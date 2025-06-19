
"use client";
import { UserX, CheckSquare, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useAppContext } from '@/lib/context/AppContext';
import type { Student, Course } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface ArchivedStudentCardProps {
  student: Student;
  course?: Course;
}

function ArchivedStudentCard({ student, course }: ArchivedStudentCardProps) {
  return (
     <Card className="mb-4 shadow-md hover:shadow-lg transition-shadow">
      <CardHeader>
         <CardTitle className="font-headline text-primary">{student.name}</CardTitle>
        <CardDescription>Course: {course?.name || 'N/A'} | Status: <span className="font-semibold capitalize">{student.status.replace('_', ' ')}</span></CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Enrollment Date: {new Date(student.enrollmentDate).toLocaleDateString()}</p>
        <p className="text-sm text-muted-foreground">Father&apos;s Name: {student.fatherName}</p>
        <p className="text-sm text-muted-foreground">Mobile: {student.mobile}</p>
         {student.status === 'completed_unpaid' && (
          <p className="text-sm text-destructive font-semibold mt-2">Outstanding payments exist.</p>
        )}
      </CardContent>
    </Card>
  );
}


export default function ArchivedStudentsPage() {
  const { students, courses, isLoading } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('completed_paid');


  const archivedStudents = students.filter(s => s.status === 'completed_paid' || s.status === 'completed_unpaid' || s.status === 'left');
  
  const filteredArchivedStudents = archivedStudents.filter(student => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.fatherName.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const completedPaidStudents = filteredArchivedStudents.filter(s => s.status === 'completed_paid');
  const completedUnpaidStudents = filteredArchivedStudents.filter(s => s.status === 'completed_unpaid');
  const leftStudents = filteredArchivedStudents.filter(s => s.status === 'left');

  if (isLoading) {
    return <div className="text-center py-10">Loading archived student data...</div>;
  }

  const renderArchivedList = (list: Student[]) => {
     if (list.length === 0) {
      return (
        <Card className="text-center py-8 shadow-md">
          <CardContent>
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-3">
                <UserX className="h-10 w-10 text-primary" />
            </div>
            <p className="text-muted-foreground">No students found in this category {searchTerm && 'matching your search'}.</p>
          </CardContent>
        </Card>
      );
    }
    return (
      <ScrollArea className="h-[calc(100vh-28rem)] pr-3">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {list.map(student => (
          <ArchivedStudentCard
            key={student.id}
            student={student}
            course={courses.find(c => c.id === student.courseId)}
          />
        ))}
        </div>
      </ScrollArea>
    );
  };


  return (
    <>
      <PageHeader
        title="Archived Student Records"
        description="View students who have completed their courses or left the academy."
      />

      <div className="mb-6">
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input 
                placeholder="Search archived students by name or father's name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
            />
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-slide-in">
        <TabsList className="grid w-full grid-cols-3 mb-6 shadow-sm">
          <TabsTrigger value="completed_paid" className="flex items-center space-x-2 data-[state=active]:shadow-md">
            <CheckSquare className="h-5 w-5" /><span>Completed & Paid ({completedPaidStudents.length})</span>
          </TabsTrigger>
          <TabsTrigger value="completed_unpaid" className="flex items-center space-x-2 data-[state=active]:shadow-md">
            <AlertTriangle className="h-5 w-5" /><span>Completed & Unpaid ({completedUnpaidStudents.length})</span>
          </TabsTrigger>
           <TabsTrigger value="left" className="flex items-center space-x-2 data-[state=active]:shadow-md">
            <UserX className="h-5 w-5" /><span>Left Academy ({leftStudents.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="completed_paid">
          {renderArchivedList(completedPaidStudents)}
        </TabsContent>
        <TabsContent value="completed_unpaid">
          {renderArchivedList(completedUnpaidStudents)}
        </TabsContent>
        <TabsContent value="left">
          {renderArchivedList(leftStudents)}
        </TabsContent>
      </Tabs>
    </>
  );
}
