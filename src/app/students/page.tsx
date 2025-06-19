
"use client";
import React, { useState, useEffect } from 'react';
import { PlusCircle, User, Users, MoreVertical, CreditCard, History, DollarSign, CalendarCheck2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useAppContext } from '@/lib/context/AppContext';
import type { Student, StudentFormData, Course, PaymentRecord } from '@/lib/types';
import { DateOfBirthPicker } from '@/components/students/DateOfBirthPicker';
import { EnrollmentDateDropdownPicker } from '@/components/students/EnrollmentDateDropdownPicker';
import { DOB_DAYS, DOB_MONTHS, DOB_YEARS, COURSE_DURATION_UNITS, MOBILE_REGEX, AADHAR_REGEX } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { format, addMonths, isBefore, isEqual, startOfMonth, parse } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';


const today = new Date();
const initialStudentFormState: StudentFormData = {
  name: '',
  fatherName: '',
  dob: { day: DOB_DAYS[0], month: DOB_MONTHS[0].value, year: DOB_YEARS[0] },
  mobile: '',
  aadhar: '',
  enrollmentDate: { 
    day: String(today.getDate()).padStart(2, '0'),
    month: String(today.getMonth() + 1).padStart(2, '0'), 
    year: String(today.getFullYear()),
  },
  courseId: '',
  courseDurationValue: 1,
  courseDurationUnit: 'months',
};

type PaymentType = 'enrollment' | 'monthly' | 'partial';

interface BillableMonthForDialog {
  monthYear: string; // "MMMM yyyy"
  dueDate: Date;
  amountPaidThisMonth: number;
  amountDueThisMonth: number; // Full monthly fee
  isFullyPaid: boolean;
  remainingDue: number;
}

const initialPaymentFormState = {
  type: 'monthly' as PaymentType,
  amount: 0,
  monthFor: format(new Date(), "MMMM yyyy"),
  remarks: '',
};

