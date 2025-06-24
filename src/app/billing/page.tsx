
"use client";
import React, { useState, useMemo, useCallback } from 'react';
import { DollarSign, History, Search, Users, UserCircle, Receipt, BookCopy, FilePlus, Banknote, IndianRupee, Clock, PiggyBank, RotateCcw } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useAppContext } from '@/lib/context/AppContext';
import type { Student, Course, PaymentRecord, CustomFee } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { format, addMonths, isBefore, startOfMonth, parseISO, differenceInMonths, formatDistanceToNowStrict } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';


export default function BillingPage() {
  const { students, courses, addPayment, isLoading: isAppContextLoading, addCustomFee, updateCustomFeeStatus, revertPayment } = useAppContext();
  const { toast } = useToast();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [paymentAmount, setPaymentAmount] = useState<number | string>('');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  
  const [customFeeName, setCustomFeeName] = useState('');
  const [customFeeAmount, setCustomFeeAmount] = useState<number | string>('');
  const [isCustomFeePaid, setIsCustomFeePaid] = useState(false);

  const activeStudents = useMemo(() => 
    students.filter(s => s.status === 'active' || s.status === 'enrollment_pending' || s.status === 'completed_unpaid'),
  [students]);

  const searchedStudents = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    return activeStudents.filter(student =>
      student.name.toLowerCase().startsWith(lowercasedSearchTerm) ||
      student.fatherName.toLowerCase().startsWith(lowercasedSearchTerm) ||
      (student.enrollmentNumber && student.enrollmentNumber.toLowerCase().startsWith(lowercasedSearchTerm))
    );
  }, [searchTerm, activeStudents]);

  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return students.find(s => s.id === selectedStudentId) || null;
  }, [selectedStudentId, students]);

  const selectedStudentCourse = useMemo(() => {
    if (!selectedStudent || !selectedStudent.courseId) return null;
    return courses.find(c => c.id === selectedStudent.courseId) || null;
  }, [selectedStudent, courses]);

  const handleStudentSelect = (studentId: string) => {
    setSelectedStudentId(studentId);
    setSearchTerm(''); 
  };
  
  const handlePaymentSubmit = async () => {
    if (!selectedStudent) return;
    const amount = parseFloat(String(paymentAmount));
    if (isNaN(amount) || amount <= 0) {
        toast({ title: "Error", description: "Please enter a valid payment amount.", variant: "destructive" });
        return;
    }

    try {
        await addPayment(selectedStudent.id, {
            date: new Date().toISOString(),
            amount,
            type: 'partial',
            remarks: paymentRemarks || `General payment towards dues.`
        });
        toast({title: "Success", description: `Payment of ₹${amount.toLocaleString()} recorded.`});
        setPaymentAmount('');
        setPaymentRemarks('');
    } catch(error: any) {
        toast({title: "Error", description: `Payment failed: ${error.message}`, variant: 'destructive'});
    }
  };

  const handleAddCustomFee = async () => {
    if (!selectedStudent || !customFeeName || !customFeeAmount) {
        toast({title: "Error", description: "Please provide a name and amount for the custom fee.", variant: 'destructive'});
        return;
    }
    const amount = parseFloat(String(customFeeAmount));
     if (isNaN(amount) || amount <= 0) {
        toast({ title: "Error", description: "Please enter a valid amount.", variant: "destructive" });
        return;
    }
    
    try {
        await addCustomFee(selectedStudent.id, { name: customFeeName, amount, status: isCustomFeePaid ? 'paid' : 'due'});
        toast({title: "Success", description: `Custom fee "${customFeeName}" added.`});
        setCustomFeeName('');
        setCustomFeeAmount('');
        setIsCustomFeePaid(false);
    } catch (error: any) {
        toast({title: "Error", description: `Failed to add custom fee: ${error.message}`, variant: 'destructive'});
    }
  };

  const handlePaySpecificFee = async (
    type: 'enrollment' | 'exam' | 'custom' | 'installment' | 'monthly', 
    amount: number, 
    description: string, 
    referenceId: string
  ) => {
    if (!selectedStudent) return;
    try {
        await addPayment(selectedStudent.id, {
            date: new Date().toISOString(),
            amount,
            type: type,
            remarks: `Payment for ${description}`,
            referenceId: referenceId
        });
        toast({title: 'Success', description: `Payment of ₹${amount.toLocaleString()} for ${description} recorded.`});

        if(type === 'custom') {
            await updateCustomFeeStatus(selectedStudent.id, referenceId, 'paid');
        }

    } catch (error: any) {
        toast({title: "Error", description: `Failed to pay fee: ${error.message}`, variant: 'destructive'});
    }
  }

  const handleRevertPayment = async (paymentId: string) => {
    if (!selectedStudent) return;
    try {
      await revertPayment(selectedStudent.id, paymentId);
      toast({ title: "Success", description: "Payment successfully reverted." });
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to revert payment: ${error.message}`, variant: "destructive" });
    }
  }

  if (isAppContextLoading) {
    return <div className="text-center py-10">Loading billing data...</div>;
  }

  return (
    <>
      <PageHeader title="Student Fee Management" description="Manage individual student payments and dues." />
      
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search students by name, father's name, or enrollment no..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (selectedStudentId) setSelectedStudentId(null); 
            }}
            className="pl-10 shadow-md w-full md:w-1/2 lg:w-1/3"
          />
        </div>

        {searchTerm && searchedStudents.length > 0 && (
          <Card className="shadow-lg animate-slide-in w-full md:w-1/2 lg:w-1/3">
            <CardHeader><CardTitle className="text-lg font-headline">Search Results</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                {searchedStudents.map(student => (
                  <div
                    key={student.id}
                    onClick={() => handleStudentSelect(student.id)}
                    className="p-3 hover:bg-muted rounded-md cursor-pointer transition-colors"
                  >
                    <p className="font-medium">{student.name} ({student.enrollmentNumber || 'N/A'})</p>
                    <p className="text-sm text-muted-foreground">
                      Father: {student.fatherName} | Course: {courses.find(c => c.id === student.courseId)?.name || 'N/A'}
                    </p>
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>
        )}
        {searchTerm && searchedStudents.length === 0 && !selectedStudentId && (
           <Card className="text-center py-8 shadow-md w-full md:w-1/2 lg:w-1/3">
            <CardContent>
                <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-3"><Users className="h-8 w-8 text-primary" /></div>
                <p className="text-muted-foreground">No students found matching &quot;{searchTerm}&quot;.</p>
            </CardContent>
           </Card>
        )}
      </div>

      {!selectedStudentId && !searchTerm && !isAppContextLoading && (
        <Card className="text-center py-12 shadow-lg animate-slide-in">
            <CardHeader>
                <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4"><UserCircle className="h-16 w-16 text-primary" /></div>
                <CardTitle className="text-2xl font-headline">Select or Search a Student</CardTitle>
                <CardDescription>Use the search bar above to find a student and manage their fee details.</CardDescription>
            </CardHeader>
        </Card>
      )}

      {selectedStudent && selectedStudentCourse && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-in">
          <Card className="lg:col-span-1 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-primary font-headline"><History className="mr-2 h-5 w-5" />Payment History</CardTitle>
              <CardDescription>All recorded transactions for {selectedStudent.name}.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-25rem)] pr-3">
                {selectedStudent.paymentHistory.length > 0 ? (
                  selectedStudent.paymentHistory.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(p => (
                    <div key={p.id} className="mb-3 p-3 border rounded-md bg-background shadow-sm hover:shadow-md transition-shadow group relative">
                      <p className="font-semibold text-sm">₹{p.amount.toLocaleString()} <span className="text-xs capitalize text-muted-foreground">({p.type})</span></p>
                      <p className="text-xs text-muted-foreground">{new Date(p.date).toLocaleDateString()}</p>
                      {p.description && <p className="text-xs text-muted-foreground">For: {p.description}</p>}
                      {p.remarks && <p className="text-xs italic text-muted-foreground mt-1">Remark: {p.remarks}</p>}
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                              <RotateCcw className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revert Payment?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to revert the payment of ₹{p.amount.toLocaleString()} made on {new Date(p.date).toLocaleDateString()}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRevertPayment(p.id)} className={cn(buttonVariants({ variant: "destructive" }))}>Confirm Revert</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-10">No payment history found.</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
          
          <Card className="lg:col-span-1 shadow-lg">
             <CardHeader>
              <CardTitle className="font-headline text-primary">{selectedStudent.name} ({selectedStudent.enrollmentNumber || 'N/A'})</CardTitle>
              <CardDescription>Course: {selectedStudentCourse.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <FinancialSummary student={selectedStudent} course={selectedStudentCourse} />
                <FeeDetailsTabs student={selectedStudent} course={selectedStudentCourse} onPay={handlePaySpecificFee} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-1 shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center text-primary font-headline"><Banknote className="mr-2 h-5 w-5" />Actions</CardTitle>
                 <CardDescription>Record payments or add custom fees.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="p-4 border rounded-lg bg-background">
                    <h3 className="font-semibold mb-3">Record General Payment</h3>
                    <div className="space-y-3">
                        <div>
                            <Label htmlFor="genPayAmount">Amount (₹)</Label>
                            <Input id="genPayAmount" type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Enter amount to pay"/>
                        </div>
                        <div>
                            <Label htmlFor="genPayRemarks">Remarks (Optional)</Label>
                            <Textarea id="genPayRemarks" value={paymentRemarks} onChange={e => setPaymentRemarks(e.target.value)} placeholder="e.g. Cash from parent" />
                        </div>
                        <Button onClick={handlePaymentSubmit} className="w-full" disabled={!paymentAmount}>Submit Payment</Button>
                    </div>
                </div>

                <Separator />
                
                <div className="p-4 border rounded-lg bg-background">
                    <h3 className="font-semibold mb-3 flex items-center"><FilePlus className="mr-2 h-5 w-5" />Add Custom Fee</h3>
                    <div className="space-y-3">
                        <div>
                            <Label htmlFor="customFeeName">Fee Name</Label>
                            <Input id="customFeeName" value={customFeeName} onChange={(e) => setCustomFeeName(e.target.value)} placeholder="e.g. Late Fee, Book Fee" />
                        </div>
                         <div>
                            <Label htmlFor="customFeeAmount">Amount (₹)</Label>
                            <Input id="customFeeAmount" type="number" value={customFeeAmount} onChange={(e) => setCustomFeeAmount(e.target.value)} placeholder="Enter amount"/>
                        </div>
                        <div className="flex items-center space-x-2 pt-1">
                           <Checkbox id="isCustomFeePaid" checked={isCustomFeePaid} onCheckedChange={(checked) => setIsCustomFeePaid(!!checked)} />
                           <Label htmlFor="isCustomFeePaid" className="text-sm font-normal">Mark as already paid</Label>
                        </div>
                        <Button onClick={handleAddCustomFee} className="w-full" disabled={!customFeeName || !customFeeAmount}>Add Fee</Button>
                    </div>
                </div>
            </CardContent>
          </Card>

        </div>
      )}
    </>
  );
}

function FinancialSummary({ student, course }: { student: Student, course: Course }) {
  const summary = useMemo(() => {
    const enrollmentFee = student.overriddenEnrollmentFee ?? course.enrollmentFee;
    let totalBilled = enrollmentFee;

    const totalPaid = (student.paymentHistory || []).reduce((sum, p) => sum + p.amount, 0);

    if (course.paymentType === 'monthly') {
      const monthlyFee = student.overriddenMonthlyFee ?? course.monthlyFee;
      const startDate = startOfMonth(parseISO(student.enrollmentDate));
      const endDate = new Date();
      let monthsBilled = 0;
      if (isBefore(startDate, endDate)) {
          monthsBilled = differenceInMonths(endDate, startDate) + 1;
      }
      const courseDurationInMonths = student.courseDurationValue * (student.courseDurationUnit === 'years' ? 12 : 1);
      const numberOfBillableMonths = Math.min(Math.max(0, monthsBilled), courseDurationInMonths);
      totalBilled += numberOfBillableMonths * monthlyFee;
    } else if (course.paymentType === 'installment' && student.selectedPaymentPlanName) {
      const plan = course.paymentPlans.find(p => p.name === student.selectedPaymentPlanName);
      if (plan) {
        totalBilled += plan.totalAmount;
      }
    }

    totalBilled += (course.examFees || []).reduce((sum, fee) => sum + fee.amount, 0);
    totalBilled += (student.customFees || []).reduce((sum, fee) => sum + fee.amount, 0);

    const totalDues = Math.max(0, totalBilled - totalPaid);

    const enrollmentDate = parseISO(student.enrollmentDate);
    const courseEndDate = addMonths(enrollmentDate, student.courseDurationValue * (student.courseDurationUnit === 'years' ? 12 : 1));
    const timeRemaining = isBefore(new Date(), courseEndDate) ? `${formatDistanceToNowStrict(courseEndDate)} left` : "Finished";

    return { totalPaid, totalDues, timeRemaining };
  }, [student, course]);

  return (
    <Card className="bg-muted/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center"><PiggyBank className="mr-2 h-5 w-5"/>Financial Summary</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-md bg-background">
          <p className="text-sm text-muted-foreground">Paid</p>
          <p className="text-lg font-bold text-green-600">₹{summary.totalPaid.toLocaleString()}</p>
        </div>
        <div className="p-2 rounded-md bg-background">
          <p className="text-sm text-muted-foreground">Dues</p>
          <p className="text-lg font-bold text-destructive">₹{summary.totalDues.toLocaleString()}</p>
        </div>
        <div className="p-2 rounded-md bg-background">
          <p className="text-sm text-muted-foreground">Course Time</p>
          <p className="text-base font-bold text-primary">{summary.timeRemaining}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function FeeDetailsTabs({student, course, onPay}: {student: Student, course: Course, onPay: Function}) {

    const { enrollmentDue } = useMemo(() => {
        const fee = student.overriddenEnrollmentFee ?? course.enrollmentFee;
        const paid = (student.paymentHistory || []).filter(p => p.type === 'enrollment').reduce((sum,p) => sum+p.amount, 0);
        return { enrollmentDue: Math.max(0, fee - paid) };
    }, [student, course]);

    const { installmentDues } = useMemo(() => {
        if(course.paymentType !== 'installment' || !student.selectedPaymentPlanName) return { installmentDues: [] };
        
        const plan = (course.paymentPlans || []).find(p => p.name === student.selectedPaymentPlanName);
        if (!plan) return { installmentDues: [] };

        let totalPaidTowardsInstallments = (student.paymentHistory || [])
            .filter(p => p.type === 'installment' || p.type === 'partial')
            .reduce((sum, p) => sum + p.amount, 0);

        const dues = plan.installments.map((installmentAmount, index) => {
            const paidForThis = Math.min(totalPaidTowardsInstallments, installmentAmount);
            totalPaidTowardsInstallments -= paidForThis;
            return {
                installment: index + 1,
                amount: installmentAmount,
                paid: paidForThis,
                due: installmentAmount - paidForThis,
            }
        });
        return { installmentDues: dues };

    }, [student, course]);

    const { monthlyDues } = useMemo(() => {
        if(course.paymentType !== 'monthly') return { monthlyDues: [] };
        let dues = [];
        const enrollmentDate = parseISO(student.enrollmentDate);
        const firstBillableMonth = startOfMonth(enrollmentDate);
        const courseDurationInMonths = student.courseDurationValue * (student.courseDurationUnit === 'years' ? 12 : 1);
        const feePerMonth = student.overriddenMonthlyFee ?? course.monthlyFee;
        
        for (let i=0; i<courseDurationInMonths; i++) {
            const monthDate = addMonths(firstBillableMonth, i);
            if (isBefore(monthDate, new Date()) || monthDate.getMonth() === new Date().getMonth()) {
                const monthYearStr = format(monthDate, "MMMM yyyy");
                
                const paidForMonth = (student.paymentHistory || [])
                    .filter(p => p.referenceId === monthYearStr)
                    .reduce((sum, p) => sum + p.amount, 0);

                dues.push({
                    monthYear: monthYearStr,
                    amount: feePerMonth,
                    paid: paidForMonth,
                    due: Math.max(0, feePerMonth - paidForMonth),
                });
            }
        }
        return { monthlyDues: dues.reverse() };
    }, [student, course]);
    
    const { examFeeDues } = useMemo(() => {
        const fees = course.examFees || [];
        return { examFeeDues: fees.map(fee => {
            const paid = (student.paymentHistory || [])
                .filter(p => p.type === 'exam' && p.referenceId === fee.name)
                .reduce((sum, p) => sum+p.amount, 0);
            return {
                name: fee.name,
                amount: fee.amount,
                paid: paid,
                due: Math.max(0, fee.amount - paid)
            }
        })};
    }, [student, course]);
    
    const customFeeDues = student.customFees || [];

    const handlePayWrapper = (type: any, amount: number, desc: string, refId: string) => {
        if(amount > 0) {
            onPay(type, amount, desc, refId);
        }
    }

    return (
        <Tabs defaultValue="dues" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dues"><Receipt className="mr-2 h-4 w-4"/>Dues</TabsTrigger>
                <TabsTrigger value="exam"><BookCopy className="mr-2 h-4 w-4"/>Exam Fees</TabsTrigger>
                <TabsTrigger value="custom"><FilePlus className="mr-2 h-4 w-4"/>Custom</TabsTrigger>
            </TabsList>
            <div className="mt-4">
                <div className="space-y-4">
                 <Card>
                    <CardHeader className="p-4">
                        <CardTitle className="text-base">Enrollment Fee</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                         <div className="flex justify-between items-center">
                            <div>
                                <p className="font-semibold">₹{(student.overriddenEnrollmentFee ?? course.enrollmentFee).toLocaleString()}</p>
                                {enrollmentDue === 0 ? <p className="text-sm text-green-600">Paid</p> : <p className="text-sm text-destructive">Due: ₹{enrollmentDue.toLocaleString()}</p>}
                            </div>
                             {enrollmentDue > 0 && <Button size="sm" onClick={() => handlePayWrapper('enrollment', enrollmentDue, 'Enrollment Fee', 'enrollment_fee')}>Pay Now</Button>}
                        </div>
                    </CardContent>
                </Card>

                <TabsContent value="dues" className="m-0 space-y-4">
                    { course.paymentType === 'monthly' && monthlyDues.map(due => (
                         <Card key={due.monthYear}>
                            <CardHeader className="p-4"><CardTitle className="text-base">{due.monthYear}</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">₹{due.amount.toLocaleString()}</p>
                                        {due.due === 0 ? <p className="text-sm text-green-600">Paid</p> : <p className="text-sm text-destructive">Due: ₹{due.due.toLocaleString()}</p>}
                                    </div>
                                    {due.due > 0 && <Button size="sm" onClick={() => handlePayWrapper('monthly', due.due, due.monthYear, due.monthYear)}>Pay Now</Button>}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    { course.paymentType === 'installment' && installmentDues.map(due => (
                         <Card key={due.installment}>
                            <CardHeader className="p-4"><CardTitle className="text-base">Installment {due.installment}</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">₹{due.amount.toLocaleString()}</p>
                                        {due.due === 0 ? <p className="text-sm text-green-600">Paid</p> : <p className="text-sm text-destructive">Due: ₹{due.due.toLocaleString()}</p>}
                                    </div>
                                    {due.due > 0 && <Button size="sm" onClick={() => handlePayWrapper('installment', due.due, `Installment ${due.installment}`, `inst_${due.installment}`)}>Pay Now</Button>}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </TabsContent>
                <TabsContent value="exam" className="m-0 space-y-4">
                    { examFeeDues.length > 0 ? examFeeDues.map(fee => (
                         <Card key={fee.name}>
                            <CardHeader className="p-4"><CardTitle className="text-base">{fee.name}</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">₹{fee.amount.toLocaleString()}</p>
                                        {fee.due === 0 ? <p className="text-sm text-green-600">Paid</p> : <p className="text-sm text-destructive">Due: ₹{fee.due.toLocaleString()}</p>}
                                    </div>
                                    {fee.due > 0 && <Button size="sm" onClick={() => handlePayWrapper('exam', fee.due, fee.name, fee.name)}>Pay Now</Button>}
                                </div>
                            </CardContent>
                        </Card>
                    )) : <p className="text-muted-foreground text-center py-4">No exam fees for this course.</p>}
                </TabsContent>
                <TabsContent value="custom" className="m-0 space-y-4">
                     { customFeeDues.length > 0 ? customFeeDues.map(fee => (
                         <Card key={fee.id}>
                            <CardHeader className="p-4"><CardTitle className="text-base">{fee.name}</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-0">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">₹{fee.amount.toLocaleString()}</p>
                                        {fee.status === 'paid' ? <p className="text-sm text-green-600">Paid</p> : <p className="text-sm text-destructive">Due</p>}
                                    </div>
                                    {fee.status === 'due' && <Button size="sm" onClick={() => handlePayWrapper('custom', fee.amount, fee.name, fee.id)}>Pay Now</Button>}
                                </div>
                            </CardContent>
                        </Card>
                    )) : <p className="text-muted-foreground text-center py-4">No custom fees added.</p>}
                </TabsContent>
                </div>
            </div>
        </Tabs>
    );
}
