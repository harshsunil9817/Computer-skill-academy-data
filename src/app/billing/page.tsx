
"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, CheckCircle, AlertCircle, Search, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { useAppContext } from '@/lib/context/AppContext';
import type { Student, Course, PaymentRecord } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format, addMonths, isBefore, isEqual, startOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

interface BillableMonthDetail {
  monthYear: string; // "MMMM yyyy"
  dueDate: Date;
  amountPaidThisMonth: number;
  feeForMonth: number;
  isFullyPaid: boolean;
  remainingDue: number;
}

interface StudentFeeItemProps {
  student: Student;
  course?: Course;
  onPayEnrollment?: (studentId: string, course: Course) => Promise<void>;
  onPayFullMonthlyDues?: (studentId: string, courseId: string) => Promise<void>; // Changed signature
  onPayPartialMonthlyDues?: (studentId: string, course: Course, amount: number, oldestDueMonth: string) => Promise<void>;
  type: 'enrollment' | 'due' | 'paid';
}

function StudentFeeItem({
  student,
  course,
  onPayEnrollment,
  onPayFullMonthlyDues,
  onPayPartialMonthlyDues,
  type,
}: StudentFeeItemProps) {
  const { toast } = useToast();
  const [partialAmount, setPartialAmount] = useState('');
  const [billableMonths, setBillableMonths] = useState<BillableMonthDetail[]>([]);
  const [totalMonthlyDuesForStudent, setTotalMonthlyDuesForStudent] = useState(0);
  const [oldestDueMonthForPartial, setOldestDueMonthForPartial] = useState("");

  useEffect(() => {
    if (course && student.status === 'active') {
      const months: BillableMonthDetail[] = [];
      const currentDate = startOfMonth(new Date());
      // Ensure enrollmentDate is correctly parsed. If it's already a Date object, new Date() is fine.
      // If it's an ISO string (which it should be from context), new Date() is also fine.
      const enrollmentDate = startOfMonth(new Date(student.enrollmentDate));
      let currentBillableMonthDate = addMonths(enrollmentDate, 1);

      while (isBefore(currentBillableMonthDate, currentDate) || isEqual(currentBillableMonthDate, currentDate)) {
        const monthStr = format(currentBillableMonthDate, "MMMM yyyy");
        const paymentsForThisMonth = student.paymentHistory.filter(p =>
          (p.type === 'monthly' || p.type === 'partial') && p.monthFor === monthStr
        );
        const amountPaidForThisMonth = paymentsForThisMonth.reduce((sum, p) => sum + p.amount, 0);
        const remainingDueForThisMonth = Math.max(0, course.monthlyFee - amountPaidForThisMonth);

        months.push({
          monthYear: monthStr,
          dueDate: new Date(currentBillableMonthDate),
          amountPaidThisMonth: amountPaidForThisMonth,
          feeForMonth: course.monthlyFee,
          isFullyPaid: remainingDueForThisMonth <= 0,
          remainingDue: remainingDueForThisMonth,
        });
        currentBillableMonthDate = addMonths(currentBillableMonthDate, 1);
      }
      months.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      setBillableMonths(months);

      const totalDue = months.reduce((sum, m) => sum + m.remainingDue, 0);
      setTotalMonthlyDuesForStudent(totalDue);

      const firstUnpaid = months.find(m => !m.isFullyPaid);
      setOldestDueMonthForPartial(firstUnpaid ? firstUnpaid.monthYear : "");

    } else {
      setBillableMonths([]);
      setTotalMonthlyDuesForStudent(0);
      setOldestDueMonthForPartial("");
    }
  }, [student, course, student.paymentHistory, type]); // Added type to dependencies

  if (!course) return null;
  if (type === 'enrollment' && student.status !== 'enrollment_pending') return null;
  if (type === 'due' && student.status !== 'active') return null;
  if (type === 'paid' && student.status !== 'active') return null;
  if (type === 'due' && student.status === 'active' && totalMonthlyDuesForStudent <= 0) return null;
  if (type === 'paid' && student.status === 'active' && totalMonthlyDuesForStudent > 0) return null;

  return (
    <Card className="mb-6 shadow-md hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="font-headline text-primary">{student.name}</CardTitle>
            <CardDescription>Course: {course.name} | Enrolled: {new Date(student.enrollmentDate).toLocaleDateString()}</CardDescription>
          </div>
          <Badge variant={
            student.status === 'enrollment_pending' ? 'destructive' :
            (type === 'due' && totalMonthlyDuesForStudent > 0) ? 'destructive' :
            'default'
          } className="capitalize">
            {student.status.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {type === 'enrollment' && student.status === 'enrollment_pending' && (
          <>
            <p>Enrollment Fee Due: <span className="font-semibold">₹{course.enrollmentFee.toLocaleString()}</span></p>
            <Button
              onClick={() => onPayEnrollment?.(student.id, course)}
              size="sm"
              className="mt-2 animate-button-click"
              disabled={!onPayEnrollment}
            >
              <DollarSign className="mr-2 h-4 w-4" /> Mark Enrollment Paid
            </Button>
          </>
        )}
        {type === 'due' && student.status === 'active' && totalMonthlyDuesForStudent > 0 && (
          <div className="space-y-4">
            <p>Total Monthly Dues: <span className="font-semibold text-destructive">₹{totalMonthlyDuesForStudent.toLocaleString()}</span></p>
            <Button
              onClick={() => {
                if (onPayFullMonthlyDues && course) {
                  onPayFullMonthlyDues(student.id, course.id); // Changed: Pass IDs
                }
              }}
              size="sm"
              className="w-full animate-button-click"
              disabled={!onPayFullMonthlyDues || totalMonthlyDuesForStudent <= 0}
            >
              <DollarSign className="mr-2 h-4 w-4" /> Pay Full Monthly Dues (₹{totalMonthlyDuesForStudent.toLocaleString()})
            </Button>

            <div className="mt-3 flex space-x-2 items-end border-t pt-4">
              <div className="flex flex-col space-y-1">
                <Label htmlFor={`partial-${student.id}`} className="text-xs">Partial Payment (for {oldestDueMonthForPartial || 'oldest due'})</Label>
                <Input
                  id={`partial-${student.id}`}
                  type="number"
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  placeholder="Amount"
                  className="w-32 h-9"
                />
              </div>
              <Button
                onClick={() => {
                  const amount = parseFloat(partialAmount);
                  if (amount > 0 && oldestDueMonthForPartial && onPayPartialMonthlyDues) {
                     if (amount <= totalMonthlyDuesForStudent) {
                        onPayPartialMonthlyDues(student.id, course, amount, oldestDueMonthForPartial);
                        setPartialAmount('');
                     } else {
                        toast({ title: "Info", description: "Partial amount cannot be greater than total due.", variant: "default"});
                     }
                  } else if (amount <= 0) {
                     toast({ title: "Error", description: "Partial payment amount must be positive.", variant: "destructive"});
                  } else if (!oldestDueMonthForPartial) {
                     toast({ title: "Info", description: "No specific oldest due month identified for partial payment, or all dues cleared.", variant: "default"});
                  }
                }}
                variant="outline"
                size="sm"
                disabled={!onPayPartialMonthlyDues || parseFloat(partialAmount) <= 0 || !oldestDueMonthForPartial}
                className="animate-button-click"
              >
                Pay Partial
              </Button>
            </div>
          </div>
        )}
         {type === 'paid' && student.status === 'active' && totalMonthlyDuesForStudent <= 0 && (
            <p className="text-green-600 flex items-center">
                <CheckCircle className="mr-2 h-5 w-5" /> All monthly dues cleared for now.
            </p>
        )}
      </CardContent>
    </Card>
  );
}


export default function BillingPage() {
  const { students, courses, addPayment, isLoading } = useAppContext();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('due');

  const handlePayEnrollment = async (studentId: string, course: Course) => {
    const studentName = students.find(s=>s.id === studentId)?.name || 'Student';
    try {
      await addPayment(studentId, {
        date: new Date().toISOString(),
        amount: course.enrollmentFee,
        type: 'enrollment',
        remarks: `Enrollment fee for ${course.name}`
      });
      toast({ title: "Success", description: `${studentName}'s enrollment fee paid. Status set to active.` });
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to process enrollment payment for ${studentName}: ${error.message}`, variant: "destructive" });
    }
  };

  const handlePayFullMonthlyDues = async (studentId: string, courseId: string) => {
    const student = students.find(s => s.id === studentId);
    const course = courses.find(c => c.id === courseId);

    if (!student || !course) {
        toast({ title: "Error", description: "Student or course data not found for full payment.", variant: "destructive" });
        return;
    }
    
    const studentName = student.name;
    let paymentsMadeCount = 0;
    let totalAmountPaidThisAction = 0;

    // Recalculate billable months with dues AT THE TIME OF CLICK using current student data
    const monthsToPayNow: BillableMonthDetail[] = [];
    const currentDate = startOfMonth(new Date());
    const enrollmentDate = startOfMonth(new Date(student.enrollmentDate));
    let currentBillableMonthDate = addMonths(enrollmentDate, 1);

    while (isBefore(currentBillableMonthDate, currentDate) || isEqual(currentBillableMonthDate, currentDate)) {
        const monthStr = format(currentBillableMonthDate, "MMMM yyyy");
        const paymentsForThisMonth = student.paymentHistory.filter(p =>
            (p.type === 'monthly' || p.type === 'partial') && p.monthFor === monthStr
        );
        const amountPaidForThisMonth = paymentsForThisMonth.reduce((sum, p) => sum + p.amount, 0);
        const remainingDueForThisMonth = Math.max(0, course.monthlyFee - amountPaidForThisMonth);

        if (remainingDueForThisMonth > 0) {
            monthsToPayNow.push({
                monthYear: monthStr,
                dueDate: new Date(currentBillableMonthDate),
                amountPaidThisMonth: amountPaidForThisMonth,
                feeForMonth: course.monthlyFee,
                isFullyPaid: false,
                remainingDue: remainingDueForThisMonth,
            });
        }
        currentBillableMonthDate = addMonths(currentBillableMonthDate, 1);
    }

    if (monthsToPayNow.length === 0) {
        toast({ title: "Info", description: `No outstanding monthly dues to pay for ${studentName}.`, variant: "default" });
        return;
    }

    try {
      for (const month of monthsToPayNow) {
        if (month.remainingDue > 0) { // Double check, though list is already filtered
          await addPayment(studentId, {
            date: new Date().toISOString(),
            amount: month.remainingDue,
            type: 'monthly',
            monthFor: month.monthYear,
            remarks: `Payment for ${month.monthYear} for ${course.name} (part of full dues settlement)`
          });
          paymentsMadeCount++;
          totalAmountPaidThisAction += month.remainingDue;
        }
      }
      if (paymentsMadeCount > 0) {
        toast({ title: "Success", description: `Paid ₹${totalAmountPaidThisAction.toLocaleString()} for ${paymentsMadeCount} month(s) for ${studentName}. Dues settled.` });
      } else {
        toast({ title: "Info", description: `No outstanding dues were found to pay for ${studentName}.`, variant: "default" });
      }
    } catch (error: any) {
       toast({ title: "Error", description: `Failed to process full monthly dues payment for ${studentName}: ${error.message}`, variant: "destructive" });
    }
  };

  const handlePayPartialMonthlyDues = async (studentId: string, course: Course, amount: number, oldestDueMonth: string) => {
    const studentName = students.find(s=>s.id === studentId)?.name || 'Student';
    try {
      await addPayment(studentId, {
        date: new Date().toISOString(),
        amount: amount,
        type: 'partial',
        monthFor: oldestDueMonth,
        remarks: `Partial payment for ${oldestDueMonth} for ${course.name}`
      });
      toast({ title: "Success", description: `Partial payment of ₹${amount.toLocaleString()} recorded for ${studentName} for ${oldestDueMonth}.` });
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to process partial payment for ${studentName}: ${error.message}`, variant: "destructive" });
    }
  };
  
  // This function is primarily for filtering students into lists.
  const calculateStudentTotalMonthlyDue = useCallback((student: Student, course: Course | undefined): number => {
    if (!course || student.status !== 'active') {
      return 0;
    }

    let totalDue = 0;
    const currentDate = startOfMonth(new Date());
    const enrollmentDate = startOfMonth(new Date(student.enrollmentDate));
    let currentBillableMonthDate = addMonths(enrollmentDate, 1);

    while (isBefore(currentBillableMonthDate, currentDate) || isEqual(currentBillableMonthDate, currentDate)) {
      const monthStr = format(currentBillableMonthDate, "MMMM yyyy");
      const paymentsForThisMonth = student.paymentHistory.filter(p =>
        (p.type === 'monthly' || p.type === 'partial') && p.monthFor === monthStr
      );
      const amountPaidForThisMonth = paymentsForThisMonth.reduce((sum, p) => sum + p.amount, 0);
      const remainingDueForThisMonth = Math.max(0, course.monthlyFee - amountPaidForThisMonth);
      totalDue += remainingDueForThisMonth;
      currentBillableMonthDate = addMonths(currentBillableMonthDate, 1);
    }
    return totalDue;
  }, []);


  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.fatherName && student.fatherName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (student.mobile && student.mobile.includes(searchTerm))
  );

  const enrollmentPendingStudents = filteredStudents.filter(s => s.status === 'enrollment_pending');

  const dueFeeStudentsDetails = filteredStudents
    .filter(s => s.status === 'active')
    .map(s => {
        const course = courses.find(c => c.id === s.courseId);
        const totalMonthlyDue = calculateStudentTotalMonthlyDue(s, course);
        return { student: s, course, totalMonthlyDue, hasDues: totalMonthlyDue > 0 };
    })
    .filter(details => details.hasDues);

  const noDueStudentsDetails = filteredStudents
    .filter(s => s.status === 'active')
    .map(s => {
        const course = courses.find(c => c.id === s.courseId);
        const totalMonthlyDue = calculateStudentTotalMonthlyDue(s, course);
        return { student: s, course, totalMonthlyDue, hasNoDues: totalMonthlyDue <= 0 };
    })
    .filter(details => details.hasNoDues && !enrollmentPendingStudents.some(es => es.id === details.student.id));


  if (isLoading) {
    return <div className="text-center py-10">Loading billing data...</div>;
  }

  const renderStudentList = (
      list: Array<{student: Student, course?: Course }>, // Removed totalMonthlyDue from here as StudentFeeItem handles it
      type: 'enrollment' | 'due' | 'paid'
    ) => {
    if (list.length === 0) {
      return (
        <Card className="text-center py-8 shadow-md">
          <CardContent>
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-3">
              {type === 'enrollment' && <AlertCircle className="h-10 w-10 text-primary" />}
              {type === 'due' && <CalendarDays className="h-10 w-10 text-primary" />}
              {type === 'paid' && <CheckCircle className="h-10 w-10 text-primary" />}
            </div>
            <p className="text-muted-foreground">No students in this category {searchTerm && 'matching your search'}.</p>
          </CardContent>
        </Card>
      );
    }
    return (
      <ScrollArea className="h-[calc(100vh-28rem)] pr-3">
        {list.map(item => (
          <StudentFeeItem
            key={item.student.id}
            student={item.student}
            course={item.course}
            onPayEnrollment={type === 'enrollment' ? handlePayEnrollment : undefined}
            onPayFullMonthlyDues={type === 'due' ? handlePayFullMonthlyDues : undefined}
            onPayPartialMonthlyDues={type === 'due' ? handlePayPartialMonthlyDues : undefined}
            type={type}
          />
        ))}
      </ScrollArea>
    );
  };

  return (
    <>
      <PageHeader title="Billing Management" description="Track student fees, payments, and dues." />

      <div className="mb-6 flex space-x-4">
        <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
                placeholder="Search students by name, father's name, mobile..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
            />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-slide-in">
        <TabsList className="grid w-full grid-cols-3 mb-6 shadow-sm">
          <TabsTrigger value="enrollment" className="flex items-center space-x-2 data-[state=active]:shadow-md">
            <AlertCircle className="h-5 w-5" /><span>Enrollment Pending ({enrollmentPendingStudents.length})</span>
          </TabsTrigger>
          <TabsTrigger value="due" className="flex items-center space-x-2 data-[state=active]:shadow-md">
            <CalendarDays className="h-5 w-5" /><span>Monthly Dues ({dueFeeStudentsDetails.length})</span>
          </TabsTrigger>
          <TabsTrigger value="paid" className="flex items-center space-x-2 data-[state=active]:shadow-md">
            <CheckCircle className="h-5 w-5" /><span>No Dues ({noDueStudentsDetails.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="enrollment">
          {renderStudentList(enrollmentPendingStudents.map(s => ({ student: s, course: courses.find(c => c.id === s.courseId) })), 'enrollment')}
        </TabsContent>
        <TabsContent value="due">
          {renderStudentList(dueFeeStudentsDetails.map(item => ({student: item.student, course: item.course})), 'due')}
        </TabsContent>
        <TabsContent value="paid">
          {renderStudentList(noDueStudentsDetails.map(item => ({student: item.student, course: item.course})), 'paid')}
        </TabsContent>
      </Tabs>
    </>
  );
}
