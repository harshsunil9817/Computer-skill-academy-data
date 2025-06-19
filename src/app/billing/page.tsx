
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
import { Checkbox } from '@/components/ui/checkbox';
import { format, addMonths, isBefore, isEqual, startOfMonth, getMonth, getYear, parse } from 'date-fns';
import { cn } from '@/lib/utils'; // Added missing import

interface BillableMonth {
  monthYear: string; // "MMMM yyyy"
  dueDate: Date;
  amountPaidThisMonth: number;
  amountDueThisMonth: number;
  isFullyPaid: boolean;
  remainingDue: number;
}

interface StudentFeeItemProps {
  student: Student;
  course?: Course;
  onPayEnrollment?: (studentId: string, course: Course) => void;
  onPaySelectedMonths?: (studentId: string, course: Course, monthsToPay: { monthYear: string, amount: number }[]) => Promise<void>;
  onPayPartial?: (studentId: string, amount: number, course: Course, monthFor: string) => void;
  type: 'enrollment' | 'due' | 'paid';
}

function StudentFeeItem({ student, course, onPayEnrollment, onPaySelectedMonths, onPayPartial, type }: StudentFeeItemProps) {
  const [partialAmount, setPartialAmount] = useState('');
  const { toast } = useToast();
  const [billableMonths, setBillableMonths] = useState<BillableMonth[]>([]);
  const [selectedMonthsToPay, setSelectedMonthsToPay] = useState<Record<string, boolean>>({});

  const calculateBillableMonths = useCallback(() => {
    if (!course || student.status !== 'active') {
      setBillableMonths([]);
      return { totalDue: 0, oldestDueMonth: '', monthsDetails: [] };
    }

    const months: BillableMonth[] = [];
    let totalOverallDue = 0;
    let oldestDueMonthString = '';

    const currentDate = startOfMonth(new Date());
    const enrollmentDate = startOfMonth(new Date(student.enrollmentDate));
    let currentBillableMonthDate = addMonths(enrollmentDate, 1); // Monthly fees start from the month *after* enrollment

    while (isBefore(currentBillableMonthDate, currentDate) || isEqual(currentBillableMonthDate, currentDate)) {
      const monthStr = format(currentBillableMonthDate, "MMMM yyyy");
      
      const paymentsForThisMonth = student.paymentHistory.filter(p => 
        (p.type === 'monthly' || p.type === 'partial') && p.monthFor === monthStr
      );
      const amountPaidForThisMonth = paymentsForThisMonth.reduce((sum, p) => sum + p.amount, 0);
      const remainingDueForThisMonth = Math.max(0, course.monthlyFee - amountPaidForThisMonth);
      const isFullyPaid = remainingDueForThisMonth <= 0;

      months.push({
        monthYear: monthStr,
        dueDate: new Date(currentBillableMonthDate),
        amountPaidThisMonth: amountPaidForThisMonth,
        amountDueThisMonth: course.monthlyFee,
        isFullyPaid: isFullyPaid,
        remainingDue: remainingDueForThisMonth,
      });

      if (!isFullyPaid) {
        totalOverallDue += remainingDueForThisMonth;
        if (!oldestDueMonthString) {
          oldestDueMonthString = monthStr;
        }
      }
      currentBillableMonthDate = addMonths(currentBillableMonthDate, 1);
    }
    setBillableMonths(months.sort((a,b) => a.dueDate.getTime() - b.dueDate.getTime())); // sort oldest first
    return { totalDue: totalOverallDue, oldestDueMonth: oldestDueMonthString, monthsDetails: months };
  }, [student, course]);


  useEffect(() => {
    calculateBillableMonths();
    setSelectedMonthsToPay({}); // Reset selections when student/course changes
  }, [calculateBillableMonths]);

  const handleMonthSelectionChange = (monthYear: string, checked: boolean) => {
    setSelectedMonthsToPay(prev => ({ ...prev, [monthYear]: checked }));
  };

  const currentlySelectedMonthsForPayment = billableMonths.filter(
    bm => selectedMonthsToPay[bm.monthYear] && !bm.isFullyPaid
  );

  const totalAmountForSelectedMonths = currentlySelectedMonthsForPayment.reduce(
    (sum, bm) => sum + bm.remainingDue, 0
  );

  const handlePaySelected = async () => {
    if (!course || !onPaySelectedMonths || currentlySelectedMonthsForPayment.length === 0) return;
    const monthsToPayObjects = currentlySelectedMonthsForPayment.map(bm => ({
      monthYear: bm.monthYear,
      amount: bm.remainingDue,
    }));
    await onPaySelectedMonths(student.id, course, monthsToPayObjects);
    setSelectedMonthsToPay({}); // Clear selection after payment
    // Recalculate billable months to reflect payment
    setTimeout(calculateBillableMonths, 500); // give a slight delay for context to update if needed
  };
  
  const { oldestDueMonth } = calculateBillableMonths(); // to get oldestDueMonth for partial payment

  if (!course) return null;

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
            (type === 'due' && billableMonths.some(bm => !bm.isFullyPaid)) ? 'destructive' :
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
            <Button onClick={() => onPayEnrollment?.(student.id, course)} size="sm" className="mt-2 animate-button-click">
              <DollarSign className="mr-2 h-4 w-4" /> Mark as Paid
            </Button>
          </>
        )}
        {type === 'due' && billableMonths.length > 0 && (
          <div className="space-y-4">
            <div className="max-h-60 overflow-y-auto pr-2 space-y-2 border rounded-md p-3 bg-muted/30">
              {billableMonths.map((bm) => (
                <div key={bm.monthYear} className="flex items-center justify-between p-2 rounded-md bg-background shadow-sm">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={`${student.id}-${bm.monthYear}`}
                      checked={bm.isFullyPaid || !!selectedMonthsToPay[bm.monthYear]}
                      disabled={bm.isFullyPaid}
                      onCheckedChange={(checked) => handleMonthSelectionChange(bm.monthYear, !!checked)}
                    />
                    <Label htmlFor={`${student.id}-${bm.monthYear}`} className={cn("text-sm", bm.isFullyPaid ? "text-green-600" : "text-foreground")}>
                      {bm.monthYear}
                    </Label>
                  </div>
                  <div className="text-sm">
                    {bm.isFullyPaid ? (
                      <span className="text-green-600 font-semibold flex items-center"><CheckCircle className="h-4 w-4 mr-1"/>Paid</span>
                    ) : (
                      <>
                        <span className="text-destructive">Due: ₹{bm.remainingDue.toLocaleString()}</span>
                        {bm.amountPaidThisMonth > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">(Paid: ₹{bm.amountPaidThisMonth.toLocaleString()})</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {currentlySelectedMonthsForPayment.length > 0 && (
              <Button 
                onClick={handlePaySelected}
                size="sm" 
                className="w-full animate-button-click"
                disabled={!onPaySelectedMonths || currentlySelectedMonthsForPayment.length === 0}
              >
                <DollarSign className="mr-2 h-4 w-4" /> Pay Selected ({currentlySelectedMonthsForPayment.length} Month(s) - ₹{totalAmountForSelectedMonths.toLocaleString()})
              </Button>
            )}
            <div className="mt-3 flex space-x-2 items-end border-t pt-4">
              <div className="flex flex-col space-y-1">
                <Label htmlFor={`partial-${student.id}`} className="text-xs">Partial Payment (for {oldestDueMonth || 'oldest due'})</Label>
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
                  const targetMonthForPartial = oldestDueMonth || format(new Date(), "MMMM yyyy");
                  const monthDetail = billableMonths.find(bm => bm.monthYear === targetMonthForPartial);
                  
                  if (amount > 0 && monthDetail && amount < monthDetail.remainingDue) { 
                    onPayPartial?.(student.id, amount, course, targetMonthForPartial);
                    setPartialAmount('');
                    setTimeout(calculateBillableMonths, 500);
                  } else if (monthDetail && amount >= monthDetail.remainingDue) {
                     toast({ title: "Info", description: "Partial payment cannot be equal to or exceed the due for this month. Use 'Pay Selected' for full month payment.", variant: "default"});
                  } else {
                     toast({ title: "Error", description: "Invalid partial payment amount or no specific due month found for oldest.", variant: "destructive"});
                  }
                }}
                variant="outline"
                size="sm"
                disabled={!onPayPartial || parseFloat(partialAmount) <= 0 || !oldestDueMonth}
                className="animate-button-click"
              >
                Pay Partial
              </Button>
            </div>
          </div>
        )}
         {type === 'due' && billableMonths.length === 0 && student.status === 'active' && (
            <p className="text-green-600 flex items-center">
                <CheckCircle className="mr-2 h-5 w-5" /> All monthly dues cleared for now.
            </p>
        )}
        {type === 'paid' && (
          <p className="text-green-600 flex items-center">
            <CheckCircle className="mr-2 h-5 w-5" /> All dues cleared for now.
          </p>
        )}
      </CardContent>
    </Card>
  );
}


