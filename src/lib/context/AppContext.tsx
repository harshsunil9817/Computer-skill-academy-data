
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
        // Construct the URL to view/preview the file
        // Option 1: Using getFileView (direct link, might force download for some types if not image)
        const fileViewUrl = appwriteStorage.getFileView(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, fileUploadResponse.$id);
        photoUrlToSave = fileViewUrl.href; 
        // Option 2: Using getFilePreview (can specify width/height, good for thumbnails)
        // const filePreviewUrl = appwriteStorage.getFilePreview(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, fileUploadResponse.$id, 400); // width 400px
        // photoUrlToSave = filePreviewUrl.href;
        console.log("Photo URL to save:", photoUrlToSave);
      }
    } catch (uploadError: any) {
      console.error("Error uploading photo to Appwrite:", uploadError);
      // Decide if you want to proceed without photo or throw error
      // For now, we'll proceed without photo if upload fails, but log it.
      // Consider a toast message to the user here in a real app.
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
      };
      if (photoUrlToSave) {
        payloadForFirestore.photoUrl = photoUrlToSave;
      }


      const docRef = await addDoc(studentsCollectionRef, payloadForFirestore);
      setStudents((prev) => [...prev, mapDocToStudent({ ...newStudentPayload, id: docRef.id, photoUrl: photoUrlToSave })]);
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
            id: doc(collection(db, '_')).id, // Firestore auto-ID for sub-collection like item, not a real sub-collection here.
            date: paymentData.date, // Keep as ISO string, convert before Firestore write
        };

        const updatedPaymentHistory = [...currentStudent.paymentHistory, newPayment];

        let newStatus = currentStudent.status;
        if (paymentData.type === 'enrollment' && currentStudent.status === 'enrollment_pending') {
            newStatus = 'active';
        }

        // Prepare payment history for Firestore (convert dates to Timestamps)
        const paymentHistoryForFirestore = updatedPaymentHistory.map(p => ({
            ...p,
            date: Timestamp.fromDate(new Date(p.date)), // Convert ISO string to Date, then to Timestamp
        }));

        await updateDoc(studentRef, {
            paymentHistory: paymentHistoryForFirestore,
            status: newStatus,
        });

        // Update local state, ensuring dates in paymentHistory remain ISO strings for consistency
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
    // Note: Does not delete Appwrite photo. Consider adding that if needed.
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

      // If student completed (paid or unpaid), reset status based on enrollment payment.
      // If student is active, check if enrollment was paid. If not, set to enrollment_pending.
      // 'left' status should remain 'left'.
      if (student.status === 'completed_paid' || student.status === 'completed_unpaid') {
        // Check original payment history (before clearing) if enrollment was paid
        const enrollmentPaid = student.paymentHistory.some(p => p.type === 'enrollment');
        newStatus = enrollmentPaid ? 'active' : 'enrollment_pending';
      } else if (student.status === 'active') {
         const enrollmentPaid = student.paymentHistory.some(p => p.type === 'enrollment');
         if (!enrollmentPaid) { // If active but somehow enrollment wasn't logged (or cleared already)
            newStatus = 'enrollment_pending';
         }
      }
      // Do not change status if 'enrollment_pending' or 'left'

      batch.update(studentRef, { paymentHistory: [], status: newStatus });
      updatedStudentsLocally.push({ ...student, paymentHistory: [], status: newStatus });
    });

    try {
      await batch.commit();
      setStudents(updatedStudentsLocally.map(mapDocToStudent)); // re-map to ensure data consistency
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
