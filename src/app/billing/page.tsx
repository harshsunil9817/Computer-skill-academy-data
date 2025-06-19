
"use client";
import React, { useState, useEffect } from 'react';
import { DollarSign, CheckCircle, AlertCircle, Search } from 'lucide-react';
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
import { format } from 'date-fns';


interface StudentFeeItemProps {
  student: Student;
  course?: Course;
  onPayEnrollment?: (studentId: string, course: Course) => void;
  onPayMonthly?: (studentId: string, amount: number, course: Course) => void;
  onPayPartial?: (studentId: string, amount: number, course: Course) => void;
  type: 'enrollment' | 'due' | 'paid';
}

function StudentFeeItem({ student, course, onPayEnrollment, onPayMonthly, onPayPartial, type }: StudentFeeItemProps) {
  const [partialAmount, setPartialAmount] = useState('');
  const { toast } = useToast(); // Renamed to avoid conflict with AppContext's toast if used directly here

  if (!course) return null;

  const getDueAmount = () => {
    if (!course) return 0;

    if (type === 'enrollment') {
      return course.enrollmentFee;
    }

    if (type === 'due' && student.status === 'active') {
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0); 
      
      const enrollmentDate = new Date(student.enrollmentDate);
      enrollmentDate.setHours(0,0,0,0);

      let expectedMonthlyPaymentCycles = 0;
      let nextBillingCycleStartDate = new Date(enrollmentDate.getFullYear(), enrollmentDate.getMonth() + 1, 1);

      while (nextBillingCycleStartDate <= currentDate) {
        const paymentForThisCycle = student.paymentHistory.find(p => 
            (p.type === 'monthly' || p.type === 'partial') && 
            p.monthFor && 
            new Date(p.monthFor).getFullYear() === nextBillingCycleStartDate.getFullYear() &&
            new Date(p.monthFor).getMonth() === nextBillingCycleStartDate.getMonth()
        );
        
        if (!paymentForThisCycle) { // Only count cycles if not paid
             expectedMonthlyPaymentCycles++;
        } else if (paymentForThisCycle.type === 'partial' && paymentForThisCycle.amount < course.monthlyFee){
            // If partially paid for the cycle, it's still considered due for remaining.
            // This logic might need adjustment based on how partials are treated towards "due count".
            // For simplicity, this example will count a partially paid month as "needing payment"
            // The actual due *amount* will be handled below.
            // A more sophisticated system might track specific months and their exact due amounts.
        }

        nextBillingCycleStartDate.setMonth(nextBillingCycleStartDate.getMonth() + 1);
      }
      
      let totalDue = 0;
      // Recalculate due amount based on expected cycles and payments
      nextBillingCycleStartDate = new Date(enrollmentDate.getFullYear(), enrollmentDate.getMonth() + 1, 1); // Reset for due calculation
       while (nextBillingCycleStartDate <= currentDate) {
        const paymentsForMonth = student.paymentHistory
          .filter(p => (p.type === 'monthly' || p.type === 'partial') && p.monthFor && 
                       new Date(p.monthFor).getFullYear() === nextBillingCycleStartDate.getFullYear() &&
                       new Date(p.monthFor).getMonth() === nextBillingCycleStartDate.getMonth());
        
        const amountPaidForMonth = paymentsForMonth.reduce((sum, p) => sum + p.amount, 0);

        if (amountPaidForMonth < course.monthlyFee) {
          totalDue += (course.monthlyFee - amountPaidForMonth);
        }
        nextBillingCycleStartDate.setMonth(nextBillingCycleStartDate.getMonth() + 1);
      }
      return totalDue;
    }
    return 0; 
  };

  const dueAmount = getDueAmount();

  return (
    <Card className="mb-4 shadow-md hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="font-headline text-primary">{student.name}</CardTitle>
            <CardDescription>Course: {course.name} | Enrolled: {new Date(student.enrollmentDate).toLocaleDateString()}</CardDescription>
          </div>
          <Badge variant={
            student.status === 'enrollment_pending' ? 'destructive' :
            (dueAmount > 0 && type === 'due') ? 'destructive' :
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
        {type === 'due' && dueAmount > 0 && (
          <>
            <p>Monthly Fee Due: <span className="font-semibold">₹{dueAmount.toLocaleString()}</span></p>
            <div className="mt-3 flex space-x-2 items-end">
              <Button onClick={() => onPayMonthly?.(student.id, dueAmount, course)} size="sm" className="animate-button-click">
                <DollarSign className="mr-2 h-4 w-4" /> Pay Full Due ({/* Number of months due could be displayed here */})
              </Button>
              <div className="flex flex-col space-y-1">
                <Label htmlFor={`partial-${student.id}`} className="text-xs">Partial Payment (₹)</Label>
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
                  if (amount > 0 && amount < dueAmount) { 
                    onPayPartial?.(student.id, amount, course);
                    setPartialAmount('');
                  } else if (amount >= dueAmount) {
                     toast({ title: "Info", description: "Partial payment cannot be equal to or exceed the full due amount. Use 'Pay Full Due' instead.", variant: "default"});
                  } else {
                     toast({ title: "Error", description: "Invalid partial payment amount.", variant: "destructive"});
                  }
                }}
                variant="outline"
                size="sm"
                disabled={parseFloat(partialAmount) <= 0 || parseFloat(partialAmount) >= dueAmount}
                className="animate-button-click"
              >
                Pay Partial
              </Button>
            </div>
          </>
        )}
        {type === 'paid' && (
          <p className="text-green-600 flex items-center">
            <CheckCircle className="mr-2 h-5 w-5" /> All dues cleared for now.
          </p>
        )}
         {/* View Payment History button removed from here */}
      </CardContent>
    </Card>
  );
}


