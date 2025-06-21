
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
import type { Course, CourseFormData, PaymentPlan, ExamFee } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

const initialCourseFormState: CourseFormData = {
  name: '',
  enrollmentFee: 0,
  paymentType: 'monthly',
  monthlyFee: 0,
  paymentPlansJSON: '[]',
  examFeesJSON: '[]',
};

export default function CoursesPage() {
  const { courses, addCourse, updateCourse, deleteCourse, isLoading } = useAppContext();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [courseForm, setCourseForm] = useState<CourseFormData>(initialCourseFormState);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const isNumericField = ['enrollmentFee', 'monthlyFee'].includes(name);
    setCourseForm((prev) => ({
      ...prev,
      [name]: isNumericField ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let paymentPlans: PaymentPlan[] = [];
    let examFees: ExamFee[] = [];

    try {
      if (courseForm.paymentType === 'installment') {
        paymentPlans = JSON.parse(courseForm.paymentPlansJSON);
      }
      examFees = JSON.parse(courseForm.examFeesJSON || '[]');
    } catch (error) {
      toast({ title: "Error", description: "Invalid JSON format in payment plans or exam fees.", variant: "destructive" });
      return;
    }
    
    if (!courseForm.name || courseForm.enrollmentFee < 0) {
      toast({ title: "Error", description: "Please fill name and enrollment fee.", variant: "destructive" });
      return;
    }
    
    if (courseForm.paymentType === 'monthly' && courseForm.monthlyFee <= 0) {
        toast({ title: "Error", description: "Monthly fee must be positive for monthly courses.", variant: "destructive" });
        return;
    }

    const coursePayload = {
      name: courseForm.name,
      enrollmentFee: courseForm.enrollmentFee,
      paymentType: courseForm.paymentType,
      monthlyFee: courseForm.paymentType === 'monthly' ? courseForm.monthlyFee : 0,
      paymentPlans: courseForm.paymentType === 'installment' ? paymentPlans : [],
      examFees: examFees,
    };

    try {
      if (editingCourse) {
        await updateCourse({ ...editingCourse, ...coursePayload });
        toast({ title: "Success", description: "Course updated successfully." });
      } else {
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
        paymentPlansJSON: JSON.stringify(course.paymentPlans || [], null, 2),
        examFeesJSON: JSON.stringify(course.examFees || [], null, 2),
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
                <div className="space-y-2">
                    <Label htmlFor="paymentPlansJSON">Payment Plans (JSON format)</Label>
                    <Textarea
                    id="paymentPlansJSON"
                    name="paymentPlansJSON"
                    value={courseForm.paymentPlansJSON}
                    onChange={handleInputChange}
                    rows={5}
                    placeholder='[{"name": "One-Time", "totalAmount": 2000, "installments": [2000]}]'
                    />
                     <p className="text-xs text-muted-foreground">Use valid JSON array format.</p>
                </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="examFeesJSON">Exam Fees (JSON format, optional)</Label>
                    <Textarea
                    id="examFeesJSON"
                    name="examFeesJSON"
                    value={courseForm.examFeesJSON}
                    onChange={handleInputChange}
                    rows={3}
                    placeholder='[{"name": "M1 Exam", "amount": 1250}]'
                    />
                    <p className="text-xs text-muted-foreground">Use valid JSON array format.</p>
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
