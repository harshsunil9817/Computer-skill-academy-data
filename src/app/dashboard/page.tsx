
"use client";
import { useEffect, useState } from 'react';
import { Users, DollarSign, UserPlus, TrendingUp, Loader2, IndianRupee } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useAppContext } from '@/lib/context/AppContext';
import type { Student, Course } from '@/lib/types';
import { format, parseISO, addMonths, startOfMonth, isBefore, differenceInCalendarMonths, getMonth, getYear } from 'date-fns';

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
    if (!isAppContextLoading) {
      setIsCalculatingStats(true);
    } else {
      setIsCalculatingStats(true);
      return; 
    }

    if (students.length > 0 && courses.length > 0) {
      const startTime = performance.now();
      console.log("Dashboard: Starting stats recalculation...");

      const courseMap = new Map<string, Course>();
      courses.forEach(course => {
        courseMap.set(course.id, course);
      });

      const currentDate = new Date();
      const currentMonthStart = startOfMonth(currentDate);
      const currentMonthForFeeCheck = getMonth(currentDate);
      const currentYearForFeeCheck = getYear(currentDate);


      let activeStudentsCount = 0;
      let newRegistrationsThisMonthCount = 0;
      let feesDueThisMonthAgg = 0;
      let totalRevenueAgg = 0;
      let totalDuesAllTimeAgg = 0;

      students.forEach(student => {
        if (student.status === 'active' || student.status === 'enrollment_pending') {
          activeStudentsCount++;
        }

        const enrollmentDate = parseISO(student.enrollmentDate);
        if (enrollmentDate.getMonth() === currentMonthForFeeCheck && enrollmentDate.getFullYear() === currentYearForFeeCheck) {
          newRegistrationsThisMonthCount++;
        }

        const course = courseMap.get(student.courseId);
        if (!course) return;

        // Calculate Fees Due This Month (current calendar month)
        if (student.status === 'active') {
          const firstBillableMonthForStudent = addMonths(startOfMonth(enrollmentDate), 1);
          // Check if current month is a billable month for this student
          if (!isBefore(currentMonthStart, firstBillableMonthForStudent)) {
            // Check if course duration covers current month
            const courseDurationInMonths = student.courseDurationValue * (student.courseDurationUnit === 'years' ? 12 : 1);
            const lastBillableMonthForStudent = addMonths(firstBillableMonthForStudent, courseDurationInMonths - 1);

            if (!isBefore(lastBillableMonthForStudent, currentMonthStart)) { // current month is within course duration
                const hasPaidForCurrentMonth = student.paymentHistory.some(p => {
                if ((p.type !== 'monthly' && p.type !== 'partial') || !p.monthFor) return false;
                try {
                  // Assuming p.monthFor is "MMMM yyyy"
                  const paymentMonthDate = parseISO(`${p.monthFor.split(" ")[1]}-${new Date(Date.parse(p.monthFor.split(" ")[0] +" 1, 2012")).getMonth() + 1}-01`);
                  return getMonth(paymentMonthDate) === currentMonthForFeeCheck && getYear(paymentMonthDate) === currentYearForFeeCheck && p.amount >= course.monthlyFee;
                } catch (e) {
                  console.warn(`Dashboard: Could not parse monthFor string for current month check: "${p.monthFor}" for student ${student.id}`);
                  return false;
                }
              });
              if (!hasPaidForCurrentMonth) {
                 feesDueThisMonthAgg += course.monthlyFee; 
              }
            }
          }
        } else if (student.status === 'enrollment_pending') {
          // Enrollment fee is due this month if student is pending and enrolled this month or previous and not paid
           const enrollmentFeePaid = student.paymentHistory.filter(p => p.type === 'enrollment').reduce((sum, p) => sum + p.amount, 0);
           if (enrollmentFeePaid < course.enrollmentFee) {
             feesDueThisMonthAgg += (course.enrollmentFee - enrollmentFeePaid);
           }
        }

        // Calculate Total Revenue
        student.paymentHistory.forEach(payment => {
          totalRevenueAgg += payment.amount;
        });

        // Calculate Total Dues All Time for this student
        if (student.status === 'active' || student.status === 'enrollment_pending' || student.status === 'completed_unpaid') {
            let studentOutstandingDues = 0;
            let studentAdvanceBalance = student.paymentHistory.filter(p => p.type === 'advance').reduce((sum, p) => sum + p.amount, 0);

            // Enrollment Fee
            const enrollmentPaid = student.paymentHistory.filter(p => p.type === 'enrollment').reduce((sum, p) => sum + p.amount, 0);
            let enrollmentDue = Math.max(0, course.enrollmentFee - enrollmentPaid);

            const appliedToEnrollment = Math.min(enrollmentDue, studentAdvanceBalance);
            enrollmentDue -= appliedToEnrollment;
            studentAdvanceBalance -= appliedToEnrollment;
            studentOutstandingDues += enrollmentDue;

            // Monthly Fees up to current month
            if (!isNaN(enrollmentDate.getTime())) {
                const firstBillableMonth = addMonths(startOfMonth(enrollmentDate), 1);
                const courseDurationInMonthsTotal = student.courseDurationValue * (student.courseDurationUnit === 'years' ? 12 : 1);
                const absoluteLastBillableMonth = addMonths(firstBillableMonth, courseDurationInMonthsTotal - 1);
                
                let monthToProcess = firstBillableMonth;
                while (isBefore(monthToProcess, addMonths(currentMonthStart,1)) && isBefore(monthToProcess, addMonths(absoluteLastBillableMonth,1))) {
                    const monthYearStr = format(monthToProcess, "MMMM yyyy");
                    const paymentsForThisMonth = student.paymentHistory
                        .filter(p => (p.type === 'monthly' || p.type === 'partial') && p.monthFor === monthYearStr)
                        .reduce((sum, p) => sum + p.amount, 0);
                    
                    let remainingDueForMonth = Math.max(0, course.monthlyFee - paymentsForThisMonth);
                    
                    const appliedToMonth = Math.min(remainingDueForMonth, studentAdvanceBalance);
                    remainingDueForMonth -= appliedToMonth;
                    studentAdvanceBalance -= appliedToMonth;
                    
                    studentOutstandingDues += remainingDueForMonth;
                    monthToProcess = addMonths(monthToProcess, 1);
                }
            }
            totalDuesAllTimeAgg += studentOutstandingDues;
        }
      });
      
      setDashboardStats({
        activeStudents: activeStudentsCount,
        feesDueThisMonth: feesDueThisMonthAgg,
        totalRevenue: totalRevenueAgg,
        newRegistrationsThisMonth: newRegistrationsThisMonthCount,
        totalDuesAllTime: totalDuesAllTimeAgg,
      });
      const endTime = performance.now();
      console.log(`Dashboard: Stats recalculated in ${endTime - startTime}ms`);
    } else if (!isAppContextLoading) { 
      setDashboardStats(initialDashboardStats);
      console.log("Dashboard: No students or courses after app context load, stats reset.");
    }
    
    if (!isAppContextLoading) {
        setIsCalculatingStats(false);
    }

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
          description="Expected current month."
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