export default function BillingPage() {
  const { students, courses, addPayment, isLoading } = useAppContext();
  const { toast } = useToast(); 
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('enrollment');
  
  // viewingStudentHistory state and related dialog removed from here

  const handlePayEnrollment = async (studentId: string, course: Course) => {
    try {
      await addPayment(studentId, {
        date: new Date().toISOString(),
        amount: course.enrollmentFee,
        type: 'enrollment',
        remarks: `Enrollment fee for ${course.name}`
      });
      toast({ title: "Success", description: `${students.find(s=>s.id === studentId)?.name}'s enrollment fee paid.` });
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to process enrollment payment: ${error.message}`, variant: "destructive" });
    }
  };

  const handlePayMonthly = async (studentId: string, amount: number, course: Course) => {
    // This function is for paying the *total accumulated due*. 
    // The `addPayment` function in context should be designed to handle one payment record.
    // For simplicity, we'll record this as a single 'monthly' payment covering the total due.
    // A more complex system might break this down or require specific month selection.
    try {
      await addPayment(studentId, {
        date: new Date().toISOString(),
        amount: amount, // This is the total due amount
        type: 'monthly', // Or a special type like 'bulk_due_payment'
        monthFor: format(new Date(), "MMMM yyyy"), // Could be 'Multiple Months Due'
        remarks: `Payment for outstanding monthly fees for ${course.name}`
      });
      toast({ title: "Success", description: `Outstanding dues paid for ${students.find(s=>s.id === studentId)?.name}.` });
    } catch (error: any) {
       toast({ title: "Error", description: `Failed to process monthly payment: ${error.message}`, variant: "destructive" });
    }
  };
  
  const handlePayPartial = async (studentId: string, amount: number, course: Course) => {
    try {
      await addPayment(studentId, {
        date: new Date().toISOString(),
        amount: amount,
        type: 'partial',
        monthFor: format(new Date(), "MMMM yyyy"), // User should ideally specify which month this partial payment is for
        remarks: `Partial monthly fee for ${course.name}`
      });
      toast({ title: "Success", description: `Partial payment recorded for ${students.find(s=>s.id === studentId)?.name}.` });
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to process partial payment: ${error.message}`, variant: "destructive" });
    }
  };

  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.fatherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.mobile.includes(searchTerm)
  );

  const enrollmentPendingStudents = filteredStudents.filter(s => s.status === 'enrollment_pending');
  
  const dueFeeStudents = filteredStudents.filter(s => {
    if (s.status !== 'active') return false;
    const course = courses.find(c => c.id === s.courseId);
    if (!course) return false;

    const currentDate = new Date();
    currentDate.setHours(0,0,0,0);
    const enrollmentDate = new Date(s.enrollmentDate);
    enrollmentDate.setHours(0,0,0,0);
        
    let totalDue = 0;
    let nextBillingCycleStartDate = new Date(enrollmentDate.getFullYear(), enrollmentDate.getMonth() + 1, 1);
    
    while(nextBillingCycleStartDate <= currentDate) {
        const paymentsForMonth = s.paymentHistory
          .filter(p => (p.type === 'monthly' || p.type === 'partial') && p.monthFor && 
                       new Date(p.monthFor).getFullYear() === nextBillingCycleStartDate.getFullYear() &&
                       new Date(p.monthFor).getMonth() === nextBillingCycleStartDate.getMonth());
        
        const amountPaidForMonth = paymentsForMonth.reduce((sum, p) => sum + p.amount, 0);

        if (amountPaidForMonth < course.monthlyFee) {
          totalDue += (course.monthlyFee - amountPaidForMonth);
        }
        nextBillingCycleStartDate.setMonth(nextBillingCycleStartDate.getMonth() + 1);
    }
    return totalDue > 0;
  });

  const noDueStudents = filteredStudents.filter(s => 
    s.status === 'active' && 
    !dueFeeStudents.find(ds => ds.id === s.id) &&
    !enrollmentPendingStudents.find(es => es.id === s.id)
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
              {type === 'due' && <DollarSign className="h-10 w-10 text-primary" />}
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
            onPayMonthly={handlePayMonthly}
            onPayPartial={handlePayPartial}
            // onViewHistory removed
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
            <DollarSign className="h-5 w-5" /><span>Monthly Dues ({dueFeeStudents.length})</span>
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

      {/* Payment History Dialog removed from here */}
    </>
  );
}