export default function BillingPage() {
  const { students, courses, addPayment, isLoading, updateStudent } = useAppContext(); // Added updateStudent
  const { toast } = useToast(); 
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('due');
  
  const handlePayEnrollment = async (studentId: string, course: Course) => {
    try {
      await addPayment(studentId, {
        date: new Date().toISOString(),
        amount: course.enrollmentFee,
        type: 'enrollment',
        remarks: `Enrollment fee for ${course.name}`
      });
      // Student status updates to 'active' within addPayment if type is 'enrollment'
      toast({ title: "Success", description: `${students.find(s=>s.id === studentId)?.name}'s enrollment fee paid. Status set to active.` });
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to process enrollment payment: ${error.message}`, variant: "destructive" });
    }
  };

  const handlePaySelectedMonths = async (studentId: string, course: Course, monthsToPay: { monthYear: string, amount: number }[]) => {
    if (monthsToPay.length === 0) return;
    
    try {
      for (const monthPayment of monthsToPay) {
        await addPayment(studentId, {
          date: new Date().toISOString(),
          amount: monthPayment.amount, 
          type: 'monthly', // Could be 'partial' if amount < course.monthlyFee, but 'monthly' is fine for clearing specific month dues
          monthFor: monthPayment.monthYear, 
          remarks: `Payment for ${monthPayment.monthYear} for ${course.name}`
        });
      }
      toast({ title: "Success", description: `Payments recorded for ${monthsToPay.length} selected month(s) for ${students.find(s=>s.id === studentId)?.name}.` });
    } catch (error: any) {
       toast({ title: "Error", description: `Failed to process payment for selected months: ${error.message}`, variant: "destructive" });
    }
  };
  
  const handlePayPartial = async (studentId: string, amount: number, course: Course, monthFor: string) => {
    try {
      await addPayment(studentId, {
        date: new Date().toISOString(),
        amount: amount,
        type: 'partial',
        monthFor: monthFor, 
        remarks: `Partial monthly fee for ${course.name} for ${monthFor}`
      });
      toast({ title: "Success", description: `Partial payment of ₹${amount} recorded for ${students.find(s=>s.id === studentId)?.name} for ${monthFor}.` });
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to process partial payment: ${error.message}`, variant: "destructive" });
    }
  };

  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.fatherName && student.fatherName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (student.mobile && student.mobile.includes(searchTerm))
  );

  const enrollmentPendingStudents = filteredStudents.filter(s => s.status === 'enrollment_pending');
  
  const dueFeeStudents = filteredStudents.filter(s => {
    if (s.status !== 'active') return false;
    const course = courses.find(c => c.id === s.courseId);
    if (!course) return false;

    const currentDate = startOfMonth(new Date());
    const enrollmentDate = startOfMonth(new Date(s.enrollmentDate));
    let currentBillableMonthDate = addMonths(enrollmentDate, 1);

    while (isBefore(currentBillableMonthDate, currentDate) || isEqual(currentBillableMonthDate, currentDate)) {
      const monthStr = format(currentBillableMonthDate, "MMMM yyyy");
      const paymentsForThisMonth = s.paymentHistory
        .filter(p => (p.type === 'monthly' || p.type === 'partial') && p.monthFor === monthStr);
      const amountPaidForThisMonth = paymentsForThisMonth.reduce((sum, p) => sum + p.amount, 0);

      if (amountPaidForThisMonth < course.monthlyFee) {
        return true; // At least one month has a due
      }
      currentBillableMonthDate = addMonths(currentBillableMonthDate, 1);
    }
    return false; // No dues found for any past billable month
  });

  const noDueStudents = filteredStudents.filter(s => 
    s.status === 'active' && 
    !dueFeeStudents.some(ds => ds.id === s.id) && // Check if not in dueFeeStudents array
    !enrollmentPendingStudents.some(es => es.id === s.id)
  );

  if (isLoading) {
    return <div className="text-center py-10">Loading billing data...</div>;
  }

  const renderStudentList = (list: Student[], type: 'enrollment' | 'due' | 'paid') => {
    if (list.length === 0) {
      return (
        <Card className="text-center py-8 shadow-md">
          <CardContent>
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-3">
              {type === 'enrollment' && <AlertCircle className="h-10 w-10 text-primary" />}
              {type === 'due' && <CalendarDays className="h-10 w-10 text-primary" />} {/* Changed icon for due */}
              {type === 'paid' && <CheckCircle className="h-10 w-10 text-primary" />}
            </div>
            <p className="text-muted-foreground">No students in this category {searchTerm && 'matching your search'}.</p>
          </CardContent>
        </Card>
      );
    }
    return (
      <ScrollArea className="h-[calc(100vh-28rem)] pr-3">
        {list.map(student => (
          <StudentFeeItem
            key={student.id}
            student={student}
            course={courses.find(c => c.id === student.courseId)}
            onPayEnrollment={handlePayEnrollment}
            onPaySelectedMonths={handlePaySelectedMonths}
            onPayPartial={handlePayPartial}
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
            <AlertCircle className="h-5 w-5" /><span>Enrollment Fee Pending ({enrollmentPendingStudents.length})</span>
          </TabsTrigger>
          <TabsTrigger value="due" className="flex items-center space-x-2 data-[state=active]:shadow-md">
            <CalendarDays className="h-5 w-5" /><span>Monthly Dues ({dueFeeStudents.length})</span> {/* Changed icon for due */}
          </TabsTrigger>
          <TabsTrigger value="paid" className="flex items-center space-x-2 data-[state=active]:shadow-md">
            <CheckCircle className="h-5 w-5" /><span>No Dues ({noDueStudents.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="enrollment">
          {renderStudentList(enrollmentPendingStudents, 'enrollment')}
        </TabsContent>
        <TabsContent value="due">
          {renderStudentList(dueFeeStudents, 'due')}
        </TabsContent>
        <TabsContent value="paid">
          {renderStudentList(noDueStudents, 'paid')}
        </TabsContent>
      </Tabs>
    </>
  );
}