export default function StudentsPage() {
  const { students, courses, addStudent, isLoading, addPayment } = useAppContext();
  const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false);
  const [studentForm, setStudentForm] = useState<StudentFormData>(initialStudentFormState);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedCourseDetails, setSelectedCourseDetails] = useState<{enrollmentFee: number, monthlyFee: number} | null>(null);
  const { toast } = useToast();

  const [viewingStudentHistory, setViewingStudentHistory] = useState<Student | null>(null);
  const [isRecordPaymentDialogOpen, setIsRecordPaymentDialogOpen] = useState(false);
  const [recordingPaymentForStudent, setRecordingPaymentForStudent] = useState<Student | null>(null);
  const [paymentForm, setPaymentForm] = useState(initialPaymentFormState);
  
  const [billableMonthsForDialog, setBillableMonthsForDialog] = useState<BillableMonthForDialog[]>([]);
  const [selectedMonthsToPayInDialog, setSelectedMonthsToPayInDialog] = useState<Record<string, boolean>>({});

  const studentCourseForPayment = recordingPaymentForStudent ? courses.find(c => c.id === recordingPaymentForStudent.courseId) : null;

  useEffect(() => {
    if (studentForm.courseId && courses.length > 0) {
      const course = courses.find(c => c.id === studentForm.courseId);
      if (course) {
        setSelectedCourseDetails({ enrollmentFee: course.enrollmentFee, monthlyFee: course.monthlyFee });
      } else {
        setSelectedCourseDetails(null);
      }
    } else {
      setSelectedCourseDetails(null);
    }
  }, [studentForm.courseId, courses]);

  useEffect(() => {
    if (recordingPaymentForStudent && studentCourseForPayment) {
      if (recordingPaymentForStudent.status === 'enrollment_pending') {
        setPaymentForm({
          type: 'enrollment',
          amount: studentCourseForPayment.enrollmentFee,
          monthFor: '', 
          remarks: `Enrollment fee for ${studentCourseForPayment.name}`,
        });
        setBillableMonthsForDialog([]);
        setSelectedMonthsToPayInDialog({});
      } else { // Active or completed_unpaid
         setPaymentForm({ 
          type: 'monthly', 
          amount: 0, // Amount will be derived from selected months for 'monthly'
          monthFor: format(new Date(), "MMMM yyyy"), 
          remarks: `Monthly fee for ${studentCourseForPayment.name}`,
        });
        // Calculate billable months for the dialog if type is 'monthly'
        const months: BillableMonthForDialog[] = [];
        const currentDate = startOfMonth(new Date());
        const enrollmentDate = startOfMonth(new Date(recordingPaymentForStudent.enrollmentDate));
        let currentBillableMonthDate = addMonths(enrollmentDate, 1); 

        while (isBefore(currentBillableMonthDate, currentDate) || isEqual(currentBillableMonthDate, currentDate)) {
          const monthStr = format(currentBillableMonthDate, "MMMM yyyy");
          const paymentsForThisMonth = recordingPaymentForStudent.paymentHistory.filter(p => 
            (p.type === 'monthly' || p.type === 'partial') && p.monthFor === monthStr
          );
          const amountPaidForThisMonth = paymentsForThisMonth.reduce((sum, p) => sum + p.amount, 0);
          const remainingDueForThisMonth = Math.max(0, studentCourseForPayment.monthlyFee - amountPaidForThisMonth);
          
          months.push({
            monthYear: monthStr,
            dueDate: new Date(currentBillableMonthDate),
            amountPaidThisMonth: amountPaidForThisMonth,
            amountDueThisMonth: studentCourseForPayment.monthlyFee,
            isFullyPaid: remainingDueForThisMonth <= 0,
            remainingDue: remainingDueForThisMonth,
          });
          currentBillableMonthDate = addMonths(currentBillableMonthDate, 1);
        }
        months.sort((a,b) => a.dueDate.getTime() - b.dueDate.getTime());
        setBillableMonthsForDialog(months);
        setSelectedMonthsToPayInDialog({});
      }
    } else {
      setPaymentForm(initialPaymentFormState);
      setBillableMonthsForDialog([]);
      setSelectedMonthsToPayInDialog({});
    }
  }, [recordingPaymentForStudent, studentCourseForPayment]);


  const handleStudentFormInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
     if (name === 'courseDurationValue') {
      setStudentForm(prev => ({ ...prev, [name]: parseInt(value) || 1 }));
    } else {
      setStudentForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDobChange = (dob: { day: string; month: string; year: string }) => {
    setStudentForm(prev => ({ ...prev, dob }));
  };

  const handleEnrollmentDateObjChange = (dateObj: { day: string; month: string; year: string }) => { 
    setStudentForm(prev => ({ ...prev, enrollmentDate: dateObj }));
  };

  const handleAddStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!MOBILE_REGEX.test(studentForm.mobile)) {
      toast({ title: "Error", description: "Mobile number must be 10 digits.", variant: "destructive" });
      return;
    }
    if (!AADHAR_REGEX.test(studentForm.aadhar)) {
      toast({ title: "Error", description: "Aadhar number must be 12 digits.", variant: "destructive" });
      return;
    }
    if (!studentForm.courseId) {
      toast({ title: "Error", description: "Please select a course.", variant: "destructive" });
      return;
    }

    try {
      await addStudent(studentForm); 
      toast({ title: "Success", description: "Student added successfully. Enrollment fee pending." });
      setIsAddStudentDialogOpen(false);
      const todayForForm = new Date();
      setStudentForm({
        ...initialStudentFormState,
        enrollmentDate: {
          day: String(todayForForm.getDate()).padStart(2, '0'),
          month: String(todayForForm.getMonth() + 1).padStart(2, '0'),
          year: String(todayForForm.getFullYear()),
        }
      });
      setSelectedCourseDetails(null);
    } catch (error: any) {
      console.error("Student operation failed:", error);
      toast({
        title: "Operation Failed",
        description: error.message || "Could not save student. Check permissions or console.",
        variant: "destructive",
      });
    }
  };

  const openAddStudentDialog = () => {
    setEditingStudent(null);
    const todayForForm = new Date();
    setStudentForm({
        ...initialStudentFormState,
        enrollmentDate: {
          day: String(todayForForm.getDate()).padStart(2, '0'),
          month: String(todayForForm.getMonth() + 1).padStart(2, '0'),
          year: String(todayForForm.getFullYear()),
        }
      });
    setSelectedCourseDetails(null);
    setIsAddStudentDialogOpen(true);
  };

  const openPaymentHistoryDialog = (student: Student) => {
    setViewingStudentHistory(student);
  };

  const openRecordPaymentDialog = (student: Student) => {
    setRecordingPaymentForStudent(student);
    // useEffect will set paymentForm and billableMonthsForDialog
    setIsRecordPaymentDialogOpen(true);
  };
  
  const handlePaymentFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let newAmount = paymentForm.amount;

    if (name === 'type') {
        const newType = value as PaymentType;
        if (newType === 'enrollment' && studentCourseForPayment && recordingPaymentForStudent?.status === 'enrollment_pending') {
            newAmount = studentCourseForPayment.enrollmentFee;
        } else if (newType === 'monthly' && studentCourseForPayment) {
             newAmount = 0; // For monthly, amount is derived from selected months
        } else if (newType === 'partial' && studentCourseForPayment) {
            newAmount = paymentForm.amount > 0 && paymentForm.type === 'partial' ? paymentForm.amount : 0; 
        }
         setPaymentForm(prev => ({ ...prev, type: newType, amount: newAmount, monthFor: newType === 'enrollment' ? '' : prev.monthFor || format(new Date(), "MMMM yyyy") }));
    } else if (name === 'amount') {
        setPaymentForm(prev => ({ ...prev, amount: parseFloat(value) || 0 }));
    }
     else { 
        setPaymentForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleMonthSelectionInDialog = (monthYear: string, checked: boolean) => {
    setSelectedMonthsToPayInDialog(prev => ({ ...prev, [monthYear]: checked }));
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordingPaymentForStudent || !studentCourseForPayment) {
      toast({ title: "Error", description: "Student or course data missing.", variant: "destructive" });
      return;
    }

    try {
      if (paymentForm.type === 'monthly') {
        const monthsToPayInDialog = billableMonthsForDialog.filter(
          bm => selectedMonthsToPayInDialog[bm.monthYear] && !bm.isFullyPaid && bm.remainingDue > 0
        );

        if (monthsToPayInDialog.length === 0) {
          toast({ title: "Info", description: "No months selected for payment or all selected months are already paid/have no dues.", variant: "default" });
          return;
        }

        for (const monthPayment of monthsToPayInDialog) {
          await addPayment(recordingPaymentForStudent.id, {
            date: new Date().toISOString(),
            amount: monthPayment.remainingDue, 
            type: 'monthly', 
            monthFor: monthPayment.monthYear, 
            remarks: paymentForm.remarks || `Payment for ${monthPayment.monthYear} for ${studentCourseForPayment.name}`
          });
        }
        toast({ title: "Success", description: `Payments recorded for ${monthsToPayInDialog.length} selected month(s) for ${recordingPaymentForStudent.name}.` });

      } else { // Enrollment or Partial
        if (paymentForm.amount <= 0) {
          toast({ title: "Error", description: "Payment amount must be greater than zero.", variant: "destructive" });
          return;
        }
        if (paymentForm.type === 'partial' && !paymentForm.monthFor.trim()) {
          toast({ title: "Error", description: "Please specify 'Month For' (e.g., July 2024) for partial payments.", variant: "destructive" });
          return;
        }
        if (paymentForm.type === 'partial' && !/^[A-Za-z]+ [0-9]{4}$/.test(paymentForm.monthFor.trim())) {
            toast({ title: "Error", description: "Invalid 'Month For' format. Expected 'Month Year' (e.g., July 2024).", variant: "destructive" });
            return;
        }

        const paymentDetails: Omit<PaymentRecord, 'id'> = {
          date: new Date().toISOString(),
          amount: paymentForm.amount,
          type: paymentForm.type,
          monthFor: paymentForm.type === 'partial' ? paymentForm.monthFor.trim() : undefined,
          remarks: paymentForm.remarks || `${paymentForm.type} fee for ${studentCourseForPayment.name}${paymentForm.monthFor && paymentForm.type === 'partial' ? ` for ${paymentForm.monthFor.trim()}` : ''}`,
        };
        await addPayment(recordingPaymentForStudent.id, paymentDetails);
        toast({ title: "Success", description: `${paymentForm.type.charAt(0).toUpperCase() + paymentForm.type.slice(1)} payment of ₹${paymentForm.amount} recorded for ${recordingPaymentForStudent.name}.` });
      }
      
      setIsRecordPaymentDialogOpen(false);
      setRecordingPaymentForStudent(null); // This will trigger useEffect to reset paymentForm & billableMonths
      setPaymentForm(initialPaymentFormState);
      setSelectedMonthsToPayInDialog({});

    } catch (error: any) {
      console.error("Failed to record payment:", error);
      toast({ title: "Error", description: `Failed to record payment: ${error.message}`, variant: "destructive" });
    }
  };
  

  const pageHeader = (
    <PageHeader
      title="Manage Students"
      description="Add new students and view existing enrollments."
      action={
        <Button onClick={openAddStudentDialog} className="animate-button-click" disabled={isLoading}>
          <PlusCircle className="mr-2 h-5 w-5" /> Add New Student
        </Button>
      }
    />
  );
  
  const renderStudentDialog = () => (
    <Dialog open={isAddStudentDialogOpen} onOpenChange={setIsAddStudentDialogOpen}>
      <DialogContent className="sm:max-w-lg shadow-2xl rounded-lg">
        <DialogHeader>
          <DialogTitle className="font-headline text-primary">{editingStudent ? 'Edit Student' : 'Add New Student'}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
        <form onSubmit={handleAddStudentSubmit} className="p-1 pr-4">
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label htmlFor="name">Student Name</Label>
              <Input id="name" name="name" value={studentForm.name} onChange={handleStudentFormInputChange} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="fatherName">Father&apos;s Name</Label>
              <Input id="fatherName" name="fatherName" value={studentForm.fatherName} onChange={handleStudentFormInputChange} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dob">Date of Birth</Label>
              <DateOfBirthPicker id="dob" value={studentForm.dob} onChange={handleDobChange} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mobile">Mobile Number (10 digits)</Label>
              <Input id="mobile" name="mobile" type="tel" value={studentForm.mobile} onChange={handleStudentFormInputChange} maxLength={10} pattern="\d{10}" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="aadhar">Aadhar Number (12 digits)</Label>
              <Input id="aadhar" name="aadhar" type="text" value={studentForm.aadhar} onChange={handleStudentFormInputChange} maxLength={12} pattern="\d{12}" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="enrollmentDate">Enrollment Date</Label>
              <EnrollmentDateDropdownPicker id="enrollmentDate" value={studentForm.enrollmentDate} onChange={handleEnrollmentDateObjChange} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="courseId">Course</Label>
              <Select name="courseId" value={studentForm.courseId} onValueChange={(value) => setStudentForm(prev => ({ ...prev, courseId: value }))} required>
                <SelectTrigger><SelectValue placeholder="Select a course" /></SelectTrigger>
                <SelectContent>
                  {courses.map(course => (
                    <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedCourseDetails && (
              <div className="grid grid-cols-2 gap-4 p-3 border rounded-md bg-primary/5">
                  <p className="text-sm">Enrollment Fee: <span className="font-bold text-primary">₹{selectedCourseDetails.enrollmentFee}</span></p>
                  <p className="text-sm">Monthly Fee: <span className="font-bold text-primary">₹{selectedCourseDetails.monthlyFee}</span></p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                  <Label htmlFor="courseDurationValue">Course Duration</Label>
                  <Input id="courseDurationValue" name="courseDurationValue" type="number" min="1" value={studentForm.courseDurationValue} onChange={handleStudentFormInputChange} required />
              </div>
              <div className="space-y-1 self-end">
                  <Select name="courseDurationUnit" value={studentForm.courseDurationUnit} onValueChange={(value) => setStudentForm(prev => ({ ...prev, courseDurationUnit: value as 'months' | 'years' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                      {COURSE_DURATION_UNITS.map(unit => (
                      <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>
                      ))}
                  </SelectContent>
                  </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="animate-button-click">Cancel</Button>
            </DialogClose>
            <Button type="submit" className="animate-button-click">{editingStudent ? 'Save Changes' : 'Add Student'}</Button>
          </DialogFooter>
        </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );

  const renderPaymentHistoryDialog = () => (
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
                  <TableHead>Month For</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {viewingStudentHistory.paymentHistory.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(payment => (
                  <TableRow key={payment.id}>
                    <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                    <TableCell>{payment.amount.toLocaleString()}</TableCell>
                    <TableCell className="capitalize">{payment.type}</TableCell>
                    <TableCell>{payment.monthFor || 'N/A'}</TableCell>
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
  );

  const renderRecordPaymentDialog = () => {
    if (!recordingPaymentForStudent || !studentCourseForPayment) return null;

    const currentlySelectedMonthsForPaymentInDialog = billableMonthsForDialog.filter(
        bm => selectedMonthsToPayInDialog[bm.monthYear] && !bm.isFullyPaid
    );
    const totalAmountForSelectedMonthsInDialog = currentlySelectedMonthsForPaymentInDialog.reduce(
        (sum, bm) => sum + bm.remainingDue, 0
    );


    return (
        <Dialog open={isRecordPaymentDialogOpen} onOpenChange={() => { setIsRecordPaymentDialogOpen(false); setRecordingPaymentForStudent(null); }}>
            <DialogContent className="sm:max-w-md shadow-2xl rounded-lg">
                <DialogHeader>
                    <DialogTitle className="font-headline text-primary">Record Payment for {recordingPaymentForStudent.name}</DialogTitle>
                    <CardDescription>Course: {studentCourseForPayment.name}</CardDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-2">
                <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 py-4">
                    <div>
                        <Label htmlFor="paymentType">Payment Type</Label>
                        <Select 
                            name="type" 
                            value={paymentForm.type} 
                            onValueChange={(value) => handlePaymentFormChange({ target: { name: 'type', value } } as any)}
                        >
                            <SelectTrigger id="paymentType">
                                <SelectValue placeholder="Select payment type" />
                            </SelectTrigger>
                            <SelectContent>
                                {recordingPaymentForStudent.status === 'enrollment_pending' && (
                                    <SelectItem value="enrollment">Enrollment Fee</SelectItem>
                                )}
                                {(recordingPaymentForStudent.status === 'active' || recordingPaymentForStudent.status === 'completed_unpaid') && (
                                  <>
                                    <SelectItem value="monthly">Monthly Fee (Select Months)</SelectItem>
                                    <SelectItem value="partial">Partial Fee (Single Month)</SelectItem>
                                  </>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {paymentForm.type === 'enrollment' && (
                        <div>
                            <Label htmlFor="paymentAmountEnrollment">Amount (₹)</Label>
                            <Input 
                                id="paymentAmountEnrollment" 
                                name="amount" 
                                type="number" 
                                value={paymentForm.amount} 
                                onChange={handlePaymentFormChange}
                                disabled // Enrollment fee is fixed
                                required 
                            />
                        </div>
                    )}

                    {paymentForm.type === 'partial' && (
                        <>
                            <div>
                                <Label htmlFor="paymentAmountPartial">Amount (₹)</Label>
                                <Input 
                                    id="paymentAmountPartial" 
                                    name="amount" 
                                    type="number" 
                                    value={paymentForm.amount} 
                                    onChange={handlePaymentFormChange}
                                    required 
                                />
                            </div>
                            <div>
                                <Label htmlFor="paymentMonthForPartial">Month For (e.g., July 2024)</Label>
                                <Input 
                                    id="paymentMonthForPartial" 
                                    name="monthFor" 
                                    type="text" 
                                    value={paymentForm.monthFor} 
                                    onChange={handlePaymentFormChange}
                                    placeholder="MMMM YYYY" 
                                    required
                                />
                            </div>
                        </>
                    )}
                    
                    {paymentForm.type === 'monthly' && billableMonthsForDialog.length > 0 && (
                        <div className="space-y-2 border rounded-md p-3 bg-muted/30">
                            <Label className="font-medium text-sm">Select Months to Pay:</Label>
                             <ScrollArea className="h-48 pr-2">
                                {billableMonthsForDialog.map((bm) => (
                                <div key={bm.monthYear} className="flex items-center justify-between p-2 rounded-md bg-background shadow-sm mb-1">
                                    <div className="flex items-center space-x-3">
                                    <Checkbox
                                        id={`dialog-${recordingPaymentForStudent.id}-${bm.monthYear}`}
                                        checked={bm.isFullyPaid || !!selectedMonthsToPayInDialog[bm.monthYear]}
                                        disabled={bm.isFullyPaid || bm.remainingDue <= 0}
                                        onCheckedChange={(checked) => handleMonthSelectionInDialog(bm.monthYear, !!checked)}
                                    />
                                    <Label htmlFor={`dialog-${recordingPaymentForStudent.id}-${bm.monthYear}`} className={cn("text-xs", bm.isFullyPaid ? "text-green-600" : "text-foreground")}>
                                        {bm.monthYear}
                                    </Label>
                                    </div>
                                    <div className="text-xs">
                                    {bm.isFullyPaid ? (
                                        <span className="text-green-600 font-semibold flex items-center"><CheckCircle className="h-3 w-3 mr-1"/>Paid</span>
                                    ) : (
                                        <>
                                        <span className={bm.remainingDue > 0 ? "text-destructive" : "text-muted-foreground"}>Due: ₹{bm.remainingDue.toLocaleString()}</span>
                                        {bm.amountPaidThisMonth > 0 && (
                                            <span className="text-xs text-muted-foreground ml-1">(Paid: ₹{bm.amountPaidThisMonth.toLocaleString()})</span>
                                        )}
                                        </>
                                    )}
                                    </div>
                                </div>
                                ))}
                            </ScrollArea>
                            {currentlySelectedMonthsForPaymentInDialog.length > 0 && (
                                <div className="text-sm font-medium pt-2 border-t">
                                    Total for Selected: ₹{totalAmountForSelectedMonthsInDialog.toLocaleString()}
                                </div>
                            )}
                        </div>
                    )}
                     {paymentForm.type === 'monthly' && billableMonthsForDialog.length === 0 && (
                        <p className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/30">No past due monthly fees found for this student.</p>
                    )}


                    <div>
                        <Label htmlFor="paymentRemarks">Remarks (Optional)</Label>
                        <Textarea 
                            id="paymentRemarks" 
                            name="remarks" 
                            value={paymentForm.remarks} 
                            onChange={handlePaymentFormChange} 
                            rows={3}
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button 
                            type="submit"
                            disabled={
                                (paymentForm.type === 'enrollment' && paymentForm.amount <= 0) ||
                                (paymentForm.type === 'partial' && paymentForm.amount <= 0) ||
                                (paymentForm.type === 'monthly' && currentlySelectedMonthsForPaymentInDialog.length === 0)
                            }
                        >
                           {paymentForm.type === 'monthly' ? 'Record Selected Month(s)' : 'Record Payment'}
                        </Button>
                    </DialogFooter>
                </form>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
  };

  if (isLoading) {
    return (
        <>
          {pageHeader}
          <div className="text-center py-10 text-muted-foreground">Loading student and course data...</div>
          {renderStudentDialog()}
        </>
    );
  }

  const activeStudentsList = students.filter(s => s.status === 'active' || s.status === 'enrollment_pending' || s.status === 'completed_unpaid');

  if (activeStudentsList.length === 0 && !isLoading) {
    return (
      <>
        {pageHeader}
        <Card className="shadow-lg text-center py-12 animate-slide-in">
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                <Users className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="mt-4 text-2xl font-headline">No Active Students Enrolled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Add your first student to get started.</p>
             <Button onClick={openAddStudentDialog} className="mt-6 animate-button-click">
                <PlusCircle className="mr-2 h-5 w-5" /> Add First Student
            </Button>
          </CardContent>
        </Card>
        {renderStudentDialog()}
        {renderPaymentHistoryDialog()}
        {renderRecordPaymentDialog()}
      </>
    );
  }
  
  return (
    <>
      {pageHeader}
      <ScrollArea className="h-[calc(100vh-20rem)]">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-slide-in">
          {activeStudentsList.map((student) => {
            const course = courses.find(c => c.id === student.courseId);
            const enrollmentDateObj = new Date(student.enrollmentDate);
            const formattedEnrollmentDate = !isNaN(enrollmentDateObj.getTime()) ? enrollmentDateObj.toLocaleDateString() : 'N/A';
            return (
              <Card key={student.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="bg-primary/20 text-primary p-3 rounded-full">
                            <User className="h-6 w-6" />
                        </div>
                        <div>
                            <CardTitle className="font-headline text-primary">{student.name}</CardTitle>
                            <CardDescription>Father: {student.fatherName}</CardDescription>
                        </div>
                    </div>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-5 w-5" />
                                <span className="sr-only">Student Actions</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                           <DropdownMenuItem asChild>
                             <Link href="/billing" className="flex items-center w-full cursor-pointer">
                                <CreditCard className="mr-2 h-4 w-4" /> Go to Billing
                             </Link>
                           </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPaymentHistoryDialog(student)} className="cursor-pointer">
                                <History className="mr-2 h-4 w-4" /> Payment History
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openRecordPaymentDialog(student)} className="cursor-pointer">
                                <DollarSign className="mr-2 h-4 w-4" /> Record Payment
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow space-y-2">
                  <p className="text-sm text-muted-foreground">Course: <span className="font-semibold text-foreground">{course?.name || 'N/A'}</span></p>
                  <p className="text-sm text-muted-foreground">Enrolled: <span className="font-semibold text-foreground">{formattedEnrollmentDate}</span></p>
                  <p className="text-sm text-muted-foreground">Mobile: <span className="font-semibold text-foreground">{student.mobile}</span></p>
                  <p className="text-sm text-muted-foreground">Status: <span className="font-semibold text-foreground capitalize">{student.status.replace('_', ' ')}</span></p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
      {renderStudentDialog()}
      {renderPaymentHistoryDialog()}
      {renderRecordPaymentDialog()}
    </>
  );
}
