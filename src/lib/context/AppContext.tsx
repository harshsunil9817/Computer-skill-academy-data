
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
  updateStudent: (studentId: string, studentData: Partial<Omit<Student, 'id' | 'paymentHistory' | 'enrollmentDate' | 'dob' | 'enrollmentNumber' >> & { enrollmentDate?: string; dob?: {day: string, month: string, year: string }; photoFile?: File | null; photoDataUri?: string | null; photoToBeRemoved?: boolean }) => Promise<void>;
  addPayment: (studentId: string, payment: Omit<PaymentRecord, 'id'>) => Promise<void>;
  deleteStudent: (studentId: string) => Promise<void>;
  clearAllPaymentHistories: () => Promise<void>;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const mapDocToStudent = (docData: any): Student => ({
  ...docData,
  enrollmentNumber: docData.enrollmentNumber || 'N/A', // Handle older docs
  enrollmentDate: docData.enrollmentDate instanceof Timestamp ? docData.enrollmentDate.toDate().toISOString() : docData.enrollmentDate,
  dob: docData.dob, // Keep as is from Firestore (should be an object)
  paymentHistory: docData.paymentHistory?.map((p: any) => ({
      ...p,
      date: p.date instanceof Timestamp ? p.date.toDate().toISOString() : p.date,
  })) || [],
  photoUrl: docData.photoUrl || undefined,
});

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

