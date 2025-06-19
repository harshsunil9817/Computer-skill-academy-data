
"use client";
import { useEffect, useState } from 'react';
import { Users, DollarSign, UserPlus, TrendingUp } from 'lucide-react';
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
}

function StatCard({ title, value, icon: Icon, description, className }: StatCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}


export default function DashboardPage() {
  const { students, courses, isLoading } = useAppContext();
  const [dashboardStats, setDashboardStats] = useState({
    activeStudents: 0,
    feesDueThisMonth: 0,
    totalRevenue: 0,
    newRegistrationsThisMonth: 0,
  });

  useEffect(() => {
    if (!isLoading && students.length > 0 && courses.length > 0) {
      const startTime = performance.now();

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
          // Enrollment fee is considered due if status is enrollment_pending
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
    } else if (!isLoading && (students.length === 0 || courses.length === 0)) {
      // Reset stats if loading is done but no data
      setDashboardStats({
        activeStudents: 0,
        feesDueThisMonth: 0,
        totalRevenue: 0,
        newRegistrationsThisMonth: 0,
      });
      console.log("Dashboard: No students or courses, stats reset.");
    }
  }, [students, courses, isLoading]);

  if (isLoading) {
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
        />
        <StatCard
          title="Fees Due This Month"
          value={`₹${dashboardStats.feesDueThisMonth.toLocaleString()}`}
          icon={DollarSign}
          description="Expected income for the current month."
          className="shadow-lg hover:shadow-xl transition-shadow duration-300"
        />
        <StatCard
          title="Total Revenue"
          value={`₹${dashboardStats.totalRevenue.toLocaleString()}`}
          icon={TrendingUp}
          description="Sum of all payments received."
          className="shadow-lg hover:shadow-xl transition-shadow duration-300"
        />
        <StatCard
          title="New Registrations"
          value={dashboardStats.newRegistrationsThisMonth}
          icon={UserPlus}
          description="Students enrolled this month."
          className="shadow-lg hover:shadow-xl transition-shadow duration-300"
        />
      </div>
      <div className="mt-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Detailed activity logs and charts will be displayed here.</p>
            {students.slice(-3).map(s => <div key={s.id} className="py-1">{s.name} joined on {new Date(s.enrollmentDate).toLocaleDateString()}</div>)}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
