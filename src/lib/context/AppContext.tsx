
"use client";
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Course, Student, PaymentRecord, StudentFormData, CourseFormData } from '@/lib/types';
import { db, app as firebaseAppInstance } from '@/lib/firebase'; // Import Firestore instance and app
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
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

  useEffect(() => {
    console.log("AppContext: useEffect triggered for data fetching.");

    if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
        console.warn("AppContext: NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set. Firebase features might not work.");
    }
    
    if (!db) {
      console.error("AppContext: Firestore 'db' instance is not available. Halting data fetch.");
      setIsLoading(false); // Stop loading if db is not initialized
      return;
    }
    console.log("AppContext: Firestore 'db' instance seems available.");

    const coursesCollectionRef = collection(db, 'courses');
    const studentsCollectionRef = collection(db, 'students');

    const fetchData = async () => {
      console.log("AppContext: fetchData started.");
      setIsLoading(true);
      try {
        console.log("AppContext: Attempting to fetch courses...");
        const courseSnapshot = await getDocs(coursesCollectionRef);
        console.log(`AppContext: Fetched ${courseSnapshot.docs.length} courses.`);
        setCourses(courseSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Course)));
        
        console.log("AppContext: Attempting to fetch students...");
        const studentSnapshot = await getDocs(studentsCollectionRef);
        console.log(`AppContext: Fetched ${studentSnapshot.docs.length} students.`);
        setStudents(studentSnapshot.docs.map(doc => mapDocToStudent({ ...doc.data(), id: doc.id })));
        console.log("AppContext: Data fetching successful.");

      } catch (error) {
        console.error("AppContext: Failed to load data from Firestore", error);
        // Optionally, set some error state here to display to the user
      } finally {
        console.log("AppContext: fetchData finished, setting isLoading to false.");
        setIsLoading(false);
      }
    };
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const addCourse = async (courseData: CourseFormData) => {
    if (!db) { console.error("Firestore 'db' not available for addCourse"); return; }
    const coursesCollectionRef = collection(db, 'courses');
    try {
      const docRef = await addDoc(coursesCollectionRef, courseData);
      setCourses((prev) => [...prev, { ...courseData, id: docRef.id }]);
    } catch (error) {
      console.error("Error adding course:", error);
    }
  };

  const updateCourse = async (updatedCourse: Course) => {
    if (!db) { console.error("Firestore 'db' not available for updateCourse"); return; }
    const courseDoc = doc(db, 'courses', updatedCourse.id);
    const { id, ...courseDataToUpdate } = updatedCourse; 
    try {
      await updateDoc(courseDoc, courseDataToUpdate);
      setCourses((prev) => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
    } catch (error) {
      console.error("Error updating course:", error);
    }
  };

  const deleteCourse = async (courseId: string) => {
    if (!db) { console.error("Firestore 'db' not available for deleteCourse"); return; }
    const courseDoc = doc(db, 'courses', courseId);
    try {
      await deleteDoc(courseDoc);
      setCourses(prev => prev.filter(c => c.id !== courseId));
    } catch (error) {
      console.error("Error deleting course:", error);
    }
  };

  const addStudent = async (studentData: StudentFormData) => {
    if (!db) { console.error("Firestore 'db' not available for addStudent"); return; }
    const studentsCollectionRef = collection(db, 'students');
    const newStudentPayload: Omit<Student, 'id'> = {
      ...studentData,
      enrollmentDate: studentData.enrollmentDate, 
      status: 'enrollment_pending',
      paymentHistory: [],
    };
    try {
      const payloadForFirestore = {
        ...newStudentPayload,
        enrollmentDate: Timestamp.fromDate(new Date(newStudentPayload.enrollmentDate)),
      };
      const docRef = await addDoc(studentsCollectionRef, payloadForFirestore);
      setStudents((prev) => [...prev, { ...newStudentPayload, id: docRef.id }]);
    } catch (error) {
      console.error("Error adding student:", error);
    }
  };
  
  const updateStudent = async (updatedStudent: Student) => {
    if (!db) { console.error("Firestore 'db' not available for updateStudent"); return; }
    const studentDoc = doc(db, 'students', updatedStudent.id);
    const { id, ...studentDataToUpdate } = updatedStudent;
    try {
      const payloadForFirestore = {
        ...studentDataToUpdate,
        enrollmentDate: Timestamp.fromDate(new Date(studentDataToUpdate.enrollmentDate)),
        paymentHistory: studentDataToUpdate.paymentHistory.map(p => ({
            ...p,
            date: Timestamp.fromDate(new Date(p.date)),
        })),
      };
      await updateDoc(studentDoc, payloadForFirestore);
      setStudents((prev) => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
    } catch (error)
      {
      console.error("Error updating student:", error);
    }
  };
  
  const addPayment = async (studentId: string, paymentData: Omit<PaymentRecord, 'id'>) => {
    if (!db) { console.error("Firestore 'db' not available for addPayment"); return; }
    const studentRef = doc(db, 'students', studentId);
    try {
        const currentStudent = students.find(s => s.id === studentId);
        if (!currentStudent) {
            console.error("Student not found for payment");
            return; 
        }

        const newPayment: PaymentRecord = { 
            ...paymentData, 
            id: doc(collection(db, '_')).id, // Generate a client-side ID for the payment record
            date: paymentData.date, 
        };
        
        const updatedPaymentHistory = [...currentStudent.paymentHistory, newPayment];
        
        let newStatus = currentStudent.status;
        if (paymentData.type === 'enrollment' && currentStudent.status === 'enrollment_pending') {
            newStatus = 'active';
        }

        const paymentHistoryForFirestore = updatedPaymentHistory.map(p => ({
            ...p,
            date: Timestamp.fromDate(new Date(p.date)),
        }));

        await updateDoc(studentRef, {
            paymentHistory: paymentHistoryForFirestore,
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
