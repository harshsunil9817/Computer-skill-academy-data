
"use client";
import React, { useState } from 'react';
import { PlusCircle, Edit, Trash2, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useAppContext } from '@/lib/context/AppContext';
import type { Course, CourseFormData, ExamFee, PaymentPlan } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const initialCourseFormState: CourseFormData = {
  name: '',
  enrollmentFee: 0,
  paymentType: 'monthly',
  monthlyFee: 0,
  examFees: [],
  paymentPlans: [],
};

export default function CoursesPage() {
  const { courses, addCourse, updateCourse, deleteCourse, isLoading } = useAppContext();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [courseForm, setCourseForm] = useState<CourseFormData>(initialCourseFormState);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  
  // State for exam fees
  const [newExamFee, setNewExamFee] = useState({ name: '', amount: '' });
  const [editingExamFeeIndex, setEditingExamFeeIndex] = useState<number | null>(null);
  
  // State for installment plans
  const [newPaymentPlan, setNewPaymentPlan] = useState({ name: '', installments: '' });
  const [editingPaymentPlanIndex, setEditingPaymentPlanIndex] = useState<number | null>(null);

  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const isNumericField = ['enrollmentFee', 'monthlyFee'].includes(name);
    setCourseForm((prev) => ({
      ...prev,
      [name]: isNumericField ? parseFloat(value) || 0 : value,
    }));
  };

  // --- Exam Fee Management ---
  const handleSaveExamFee = () => {
    const amount = parseFloat(newExamFee.amount);
    if (newExamFee.name && !isNaN(amount) && amount > 0) {
      if (editingExamFeeIndex !== null) {
        setCourseForm(prev => {
          const updatedFees = [...(prev.examFees || [])];
          updatedFees[editingExamFeeIndex] = { name: newExamFee.name, amount };
          return { ...prev, examFees: updatedFees };
        });
        setEditingExamFeeIndex(null);
        toast({ title: "Success", description: "Exam fee updated." });
      } else {
        setCourseForm(prev => ({
          ...prev,
          examFees: [...(prev.examFees || []), { name: newExamFee.name, amount }]
        }));
        toast({ title: "Success", description: "Exam fee added." });
      }
      setNewExamFee({ name: '', amount: '' }); // Reset form
    } else {
      toast({ title: "Error", description: "Please enter a valid fee name and a positive amount.", variant: "destructive" });
    }
  };

  const handleEditExamFee = (index: number) => {
    const feeToEdit = (courseForm.examFees || [])[index];
    if (feeToEdit) {
      setEditingExamFeeIndex(index);
      setNewExamFee({ name: feeToEdit.name, amount: String(feeToEdit.amount) });
    }
  };
  
  const handleCancelEditExamFee = () => {
    setEditingExamFeeIndex(null);
    setNewExamFee({ name: '', amount: '' });
  };

  const handleRemoveExamFee = (index: number) => {
    if (editingExamFeeIndex === index) {
      handleCancelEditExamFee();
    }
    setCourseForm(prev => ({
      ...prev,
      examFees: (prev.examFees || []).filter((_, i) => i !== index)
    }));
    toast({ title: "Fee Removed", description: "The exam fee has been removed." });
  };

  // --- Payment Plan Management ---
  const handleSavePaymentPlan = () => {
    const installments = newPaymentPlan.installments.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0);
    if (!newPaymentPlan.name || installments.length === 0) {
        toast({ title: "Error", description: "Please enter a valid plan name and at least one installment amount.", variant: "destructive" });
        return;
    }

    const totalAmount = installments.reduce((sum, current) => sum + current, 0);
    const plan: PaymentPlan = { name: newPaymentPlan.name, installments, totalAmount };

    if (editingPaymentPlanIndex !== null) {
        setCourseForm(prev => {
            const updatedPlans = [...prev.paymentPlans];
            updatedPlans[editingPaymentPlanIndex] = plan;
            return { ...prev, paymentPlans: updatedPlans };
        });
        toast({ title: "Success", description: "Payment plan updated." });
    } else {
        setCourseForm(prev => ({
            ...prev,
            paymentPlans: [...(prev.paymentPlans || []), plan]
        }));
        toast({ title: "Success", description: "Payment plan added." });
    }
    setNewPaymentPlan({ name: '', installments: '' });
    setEditingPaymentPlanIndex(null);
  };

  const handleEditPaymentPlan = (index: number) => {
      const planToEdit = (courseForm.paymentPlans || [])[index];
      if(planToEdit) {
        setEditingPaymentPlanIndex(index);
        setNewPaymentPlan({ name: planToEdit.name, installments: planToEdit.installments.join(', ') });
      }
  };
  
  const handleCancelEditPaymentPlan = () => {
    setEditingPaymentPlanIndex(null);
    setNewPaymentPlan({ name: '', installments: '' });
  };

  const handleRemovePaymentPlan = (index: number) => {
    if (editingPaymentPlanIndex === index) {
      handleCancelEditPaymentPlan();
    }
    setCourseForm(prev => ({
      ...prev,
      paymentPlans: (prev.paymentPlans || []).filter((_, i) => i !== index)
    }));
    toast({ title: "Plan Removed", description: "The payment plan has been removed." });
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!courseForm.name || courseForm.enrollmentFee < 0) {
      toast({ title: "Error", description: "Please fill name and enrollment fee.", variant: "destructive" });
      return;
    }
    
    if (courseForm.paymentType === 'monthly' && courseForm.monthlyFee <= 0) {
        toast({ title: "Error", description: "Monthly fee must be positive for monthly courses.", variant: "destructive" });
        return;
    }
     if (courseForm.paymentType === 'installment' && (courseForm.paymentPlans || []).length === 0) {
        toast({ title: "Error", description: "Please add at least one payment plan for an installment-based course.", variant: "destructive" });
        return;
    }
    
    try {
      if (editingCourse) {
        const coursePayload: Course = {
            ...editingCourse,
            name: courseForm.name,
            enrollmentFee: courseForm.enrollmentFee,
            paymentType: courseForm.paymentType,
            monthlyFee: courseForm.paymentType === 'monthly' ? courseForm.monthlyFee : 0,
            examFees: courseForm.examFees || [],
            paymentPlans: courseForm.paymentType === 'installment' ? (courseForm.paymentPlans || []) : [],
        };
        await updateCourse(coursePayload);
        toast({ title: "Success", description: "Course updated successfully." });
      } else {
        const coursePayload: Omit<Course, 'id'> = {
            ...courseForm,
            monthlyFee: courseForm.paymentType === 'monthly' ? courseForm.monthlyFee : 0,
            paymentPlans: courseForm.paymentType === 'installment' ? (courseForm.paymentPlans || []) : [],
            examFees: courseForm.examFees || [],
        }
        await addCourse(coursePayload);
        toast({ title: "Success", description: "Course added successfully." });
      }
      setIsDialogOpen(false);
    } catch (error: any) {
      console.error("Course operation failed:", error);
      toast({
        title: "Operation Failed",
        description: error.message || "Could not save course. Please check the console for more details.",
        variant: "destructive",
      });
    }
  };

  const openAddDialog = () => {
    setEditingCourse(null);
    setCourseForm(initialCourseFormState);
    handleCancelEditExamFee();
    handleCancelEditPaymentPlan();
    setIsDialogOpen(true);
  };

  const openEditDialog = (course: Course) => {
    setEditingCourse(course);
    setCourseForm({
        name: course.name,
        enrollmentFee: course.enrollmentFee,
        monthlyFee: course.monthlyFee,
        paymentType: course.paymentType,
        examFees: course.examFees || [],
        paymentPlans: course.paymentPlans || [],
    });
    handleCancelEditExamFee();
    handleCancelEditPaymentPlan();
    setIsDialogOpen(true);
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      await deleteCourse(courseId);
      toast({ title: "Success", description: "Course deleted successfully." });
    } catch (error: any) {
      console.error("Delete course failed:", error);
      toast({
        title: "Deletion Failed",
        description: error.message || "Could not delete course. Please check the console for more details.",
        variant: "destructive",
      });
    }
  };
  
  if (isLoading) {
    return <div className="text-center py-10">Loading course data...</div>;
  }

  return (
    <>
      <PageHeader
        title="Manage Courses"
        description="Add, view, and edit your academy's courses."
        action={
          <Button onClick={openAddDialog} className="animate-button-click">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Course
          </Button>
        }
      />

      {courses.length === 0 ? (
        <Card className="shadow-lg text-center py-12 animate-slide-in">
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
              <BookOpen className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="mt-4 text-2xl font-headline">No Courses Yet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Start by adding your first course to the academy.</p>
            <Button onClick={openAddDialog} className="mt-6 animate-button-click">
              <PlusCircle className="mr-2 h-5 w-5" /> Add First Course
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-20rem)]">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-slide-in">
          {courses.map((course) => (
            <Card key={course.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader>
                <CardTitle className="font-headline text-primary">{course.name}</CardTitle>
                <CardDescription>Payment Type: <span className="capitalize">{course.paymentType}</span></CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">
                  Enrollment Fee: <span className="font-semibold text-foreground">₹{course.enrollmentFee.toLocaleString()}</span>
                </p>
                {course.paymentType === 'monthly' && (
                    <p className="text-sm text-muted-foreground">
                    Monthly Fee: <span className="font-semibold text-foreground">₹{course.monthlyFee.toLocaleString()}</span>
                    </p>
                )}
                 {course.paymentType === 'installment' && course.paymentPlans?.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">Payment Plans:</span>
                        <ul className="list-disc pl-5">
                            {course.paymentPlans.map(plan => (
                                <li key={plan.name}>{plan.name} (₹{plan.totalAmount.toLocaleString()})</li>
                            ))}
                        </ul>
                    </div>
                )}
                 {course.examFees?.length > 0 && (
                     <div className="text-sm text-muted-foreground mt-2">
                        <span className="font-semibold text-foreground">Exam Fees:</span>
                        <ul className="list-disc pl-5">
                            {course.examFees.map(fee => (
                                <li key={fee.name}>{fee.name} (₹{fee.amount.toLocaleString()})</li>
                            ))}
                        </ul>
                    </div>
                 )}
              </CardContent>
              <div className="border-t p-4 flex justify-end space-x-2">
                <Button variant="outline" size="sm" onClick={() => openEditDialog(course)} className="animate-button-click">
                  <Edit className="mr-1 h-4 w-4" /> Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDeleteCourse(course.id)} className="animate-button-click">
                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
        </ScrollArea>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md shadow-2xl rounded-lg">
          <DialogHeader>
            <DialogTitle className="font-headline text-primary">{editingCourse ? 'Edit Course' : 'Add New Course'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
          <form onSubmit={handleSubmit} className="pr-4 py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Course Name</Label>
                <Input id="name" name="name" value={courseForm.name} onChange={handleInputChange} placeholder="e.g., Web Development" />
              </div>
               <div className="space-y-2">
                <Label htmlFor="enrollmentFee">Enrollment Fee (₹)</Label>
                <Input id="enrollmentFee" name="enrollmentFee" type="number" value={courseForm.enrollmentFee} onChange={handleInputChange} placeholder="e.g., 500" />
              </div>
              <div className="space-y-2">
                  <Label>Payment Type</Label>
                  <RadioGroup
                      name="paymentType"
                      value={courseForm.paymentType}
                      onValueChange={(value: 'monthly' | 'installment') => setCourseForm(prev => ({ ...prev, paymentType: value }))}
                      className="flex gap-4"
                      disabled={!!editingCourse}
                  >
                      <div className="flex items-center space-x-2">
                          <RadioGroupItem value="monthly" id="r1" />
                          <Label htmlFor="r1">Monthly Fees</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                          <RadioGroupItem value="installment" id="r2" />
                          <Label htmlFor="r2">Installment Plan</Label>
                      </div>
                  </RadioGroup>
                  {editingCourse && <p className="text-xs text-muted-foreground">Payment type cannot be changed for an existing course.</p>}
              </div>

              {courseForm.paymentType === 'monthly' && (
                <div className="space-y-2">
                    <Label htmlFor="monthlyFee">Monthly Fee (₹)</Label>
                    <Input id="monthlyFee" name="monthlyFee" type="number" value={courseForm.monthlyFee} onChange={handleInputChange} placeholder="e.g., 500" />
                </div>
              )}
            
            {courseForm.paymentType === 'installment' && (
                 <div className="space-y-4 rounded-md border p-4">
                    <Label className="text-base font-medium">Installment Plans</Label>
                    <p className="text-sm text-muted-foreground">Add or edit installment plans for this course.</p>
                    
                    <div className="flex gap-2 items-end">
                        <div className="flex-1 space-y-1">
                            <Label htmlFor="planName" className="text-xs">Plan Name</Label>
                            <Input id="planName" value={newPaymentPlan.name} onChange={(e) => setNewPaymentPlan({...newPaymentPlan, name: e.target.value})} placeholder="e.g., Two Installments" />
                        </div>
                        <div className="flex-1 space-y-1">
                            <Label htmlFor="installments" className="text-xs">Installments (₹, comma-separated)</Label>
                            <Input id="installments" value={newPaymentPlan.installments} onChange={(e) => setNewPaymentPlan({...newPaymentPlan, installments: e.target.value})} placeholder="e.g., 1500, 1500" />
                        </div>
                        <Button type="button" onClick={handleSavePaymentPlan} size="sm">{editingPaymentPlanIndex !== null ? 'Update' : 'Add'}</Button>
                        {editingPaymentPlanIndex !== null && (
                            <Button type="button" variant="ghost" onClick={handleCancelEditPaymentPlan} size="sm">Cancel</Button>
                        )}
                    </div>
                    <Separator />
                    <div className="space-y-2">
                        {(courseForm.paymentPlans || []).map((plan, index) => (
                            <div key={index} className={cn("flex justify-between items-center rounded-md bg-muted p-2 text-sm", {'ring-2 ring-primary': editingPaymentPlanIndex === index})}>
                                <div>
                                  <p className="font-medium">{plan.name} - ₹{plan.totalAmount.toLocaleString()}</p>
                                  <p className="text-xs text-muted-foreground">({plan.installments.join(', ')})</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleEditPaymentPlan(index)} className="h-6 w-6" disabled={editingPaymentPlanIndex === index}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemovePaymentPlan(index)} className="h-6 w-6">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                        {(courseForm.paymentPlans || []).length === 0 && (
                            <p className="text-xs text-center text-muted-foreground py-2">No installment plans added.</p>
                        )}
                    </div>
                </div>
            )}
            
            <div className="space-y-4 rounded-md border p-4">
                <Label className="text-base font-medium">Exam Fees</Label>
                <p className="text-sm text-muted-foreground">Add or edit exam fees for this course.</p>
                
                <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                        <Label htmlFor="examFeeName" className="text-xs">Fee Name</Label>
                        <Input id="examFeeName" value={newExamFee.name} onChange={(e) => setNewExamFee({...newExamFee, name: e.target.value})} placeholder="e.g., Final Exam" />
                    </div>
                    <div className="w-32 space-y-1">
                        <Label htmlFor="examFeeAmount" className="text-xs">Amount (₹)</Label>
                        <Input id="examFeeAmount" type="number" value={newExamFee.amount} onChange={(e) => setNewExamFee({...newExamFee, amount: e.target.value})} placeholder="e.g., 500" />
                    </div>
                    <Button type="button" onClick={handleSaveExamFee} size="sm">{editingExamFeeIndex !== null ? 'Update' : 'Add'}</Button>
                    {editingExamFeeIndex !== null && (
                         <Button type="button" variant="ghost" onClick={handleCancelEditExamFee} size="sm">Cancel</Button>
                    )}
                </div>
                 <Separator />
                <div className="space-y-2">
                    {(courseForm.examFees || []).map((fee, index) => (
                        <div key={index} className={cn("flex justify-between items-center rounded-md bg-muted p-2 text-sm", {'ring-2 ring-primary': editingExamFeeIndex === index})}>
                            <p className="font-medium">{fee.name} - ₹{fee.amount.toLocaleString()}</p>
                            <div className="flex items-center gap-1">
                                <Button type="button" variant="ghost" size="icon" onClick={() => handleEditExamFee(index)} className="h-6 w-6" disabled={editingExamFeeIndex === index}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveExamFee(index)} className="h-6 w-6">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    {(courseForm.examFees || []).length === 0 && (
                        <p className="text-xs text-center text-muted-foreground py-2">No exam fees added.</p>
                    )}
                </div>
            </div>

            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="animate-button-click">Cancel</Button>
              </DialogClose>
              <Button type="submit" className="animate-button-click">{editingCourse ? 'Save Changes' : 'Add Course'}</Button>
            </DialogFooter>
          </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
