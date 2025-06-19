
"use client";
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Course, Student, PaymentRecord, StudentFormData, CourseFormData } from '@/lib/types';
import { db } from '@/lib/firebase'; // Import Firestore instance
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  query,
  writeBatch,
  where,
  Timestamp
} from 'firebase/firestore';

interface AppContextType {
  courses: Course[];
  students: Student[];
  addCourse: (course: CourseFormData) => Promise<void>;
  updateCourse: (course: Course) => Promise<void>;
  deleteCourse: (courseId: string) => Promise<void>;
  addStudent: (student: StudentFormData) => Promise<void>;
  updateStudent: (student: Student) => Promise<void>;
  addPayment: (studentId: string, payment: Omit<PaymentRecord, 'id'>) => Promise<void>;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper to convert Firestore doc data (handles Timestamps if you use them)
const mapDocToCourse = (docData: any): Course => ({
  ...docData,
  // Convert Firestore Timestamps to ISO strings if necessary, or ensure types match
});

const mapDocToStudent = (docData: any): Student => ({
  ...docData,
  enrollmentDate: docData.enrollmentDate instanceof Timestamp ? docData.enrollmentDate.toDate().toISOString() : docData.enrollmentDate,
  paymentHistory: docData.paymentHistory?.map((p: any) => ({
      ...p,
      date: p.date instanceof Timestamp ? p.date.toDate().toISOString() : p.date,
  })) || [],
});


export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const coursesCollectionRef = collection(db, 'courses');
  const studentsCollectionRef = collection(db, 'students');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const courseSnapshot = await getDocs(coursesCollectionRef);
        setCourses(courseSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Course)));
        
        const studentSnapshot = await getDocs(studentsCollectionRef);
        setStudents(studentSnapshot.docs.map(doc => mapDocToStudent({ ...doc.data(), id: doc.id })));

      } catch (error) {
        console.error("Failed to load data from Firestore", error);
        // Potentially set an error state here
      }
      setIsLoading(false);
    };
    fetchData();
  }, []);


  const addCourse = async (courseData: CourseFormData) => {
    try {
      const docRef = await addDoc(coursesCollectionRef, courseData);
      setCourses((prev) => [...prev, { ...courseData, id: docRef.id }]);
    } catch (error) {
      console.error("Error adding course:", error);
    }
  };

  const updateCourse = async (updatedCourse: Course) => {
    const courseDoc = doc(db, 'courses', updatedCourse.id);
    const { id, ...courseData } = updatedCourse; // Firestore update data should not contain id
    try {
      await updateDoc(courseDoc, courseData);
      setCourses((prev) => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
    } catch (error) {
      console.error("Error updating course:", error);
    }
  };

  const deleteCourse = async (courseId: string) => {
    const courseDoc = doc(db, 'courses', courseId);
    try {
      await deleteDoc(courseDoc);
      setCourses(prev => prev.filter(c => c.id !== courseId));
      // Optionally, handle students enrolled in this course (e.g., unenroll or archive)
      // This might involve a batch write or cloud function for consistency
    } catch (error) {
      console.error("Error deleting course:", error);
    }
  };

  const addStudent = async (studentData: StudentFormData) => {
    const newStudentPayload: Omit<Student, 'id'> = {
      ...studentData,
      enrollmentDate: studentData.enrollmentDate, // Already a string
      status: 'enrollment_pending',
      paymentHistory: [],
    };
    try {
      const docRef = await addDoc(studentsCollectionRef, newStudentPayload);
      setStudents((prev) => [...prev, { ...newStudentPayload, id: docRef.id }]);
    } catch (error) {
      console.error("Error adding student:", error);
    }
  };
  
  const updateStudent = async (updatedStudent: Student) => {
    const studentDoc = doc(db, 'students', updatedStudent.id);
    const { id, ...studentData } = updatedStudent;
    try {
      await updateDoc(studentDoc, studentData);
      setStudents((prev) => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
    } catch (error) {
      console.error("Error updating student:", error);
    }
  };
  
  const addPayment = async (studentId: string, paymentData: Omit<PaymentRecord, 'id'>) => {
    const studentRef = doc(db, 'students', studentId);
    try {
        const currentStudent = students.find(s => s.id === studentId);
        if (!currentStudent) {
            console.error("Student not found for payment");
            return;
        }

        // Firestore uses its own Timestamp, but we can store ISO strings directly or convert
        const newPayment: PaymentRecord = { 
            ...paymentData, 
            id: Math.random().toString(36).substr(2, 9), // Temporary client-side ID, Firestore handles its own
            date: paymentData.date, // Assuming this is already an ISO string
        };
        
        const updatedPaymentHistory = [...currentStudent.paymentHistory, newPayment];
        
        let newStatus = currentStudent.status;
        if (paymentData.type === 'enrollment' && currentStudent.status === 'enrollment_pending') {
            newStatus = 'active';
        }
        // Add more complex status logic if needed

        await updateDoc(studentRef, {
            paymentHistory: updatedPaymentHistory,
            status: newStatus,
        });

        setStudents(prevStudents =>
            prevStudents.map(s => 
                s.id === studentId 
                ? { ...s, paymentHistory: updatedPaymentHistory, status: newStatus } 
                : s
            )
        );

    } catch (error) {
        console.error("Error adding payment:", error);
    }
  };


  return (
    <AppContext.Provider value={{ 
        courses, 
        students, 
        addCourse, 
        updateCourse, 
        deleteCourse, 
        addStudent, 
        updateStudent, 
        addPayment, 
        isLoading 
    }}>
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

    