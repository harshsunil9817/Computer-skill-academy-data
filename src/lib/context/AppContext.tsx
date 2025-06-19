
"use client";
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Course, Student, PaymentRecord } from '@/lib/types';

interface AppContextType {
  courses: Course[];
  students: Student[];
  addCourse: (course: Omit<Course, 'id'>) => void;
  updateCourse: (course: Course) => void;
  deleteCourse: (courseId: string) => void;
  addStudent: (student: Omit<Student, 'id' | 'status' | 'paymentHistory'>) => void;
  updateStudent: (student: Student) => void;
  addPayment: (studentId: string, payment: Omit<PaymentRecord, 'id'>) => void;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const generateId = () => Math.random().toString(36).substr(2, 9);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load data from localStorage on mount
    try {
      const storedCourses = localStorage.getItem('academyCourses');
      if (storedCourses) {
        setCourses(JSON.parse(storedCourses));
      }
      const storedStudents = localStorage.getItem('academyStudents');
      if (storedStudents) {
        setStudents(JSON.parse(storedStudents));
      }
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Save data to localStorage whenever it changes
    if (!isLoading) {
      try {
        localStorage.setItem('academyCourses', JSON.stringify(courses));
        localStorage.setItem('academyStudents', JSON.stringify(students));
      } catch (error) {
        console.error("Failed to save data to localStorage", error);
      }
    }
  }, [courses, students, isLoading]);

  const addCourse = (courseData: Omit<Course, 'id'>) => {
    const newCourse = { ...courseData, id: generateId() };
    setCourses((prev) => [...prev, newCourse]);
  };

  const updateCourse = (updatedCourse: Course) => {
    setCourses((prev) => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
  };

  const deleteCourse = (courseId: string) => {
    setCourses(prev => prev.filter(c => c.id !== courseId));
    // Optionally, handle students enrolled in this course
  };

  const addStudent = (studentData: Omit<Student, 'id' | 'status' | 'paymentHistory'>) => {
    const newStudent: Student = {
      ...studentData,
      id: generateId(),
      status: 'enrollment_pending', // Initially pending enrollment fee
      paymentHistory: [],
    };
    setStudents((prev) => [...prev, newStudent]);
  };

  const updateStudent = (updatedStudent: Student) => {
    setStudents((prev) => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
  };
  
  const addPayment = (studentId: string, paymentData: Omit<PaymentRecord, 'id'>) => {
    setStudents(prevStudents =>
      prevStudents.map(student => {
        if (student.id === studentId) {
          const newPayment: PaymentRecord = { ...paymentData, id: generateId() };
          const updatedPaymentHistory = [...student.paymentHistory, newPayment];
          
          let newStatus = student.status;
          if (paymentData.type === 'enrollment' && student.status === 'enrollment_pending') {
             newStatus = 'active'; // Or check if first monthly fee is also due
          }
          // Add more logic here to update student status based on payment

          return { ...student, paymentHistory: updatedPaymentHistory, status: newStatus };
        }
        return student;
      })
    );
  };


  return (
    <AppContext.Provider value={{ courses, students, addCourse, updateCourse, deleteCourse, addStudent, updateStudent, addPayment, isLoading }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
