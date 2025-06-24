
"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import { PlusCircle, User, Users, MoreVertical, Trash2, UserMinus, ImageUp, Camera, XCircle, Edit, CreditCard, Pencil } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogClose 
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useAppContext } from '@/lib/context/AppContext';
import type { Student, StudentFormData, Course, PaymentPlan } from '@/lib/types';
import { DateOfBirthPicker } from '@/components/students/DateOfBirthPicker';
import { EnrollmentDateDropdownPicker } from '@/components/students/EnrollmentDateDropdownPicker';
import { DOB_DAYS, DOB_MONTHS, DOB_YEARS, COURSE_DURATION_UNITS, MOBILE_REGEX, AADHAR_REGEX } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription as UIDescription } from "@/components/ui/alert"; 
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';


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
  photoFile: null,
  photoDataUri: null,
  selectedPaymentPlanName: undefined,
  overriddenEnrollmentFee: undefined,
  overriddenMonthlyFee: undefined,
};

export default function StudentsPage() {
  const { students, courses, addStudent, isLoading, updateStudent, deleteStudent } = useAppContext();
  const [isStudentFormDialogOpen, setIsStudentFormDialogOpen] = useState(false);
  const [studentForm, setStudentForm] = useState<StudentFormData>(initialStudentFormState);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const { toast } = useToast();
  
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeCourseTab, setActiveCourseTab] = useState('all');
  const [overrideFees, setOverrideFees] = useState(false);

  const coursesWithStudents = useMemo(() => {
    const courseIdsWithStudents = new Set(students.map(s => s.courseId));
    return courses.filter(c => courseIdsWithStudents.has(c.id));
  }, [students, courses]);


  useEffect(() => {
    if (studentForm.courseId && courses.length > 0) {
      const course = courses.find(c => c.id === studentForm.courseId);
      if (course) {
        setSelectedCourse(course);
        if(course.paymentType === 'installment' && !studentForm.selectedPaymentPlanName && course.paymentPlans?.length > 0) {
            setStudentForm(prev => ({...prev, selectedPaymentPlanName: course.paymentPlans[0].name}));
        }
        if (course.paymentType === 'monthly') {
            setStudentForm(prev => ({...prev, selectedPaymentPlanName: undefined}));
        }
      } else {
        setSelectedCourse(null);
      }
    } else {
      setSelectedCourse(null);
    }
  }, [studentForm.courseId, courses]);


  useEffect(() => {
    if (isCameraOpen) {
      const getCameraPermission = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please enable camera permissions in your browser settings.',
          });
          setIsCameraOpen(false); 
        }
      };
      getCameraPermission();
    } else {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      setHasCameraPermission(null); 
    }
  }, [isCameraOpen, toast]);


  const handleStudentFormInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
     if (name === 'courseDurationValue' || name === 'overriddenEnrollmentFee' || name === 'overriddenMonthlyFee') {
      setStudentForm(prev => ({ ...prev, [name]: value === '' ? undefined : parseFloat(value) }));
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

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setStudentForm(prev => ({ ...prev, photoFile: file, photoDataUri: null }));
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleOpenCamera = () => setIsCameraOpen(true);
  const handleCloseCamera = () => setIsCameraOpen(false);

  const handleCapturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/png');
        setStudentForm(prev => ({ ...prev, photoDataUri: dataUri, photoFile: null }));
        setPhotoPreview(dataUri);
      }
      handleCloseCamera(); 
    }
  };

  const handleRemovePhoto = () => {
    setStudentForm(prev => ({ ...prev, photoFile: null, photoDataUri: null }));
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; 
    }
  };


  const handleStudentFormSubmit = async (e: React.FormEvent) => {
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
    const course = courses.find(c => c.id === studentForm.courseId);
    if(course?.paymentType === 'installment' && !studentForm.selectedPaymentPlanName) {
        toast({ title: "Error", description: "Please select a payment plan for this course.", variant: "destructive" });
        return;
    }


    try {
      if (editingStudent) {
         await updateStudent(editingStudent.id, {
          ...studentForm,
          overriddenEnrollmentFee: overrideFees ? studentForm.overriddenEnrollmentFee : null,
          overriddenMonthlyFee: overrideFees ? studentForm.overriddenMonthlyFee : null,
          photoToBeRemoved: photoPreview === null && !!editingStudent.photoUrl && !studentForm.photoFile && !studentForm.photoDataUri,
        });
        toast({ title: "Success", description: "Student details updated successfully." });

      } else {
        await addStudent({
            ...studentForm,
            overriddenEnrollmentFee: overrideFees ? studentForm.overriddenEnrollmentFee : undefined,
            overriddenMonthlyFee: overrideFees ? studentForm.overriddenMonthlyFee : undefined,
        }); 
        toast({ title: "Success", description: "Student added successfully. Enrollment fee pending." });
      }

      setIsStudentFormDialogOpen(false);
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
    setStudentForm(initialStudentFormState);
    setOverrideFees(false);
    setSelectedCourse(null);
    handleRemovePhoto(); 
    setIsCameraOpen(false); 
    setIsStudentFormDialogOpen(true);
  };
  
  const openEditStudentDialog = (student: Student) => {
    setEditingStudent(student);
    const enrollmentDateParts = student.enrollmentDate.split('T')[0].split('-');
    
    setStudentForm({
      name: student.name,
      fatherName: student.fatherName,
      dob: student.dob,
      mobile: student.mobile,
      aadhar: student.aadhar,
      enrollmentDate: { day: enrollmentDateParts[2], month: enrollmentDateParts[1], year: enrollmentDateParts[0] },
      courseId: student.courseId,
      courseDurationValue: student.courseDurationValue,
      courseDurationUnit: student.courseDurationUnit,
      photoFile: null, 
      photoDataUri: null,
      selectedPaymentPlanName: student.selectedPaymentPlanName,
      overriddenEnrollmentFee: student.overriddenEnrollmentFee,
      overriddenMonthlyFee: student.overriddenMonthlyFee,
    });
    setOverrideFees(!!student.overriddenEnrollmentFee || !!student.overriddenMonthlyFee);
    setPhotoPreview(student.photoUrl || null);
    setIsCameraOpen(false);
    setIsStudentFormDialogOpen(true);
  };
  
  const closeDialog = () => {
     setIsStudentFormDialogOpen(false);
     handleCloseCamera(); 
     setEditingStudent(null); 
     handleRemovePhoto();
     setStudentForm(initialStudentFormState);
     setOverrideFees(false);
  }

  const handleMarkAsLeft = async (studentId: string) => {
    try {
      await updateStudent(studentId, { status: 'left' });
      toast({ title: "Success", description: "Student marked as left." });
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to mark student as left: ${error.message}`, variant: "destructive" });
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    try {
      await deleteStudent(studentId); 
      toast({ title: "Success", description: "Student deleted successfully." });
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to delete student: ${error.message}`, variant: "destructive" });
    }
  };

  const pageHeader = (
    <PageHeader
      title="Manage Students"
      description="Add new students, edit details, and view existing enrollments."
      action={
        <Button onClick={openAddStudentDialog} className="animate-button-click" disabled={isLoading}>
          <PlusCircle className="mr-2 h-5 w-5" /> Add New Student
        </Button>
      }
    />
  );
  
  const renderStudentDialog = () => (
    <Dialog open={isStudentFormDialogOpen} onOpenChange={(isOpen) => !isOpen && closeDialog()}>
      <DialogContent className="sm:max-w-lg shadow-2xl rounded-lg">
        <DialogHeader>
          <DialogTitle className="font-headline text-primary">{editingStudent ? 'Edit Student Details' : 'Add New Student'}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh]">
        <form onSubmit={handleStudentFormSubmit} className="p-1 pr-4">
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
            
            <div className="space-y-2 border p-4 rounded-md">
                <Label className="text-base font-medium">Student Photo</Label>
                {photoPreview && (
                    <div className="my-2 relative w-32 h-32 mx-auto rounded-md overflow-hidden shadow-md">
                        <Image src={photoPreview} alt="Student photo preview" layout="fill" objectFit="cover" />
                        <Button 
                            variant="destructive" 
                            size="icon" 
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={handleRemovePhoto}
                            type="button"
                        >
                            <XCircle className="h-4 w-4" />
                        </Button>
                    </div>
                )}
                <Tabs defaultValue="upload" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="upload"><ImageUp className="mr-2 h-4 w-4" />Upload</TabsTrigger>
                        <TabsTrigger value="camera"><Camera className="mr-2 h-4 w-4" />Camera</TabsTrigger>
                    </TabsList>
                    <TabsContent value="upload" className="mt-4">
                        <Input id="photoFile" name="photoFile" type="file" accept="image/*" onChange={handlePhotoFileChange} ref={fileInputRef} />
                    </TabsContent>
                    <TabsContent value="camera" className="mt-4 space-y-3">
                        {isCameraOpen ? (
                            <div className="space-y-2">
                                <video ref={videoRef} className="w-full aspect-video rounded-md bg-muted" autoPlay muted playsInline />
                                <canvas ref={canvasRef} className="hidden" />
                                {hasCameraPermission === false && (
                                    <Alert variant="destructive">
                                      <UIDescription>Camera access denied. Please enable permissions.</UIDescription>
                                    </Alert>
                                )}
                                <div className="flex gap-2">
                                    <Button type="button" onClick={handleCapturePhoto} disabled={!hasCameraPermission}><Camera className="mr-2 h-4 w-4" /> Capture</Button>
                                    <Button type="button" variant="outline" onClick={handleCloseCamera}>Close</Button>
                                </div>
                            </div>
                        ) : ( <Button type="button" onClick={handleOpenCamera} className="w-full"><Camera className="mr-2 h-4 w-4" /> Open Camera</Button> )}
                    </TabsContent>
                </Tabs>
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
            
            {selectedCourse && (
                <div className="p-3 border rounded-md bg-primary/5 text-sm space-y-3">
                    <div>
                        <p>Payment Type: <span className="font-bold text-primary capitalize">{selectedCourse.paymentType}</span></p>
                        {selectedCourse.paymentType === 'monthly' ? (
                            <p>Default Monthly Fee: <span className="font-bold text-primary">₹{selectedCourse.monthlyFee.toLocaleString()}</span></p>
                        ) : selectedCourse.paymentPlans?.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <Label htmlFor="selectedPaymentPlanName">Payment Plan</Label>
                              <Select name="selectedPaymentPlanName" value={studentForm.selectedPaymentPlanName} onValueChange={(value) => setStudentForm(prev => ({ ...prev, selectedPaymentPlanName: value }))} required>
                                <SelectTrigger><SelectValue placeholder="Select a payment plan" /></SelectTrigger>
                                <SelectContent>
                                  {selectedCourse.paymentPlans.map(plan => (
                                    <SelectItem key={plan.name} value={plan.name}>{plan.name} (Total: ₹{plan.totalAmount.toLocaleString()})</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                        )}
                        <p>Default Enrollment Fee: <span className="font-bold text-primary">₹{selectedCourse.enrollmentFee.toLocaleString()}</span></p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="overrideFees" checked={overrideFees} onCheckedChange={(checked) => setOverrideFees(!!checked)} />
                        <Label htmlFor="overrideFees">Override default fees for this student</Label>
                    </div>
                    {overrideFees && (
                        <div className="space-y-2 pt-2 animate-slide-in">
                            <div className="space-y-1">
                                <Label htmlFor="overriddenEnrollmentFee">Overridden Enrollment Fee (₹)</Label>
                                <Input id="overriddenEnrollmentFee" name="overriddenEnrollmentFee" type="number" value={studentForm.overriddenEnrollmentFee ?? ''} onChange={handleStudentFormInputChange} placeholder={`Default: ${selectedCourse.enrollmentFee}`} />
                            </div>
                             {selectedCourse.paymentType === 'monthly' && (
                                <div className="space-y-1">
                                    <Label htmlFor="overriddenMonthlyFee">Overridden Monthly Fee (₹)</Label>
                                    <Input id="overriddenMonthlyFee" name="overriddenMonthlyFee" type="number" value={studentForm.overriddenMonthlyFee ?? ''} onChange={handleStudentFormInputChange} placeholder={`Default: ${selectedCourse.monthlyFee}`} />
                                </div>
                            )}
                        </div>
                    )}
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
  const filteredStudents = activeCourseTab === 'all'
    ? activeStudentsList
    : activeStudentsList.filter(s => s.courseId === activeCourseTab);

  if (activeStudentsList.length === 0 && !isLoading) {
    return (
      <>
        {pageHeader}
        <Card className="shadow-lg text-center py-12 animate-slide-in">
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit"> <Users className="h-12 w-12 text-primary" /></div>
            <CardTitle className="mt-4 text-2xl font-headline">No Active Students Enrolled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Add your first student to get started.</p>
             <Button onClick={openAddStudentDialog} className="mt-6 animate-button-click"><PlusCircle className="mr-2 h-5 w-5" /> Add First Student</Button>
          </CardContent>
        </Card>
        {renderStudentDialog()}
      </>
    );
  }
  
  return (
    <>
      {pageHeader}
       <Tabs value={activeCourseTab} onValueChange={setActiveCourseTab} className="mb-6">
        <TabsList>
            <TabsTrigger value="all">All Students ({activeStudentsList.length})</TabsTrigger>
            {coursesWithStudents.map(course => (
                 <TabsTrigger key={course.id} value={course.id}>
                    {course.name} ({activeStudentsList.filter(s => s.courseId === course.id).length})
                </TabsTrigger>
            ))}
        </TabsList>
      </Tabs>

      <ScrollArea className="h-[calc(100vh-25rem)]">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-slide-in">
          {filteredStudents.map((student) => {
            const course = courses.find(c => c.id === student.courseId);
            const enrollmentDateObj = new Date(student.enrollmentDate);
            const formattedEnrollmentDate = !isNaN(enrollmentDateObj.getTime()) ? enrollmentDateObj.toLocaleDateString() : 'N/A';
            return (
              <Card key={student.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                        {student.photoUrl ? (
                            <div className="relative w-16 h-16 rounded-full overflow-hidden shadow-md">
                                <Image src={student.photoUrl} alt={student.name} layout="fill" objectFit="cover" />
                            </div>
                        ) : (
                            <div className="relative w-16 h-16 rounded-full overflow-hidden shadow-md bg-muted flex items-center justify-center">
                                <Image src="https://placehold.co/100x100.png" alt="Placeholder" layout="fill" objectFit="cover" data-ai-hint="avatar person" />
                            </div>
                        )}
                        <div>
                            <CardTitle className="font-headline text-primary">{student.name}</CardTitle>
                            <CardDescription>Father: {student.fatherName}</CardDescription>
                        </div>
                    </div>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-5 w-5" /><span className="sr-only">Student Actions</span></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                           <DropdownMenuItem onClick={() => openEditStudentDialog(student)} className="cursor-pointer"><Edit className="mr-2 h-4 w-4" /> Edit Student</DropdownMenuItem>
                           <DropdownMenuItem asChild>
                             <Link href="/billing" className="flex items-center w-full cursor-pointer"><CreditCard className="mr-2 h-4 w-4" /> Manage Fees</Link>
                           </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                                <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer"><UserMinus className="mr-2 h-4 w-4 text-orange-500" /> Mark as Left</DropdownMenuItem></AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will mark {student.name} as having left the academy. Their records will be moved to archived.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleMarkAsLeft(student.id)} className={cn(buttonVariants({variant: "outline"}))}>Confirm</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <AlertDialog>
                                <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer"><Trash2 className="mr-2 h-4 w-4 text-destructive" /> Delete Student</DropdownMenuItem></AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete {student.name} and all their associated data, including payment history and photo.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteStudent(student.id)} className={cn(buttonVariants({variant: "destructive"}))}>Delete Student</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow space-y-2">
                  <p className="text-sm text-muted-foreground">Enroll. No: <span className="font-semibold text-foreground">{student.enrollmentNumber || 'N/A'}</span></p>
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
    </>
  );
}
