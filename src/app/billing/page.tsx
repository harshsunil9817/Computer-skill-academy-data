
"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DollarSign, CheckCircle, AlertCircle, CalendarDays, History, Landmark, MinusCircle, PlusCircle, UserCircle, Search, Users, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useAppContext } from '@/lib/context/AppContext';
import type { Student, Course, PaymentRecord } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { format, addMonths, isBefore, isEqual, startOfMonth, parseISO, getMonth, getYear,differenceInMonths } from 'date-fns';

interface BillableMonthInfo {
  monthYear: string; // "MMMM yyyy"
  monthDate: Date;
  feeForMonth: number;
  paidForMonth: number;
  remainingDue: number;
  isCoveredByAdvance: boolean;
  isFullyPaid: boolean;
}

type AdhocPaymentType = 'settle_dues' | 'pay_in_advance';

export default function BillingPage() {
  const { students, courses, addPayment, isLoading: isAppContextLoading } = useAppContext();
  const { toast } = useToast();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [adhocPaymentAmount, setAdhocPaymentAmount] = useState<number | string>('');
  const [adhocPaymentType, setAdhocPaymentType] = useState<AdhocPaymentType>('settle_dues');
  const [adhocPaymentRemarks, setAdhocPaymentRemarks] = useState('');

  const [selectedMonthsToPay, setSelectedMonthsToPay] = useState<Record<string, boolean>>({});


  const activeStudents = useMemo(() => 
    students.filter(s => s.status === 'active' || s.status === 'enrollment_pending' || s.status === 'completed_unpaid'),
  [students]);

  const searchedStudents = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return activeStudents.filter(student =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.fatherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.enrollmentNumber && student.enrollmentNumber.toLowerCase().includes(searchTerm.toLowerCase()))
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


  const isEnrollmentFeePaid = useCallback((student: Student | null, course: Course | null): boolean => {
    if (!student || !course) return false;
    const enrollmentPayments = student.paymentHistory
      .filter(p => p.type === 'enrollment')
      .reduce((sum, p) => sum + p.amount, 0);
    return enrollmentPayments >= course.enrollmentFee;
  }, []);

  const enrollmentFeeDue = useMemo((): number => {
    if (!selectedStudent || !selectedStudentCourse || isEnrollmentFeePaid(selectedStudent, selectedStudentCourse)) return 0;
    const paidAmount = selectedStudent.paymentHistory
        .filter(p => p.type === 'enrollment')
        .reduce((sum,p) => sum + p.amount, 0);
    return Math.max(0, selectedStudentCourse.enrollmentFee - paidAmount);
  }, [selectedStudent, selectedStudentCourse, isEnrollmentFeePaid]);


  const billableMonthsDetails = useMemo((): BillableMonthInfo[] => {
    if (!selectedStudent || !selectedStudentCourse || !selectedStudent.enrollmentDate) return [];
    
    const details: BillableMonthInfo[] = [];
    const enrollmentDate = parseISO(selectedStudent.enrollmentDate);
    if (isNaN(enrollmentDate.getTime())) return [];

    const courseDurationInMonths = selectedStudent.courseDurationValue * (selectedStudent.courseDurationUnit === 'years' ? 12 : 1);
    
    const firstBillableMonth = addMonths(startOfMonth(enrollmentDate), 1);
    const lastPossibleBillableMonth = addMonths(firstBillableMonth, courseDurationInMonths - 1);
    const loopEndDate = addMonths(lastPossibleBillableMonth, 1); 

    let currentProcessingMonth = firstBillableMonth;

    while(isBefore(currentProcessingMonth, loopEndDate)) {
      const monthYearStr = format(currentProcessingMonth, "MMMM yyyy");
      const paymentsForThisMonth = selectedStudent.paymentHistory
        .filter(p => (p.type === 'monthly' || p.type === 'partial') && p.monthFor === monthYearStr)
        .reduce((sum, p) => sum + p.amount, 0);
      
      const remainingDueForMonth = Math.max(0, selectedStudentCourse.monthlyFee - paymentsForThisMonth);

      details.push({
        monthYear: monthYearStr,
        monthDate: new Date(currentProcessingMonth),
        feeForMonth: selectedStudentCourse.monthlyFee,
        paidForMonth: paymentsForThisMonth,
        remainingDue: remainingDueForMonth,
        isCoveredByAdvance: false, 
        isFullyPaid: remainingDueForMonth <= 0,
      });
      currentProcessingMonth = addMonths(currentProcessingMonth, 1);
    }
    return details;

  }, [selectedStudent, selectedStudentCourse]);


  const { totalOutstandingDues, effectiveAdvanceBalance, finalBillableMonthsDetails, finalBillableMonthDate } = useMemo(() => {
    if (!selectedStudent || !selectedStudentCourse) {
      return { totalOutstandingDues: 0, effectiveAdvanceBalance: 0, finalBillableMonthsDetails: [], finalBillableMonthDate: null };
    }

    let currentTotalDues = enrollmentFeeDue;
    billableMonthsDetails.forEach(month => {
        if(isBefore(month.monthDate, addMonths(startOfMonth(new Date()),1))) { 
             currentTotalDues += month.remainingDue;
        }
    });
    
    const advancePaymentsTotal = selectedStudent.paymentHistory
        .filter(p => p.type === 'advance')
        .reduce((sum, p) => sum + p.amount, 0);

    let _effectiveAdvanceBalance = advancePaymentsTotal;
    let tempTotalDues = enrollmentFeeDue;

    if (tempTotalDues > 0 && _effectiveAdvanceBalance > 0) {
        const amountToCoverEnrollment = Math.min(_effectiveAdvanceBalance, tempTotalDues);
        tempTotalDues -= amountToCoverEnrollment;
        _effectiveAdvanceBalance -= amountToCoverEnrollment;
    }
    
    const monthsWithAdvanceApplied = billableMonthsDetails.map(month => {
        let newRemainingDue = month.remainingDue;
        let coveredByAdvance = false;
        if (_effectiveAdvanceBalance > 0 && newRemainingDue > 0) {
            const amountToCover = Math.min(_effectiveAdvanceBalance, newRemainingDue);
            newRemainingDue -= amountToCover;
            _effectiveAdvanceBalance -= amountToCover;
            coveredByAdvance = newRemainingDue <= 0; 
        }
        
        if(isBefore(month.monthDate, addMonths(startOfMonth(new Date()),1))) {
            tempTotalDues += newRemainingDue; 
        }
        return { ...month, remainingDue: newRemainingDue, isCoveredByAdvance: coveredByAdvance, isFullyPaid: newRemainingDue <= 0 };
    });

    const _finalBillableMonthDate = monthsWithAdvanceApplied.length > 0 ? monthsWithAdvanceApplied[monthsWithAdvanceApplied.length - 1].monthDate : null;

    return { 
        totalOutstandingDues: tempTotalDues, 
        effectiveAdvanceBalance: _effectiveAdvanceBalance, 
        finalBillableMonthsDetails: monthsWithAdvanceApplied,
        finalBillableMonthDate: _finalBillableMonthDate
    };

  }, [selectedStudent, selectedStudentCourse, billableMonthsDetails, enrollmentFeeDue]);


  const handlePayEnrollmentFee = async () => {
    if (!selectedStudent || !selectedStudentCourse || enrollmentFeeDue <= 0) return;
    
    let amountToPay = enrollmentFeeDue;
    let paymentType: PaymentRecord['type'] = 'enrollment';
    let remarks = `Enrollment fee for ${selectedStudentCourse.name}`;

    try {
      await addPayment(selectedStudent.id, {
        date: new Date().toISOString(),
        amount: amountToPay,
        type: paymentType,
        remarks: remarks
      });
      toast({ title: "Success", description: `Enrollment fee of ₹${amountToPay.toLocaleString()} paid for ${selectedStudent.name}.` });
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to pay enrollment fee: ${error.message}`, variant: "destructive" });
    }
  };

  const handlePaySelectedMonths = async () => {
    if (!selectedStudent || !selectedStudentCourse) return;
    const monthsToPayNow = finalBillableMonthsDetails.filter(
      bm => {
        const isThisTheFinalMonth = finalBillableMonthDate && isEqual(startOfMonth(bm.monthDate), startOfMonth(finalBillableMonthDate));
        return selectedMonthsToPay[bm.monthYear] && bm.remainingDue > 0 && !bm.isCoveredByAdvance && !isThisTheFinalMonth;
      }
    );

    if (monthsToPayNow.length === 0) {
      toast({ title: "Info", description: "No valid months selected for payment, or selected months have no remaining dues, are advance covered, or include the final course month.", variant: "default" });
      return;
    }

    try {
      for (const month of monthsToPayNow) {
        await addPayment(selectedStudent.id, {
          date: new Date().toISOString(),
          amount: month.remainingDue,
          type: 'monthly',
          monthFor: month.monthYear,
          remarks: `Payment for ${month.monthYear} for ${selectedStudentCourse.name}`
        });
      }
      toast({ title: "Success", description: `Payments recorded for ${monthsToPayNow.length} selected month(s) for ${selectedStudent.name}.` });
      setSelectedMonthsToPay({}); 
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to process payments for selected months: ${error.message}`, variant: "destructive" });
    }
  };
  
  const handleAdhocPaymentSubmit = async () => {
    if (!selectedStudent || !selectedStudentCourse) return;
    const amount = parseFloat(String(adhocPaymentAmount));
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Please enter a valid positive amount.", variant: "destructive" });
      return;
    }

    try {
      if (adhocPaymentType === 'settle_dues') {
        if (totalOutstandingDues === 0 && enrollmentFeeDue === 0) { 
            toast({ title: "Info", description: `${selectedStudent.name} has no outstanding dues to settle.`, variant: "default" });
            return;
        }
        
        let oldestDueItemRemark = "";
        if(enrollmentFeeDue > 0) {
            oldestDueItemRemark = "Enrollment Fee";
        } else {
            const firstUnpaidMonth = finalBillableMonthsDetails.find(m => m.remainingDue > 0 && !m.isCoveredByAdvance && isBefore(m.monthDate, startOfMonth(new Date())));
            if (firstUnpaidMonth) oldestDueItemRemark = firstUnpaidMonth.monthYear;
        }

        await addPayment(selectedStudent.id, {
          date: new Date().toISOString(),
          amount: amount,
          type: 'partial', 
          monthFor: oldestDueItemRemark || undefined, 
          remarks: adhocPaymentRemarks || `Payment towards outstanding dues${oldestDueItemRemark ? ` (towards ${oldestDueItemRemark})`:''}`
        });
        toast({ title: "Success", description: `Payment of ₹${amount.toLocaleString()} towards dues recorded for ${selectedStudent.name}.`});
      } else if (adhocPaymentType === 'pay_in_advance') {
        await addPayment(selectedStudent.id, {
          date: new Date().toISOString(),
          amount: amount,
          type: 'advance',
          remarks: adhocPaymentRemarks || 'Advance payment'
        });
        toast({ title: "Success", description: `Advance payment of ₹${amount.toLocaleString()} recorded for ${selectedStudent.name}.`});
      }
      setAdhocPaymentAmount('');
      setAdhocPaymentRemarks('');
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to record payment: ${error.message}`, variant: "destructive" });
    }
  };

  const handleStudentSelect = (studentId: string) => {
    setSelectedStudentId(studentId);
    setSearchTerm(''); 
    setSelectedMonthsToPay({}); 
  };


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
            <CardHeader>
              <CardTitle className="text-lg font-headline">Search Results</CardTitle>
            </CardHeader>
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
                <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-3">
                    <Users className="h-8 w-8 text-primary" />
                </div>
                <p className="text-muted-foreground">No students found matching &quot;{searchTerm}&quot;.</p>
            </CardContent>
           </Card>
        )}
      </div>

      {!selectedStudentId && !searchTerm && !isAppContextLoading && (
        <Card className="text-center py-12 shadow-lg animate-slide-in">
            <CardHeader>
                <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
                    <UserCircle className="h-16 w-16 text-primary" />
                </div>
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
                    <div key={p.id} className="mb-3 p-3 border rounded-md bg-background shadow-sm hover:shadow-md transition-shadow">
                      <p className="font-semibold text-sm">₹{p.amount.toLocaleString()} <span className="text-xs capitalize text-muted-foreground">({p.type})</span></p>
                      <p className="text-xs text-muted-foreground">{new Date(p.date).toLocaleDateString()}</p>
                      {p.monthFor && <p className="text-xs text-muted-foreground">For: {p.monthFor}</p>}
                      {p.remarks && <p className="text-xs italic text-muted-foreground mt-1">Remark: {p.remarks}</p>}
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
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-md bg-primary/5 shadow-inner">
                <h3 className="font-semibold mb-2 text-primary">Financial Overview</h3>
                <p className="text-sm">
                  Total Outstanding Dues: <span className={`font-bold ${totalOutstandingDues > 0 ? 'text-destructive' : 'text-green-600'}`}>₹{totalOutstandingDues.toLocaleString()}</span>
                </p>
                <p className="text-sm">
                  Available Advance Balance: <span className="font-bold text-accent">₹{effectiveAdvanceBalance.toLocaleString()}</span>
                </p>
              </div>

              {enrollmentFeeDue > 0 && !isEnrollmentFeePaid(selectedStudent, selectedStudentCourse) && (
                <div className="p-3 border border-amber-500 rounded-md bg-amber-50">
                  <p className="text-sm font-semibold text-amber-700">Enrollment Fee Due: ₹{enrollmentFeeDue.toLocaleString()}</p>
                  <Button size="sm" onClick={handlePayEnrollmentFee} className="mt-2 animate-button-click bg-amber-600 hover:bg-amber-700">Pay Enrollment Fee</Button>
                </div>
              )}
              {isEnrollmentFeePaid(selectedStudent, selectedStudentCourse) && (
                 <p className="text-sm text-green-600 flex items-center p-3 border border-green-500 rounded-md bg-green-50"><CheckCircle className="mr-2 h-4 w-4"/>Enrollment Fee Paid</p>
              )}
              
              <Separator />
              
              <div>
                <h4 className="font-semibold mb-2 text-md text-primary">Monthly Fee Payments</h4>
                <ScrollArea className="h-[calc(100vh-48rem)] pr-2 border rounded-md p-2 bg-muted/20">
                  {finalBillableMonthsDetails.length > 0 ? (
                    finalBillableMonthsDetails.map(month => {
                      const isThisTheFinalMonth = finalBillableMonthDate && isEqual(startOfMonth(month.monthDate), startOfMonth(finalBillableMonthDate));
                      return (
                        <div key={month.monthYear} className="flex items-center justify-between p-2.5 mb-2 rounded-md bg-background shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center">
                            <Checkbox
                              id={`month-${month.monthYear}`}
                              checked={selectedMonthsToPay[month.monthYear] || month.isFullyPaid || month.isCoveredByAdvance}
                              disabled={month.isFullyPaid || month.isCoveredByAdvance || month.remainingDue <=0 || isThisTheFinalMonth}
                              onCheckedChange={(checked) => setSelectedMonthsToPay(prev => ({ ...prev, [month.monthYear]: !!checked }))}
                            />
                            <Label htmlFor={`month-${month.monthYear}`} className="ml-3 text-sm">
                              {month.monthYear} (Fee: ₹{month.feeForMonth.toLocaleString()})
                              {isThisTheFinalMonth && <span className="text-xs text-muted-foreground ml-1">(Final Month)</span>}
                            </Label>
                          </div>
                          <div className="text-xs">
                            {month.isFullyPaid ? (
                              month.isCoveredByAdvance ? <span className="text-accent font-semibold">Paid (Advance)</span> : <span className="text-green-600 font-semibold">Paid</span>
                            ) : (
                              <span className="text-destructive">Due: ₹{month.remainingDue.toLocaleString()}</span>
                            )}
                            {month.paidForMonth > 0 && !month.isFullyPaid && <span className="text-muted-foreground ml-1">(Paid: ₹{month.paidForMonth.toLocaleString()})</span>}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                     <p className="text-sm text-muted-foreground p-4 text-center">No monthly fees applicable yet or course completed.</p>
                  )}
                </ScrollArea>
                {finalBillableMonthsDetails.some(m => {
                    const isThisTheFinalMonth = finalBillableMonthDate && isEqual(startOfMonth(m.monthDate), startOfMonth(finalBillableMonthDate));
                    return selectedMonthsToPay[m.monthYear] && m.remainingDue > 0 && !m.isCoveredByAdvance && !isThisTheFinalMonth;
                }) && (
                    <Button onClick={handlePaySelectedMonths} className="mt-3 w-full animate-button-click">
                        <DollarSign className="mr-2 h-4 w-4"/>Pay for Selected Month(s)
                    </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-primary font-headline"><Landmark className="mr-2 h-5 w-5" />Record Ad-hoc Payment</CardTitle>
              <CardDescription>Make a general payment or pay in advance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label htmlFor="adhocAmount">Amount (₹)</Label>
                <Input 
                    id="adhocAmount" 
                    type="number" 
                    value={adhocPaymentAmount} 
                    onChange={(e) => setAdhocPaymentAmount(e.target.value)} 
                    placeholder="Enter amount"
                    className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="adhocPaymentType">Payment Type</Label>
                <Select value={adhocPaymentType} onValueChange={(value: AdhocPaymentType) => setAdhocPaymentType(value)}>
                    <SelectTrigger id="adhocPaymentType" className="mt-1">
                        <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="settle_dues">Settle Dues</SelectItem>
                        <SelectItem value="pay_in_advance">Pay in Advance</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="adhocRemarks">Remarks (Optional)</Label>
                <Textarea 
                    id="adhocRemarks" 
                    value={adhocPaymentRemarks} 
                    onChange={(e) => setAdhocPaymentRemarks(e.target.value)} 
                    placeholder="e.g., Cash payment from parent"
                    rows={3}
                    className="mt-1"
                />
              </div>
              <Button onClick={handleAdhocPaymentSubmit} className="w-full animate-button-click" disabled={parseFloat(String(adhocPaymentAmount)) <=0 || isNaN(parseFloat(String(adhocPaymentAmount)))}>
                <DollarSign className="mr-2 h-4 w-4"/> Submit Payment
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

