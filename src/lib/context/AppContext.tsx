
"use client";
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Course, Student, PaymentRecord, StudentFormData, CourseFormData, PaymentPlan, ExamFee, CustomFee } from '@/lib/types';
import { db, app as firebaseAppInstance } from '@/lib/firebase';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { storage as appwriteStorage, ID as AppwriteID, APPWRITE_STUDENT_PHOTOS_BUCKET_ID } from '@/lib/appwrite';


interface AppContextType {
  courses: Course[];
  students: Student[];
  addCourse: (course: Omit<Course, 'id'>) => Promise<void>;
  updateCourse: (course: Course) => Promise<void>;
  deleteCourse: (courseId: string) => Promise<void>;
  addStudent: (student: StudentFormData) => Promise<void>;
  updateStudent: (studentId: string, studentData: Partial<StudentFormData> & { photoToBeRemoved?: boolean, status?: string }) => Promise<void>;
  addPayment: (studentId: string, payment: Omit<PaymentRecord, 'id'>) => Promise<void>;
  revertPayment: (studentId: string, paymentId: string) => Promise<void>;
  deleteStudent: (studentId: string) => Promise<void>;
  addCustomFee: (studentId: string, fee: Omit<CustomFee, 'id' | 'dateCreated' | 'status'> & { status: 'paid' | 'due'}) => Promise<void>;
  updateCustomFeeStatus: (studentId: string, feeId: string, status: 'paid' | 'due') => Promise<void>;
  clearAllPaymentHistories: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (user: string, pass: string) => boolean;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const mapDocToStudent = (docData: any): Student => ({
  ...docData,
  enrollmentNumber: docData.enrollmentNumber || 'N/A',
  enrollmentDate: docData.enrollmentDate instanceof Timestamp ? docData.enrollmentDate.toDate().toISOString() : docData.enrollmentDate,
  dob: docData.dob,
  paymentHistory: docData.paymentHistory?.map((p: any) => ({
      ...p,
      date: p.date instanceof Timestamp ? p.date.toDate().toISOString() : p.date,
  })) || [],
  customFees: docData.customFees?.map((f: any) => ({
      ...f,
      dateCreated: f.dateCreated instanceof Timestamp ? f.dateCreated.toDate().toISOString() : f.dateCreated,
      datePaid: f.datePaid instanceof Timestamp ? f.datePaid.toDate().toISOString() : f.datePaid,
  })) || [],
  photoUrl: docData.photoUrl || undefined,
  overriddenEnrollmentFee: docData.overriddenEnrollmentFee,
  overriddenMonthlyFee: docData.overriddenMonthlyFee,
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

const getAppwriteFileIdFromUrl = (url: string): string | null => {
    try {
        const pathSegments = new URL(url).pathname.split('/');
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

const PREDEFINED_COURSES: Omit<Course, 'id'>[] = [
    { name: "CCC", enrollmentFee: 0, paymentType: 'installment', monthlyFee: 0, paymentPlans: [{name: "One-Time", totalAmount: 2000, installments: [2000]}, {name: "Two Installments", totalAmount: 2200, installments: [1100, 1100]}], examFees: [] },
    { name: "Tally", enrollmentFee: 0, paymentType: 'installment', monthlyFee: 0, paymentPlans: [{name: "One-Time", totalAmount: 2500, installments: [2500]}, {name: "Two Installments", totalAmount: 2600, installments: [1300, 1300]}], examFees: [] },
    { name: "Premium Tally", enrollmentFee: 0, paymentType: 'installment', monthlyFee: 0, paymentPlans: [{name: "One-Time", totalAmount: 3000, installments: [3000]}, {name: "Two Installments", totalAmount: 3200, installments: [1600, 1600]}, {name: "Three Installments", totalAmount: 3600, installments: [1200, 1200, 1200]}], examFees: [] },
    { name: "Coral Draw & PhotoShop (DTP)", enrollmentFee: 0, paymentType: 'installment', monthlyFee: 0, paymentPlans: [{name: "One-Time", totalAmount: 3000, installments: [3000]}, {name: "Two Installments", totalAmount: 3200, installments: [1600, 1600]}, {name: "Three Installments", totalAmount: 3600, installments: [1200, 1200, 1200]}], examFees: [] },
    { name: "Excel", enrollmentFee: 0, paymentType: 'installment', monthlyFee: 0, paymentPlans: [{name: "One-Time", totalAmount: 2500, installments: [2500]}, {name: "Two Installments", totalAmount: 2700, installments: [1350, 1350]}, {name: "Three Installments", totalAmount: 2700, installments: [900, 900, 900]}], examFees: [] },
    { name: "HTML, CSS, JavaScript", enrollmentFee: 0, paymentType: 'installment', monthlyFee: 0, paymentPlans: [{name: "One-Time", totalAmount: 2500, installments: [2500]}, {name: "Two Installments", totalAmount: 2700, installments: [1350, 1350]}, {name: "Three Installments", totalAmount: 2700, installments: [900, 900, 900]}], examFees: [] },
    { name: "Python", enrollmentFee: 0, paymentType: 'installment', monthlyFee: 0, paymentPlans: [{name: "One-Time", totalAmount: 2500, installments: [2500]}, {name: "Two Installments", totalAmount: 2700, installments: [1350, 1350]}, {name: "Three Installments", totalAmount: 2700, installments: [900, 900, 900]}], examFees: [] },
    { name: "SQL", enrollmentFee: 0, paymentType: 'installment', monthlyFee: 0, paymentPlans: [{name: "One-Time", totalAmount: 2500, installments: [2500]}, {name: "Two Installments", totalAmount: 2700, installments: [1350, 1350]}, {name: "Three Installments", totalAmount: 2700, installments: [900, 900, 900]}], examFees: [] },
    { name: "ADCA", enrollmentFee: 550, paymentType: 'monthly', monthlyFee: 500, paymentPlans: [], examFees: [{name: "Exam Fee", amount: 300}] },
    { name: "ADFA", enrollmentFee: 550, paymentType: 'monthly', monthlyFee: 500, paymentPlans: [], examFees: [{name: "Exam Fee", amount: 300}] },
    { name: "O Level", enrollmentFee: 1250, paymentType: 'monthly', monthlyFee: 500, paymentPlans: [], examFees: [{name: "M1 Exam + Practical", amount: 2150}, {name: "M2 Exam + Practical", amount: 2150}, {name: "M3 Exam + Practical", amount: 2150}, {name: "M4 Exam + Practical", amount: 2150}]}
];


export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isAppContextLoading, setAppContextIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const router = useRouter();


  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
    setIsAuthLoading(false);

    const fetchData = async () => {
      setAppContextIsLoading(true);
      if (!db) {
        console.error("AppContext: Firestore 'db' instance is not available. Halting data fetch.");
        setAppContextIsLoading(false);
        return;
      }
      try {
        const coursesCollectionRef = collection(db, 'courses');
        const studentSnapshot = await getDocs(collection(db, 'students'));
        const existingStudents = studentSnapshot.docs.map(doc => mapDocToStudent({ ...doc.data(), id: doc.id }));
        setStudents(existingStudents);

        const courseSnapshot = await getDocs(coursesCollectionRef);
        let existingCourses = courseSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Course));
        
        const batch = writeBatch(db);
        let hasChanges = false;
        for (const pc of PREDEFINED_COURSES) {
            if (!existingCourses.some(ec => ec.name === pc.name)) {
                const courseRef = doc(collection(db, "courses"));
                batch.set(courseRef, pc);
                existingCourses.push({...pc, id: courseRef.id});
                hasChanges = true;
            }
        }
        if (hasChanges) {
            await batch.commit();
        }

        setCourses(existingCourses);

      } catch (error) {
        console.error("AppContext: Failed to load data from Firestore.", error);
      } finally {
        setAppContextIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const login = (user: string, pass: string): boolean => {
    if (user.toLowerCase() === 'sunil singh' && pass === 'sunil817') {
      localStorage.setItem('isAuthenticated', 'true');
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('isAuthenticated');
    setIsAuthenticated(false);
    router.push('/login');
  };

  const addCourse = async (courseData: Omit<Course, 'id'>) => {
    if (!db) throw new Error("Database not available.");
    const docRef = await addDoc(collection(db, 'courses'), courseData);
    setCourses((prev) => [...prev, { ...courseData, id: docRef.id }]);
  };

  const updateCourse = async (updatedCourse: Course) => {
    if (!db) throw new Error("Database not available.");
    const courseDocRef = doc(db, 'courses', updatedCourse.id);
    const { id, ...courseDataToUpdate } = updatedCourse;
    await updateDoc(courseDocRef, courseDataToUpdate);
    setCourses((prev) => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
  };

  const deleteCourse = async (courseId: string) => {
    if (!db) throw new Error("Database not available.");
    if (students.some(student => student.courseId === courseId)) {
      throw new Error("Cannot delete course. Students are currently enrolled in it.");
    }
    await deleteDoc(doc(db, 'courses', courseId));
    setCourses(prev => prev.filter(c => c.id !== courseId));
  };

  const addStudent = async (studentData: StudentFormData) => {
    if (!db) throw new Error("Database not available.");
    
    let photoUrlToSave: string | undefined = undefined;
    if (studentData.photoFile) {
        const fileToUpload = studentData.photoFile;
        const fileUploadResponse = await appwriteStorage.createFile(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, AppwriteID.unique(), fileToUpload);
        photoUrlToSave = appwriteStorage.getFileView(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, fileUploadResponse.$id).href; 
    } else if (studentData.photoDataUri) {
        const fileToUpload = dataURItoFile(studentData.photoDataUri, `student_photo_${Date.now()}.png`);
        const fileUploadResponse = await appwriteStorage.createFile(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, AppwriteID.unique(), fileToUpload);
        photoUrlToSave = appwriteStorage.getFileView(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, fileUploadResponse.$id).href;
    }

    const enrollmentYear = studentData.enrollmentDate.year.slice(-2);
    const studentsInSameYear = students.filter(s => s.enrollmentDate.startsWith(studentData.enrollmentDate.year));
    const enrollmentSequence = String(studentsInSameYear.length + 1).padStart(4, '0');
    const generatedEnrollmentNumber = `CSA${enrollmentYear}${enrollmentSequence}`;

    const { enrollmentDate: ed, dob, photoFile, photoDataUri, ...rest } = studentData;
    const isoEnrollmentDate = `${ed.year}-${String(ed.month).padStart(2, '0')}-${String(ed.day).padStart(2, '0')}`;
    
    const newStudentPayload: Omit<Student, 'id'> = {
      ...rest,
      enrollmentNumber: generatedEnrollmentNumber,
      enrollmentDate: isoEnrollmentDate,
      dob,
      status: 'enrollment_pending',
      paymentHistory: [],
      customFees: [],
      photoUrl: photoUrlToSave,
    };

    const payloadForFirestore: any = {
      ...newStudentPayload,
      enrollmentDate: Timestamp.fromDate(new Date(isoEnrollmentDate)),
      photoUrl: photoUrlToSave || null,
      selectedPaymentPlanName: newStudentPayload.selectedPaymentPlanName || null,
      overriddenEnrollmentFee: newStudentPayload.overriddenEnrollmentFee ?? null,
      overriddenMonthlyFee: newStudentPayload.overriddenMonthlyFee ?? null,
    };

    const docRef = await addDoc(collection(db, 'students'), payloadForFirestore);
    setStudents((prev) => [...prev, mapDocToStudent({ ...newStudentPayload, id: docRef.id })]);
  };

  const updateStudent = async (studentId: string, updateData: Partial<StudentFormData> & { photoToBeRemoved?: boolean, status?: string }) => {
    if (!db) throw new Error("Database not available.");
    const studentDocRef = doc(db, 'students', studentId);
    const currentStudent = students.find(s => s.id === studentId);
    if (!currentStudent) throw new Error("Student not found.");

    let finalPhotoUrl: string | null | undefined = currentStudent.photoUrl;

    if (updateData.photoFile) {
        const fileToUpload = updateData.photoFile;
        if (currentStudent.photoUrl) {
            const oldFileId = getAppwriteFileIdFromUrl(currentStudent.photoUrl);
            if (oldFileId) {
                try { await appwriteStorage.deleteFile(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, oldFileId); }
                catch (e) { console.warn("Old photo deletion failed (might be already deleted):", e); }
            }
        }
        const fileUploadResponse = await appwriteStorage.createFile(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, AppwriteID.unique(), fileToUpload);
        finalPhotoUrl = appwriteStorage.getFileView(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, fileUploadResponse.$id).href;
    } else if (updateData.photoDataUri) {
        if (currentStudent.photoUrl) {
            const oldFileId = getAppwriteFileIdFromUrl(currentStudent.photoUrl);
            if (oldFileId) {
                try { await appwriteStorage.deleteFile(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, oldFileId); }
                catch (e) { console.warn("Old photo deletion failed:", e); }
            }
        }
        const fileToUpload = dataURItoFile(updateData.photoDataUri, `student_photo_${Date.now()}.png`);
        const fileUploadResponse = await appwriteStorage.createFile(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, AppwriteID.unique(), fileToUpload);
        finalPhotoUrl = appwriteStorage.getFileView(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, fileUploadResponse.$id).href;
    } else if (updateData.photoToBeRemoved && currentStudent.photoUrl) {
        const fileIdToDelete = getAppwriteFileIdFromUrl(currentStudent.photoUrl);
        if (fileIdToDelete) {
             try { await appwriteStorage.deleteFile(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, fileIdToDelete); }
             catch (e) { console.warn("Photo deletion failed:", e); }
        }
        finalPhotoUrl = null;
    }

    const { photoFile, photoDataUri, photoToBeRemoved, enrollmentDate, dob, ...restOfUpdateData } = updateData;
    
    const payloadForFirestore: Record<string, any> = { ...restOfUpdateData };

    if (enrollmentDate) {
      payloadForFirestore.enrollmentDate = Timestamp.fromDate(new Date(`${enrollmentDate.year}-${enrollmentDate.month}-${enrollmentDate.day}`));
    }
    if (dob) payloadForFirestore.dob = dob;
    
    payloadForFirestore.photoUrl = finalPhotoUrl === undefined ? currentStudent.photoUrl : finalPhotoUrl;
    if (updateData.status) payloadForFirestore.status = updateData.status;

    if ('overriddenEnrollmentFee' in updateData) {
        payloadForFirestore.overriddenEnrollmentFee = updateData.overriddenEnrollmentFee ?? null;
    }
    if ('overriddenMonthlyFee' in updateData) {
        payloadForFirestore.overriddenMonthlyFee = updateData.overriddenMonthlyFee ?? null;
    }
    
    Object.keys(payloadForFirestore).forEach(key => payloadForFirestore[key] === undefined && delete payloadForFirestore[key]);

    await updateDoc(studentDocRef, payloadForFirestore);

    const updatedLocalStudentData = { ...currentStudent, ...payloadForFirestore };
    if(payloadForFirestore.enrollmentDate) {
        updatedLocalStudentData.enrollmentDate = payloadForFirestore.enrollmentDate.toDate().toISOString();
    }

    setStudents((prev) => prev.map(s => s.id === studentId ? mapDocToStudent(updatedLocalStudentData) : s));
  };
  
  const addPayment = async (studentId: string, paymentData: Omit<PaymentRecord, 'id'>) => {
     if (!db) throw new Error("Database not available.");
     await runTransaction(db, async (transaction) => {
        const studentRef = doc(db, 'students', studentId);
        const studentDoc = await transaction.get(studentRef);
        if (!studentDoc.exists()) throw new Error("Student not found.");

        const currentStudent = mapDocToStudent(studentDoc.data());
        
        const newPayment: PaymentRecord = {
            ...paymentData,
            id: doc(collection(db, '_')).id, 
            date: new Date().toISOString(),
        };
        const updatedPaymentHistory = [...currentStudent.paymentHistory, newPayment];
        
        let newStatus = currentStudent.status;
        if(newPayment.type === 'enrollment' && currentStudent.status === 'enrollment_pending') {
            const course = courses.find(c => c.id === currentStudent.courseId);
            const totalEnrollmentPaid = updatedPaymentHistory.filter(p => p.type === 'enrollment').reduce((sum,p) => sum+p.amount, 0);
            if(course && totalEnrollmentPaid >= (currentStudent.overriddenEnrollmentFee ?? course.enrollmentFee)) {
                newStatus = 'active';
            }
        }
        
        const paymentHistoryForFirestore = updatedPaymentHistory.map(p => ({
            ...p,
            date: Timestamp.fromDate(new Date(p.date)), 
        }));

        transaction.update(studentRef, { paymentHistory: paymentHistoryForFirestore, status: newStatus });
     });
     const updatedStudentDoc = await getDocs(collection(db, 'students'));
     setStudents(updatedStudentDoc.docs.map(doc => mapDocToStudent({ ...doc.data(), id: doc.id })));
  };

  const revertPayment = async (studentId: string, paymentId: string) => {
    if (!db) throw new Error("Database not available.");
    await runTransaction(db, async (transaction) => {
      const studentRef = doc(db, 'students', studentId);
      const studentDoc = await transaction.get(studentRef);
      if (!studentDoc.exists()) throw new Error("Student not found.");

      const currentStudent = mapDocToStudent(studentDoc.data());
      const paymentToRevert = currentStudent.paymentHistory.find(p => p.id === paymentId);

      if (!paymentToRevert) throw new Error("Payment record not found.");

      const updatedPaymentHistory = currentStudent.paymentHistory.filter(p => p.id !== paymentId);
      
      let newStatus = currentStudent.status;
      if (paymentToRevert.type === 'enrollment' && newStatus === 'active') {
        const course = courses.find(c => c.id === currentStudent.courseId);
        const totalEnrollmentPaid = updatedPaymentHistory.filter(p => p.type === 'enrollment').reduce((sum, p) => sum + p.amount, 0);
        if (course && totalEnrollmentPaid < (currentStudent.overriddenEnrollmentFee ?? course.enrollmentFee)) {
          newStatus = 'enrollment_pending';
        }
      }

      const paymentHistoryForFirestore = updatedPaymentHistory.map(p => ({
          ...p,
          date: Timestamp.fromDate(new Date(p.date)),
      }));

      transaction.update(studentRef, { paymentHistory: paymentHistoryForFirestore, status: newStatus });
    });

    const updatedStudentDoc = await getDocs(collection(db, 'students'));
    setStudents(updatedStudentDoc.docs.map(doc => mapDocToStudent({ ...doc.data(), id: doc.id })));
  };

  const addCustomFee = async (studentId: string, fee: Omit<CustomFee, 'id' | 'dateCreated'>) => {
     if (!db) throw new Error("Database not available.");
     const studentRef = doc(db, 'students', studentId);
     const currentStudent = students.find(s => s.id === studentId);
     if (!currentStudent) throw new Error("Student not found");

     const newFee: CustomFee = {
         ...fee,
         id: doc(collection(db, '_')).id,
         dateCreated: new Date().toISOString(),
         status: fee.amount === 0 || fee.status === 'paid' ? 'paid' : 'due',
     }
     
     const updatedFees = [...(currentStudent.customFees || []), newFee];
     await updateDoc(studentRef, { customFees: updatedFees });
     setStudents(prev => prev.map(s => s.id === studentId ? {...s, customFees: updatedFees} : s));

     if (newFee.status === 'paid') {
         await addPayment(studentId, {
             date: new Date().toISOString(),
             amount: newFee.amount,
             type: 'custom',
             referenceId: newFee.id,
             description: newFee.name
         });
     }
  };

  const updateCustomFeeStatus = async (studentId: string, feeId: string, status: 'paid' | 'due') => {
      if (!db) throw new Error("Database not available.");
      const studentRef = doc(db, 'students', studentId);
      const currentStudent = students.find(s => s.id === studentId);
      if (!currentStudent) throw new Error("Student not found");

      const updatedFees = (currentStudent.customFees || []).map(fee => {
          if (fee.id === feeId) {
              return {...fee, status, datePaid: status === 'paid' ? new Date().toISOString() : undefined }
          }
          return fee;
      });
      await updateDoc(studentRef, { customFees: updatedFees });
      setStudents(prev => prev.map(s => s.id === studentId ? {...s, customFees: updatedFees} : s));
  };


  const deleteStudent = async (studentId: string) => {
    if (!db) throw new Error("Database not available.");
    const studentDocRef = doc(db, 'students', studentId);
    const studentToDelete = students.find(s => s.id === studentId);
    if (studentToDelete?.photoUrl) {
      const fileIdToDelete = getAppwriteFileIdFromUrl(studentToDelete.photoUrl);
      if(fileIdToDelete) {
         try { await appwriteStorage.deleteFile(APPWRITE_STUDENT_PHOTOS_BUCKET_ID, fileIdToDelete); }
         catch(e) { console.warn("Could not delete student photo from Appwrite, it might have been already deleted.", e)}
      }
    }
    await deleteDoc(studentDocRef);
    setStudents(prev => prev.filter(s => s.id !== studentId));
  };

  const clearAllPaymentHistories = async () => {
    if (!db) throw new Error("Database not available.");
    const batch = writeBatch(db);
    students.forEach(student => {
        const studentRef = doc(db, 'students', student.id);
        batch.update(studentRef, {
            paymentHistory: [],
            customFees: (student.customFees || []).map(fee => ({...fee, status: 'due', datePaid: null})),
            status: 'enrollment_pending'
        });
    });
    await batch.commit();
    const studentSnapshot = await getDocs(collection(db, 'students'));
    const existingStudents = studentSnapshot.docs.map(doc => mapDocToStudent({ ...doc.data(), id: doc.id }));
    setStudents(existingStudents);
  };
  
  const isLoading = isAppContextLoading || isAuthLoading;

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
        revertPayment,
        deleteStudent,
        addCustomFee,
        updateCustomFeeStatus,
        clearAllPaymentHistories,
        isLoading,
        isAuthenticated,
        login,
        logout,
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
