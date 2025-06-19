
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
import { storage as appwriteStorage, ID as AppwriteID, APPWRITE_STUDENT_PHOTOS_BUCKET_ID } from '@/lib/appwrite';


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
  photoUrl: docData.photoUrl || undefined,
});

// Helper function to convert data URI to File
function dataURItoFile(dataURI: string, filename: string): File {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new File([ab], filename, { type: mimeString });
}


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

    let photoUrlToSave: string | undefined = undefined;

    try {
      let fileToUpload: File | null = null;
      if (studentData.photoFile) {
        fileToUpload = studentData.photoFile;
      } else if (studentData.photoDataUri) {
        fileToUpload = dataURItoFile(studentData.photoDataUri, `student_photo_${Date.now()}.png`);
      }

      if (fileToUpload) {
        console.log("Attempting to upload photo to Appwrite...");
        const fileUploadResponse = await appwriteStorage.createFile(
          APPWRITE_STUDENT_PHOTOS_BUCKET_ID,
          AppwriteID.unique(),
          fileToUpload
        );
        console.log("Appwrite file upload response:", fileUploadResponse);
        const fileViewUrl = appwriteStorage.getFileView(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, fileUploadResponse.$id);
        photoUrlToSave = fileViewUrl.href; 
        console.log("Photo URL to save:", photoUrlToSave);
      }
    } catch (uploadError: any) {
      console.error("Error uploading photo to Appwrite:", uploadError);
      // Set photoUrlToSave to null or undefined if you want to proceed without photo
      // For now, we let it be undefined so the payload below handles it.
    }


    const { enrollmentDate: enrollmentDateObj, photoFile, photoDataUri, ...restOfStudentData } = studentData;
    const isoEnrollmentDate = `${enrollmentDateObj.year}-${String(enrollmentDateObj.month).padStart(2, '0')}-${String(enrollmentDateObj.day).padStart(2, '0')}`;

    const newStudentPayload: Omit<Student, 'id'> = {
      ...restOfStudentData,
      enrollmentDate: isoEnrollmentDate,
      status: 'enrollment_pending',
      paymentHistory: [],
      photoUrl: photoUrlToSave, 
    };

    try {
      const payloadForFirestore: any = {
        ...newStudentPayload,
        enrollmentDate: Timestamp.fromDate(new Date(newStudentPayload.enrollmentDate)),
        photoUrl: photoUrlToSave || null, // Ensure photoUrl is null if undefined
      };


      const docRef = await addDoc(studentsCollectionRef, payloadForFirestore);
      setStudents((prev) => [...prev, mapDocToStudent({ ...newStudentPayload, id: docRef.id, photoUrl: photoUrlToSave || undefined })]);
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
    // Ensure photoUrl is not set to undefined
    if (payloadForFirestore.hasOwnProperty('photoUrl') && payloadForFirestore.photoUrl === undefined) {
        payloadForFirestore.photoUrl = null;
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
        // If enrollment fee is paid and student was pending, activate them
        if (paymentData.type === 'enrollment' && currentStudent.status === 'enrollment_pending') {
            const course = courses.find(c => c.id === currentStudent.courseId);
            const enrollmentFeePaid = updatedPaymentHistory
                .filter(p => p.type === 'enrollment')
                .reduce((sum, p) => sum + p.amount, 0);
            if (course && enrollmentFeePaid >= course.enrollmentFee) {
                newStatus = 'active';
            }
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
                ? mapDocToStudent({ ...s, paymentHistory: updatedPaymentHistory, status: newStatus })
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
      const studentToDelete = students.find(s => s.id === studentId);
      if (studentToDelete && studentToDelete.photoUrl) {
        try {
          const fileId = studentToDelete.photoUrl.split('/files/')[1].split('/view')[0];
          if (fileId) {
             await appwriteStorage.deleteFile(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, fileId);
             console.log("Appwrite photo deleted:", fileId);
          }
        } catch (appwriteError) {
            console.error("Error deleting photo from Appwrite, proceeding with Firestore delete:", appwriteError);
        }
      }
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
      
      // Check if enrollment was effectively paid before clearing history.
      // This check needs to be against the *current* payment history.
      const course = courses.find(c => c.id === student.courseId);
      const enrollmentFeePaidAmount = student.paymentHistory
          .filter(p => p.type === 'enrollment')
          .reduce((sum, p) => sum + p.amount, 0);
      const wasEnrollmentFeeSufficientlyPaid = course && enrollmentFeePaidAmount >= course.enrollmentFee;


      if (student.status === 'completed_paid' || student.status === 'completed_unpaid' || student.status === 'active') {
        newStatus = wasEnrollmentFeeSufficientlyPaid ? 'active' : 'enrollment_pending';
      } else if (student.status === 'enrollment_pending') {
        // If they were pending, they remain pending unless this clear operation somehow implied they should be active (which it shouldn't)
        newStatus = 'enrollment_pending';
      }
      // 'left' status remains 'left'

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


    