
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
      const courseMap = new Map<string, Course>();
      courses.forEach(course => courseMap.set(course.id, course));

      const currentDate = new Date();
      const currentMonth = getMonth(currentDate);
      const currentYearNum = getYear(currentDate);
      const currentMonthStr = format(currentDate, "MMMM yyyy");

      let activeStudentsCount = 0;
      let newRegistrationsThisMonthCount = 0;
      let feesDueThisMonthAgg = 0;
      let totalRevenueAgg = 0;
      let totalDuesAllTimeAgg = 0;

      students.forEach(student => {
        const course = courseMap.get(student.courseId);
        
        totalRevenueAgg += (student.paymentHistory || []).reduce((sum, p) => sum + p.amount, 0);

        if (student.status === 'active' || student.status === 'enrollment_pending') {
          activeStudentsCount++;
        }
        
        const enrollmentDate = parseISO(student.enrollmentDate);
        if (getMonth(enrollmentDate) === currentMonth && getYear(enrollmentDate) === currentYearNum) {
          newRegistrationsThisMonthCount++;
        }

        if (!course) return;

        // --- Calculate Fees Due This Month ---
        if (course.paymentType === 'monthly' && (student.status === 'active' || student.status === 'completed_unpaid')) {
            const courseStartDate = parseISO(student.enrollmentDate);
            const courseDurationInMonths = student.courseDurationValue * (student.courseDurationUnit === 'years' ? 12 : 1);
            const courseEndDate = addMonths(courseStartDate, courseDurationInMonths);
            
            // Check if current month is within the student's active course time
            if (!isBefore(currentDate, startOfMonth(courseStartDate)) && isBefore(startOfMonth(currentDate), courseEndDate)) {
                const paidForCurrentMonth = (student.paymentHistory || [])
                    .filter(p => p.type === 'monthly' && p.referenceId === currentMonthStr)
                    .reduce((sum, p) => sum + p.amount, 0);
                
                const dueForMonth = Math.max(0, course.monthlyFee - paidForCurrentMonth);
                feesDueThisMonthAgg += dueForMonth;
            }
        }


        // --- Calculate Total Dues All Time for this student ---
        let totalBilled = 0;
        const totalPaid = (student.paymentHistory || []).reduce((sum, p) => sum + p.amount, 0);

        totalBilled += course.enrollmentFee;
        totalBilled += (course.examFees || []).reduce((sum, fee) => sum + fee.amount, 0);
        totalBilled += (student.customFees || []).filter(f => f.status === 'due').reduce((sum, fee) => sum + fee.amount, 0);

        if (course.paymentType === 'monthly') {
            const startDate = startOfMonth(enrollmentDate);
            const endDate = new Date();
            const monthsDifference = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
            const courseDurationInMonths = student.courseDurationValue * (student.courseDurationUnit === 'years' ? 12 : 1);
            const numberOfBillableMonths = Math.min(Math.max(0, monthsDifference + 1), courseDurationInMonths);
            totalBilled += numberOfBillableMonths * course.monthlyFee;
        } else if (course.paymentType === 'installment' && student.selectedPaymentPlanName) {
            const plan = (course.paymentPlans || []).find(p => p.name === student.selectedPaymentPlanName);
            if (plan) {
                totalBilled += plan.totalAmount;
            }
        }
        
        totalDuesAllTimeAgg += Math.max(0, totalBilled - totalPaid);
      });
      
      setDashboardStats({
        activeStudents: activeStudentsCount,
        feesDueThisMonth: feesDueThisMonthAgg,
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
          description="Total unpaid monthly fees."
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
