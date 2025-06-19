
"use client";
import React, { useState, useEffect } from 'react';
import { Brain, Send, Loader2, UserCheck, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { suggestStudentInterventionPlan, type SuggestStudentInterventionInput, type SuggestStudentInterventionOutput } from '@/ai/flows/suggest-intervention';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/lib/context/AppContext';
import type { Student } from '@/lib/types';

export default function InterventionPage() {
  const { students, courses, isLoading: isAppContextLoading } = useAppContext();
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [attendance, setAttendance] = useState<number | string>('');
  const [grades, setGrades] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [interventionPlan, setInterventionPlan] = useState<SuggestStudentInterventionOutput | null>(null);
  const { toast } = useToast();

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || attendance === '' || !grades) {
      toast({
        title: "Missing Information",
        description: "Please select a student and provide attendance & grades.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setInterventionPlan(null);

    const studentCourse = courses.find(c => c.id === selectedStudent.courseId);
    const paymentSummary = selectedStudent.paymentHistory.map(p => `${p.type} of ${p.amount} on ${new Date(p.date).toLocaleDateString()}`).join(', ');
    
    const input: SuggestStudentInterventionInput = {
      studentName: selectedStudent.name,
      attendancePercentage: Number(attendance),
      grades: grades,
      paymentHistory: paymentSummary || 'No payment history available.',
    };

    try {
      const result = await suggestStudentInterventionPlan(input);
      setInterventionPlan(result);
      toast({
        title: "Intervention Plan Generated",
        description: "AI has suggested an intervention plan.",
      });
    } catch (error) {
      console.error("Error generating intervention plan:", error);
      toast({
        title: "Error",
        description: "Failed to generate intervention plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="AI Intervention Suggestions"
        description="Get AI-powered recommendations for student intervention plans."
      />

      <div className="grid md:grid-cols-2 gap-8 animate-slide-in">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-primary">Student Details for Intervention</CardTitle>
            <CardDescription>Select a student and provide their recent performance data.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="studentId">Select Student</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={isAppContextLoading}>
                  <SelectTrigger id="studentId">
                    <SelectValue placeholder={isAppContextLoading ? "Loading students..." : "Select a student"} />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name} ({student.enrollmentNumber || 'N/A'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedStudent && (
                 <Card className="bg-primary/5 p-4 border-primary/20">
                    <p className="text-sm font-medium text-primary">{selectedStudent.name} ({selectedStudent.enrollmentNumber || 'N/A'})</p>
                    <p className="text-xs text-muted-foreground">Course: {courses.find(c=>c.id === selectedStudent.courseId)?.name || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">Enrolled: {new Date(selectedStudent.enrollmentDate).toLocaleDateString()}</p>
                </Card>
              )}

              <div className="space-y-2">
                <Label htmlFor="attendance">Attendance Percentage (%)</Label>
                <Input
                  id="attendance"
                  type="number"
                  value={attendance}
                  onChange={(e) => setAttendance(e.target.value)}
                  placeholder="e.g., 85"
                  min="0" max="100"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="grades">Recent Grades / Performance Notes</Label>
                <Textarea
                  id="grades"
                  value={grades}
                  onChange={(e) => setGrades(e.target.value)}
                  placeholder="e.g., 'Math: B, Programming: A, Poor participation in class'"
                  rows={3}
                />
              </div>

              <Button type="submit" disabled={isLoading || !selectedStudentId} className="w-full animate-button-click">
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Generate Intervention Plan
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-primary flex items-center">
                <Brain className="mr-2 h-6 w-6"/> Suggested Intervention Plan
            </CardTitle>
            <CardDescription>AI-generated recommendations will appear here.</CardDescription>
          </CardHeader>
          <CardContent className="min-h-[300px]">
            {isLoading && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
                <p>Generating plan, please wait...</p>
              </div>
            )}
            {!isLoading && !interventionPlan && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <UserCheck className="h-12 w-12 mb-4 text-primary/50" />
                <p>Fill the form to get AI suggestions.</p>
              </div>
            )}
            {interventionPlan && (
              <div className="space-y-4 prose prose-sm max-w-none dark:prose-invert">
                <h3 className="font-semibold text-accent">Intervention Strategy for {selectedStudent?.name}</h3>
                <p className="whitespace-pre-wrap leading-relaxed">{interventionPlan.interventionPlan}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