// Helper to extract Appwrite file ID from URL
const getAppwriteFileIdFromUrl = (url: string): string | null => {
    try {
        const pathSegments = new URL(url).pathname.split('/');
        // Assuming URL structure like /v1/storage/buckets/{BUCKET_ID}/files/{FILE_ID}/view
        const fileIdIndex = pathSegments.indexOf('files') + 1;
        if (fileIdIndex > 0 && fileIdIndex < pathSegments.length) {
            return pathSegments[fileIdIndex];
        }
        return null;
    } catch (e) {
        console.error("Error parsing Appwrite URL for file ID:", e);
        return null;
    }
};


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
        const fileUploadResponse = await appwriteStorage.createFile(
          APPWRITE_STUDENT_PHOTOS_BUCKET_ID,
          AppwriteID.unique(),
          fileToUpload
        );
        const fileViewUrl = appwriteStorage.getFileView(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, fileUploadResponse.$id);
        photoUrlToSave = fileViewUrl.href; 
      }
    } catch (uploadError: any) {
      console.error("Error uploading photo to Appwrite:", uploadError);
    }

    // Generate Enrollment Number
    const enrollmentYear = studentData.enrollmentDate.year.slice(-2); // Last two digits of the year
    const studentsInSameYear = students.filter(s => {
      try {
        const existingStudentEnrollmentYear = new Date(s.enrollmentDate).getFullYear().toString().slice(-2);
        return existingStudentEnrollmentYear === enrollmentYear;
      } catch (e) {
        return false; // Gracefully handle if date is invalid
      }
    });
    const nextSequenceNumber = studentsInSameYear.length + 1;
    const enrollmentSequence = String(nextSequenceNumber).padStart(4, '0');
    const generatedEnrollmentNumber = `CSA${enrollmentYear}${enrollmentSequence}`;


    const { enrollmentDate: enrollmentDateObj, dob: dobObj, photoFile, photoDataUri, ...restOfStudentData } = studentData;
    const isoEnrollmentDate = `${enrollmentDateObj.year}-${String(enrollmentDateObj.month).padStart(2, '0')}-${String(enrollmentDateObj.day).padStart(2, '0')}`;
    
    const newStudentPayload: Omit<Student, 'id'> = {
      ...restOfStudentData,
      enrollmentNumber: generatedEnrollmentNumber,
      enrollmentDate: isoEnrollmentDate,
      dob: dobObj, // Store DOB object directly
      status: 'enrollment_pending',
      paymentHistory: [],
      photoUrl: photoUrlToSave || undefined, 
    };

    try {
      const payloadForFirestore: any = {
        ...newStudentPayload,
        enrollmentDate: Timestamp.fromDate(new Date(newStudentPayload.enrollmentDate)),
        photoUrl: photoUrlToSave || null, 
      };

      const docRef = await addDoc(studentsCollectionRef, payloadForFirestore);
      setStudents((prev) => [...prev, mapDocToStudent({ ...newStudentPayload, id: docRef.id, photoUrl: photoUrlToSave || undefined })]);
    } catch (error: any) {
      console.error("Error adding student to Firestore:", error);
      throw error;
    }
  };

  const updateStudent = async (
    studentId: string, 
    updateData: Partial<Omit<Student, 'id' | 'paymentHistory' | 'enrollmentDate' | 'dob' | 'enrollmentNumber'>> & { 
        enrollmentDate?: string; 
        dob?: {day: string, month: string, year: string }; 
        photoFile?: File | null; 
        photoDataUri?: string | null; 
        photoToBeRemoved?: boolean 
    }
) => {
    if (!db) {
       console.error("Firestore 'db' not available for updateStudent");
       throw new Error("Database not available. Please try again later.");
    }
    const studentDocRef = doc(db, 'students', studentId);
    const currentStudent = students.find(s => s.id === studentId);

    if (!currentStudent) {
        console.error("Student not found for update");
        throw new Error("Student not found.");
    }

    let finalPhotoUrl: string | null | undefined = currentStudent.photoUrl;

    if (updateData.photoFile || updateData.photoDataUri) { 
        let fileToUpload: File | null = null;
        if (updateData.photoFile) {
            fileToUpload = updateData.photoFile;
        } else if (updateData.photoDataUri) {
            fileToUpload = dataURItoFile(updateData.photoDataUri, `student_photo_${Date.now()}.png`);
        }

        if (fileToUpload) {
            try {
                const fileUploadResponse = await appwriteStorage.createFile(
                    APPWRITE_STUDENT_PHOTOS_BUCKET_ID,
                    AppwriteID.unique(),
                    fileToUpload
                );
                const newPhotoViewUrl = appwriteStorage.getFileView(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, fileUploadResponse.$id);
                finalPhotoUrl = newPhotoViewUrl.href;

                if (currentStudent.photoUrl) {
                    const oldFileId = getAppwriteFileIdFromUrl(currentStudent.photoUrl);
                    if (oldFileId) {
                        await appwriteStorage.deleteFile(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, oldFileId);
                    }
                }
            } catch (uploadError) {
                console.error("Error uploading new photo during update:", uploadError);
            }
        }
    } else if (updateData.photoToBeRemoved && currentStudent.photoUrl) { 
        try {
            const oldFileId = getAppwriteFileIdFromUrl(currentStudent.photoUrl);
            if (oldFileId) {
                await appwriteStorage.deleteFile(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, oldFileId);
            }
            finalPhotoUrl = null;
        } catch (deleteError) {
            console.error("Error deleting existing photo during update:", deleteError);
        }
    }

    const { photoFile, photoDataUri, photoToBeRemoved, ...restOfUpdateData } = updateData;
    
    const payloadForFirestore: Record<string, any> = { ...restOfUpdateData };

    if (updateData.enrollmentDate) {
      payloadForFirestore.enrollmentDate = Timestamp.fromDate(new Date(updateData.enrollmentDate));
    }
    if (updateData.dob) { 
        payloadForFirestore.dob = updateData.dob;
    }
    
    // Ensure enrollmentNumber is not accidentally removed or changed if not explicitly part of updateData
    payloadForFirestore.enrollmentNumber = currentStudent.enrollmentNumber; 
    payloadForFirestore.photoUrl = finalPhotoUrl === undefined ? currentStudent.photoUrl : (finalPhotoUrl === null ? null : finalPhotoUrl);

    Object.keys(payloadForFirestore).forEach(key => {
        if (payloadForFirestore[key] === undefined) {
            delete payloadForFirestore[key];
        }
    });


    try {
      await updateDoc(studentDocRef, payloadForFirestore);
      setStudents((prevStudents) =>
        prevStudents.map(s => {
          if (s.id === studentId) {
            const updatedStudentFields = { ...s, ...payloadForFirestore };
            if (payloadForFirestore.enrollmentDate instanceof Timestamp) {
              updatedStudentFields.enrollmentDate = payloadForFirestore.enrollmentDate.toDate().toISOString();
            }
            return mapDocToStudent(updatedStudentFields); 
          }
          return s;
        })
      );
    } catch (error: any)
 {
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
          const fileId = getAppwriteFileIdFromUrl(studentToDelete.photoUrl);
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
      
      const course = courses.find(c => c.id === student.courseId);
      const enrollmentFeePaidAmount = student.paymentHistory
          .filter(p => p.type === 'enrollment')
          .reduce((sum, p) => sum + p.amount, 0);
      const wasEnrollmentFeeSufficientlyPaid = course && enrollmentFeePaidAmount >= course.enrollmentFee;

      if (student.status === 'completed_paid' || student.status === 'completed_unpaid' || student.status === 'active') {
        newStatus = wasEnrollmentFeeSufficientlyPaid ? 'active' : 'enrollment_pending';
      } else if (student.status === 'enrollment_pending') {
        newStatus = 'enrollment_pending';
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

