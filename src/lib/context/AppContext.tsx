
"use client";
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Course, Student, PaymentRecord, StudentFormData, CourseFormData } from '@/lib/types';
import { db, app as firebaseAppInstance } from '@/lib/firebase';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  writeBatch
} from 'firebase/firestore';

interface AppContextType {
  courses: Course[];
  students: Student[];
  addCourse: (course: CourseFormData) => Promise<void>;
  updateCourse: (course: Course) => Promise<void>;
  deleteCourse: (courseId: string) => Promise<void>;
  addStudent: (student: StudentFormData) => Promise<void>;
  updateStudent: (studentId: string, studentData: Partial<Omit<Student, 'id' | 'paymentHistory' | 'enrollmentDate'> & { enrollmentDate?: string | Date, paymentHistory?: Omit<PaymentRecord, 'id'>[] | PaymentRecord[] }>) => Promise<void>;
  addPayment: (studentId: string, payment: Omit<PaymentRecord, 'id'>) => Promise<void>;
  deleteStudent: (studentId: string) => Promise<void>;
  clearAllPaymentHistories: () => Promise<void>;
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
    } catch (error: any) {
      console.error("Error adding course to Firestore:", error);
      throw error;
    }
  };

  const updateCourse = async (updatedCourse: Course) => {
    if (!db) {
      console.error("Firestore 'db' not available for updateCourse");
      throw new Error("Database not available. Please try again later.");
    }
    const courseDocRef = doc(db, 'courses', updatedCourse.id);
    const { id, ...courseDataToUpdate } = updatedCourse;
    try {
      await updateDoc(courseDocRef, courseDataToUpdate);
      setCourses((prev) => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
    } catch (error: any) {
      console.error("Error updating course in Firestore:", error);
      throw error;
    }
  };

  const deleteCourse = async (courseId: string) => {
    if (!db) {
      console.error("Firestore 'db' not available for deleteCourse");
      throw new Error("Database not available. Please try again later.");
    }
    const isCourseInUse = students.some(student => student.courseId === courseId);
    if (isCourseInUse) {
      throw new Error("Cannot delete course. Students are currently enrolled in it.");
    }

    const courseDocRef = doc(db, 'courses', courseId);
    try {
      await deleteDoc(courseDocRef);
      setCourses(prev => prev.filter(c => c.id !== courseId));
    } catch (error: any) {
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

    const { enrollmentDate: enrollmentDateObj, ...restOfStudentData } = studentData;
    const isoEnrollmentDate = `${enrollmentDateObj.year}-${String(enrollmentDateObj.month).padStart(2, '0')}-${String(enrollmentDateObj.day).padStart(2, '0')}`;

    const newStudentPayload: Omit<Student, 'id'> = {
      ...restOfStudentData,
      enrollmentDate: isoEnrollmentDate,
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
    } catch (error: any) {
      console.error("Error adding student to Firestore:", error);
      throw error;
    }
  };

  const updateStudent = async (studentId: string, studentData: Partial<Omit<Student, 'id' | 'paymentHistory' | 'enrollmentDate'> & { enrollmentDate?: string | Date, paymentHistory?: Omit<PaymentRecord, 'id'>[] | PaymentRecord[] }>) => {
    if (!db) {
       console.error("Firestore 'db' not available for updateStudent");
       throw new Error("Database not available. Please try again later.");
    }
    const studentDocRef = doc(db, 'students', studentId);

    const payloadForFirestore: Record<string, any> = { ...studentData };

    if (studentData.enrollmentDate) {
      payloadForFirestore.enrollmentDate = studentData.enrollmentDate instanceof Date
                                          ? Timestamp.fromDate(studentData.enrollmentDate)
                                          : Timestamp.fromDate(new Date(studentData.enrollmentDate));
    }
    if (studentData.paymentHistory) {
       payloadForFirestore.paymentHistory = studentData.paymentHistory.map(p => ({
          ...p,
          date: p.date instanceof Date ? Timestamp.fromDate(p.date) : Timestamp.fromDate(new Date(p.date)),
      }));
    }

    try {
      await updateDoc(studentDocRef, payloadForFirestore);
      setStudents((prevStudents) =>
        prevStudents.map(s =>
          s.id === studentId
          ? mapDocToStudent({ ...s, ...studentData, enrollmentDate: studentData.enrollmentDate ? new Date(studentData.enrollmentDate).toISOString() : s.enrollmentDate, paymentHistory: studentData.paymentHistory ? studentData.paymentHistory.map(p=> ({...p, date: new Date(p.date).toISOString()})) : s.paymentHistory })
          : s
        )
      );
    } catch (error: any) {
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
            id: doc(collection(db, '_')).id,
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
                ? { ...s, paymentHistory: updatedPaymentHistory.map(p=> ({...p, date: new Date(p.date).toISOString()})), status: newStatus }
                : s
            )
        );

    } catch (error: any) {
        console.error("Error adding payment to Firestore:", error);
        throw error;
    }
  };

  const deleteStudent = async (studentId: string) => {
    if (!db) {
      console.error("Firestore 'db' not available for deleteStudent");
      throw new Error("Database not available. Please try again later.");
    }
    const studentDocRef = doc(db, 'students', studentId);
    try {
      await deleteDoc(studentDocRef);
      setStudents(prev => prev.filter(s => s.id !== studentId));
    } catch (error: any) {
      console.error("Error deleting student from Firestore:", error);
      throw error;
    }
  };

  const clearAllPaymentHistories = async () => {
    if (!db) {
      console.error("Firestore 'db' not available for clearAllPaymentHistories");
      throw new Error("Database not available. Please try again later.");
    }
    const batch = writeBatch(db);
    const updatedStudentsLocally: Student[] = [];

    students.forEach(student => {
      const studentRef = doc(db, 'students', student.id);
      let newStatus = student.status;

      if (student.status === 'completed_paid' || student.status === 'completed_unpaid') {
        const enrollmentPaid = student.paymentHistory.some(p => p.type === 'enrollment');
        newStatus = enrollmentPaid ? 'active' : 'enrollment_pending';
      } else if (student.status === 'active') {
         const enrollmentPaid = student.paymentHistory.some(p => p.type === 'enrollment');
         if (!enrollmentPaid) {
            newStatus = 'enrollment_pending';
         }
      }

      batch.update(studentRef, { paymentHistory: [], status: newStatus });
      updatedStudentsLocally.push({ ...student, paymentHistory: [], status: newStatus });
    });

    try {
      await batch.commit();
      setStudents(updatedStudentsLocally.map(mapDocToStudent));
    } catch (error: any) {
      console.error("Error clearing payment histories in Firestore:", error);
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
        deleteStudent,
        clearAllPaymentHistories,
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
