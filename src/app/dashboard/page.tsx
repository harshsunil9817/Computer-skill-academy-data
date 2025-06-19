
"use client";
import { useEffect, useState } from 'react';
import { Users, DollarSign, UserPlus, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useAppContext } from '@/lib/context/AppContext';
import type { Student } from '@/lib/types';

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
    if (!isLoading && students.length > 0) {
      const activeStudents = students.filter(s => s.status === 'active' || s.status === 'enrollment_pending').length;
      
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth();
      const currentYear = currentDate.getFullYear();

      const newRegistrationsThisMonth = students.filter(student => {
        const enrollmentDate = new Date(student.enrollmentDate);
        return enrollmentDate.getMonth() === currentMonth && enrollmentDate.getFullYear() === currentYear;
      }).length;

      let feesDueThisMonth = 0;
      let totalRevenue = 0;

      students.forEach(student => {
        const course = courses.find(c => c.id === student.courseId);
        if (!course) return;

        // Calculate fees due
        // This is a simplified calculation. Real-world would need more complex logic.
        if (student.status === 'active') {
          const lastPaymentForThisMonth = student.paymentHistory
            .filter(p => p.type === 'monthly')
            .find(p => {
              const paymentDate = new Date(p.date);
              return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
            });
          if (!lastPaymentForThisMonth) {
            feesDueThisMonth += course.monthlyFee;
          }
        } else if (student.status === 'enrollment_pending') {
            feesDueThisMonth += course.enrollmentFee;
        }


        // Calculate total revenue
        student.paymentHistory.forEach(payment => {
          totalRevenue += payment.amount;
        });
      });
      
      setDashboardStats({
        activeStudents,
        feesDueThisMonth,
        totalRevenue,
        newRegistrationsThisMonth,
      });
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
        {/* Placeholder for future charts or more detailed info */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Detailed activity logs and charts will be displayed here.</p>
            {/* Example: List last 5 new students or payments */}
            {students.slice(-3).map(s => <div key={s.id} className="py-1">{s.name} joined on {new Date(s.enrollmentDate).toLocaleDateString()}</div>)}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
