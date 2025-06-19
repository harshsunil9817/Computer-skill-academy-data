
"use client";
import React, { useState, useEffect } from 'react';
import { DollarSign, CheckCircle, AlertCircle, History, Search, ListFilter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { useAppContext } from '@/lib/context/AppContext';
import type { Student, Course, PaymentRecord } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';


interface StudentFeeItemProps {
  student: Student;
  course?: Course;
  onPayEnrollment?: (studentId: string, course: Course) => void;
  onPayMonthly?: (studentId: string, amount: number, course: Course) => void;
  onPayPartial?: (studentId: string, amount: number, course: Course) => void;
  onViewHistory?: (student: Student) => void;
  type: 'enrollment' | 'due' | 'paid';
}

function StudentFeeItem({ student, course, onPayEnrollment, onPayMonthly, onPayPartial, onViewHistory, type }: StudentFeeItemProps) {
  const [partialAmount, setPartialAmount] = useState('');

  if (!course) return null;

  const getDueAmount = () => {
    if (type === 'enrollment') return course.enrollmentFee;
    // Simplified due calculation for monthly; real-world would be more complex
    const currentDate = new Date();
    const enrollmentDate = new Date(student.enrollmentDate);
    const monthsSinceEnrollment = (currentDate.getFullYear() - enrollmentDate.getFullYear()) * 12 + (currentDate.getMonth() - enrollmentDate.getMonth());
    
    const paidMonthlyFeesCount = student.paymentHistory.filter(p => p.type === 'monthly').length;
    
    // Student is considered due if months since enrollment is greater than paid monthly fees,
    // and it's not the enrollment month itself unless explicitly handled
    if (monthsSinceEnrollment >= 0 && monthsSinceEnrollment > paidMonthlyFeesCount ) {
        const alreadyPaidForCurrentMonth = student.paymentHistory.some(p => {
            if (p.type !== 'monthly' || !p.monthFor) return false;
            const [monthStr, yearStr] = p.monthFor.split(" ");
            const monthIdx = new Date(Date.parse(monthStr +" 1, 2012")).getMonth(); // Get month index
            return parseInt(yearStr) === currentDate.getFullYear() && monthIdx === currentDate.getMonth();
        });
        if (!alreadyPaidForCurrentMonth) return course.monthlyFee * (monthsSinceEnrollment - paidMonthlyFeesCount +1); // +1 for current month due potentially
    }
    return 0; // Default no due if logic doesn't catch or if paid up
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
                <DollarSign className="mr-2 h-4 w-4" /> Pay Full Due
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
         <Button variant="link" onClick={() => onViewHistory?.(student)} className="mt-2 p-0 h-auto text-sm animate-button-click">
            <History className="mr-1 h-4 w-4" /> View Payment History
        </Button>
      </CardContent>
    </Card>
  );
}


export default function BillingPage() {
  const { students, courses, addPayment, isLoading } = useAppContext();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('enrollment');
  
  const [viewingStudentHistory, setViewingStudentHistory] = useState<Student | null>(null);


  const handlePayEnrollment = (studentId: string, course: Course) => {
    addPayment(studentId, {
      date: new Date().toISOString(),
      amount: course.enrollmentFee,
      type: 'enrollment',
      remarks: `Enrollment fee for ${course.name}`
    });
    toast({ title: "Success", description: `${students.find(s=>s.id === studentId)?.name}'s enrollment fee paid.` });
  };

  const handlePayMonthly = (studentId: string, amount: number, course: Course) => {
     addPayment(studentId, {
      date: new Date().toISOString(),
      amount: amount,
      type: 'monthly',
      monthFor: format(new Date(), "MMMM yyyy"), // Example: "July 2024"
      remarks: `Monthly fee for ${course.name}`
    });
    toast({ title: "Success", description: `Monthly fee paid for ${students.find(s=>s.id === studentId)?.name}.` });
  };
  
  const handlePayPartial = (studentId: string, amount: number, course: Course) => {
    addPayment(studentId, {
      date: new Date().toISOString(),
      amount: amount,
      type: 'partial',
      monthFor: format(new Date(), "MMMM yyyy"),
      remarks: `Partial monthly fee for ${course.name}`
    });
    toast({ title: "Success", description: `Partial payment recorded for ${students.find(s=>s.id === studentId)?.name}.` });
  };

  const openHistoryDialog = (student: Student) => {
    setViewingStudentHistory(student);
  };

  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.fatherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.mobile.includes(searchTerm)
  );

  const enrollmentPendingStudents = filteredStudents.filter(s => s.status === 'enrollment_pending');
  
  // This is a very simplified due calculation. A robust system would track each month's due status.
  const dueFeeStudents = filteredStudents.filter(s => {
    if (s.status !== 'active') return false;
    const course = courses.find(c => c.id === s.courseId);
    if (!course) return false;

    const currentDate = new Date();
    const enrollmentDate = new Date(s.enrollmentDate);
    
    // Number of full months passed since the start of the month after enrollment
    let monthsDueCount = 0;
    let checkDate = new Date(enrollmentDate.getFullYear(), enrollmentDate.getMonth() + 1, 1); // Start of month after enrollment
    
    while(checkDate <= currentDate) {
        monthsDueCount++;
        checkDate.setMonth(checkDate.getMonth() + 1);
    }

    const paidMonthlyFeesCount = s.paymentHistory.filter(p => p.type === 'monthly').length;
    return monthsDueCount > paidMonthlyFeesCount;
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
            onViewHistory={openHistoryDialog}
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
        {/* <Button variant="outline"><ListFilter className="mr-2 h-4 w-4" /> Filters</Button> */}
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

      <Dialog open={!!viewingStudentHistory} onOpenChange={() => setViewingStudentHistory(null)}>
        <DialogContent className="sm:max-w-lg shadow-2xl rounded-lg">
          <DialogHeader>
            <DialogTitle className="font-headline text-primary">Payment History: {viewingStudentHistory?.name}</DialogTitle>
          </DialogHeader>
          {viewingStudentHistory && viewingStudentHistory.paymentHistory.length > 0 ? (
            <ScrollArea className="max-h-[60vh] mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount (₹)</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewingStudentHistory.paymentHistory.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(payment => (
                    <TableRow key={payment.id}>
                      <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                      <TableCell>{payment.amount.toLocaleString()}</TableCell>
                      <TableCell className="capitalize">{payment.type} {payment.monthFor && `(${payment.monthFor})`}</TableCell>
                      <TableCell>{payment.remarks}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <p className="py-8 text-center text-muted-foreground">No payment history found for this student.</p>
          )}
          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="animate-button-click">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
