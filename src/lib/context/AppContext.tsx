
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
        console.warn("AppContext: NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set. Firebase features might not work as expected if other config values are also missing.");
    }

    if (!db) {
      console.error("AppContext: Firestore 'db' instance is not available. Halting data fetch.");
      setIsLoading(false); 
      return;
    }
    console.log("AppContext: Firestore 'db' instance appears to be available.");

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
        console.error("AppContext: Failed to load data from Firestore. This could be a security rules issue or network problem.", error);
      } finally {
        console.log("AppContext: fetchData finished, setting isLoading to false.");
        setIsLoading(false);
      }
    };
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const addCourse = async (courseData: CourseFormData) => {
    if (!db) { 
      console.error("Firestore 'db' not available for addCourse");
      throw new Error("Database not available. Please try again later.");
    }
    const coursesCollectionRef = collection(db, 'courses');
    try {
      const docRef = await addDoc(coursesCollectionRef, courseData);
      setCourses((prev) => [...prev, { ...courseData, id: docRef.id }]);
    } catch (error) {
      console.error("Error adding course to Firestore:", error);
      throw error; // Re-throw the error to be caught by the calling page
    }
  };

  const updateCourse = async (updatedCourse: Course) => {
    if (!db) {
      console.error("Firestore 'db' not available for updateCourse");
      throw new Error("Database not available. Please try again later.");
    }
    const courseDocRef = doc(db, 'courses', updatedCourse.id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...courseDataToUpdate } = updatedCourse; 
    try {
      await updateDoc(courseDocRef, courseDataToUpdate);
      setCourses((prev) => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
    } catch (error) {
      console.error("Error updating course in Firestore:", error);
      throw error;
    }
  };

  const deleteCourse = async (courseId: string) => {
    if (!db) {
      console.error("Firestore 'db' not available for deleteCourse");
      throw new Error("Database not available. Please try again later.");
    }
    const courseDocRef = doc(db, 'courses', courseId);
    try {
      await deleteDoc(courseDocRef);
      setCourses(prev => prev.filter(c => c.id !== courseId));
    } catch (error) {
      console.error("Error deleting course from Firestore:", error);
      throw error;
    }
  };

  const addStudent = async (studentData: StudentFormData) => {
    if (!db) { 
      console.error("Firestore 'db' not available for addStudent");
      throw new Error("Database not available. Please try again later.");
    }
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
      console.error("Error adding student to Firestore:", error);
      throw error;
    }
  };
  
  const updateStudent = async (updatedStudent: Student) => {
    if (!db) {
       console.error("Firestore 'db' not available for updateStudent");
       throw new Error("Database not available. Please try again later.");
    }
    const studentDocRef = doc(db, 'students', updatedStudent.id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      await updateDoc(studentDocRef, payloadForFirestore);
      setStudents((prev) => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s));
    } catch (error) {
      console.error("Error updating student in Firestore:", error);
      throw error;
    }
  };
  
  const addPayment = async (studentId: string, paymentData: Omit<PaymentRecord, 'id'>) => {
    if (!db) { 
      console.error("Firestore 'db' not available for addPayment");
      throw new Error("Database not available. Please try again later.");
    }
    const studentRef = doc(db, 'students', studentId);
    try {
        const currentStudent = students.find(s => s.id === studentId);
        if (!currentStudent) {
            console.error("Student not found for payment");
            throw new Error("Student not found to add payment.");
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
        console.error("Error adding payment to Firestore:", error);
        throw error;
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

    