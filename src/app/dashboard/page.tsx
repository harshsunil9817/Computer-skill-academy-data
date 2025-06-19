
"use client";
import { useEffect, useState } from 'react';
import { Users, DollarSign, UserPlus, TrendingUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useAppContext } from '@/lib/context/AppContext';
import type { Student, Course } from '@/lib/types';

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
};

export default function DashboardPage() {
  const { students, courses, isLoading: isAppContextLoading } = useAppContext();
  const [dashboardStats, setDashboardStats] = useState(initialDashboardStats);
  const [isCalculatingStats, setIsCalculatingStats] = useState(true);

  useEffect(() => {
    // Start loading animation for stats immediately if app context is already done loading.
    // Otherwise, wait for app context to finish.
    if (!isAppContextLoading) {
      setIsCalculatingStats(true);
    } else {
      // If app context is still loading, ensure we show calculating when it's done.
      setIsCalculatingStats(true);
      return; // Wait for app context to load data
    }

    // Proceed with calculations only if base data is available
    if (students.length > 0 && courses.length > 0) {
      const startTime = performance.now();
      console.log("Dashboard: Starting stats recalculation...");

      const courseMap = new Map<string, Course>();
      courses.forEach(course => {
        courseMap.set(course.id, course);
      });

      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      let activeStudentsCount = 0;
      let newRegistrationsThisMonthCount = 0;
      let feesDueThisMonthAgg = 0;
      let totalRevenueAgg = 0;

      students.forEach(student => {
        if (student.status === 'active' || student.status === 'enrollment_pending') {
          activeStudentsCount++;
        }

        const enrollmentDate = new Date(student.enrollmentDate);
        if (enrollmentDate.getMonth() === currentMonth && enrollmentDate.getFullYear() === currentYear) {
          newRegistrationsThisMonthCount++;
        }

        const course = courseMap.get(student.courseId);
        if (!course) return;

        if (student.status === 'active') {
          const hasPaidMonthlyFeeForCurrentMonth = student.paymentHistory.some(p => {
            if (p.type !== 'monthly' || !p.monthFor) return false;
            try {
              const [monthStr, yearStr] = p.monthFor.split(" ");
              const paymentMonthIndex = new Date(Date.parse(monthStr +" 1, 2012")).getMonth();
              return parseInt(yearStr) === currentYear && paymentMonthIndex === currentMonth;
            } catch (e) {
              console.warn(`Dashboard: Could not parse monthFor string: "${p.monthFor}" for student ${student.id}`);
              return false;
            }
          });

          if (!hasPaidMonthlyFeeForCurrentMonth) {
            feesDueThisMonthAgg += course.monthlyFee;
          }
        } else if (student.status === 'enrollment_pending') {
          feesDueThisMonthAgg += course.enrollmentFee;
        }

        student.paymentHistory.forEach(payment => {
          totalRevenueAgg += payment.amount;
        });
      });
      
      setDashboardStats({
        activeStudents: activeStudentsCount,
        feesDueThisMonth: feesDueThisMonthAgg,
        totalRevenue: totalRevenueAgg,
        newRegistrationsThisMonth: newRegistrationsThisMonthCount,
      });
      const endTime = performance.now();
      console.log(`Dashboard: Stats recalculated in ${endTime - startTime}ms`);
    } else if (!isAppContextLoading) { 
      // App context is loaded, but no students/courses
      setDashboardStats(initialDashboardStats);
      console.log("Dashboard: No students or courses after app context load, stats reset.");
    }
    
    // Always set calculating to false after attempting calculation or if no data
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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 animate-slide-in">
        <StatCard
          title="Active Students"
          value={dashboardStats.activeStudents}
          icon={Users}
          description="Total students currently enrolled."
          className="shadow-lg hover:shadow-xl transition-shadow duration-300"
          isCalculating={isCalculatingStats}
        />
        <StatCard
          title="Fees Due This Month"
          value={`₹${dashboardStats.feesDueThisMonth.toLocaleString()}`}
          icon={DollarSign}
          description="Expected income for the current month."
          className="shadow-lg hover:shadow-xl transition-shadow duration-300"
          isCalculating={isCalculatingStats}
        />
        <StatCard
          title="Total Revenue"
          value={`₹${dashboardStats.totalRevenue.toLocaleString()}`}
          icon={TrendingUp}
          description="Sum of all payments received."
          className="shadow-lg hover:shadow-xl transition-shadow duration-300"
          isCalculating={isCalculatingStats}
        />
        <StatCard
          title="New Registrations"
          value={dashboardStats.newRegistrationsThisMonth}
          icon={UserPlus}
          description="Students enrolled this month."
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
              students.slice(-3).map(s => <div key={s.id} className="py-1">{s.name} joined on {new Date(s.enrollmentDate).toLocaleDateString()}</div>)
            ) : (
              <p className="text-muted-foreground">No recent student activity to display.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
