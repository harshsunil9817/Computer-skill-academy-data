
"use client";
import React, { useState, useEffect } from 'react';
import { PlusCircle, Edit, Trash2, User, Users, DollarSign, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useAppContext } from '@/lib/context/AppContext';
import type { Student, StudentFormData, Course } from '@/lib/types';
import { DateOfBirthPicker } from '@/components/students/DateOfBirthPicker';
import { DOB_DAYS, DOB_MONTHS, DOB_YEARS, COURSE_DURATION_UNITS, MOBILE_REGEX, AADHAR_REGEX } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

const initialStudentFormState: StudentFormData = {
  name: '',
  fatherName: '',
  dob: { day: DOB_DAYS[0], month: DOB_MONTHS[0].value, year: DOB_YEARS[0] },
  mobile: '',
  aadhar: '',
  enrollmentDate: new Date().toISOString().split('T')[0],
  courseId: '',
  courseDurationValue: 1,
  courseDurationUnit: 'months',
};

export default function StudentsPage() {
  const { students, courses, addStudent, updateStudent, isLoading } = useAppContext();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [studentForm, setStudentForm] = useState<StudentFormData>(initialStudentFormState);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedCourseDetails, setSelectedCourseDetails] = useState<{enrollmentFee: number, monthlyFee: number} | null>(null);
  const { toast } = useToast();

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


  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  const handleEnrollmentDateChange = (date: Date | undefined) => {
    if (date) {
      setStudentForm(prev => ({ ...prev, enrollmentDate: date.toISOString().split('T')[0] }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
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

    if (editingStudent) {
      // updateStudent logic needs to be implemented in context if required
      // For now, focusing on addStudent
      toast({ title: "Info", description: "Student update functionality is not fully implemented in this demo." });
    } else {
      addStudent(studentForm);
      toast({ title: "Success", description: "Student added successfully. Enrollment fee pending." });
    }
    setIsDialogOpen(false);
    setStudentForm(initialStudentFormState);
    setEditingStudent(null);
    setSelectedCourseDetails(null);
  };

  const openAddDialog = () => {
    setEditingStudent(null);
    setStudentForm({...initialStudentFormState, enrollmentDate: new Date().toISOString().split('T')[0]}); // Reset with current date
    setSelectedCourseDetails(null);
    setIsDialogOpen(true);
  };
  
  if (isLoading) {
    return <div className="text-center py-10">Loading student and course data...</div>;
  }

  return (
    <>
      <PageHeader
        title="Manage Students"
        description="Add new students and view existing enrollments."
        action={
          <Button onClick={openAddDialog} className="animate-button-click">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Student
          </Button>
        }
      />

      {students.length === 0 ? (
         <Card className="shadow-lg text-center py-12 animate-slide-in">
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                <Users className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="mt-4 text-2xl font-headline">No Students Enrolled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Add your first student to get started.</p>
             <Button onClick={openAddDialog} className="mt-6 animate-button-click">
                <PlusCircle className="mr-2 h-5 w-5" /> Add First Student
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-20rem)]">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-slide-in">
          {students.map((student) => {
            const course = courses.find(c => c.id === student.courseId);
            return (
              <Card key={student.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <div className="bg-primary/20 text-primary p-3 rounded-full">
                        <User className="h-6 w-6" />
                    </div>
                    <div>
                        <CardTitle className="font-headline text-primary">{student.name}</CardTitle>
                        <CardDescription>Father: {student.fatherName}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow space-y-2">
                  <p className="text-sm text-muted-foreground">Course: <span className="font-semibold text-foreground">{course?.name || 'N/A'}</span></p>
                  <p className="text-sm text-muted-foreground">Enrolled: <span className="font-semibold text-foreground">{new Date(student.enrollmentDate).toLocaleDateString()}</span></p>
                  <p className="text-sm text-muted-foreground">Mobile: <span className="font-semibold text-foreground">{student.mobile}</span></p>
                  <p className="text-sm text-muted-foreground">Status: <span className="font-semibold text-foreground capitalize">{student.status.replace('_', ' ')}</span></p>
                </CardContent>
                <div className="border-t p-4 flex justify-end space-x-2">
                  {/* <Button variant="outline" size="sm" onClick={() => { /* openEditDialog(student) */ }} className="animate-button-click">
                    <Edit className="mr-1 h-4 w-4" /> Edit
                  </Button> */}
                  <Button variant="ghost" size="sm" onClick={() => { /* View Details */ }} className="animate-button-click">
                     View Details
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
        </ScrollArea>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg shadow-2xl rounded-lg">
          <DialogHeader>
            <DialogTitle className="font-headline text-primary">{editingStudent ? 'Edit Student' : 'Add New Student'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
          <form onSubmit={handleSubmit} className="p-1 pr-4">
            <div className="grid gap-4 py-4">
              <div className="space-y-1">
                <Label htmlFor="name">Student Name</Label>
                <Input id="name" name="name" value={studentForm.name} onChange={handleInputChange} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fatherName">Father&apos;s Name</Label>
                <Input id="fatherName" name="fatherName" value={studentForm.fatherName} onChange={handleInputChange} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dob">Date of Birth</Label>
                <DateOfBirthPicker id="dob" value={studentForm.dob} onChange={handleDobChange} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mobile">Mobile Number (10 digits)</Label>
                <Input id="mobile" name="mobile" type="tel" value={studentForm.mobile} onChange={handleInputChange} maxLength={10} pattern="\d{10}" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="aadhar">Aadhar Number (12 digits)</Label>
                <Input id="aadhar" name="aadhar" type="text" value={studentForm.aadhar} onChange={handleInputChange} maxLength={12} pattern="\d{12}" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="enrollmentDate">Enrollment Date</Label>
                 <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn("w-full justify-start text-left font-normal", !studentForm.enrollmentDate && "text-muted-foreground")}
                    >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {studentForm.enrollmentDate ? format(new Date(studentForm.enrollmentDate), "PPP") : <span>Pick a date</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={new Date(studentForm.enrollmentDate)}
                        onSelect={handleEnrollmentDateChange}
                        initialFocus
                    />
                    </PopoverContent>
                </Popover>
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
                    <Input id="courseDurationValue" name="courseDurationValue" type="number" min="1" value={studentForm.courseDurationValue} onChange={handleInputChange} required />
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
    </>
  );
}
