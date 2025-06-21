
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
import type { Course, CourseFormData, ExamFee } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const initialCourseFormState: CourseFormData = {
  name: '',
  enrollmentFee: 0,
  paymentType: 'monthly',
  monthlyFee: 0,
  examFees: [],
};

export default function CoursesPage() {
  const { courses, addCourse, updateCourse, deleteCourse, isLoading } = useAppContext();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [courseForm, setCourseForm] = useState<CourseFormData>(initialCourseFormState);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [newExamFee, setNewExamFee] = useState({ name: '', amount: '' });
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const isNumericField = ['enrollmentFee', 'monthlyFee'].includes(name);
    setCourseForm((prev) => ({
      ...prev,
      [name]: isNumericField ? parseFloat(value) || 0 : value,
    }));
  };

  const handleAddExamFee = () => {
    const amount = parseFloat(newExamFee.amount);
    if (newExamFee.name && !isNaN(amount) && amount > 0) {
        setCourseForm(prev => ({
            ...prev,
            examFees: [...(prev.examFees || []), { name: newExamFee.name, amount }]
        }));
        setNewExamFee({ name: '', amount: '' }); // Reset form
    } else {
        toast({ title: "Error", description: "Please enter a valid fee name and a positive amount.", variant: "destructive" });
    }
  };

  const handleRemoveExamFee = (index: number) => {
      setCourseForm(prev => ({
          ...prev,
          examFees: (prev.examFees || []).filter((_, i) => i !== index)
      }));
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
    
    try {
      if (editingCourse) {
        const coursePayload: Course = {
            ...editingCourse,
            name: courseForm.name,
            enrollmentFee: courseForm.enrollmentFee,
            paymentType: courseForm.paymentType,
            monthlyFee: courseForm.paymentType === 'monthly' ? courseForm.monthlyFee : 0,
            examFees: courseForm.examFees || [],
            // Preserve payment plans, they are not editable in this simplified UI
            paymentPlans: editingCourse.paymentPlans,
        };
        await updateCourse(coursePayload);
        toast({ title: "Success", description: "Course updated successfully." });
      } else {
        const coursePayload: Omit<Course, 'id'> = {
            ...courseForm,
            monthlyFee: courseForm.paymentType === 'monthly' ? courseForm.monthlyFee : 0,
            paymentPlans: [], // New courses from UI are simple, no complex plans
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
    });
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
              </div>

              {courseForm.paymentType === 'monthly' ? (
                <div className="space-y-2">
                    <Label htmlFor="monthlyFee">Monthly Fee (₹)</Label>
                    <Input id="monthlyFee" name="monthlyFee" type="number" value={courseForm.monthlyFee} onChange={handleInputChange} placeholder="e.g., 500" />
                </div>
                ) : (
                <div className="space-y-2 p-3 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">
                        Installment plans for existing courses are pre-defined. 
                        New installment-based courses must be added directly to the database.
                    </p>
                </div>
                )}
            
             <div className="space-y-4 rounded-md border p-4">
                <Label className="text-base font-medium">Exam Fees</Label>
                <p className="text-sm text-muted-foreground">Add any exam fees associated with this course.</p>
                
                <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                        <Label htmlFor="examFeeName" className="text-xs">Fee Name</Label>
                        <Input id="examFeeName" value={newExamFee.name} onChange={(e) => setNewExamFee({...newExamFee, name: e.target.value})} placeholder="e.g., Final Exam" />
                    </div>
                    <div className="w-32 space-y-1">
                        <Label htmlFor="examFeeAmount" className="text-xs">Amount (₹)</Label>
                        <Input id="examFeeAmount" type="number" value={newExamFee.amount} onChange={(e) => setNewExamFee({...newExamFee, amount: e.target.value})} placeholder="e.g., 500" />
                    </div>
                    <Button type="button" onClick={handleAddExamFee} size="sm">Add</Button>
                </div>

                <div className="space-y-2">
                    {(courseForm.examFees || []).map((fee, index) => (
                        <div key={index} className="flex justify-between items-center rounded-md bg-muted p-2 text-sm">
                            <p className="font-medium">{fee.name} - ₹{fee.amount.toLocaleString()}</p>
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveExamFee(index)} className="h-6 w-6">
                                <Trash2 className="h-4 w-4" />
                            </Button>
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
