
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
import type { Course, CourseFormData } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

const initialCourseFormState: CourseFormData = {
  name: '',
  enrollmentFee: 0,
  monthlyFee: 0,
};

export default function CoursesPage() {
  const { courses, addCourse, updateCourse, deleteCourse, isLoading } = useAppContext();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [courseForm, setCourseForm] = useState<CourseFormData>(initialCourseFormState);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const { toast } = useToast();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCourseForm((prev) => ({
      ...prev,
      [name]: name === 'name' ? value : parseFloat(value) || 0,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseForm.name || courseForm.enrollmentFee <= 0 || courseForm.monthlyFee <= 0) {
      toast({ title: "Error", description: "Please fill all fields with valid values.", variant: "destructive" });
      return;
    }
    try {
      if (editingCourse) {
        await updateCourse({ ...editingCourse, ...courseForm });
        toast({ title: "Success", description: "Course updated successfully." });
      } else {
        await addCourse(courseForm);
        toast({ title: "Success", description: "Course added successfully." });
      }
      setIsDialogOpen(false);
      setCourseForm(initialCourseFormState);
      setEditingCourse(null);
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
    setCourseForm({ name: course.name, enrollmentFee: course.enrollmentFee, monthlyFee: course.monthlyFee });
    setIsDialogOpen(true);
  };

  const handleDeleteCourse = async (courseId: string) => {
    // Add confirmation dialog here if needed via AlertDialog component
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
                <CardDescription>Manage course details and fees.</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground">
                  Enrollment Fee: <span className="font-semibold text-foreground">₹{course.enrollmentFee.toLocaleString()}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Monthly Fee: <span className="font-semibold text-foreground">₹{course.monthlyFee.toLocaleString()}</span>
                </p>
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
        <DialogContent className="sm:max-w-[425px] shadow-2xl rounded-lg">
          <DialogHeader>
            <DialogTitle className="font-headline text-primary">{editingCourse ? 'Edit Course' : 'Add New Course'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" name="name" value={courseForm.name} onChange={handleInputChange} className="col-span-3" placeholder="e.g., Web Development" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="enrollmentFee" className="text-right">Enrollment Fee (₹)</Label>
                <Input id="enrollmentFee" name="enrollmentFee" type="number" value={courseForm.enrollmentFee} onChange={handleInputChange} className="col-span-3" placeholder="e.g., 1000" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="monthlyFee" className="text-right">Monthly Fee (₹)</Label>
                <Input id="monthlyFee" name="monthlyFee" type="number" value={courseForm.monthlyFee} onChange={handleInputChange} className="col-span-3" placeholder="e.g., 500" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" className="animate-button-click">Cancel</Button>
              </DialogClose>
              <Button type="submit" className="animate-button-click">{editingCourse ? 'Save Changes' : 'Add Course'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

    