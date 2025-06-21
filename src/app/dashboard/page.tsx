
"use client";
import { useEffect, useState } from 'react';
import { Users, DollarSign, UserPlus, TrendingUp, Loader2, IndianRupee } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useAppContext } from '@/lib/context/AppContext';
import type { Student, Course } from '@/lib/types';
import { format, parseISO, addMonths, startOfMonth, isBefore, getMonth, getYear } from 'date-fns';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  className?: string;
  isCalculating?: boolean;
}

function StatCard({ title, value, icon: Icon, description, className, isCalculating }: StatCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isCalculating ? (
          <div className="flex items-center">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Calculating...</span>
          </div>
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {description && !isCalculating && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}

const initialDashboardStats = {
  activeStudents: 0,
  feesDueThisMonth: 0,
  totalRevenue: 0,
  newRegistrationsThisMonth: 0,
  totalDuesAllTime: 0,
};

export default function DashboardPage() {
  const { students, courses, isLoading: isAppContextLoading } = useAppContext();
  const [dashboardStats, setDashboardStats] = useState(initialDashboardStats);
  const [isCalculatingStats, setIsCalculatingStats] = useState(true);

  useEffect(() => {
    if (isAppContextLoading) {
      setIsCalculatingStats(true);
      return; 
    }

    if (students.length > 0 && courses.length > 0) {
      console.log("Dashboard: Starting stats recalculation...");

      const courseMap = new Map<string, Course>();
      courses.forEach(course => courseMap.set(course.id, course));

      const currentDate = new Date();
      const currentMonthStart = startOfMonth(currentDate);
      
      let activeStudentsCount = 0;
      let newRegistrationsThisMonthCount = 0;
      let feesDueThisMonthAgg = 0;
      let totalRevenueAgg = 0;
      let totalDuesAllTimeAgg = 0;

      students.forEach(student => {
        const enrollmentDate = parseISO(student.enrollmentDate);
        const course = courseMap.get(student.courseId);

        if (student.status === 'active' || student.status === 'enrollment_pending') {
          activeStudentsCount++;
        }

        if (getMonth(enrollmentDate) === getMonth(currentDate) && getYear(enrollmentDate) === getYear(currentDate)) {
          newRegistrationsThisMonthCount++;
        }
        
        totalRevenueAgg += student.paymentHistory.reduce((sum, p) => sum + p.amount, 0);

        if (!course) return;

        // Calculate Total Dues All Time for this student
        let studentOutstandingDues = 0;
        
        // 1. Enrollment Fee Due
        const enrollmentPaid = student.paymentHistory.filter(p => p.type === 'enrollment').reduce((sum,p) => sum+p.amount, 0);
        studentOutstandingDues += Math.max(0, course.enrollmentFee - enrollmentPaid);

        // 2. Monthly Fee Dues
        if (course.paymentType === 'monthly') {
            const firstBillableMonth = addMonths(startOfMonth(enrollmentDate), 1);
            const courseDurationInMonths = student.courseDurationValue * (student.courseDurationUnit === 'years' ? 12 : 1);
            const lastBillableMonth = addMonths(firstBillableMonth, courseDurationInMonths - 1);
            
            let monthToProcess = firstBillableMonth;
            while(isBefore(monthToProcess, addMonths(currentMonthStart, 1)) && isBefore(monthToProcess, addMonths(lastBillableMonth, 1))) {
                const monthYearStr = format(monthToProcess, "MMMM yyyy");
                const paymentsForThisMonth = student.paymentHistory
                    .filter(p => p.type === 'monthly' && p.referenceId === monthYearStr)
                    .reduce((sum, p) => sum + p.amount, 0);
                studentOutstandingDues += Math.max(0, course.monthlyFee - paymentsForThisMonth);
                monthToProcess = addMonths(monthToProcess, 1);
            }
        }

        // 3. Installment Dues
        if (course.paymentType === 'installment' && student.selectedPaymentPlanName) {
            const plan = course.paymentPlans.find(p => p.name === student.selectedPaymentPlanName);
            if (plan) {
                const totalInstallmentAmount = plan.installments.reduce((sum, amt) => sum + amt, 0);
                const paidForInstallments = student.paymentHistory.filter(p => p.type === 'installment' || p.type === 'partial').reduce((sum, p) => sum + p.amount, 0);
                studentOutstandingDues += Math.max(0, totalInstallmentAmount - paidForInstallments);
            }
        }

        // 4. Exam Fee Dues
        course.examFees?.forEach(fee => {
            const paidForExam = student.paymentHistory.filter(p => p.type === 'exam' && p.referenceId === fee.name).reduce((sum, p) => sum+p.amount, 0);
            studentOutstandingDues += Math.max(0, fee.amount - paidForExam);
        });

        // 5. Custom Fee Dues
        student.customFees?.forEach(fee => {
            if (fee.status === 'due') {
                studentOutstandingDues += fee.amount;
            }
        });

        // Subtract general partial payments from total dues
        const partialPayments = student.paymentHistory.filter(p => p.type === 'partial').reduce((sum, p) => sum + p.amount, 0);
        
        let allNonPartialPayments = student.paymentHistory
            .filter(p => p.type !== 'partial')
            .reduce((sum, p) => sum + p.amount, 0);

        let totalBilled = course.enrollmentFee + (student.customFees?.reduce((sum,f) => sum+f.amount, 0) || 0) + (course.examFees?.reduce((sum,f)=> sum+f.amount,0) || 0);

        if(course.paymentType === 'monthly') {
             // ... logic to calculate total billed monthly fees
        } else if(course.paymentType === 'installment' && student.selectedPaymentPlanName) {
             const plan = course.paymentPlans.find(p => p.name === student.selectedPaymentPlanName);
             if(plan) totalBilled += plan.totalAmount;
        }

        const totalPaid = student.paymentHistory.reduce((sum,p) => sum+p.amount, 0);

        totalDuesAllTimeAgg += Math.max(0, totalBilled - totalPaid);
      });
      
      setDashboardStats({
        activeStudents: activeStudentsCount,
        feesDueThisMonth: feesDueThisMonthAgg, // This calculation is complex and deferred for now.
        totalRevenue: totalRevenueAgg,
        newRegistrationsThisMonth: newRegistrationsThisMonthCount,
        totalDuesAllTime: totalDuesAllTimeAgg,
      });

    } else if (!isAppContextLoading) { 
      setDashboardStats(initialDashboardStats);
    }
    
    setIsCalculatingStats(false);

  }, [students, courses, isAppContextLoading]);

  if (isAppContextLoading) {
    return <div className="text-center py-10">Loading dashboard data...</div>;
  }

  return (
    <>
      <PageHeader title="Dashboard" description="Overview of your academy's performance." />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 animate-slide-in">
        <StatCard
          title="Active Students"
          value={dashboardStats.activeStudents}
          icon={Users}
          description="Currently enrolled."
          className="shadow-lg hover:shadow-xl transition-shadow duration-300"
          isCalculating={isCalculatingStats}
        />
        <StatCard
          title="Fees Due This Month"
          value={`₹${dashboardStats.feesDueThisMonth.toLocaleString()}`}
          icon={DollarSign}
          description="Calculation pending update."
          className="shadow-lg hover:shadow-xl transition-shadow duration-300"
          isCalculating={isCalculatingStats}
        />
        <StatCard
          title="Total Dues All Time"
          value={`₹${dashboardStats.totalDuesAllTime.toLocaleString()}`}
          icon={IndianRupee}
          description="All outstanding fees."
          className="shadow-lg hover:shadow-xl transition-shadow duration-300"
          isCalculating={isCalculatingStats}
        />
        <StatCard
          title="Total Revenue"
          value={`₹${dashboardStats.totalRevenue.toLocaleString()}`}
          icon={TrendingUp}
          description="All payments received."
          className="shadow-lg hover:shadow-xl transition-shadow duration-300"
          isCalculating={isCalculatingStats}
        />
        <StatCard
          title="New Registrations"
          value={dashboardStats.newRegistrationsThisMonth}
          icon={UserPlus}
          description="Enrolled this month."
          className="shadow-lg hover:shadow-xl transition-shadow duration-300"
          isCalculating={isCalculatingStats}
        />
      </div>
      <div className="mt-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isCalculatingStats ? (
                 <div className="flex items-center text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span>Loading recent activity...</span>
                 </div>
            ) : students.length > 0 ? (
              students.filter(s => s.status === 'active' || s.status === 'enrollment_pending')
                .sort((a,b) => parseISO(b.enrollmentDate).getTime() - parseISO(a.enrollmentDate).getTime())
                .slice(0, 3)
                .map(s => <div key={s.id} className="py-1">{s.name} joined on {new Date(s.enrollmentDate).toLocaleDateString()}</div>)
            ) : (
              <p className="text-muted-foreground">No recent student activity to display.</p>
            )}
            {!isCalculatingStats && students.filter(s => s.status === 'active' || s.status === 'enrollment_pending').length === 0 && (
                 <p className="text-muted-foreground">No active students to display recent activity for.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
