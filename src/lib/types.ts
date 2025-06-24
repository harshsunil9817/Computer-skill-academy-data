
export interface PaymentPlan {
  name: string; // e.g., "One-Time Payment", "Two Installments"
  totalAmount: number;
  installments: number[]; // e.g., [2000] or [1100, 1100]
}

export interface ExamFee {
  name: string; // e.g., "M1 Exam", "Practical Exam"
  amount: number;
}

export interface Course {
  id: string;
  name: string;
  enrollmentFee: number;
  paymentType: 'monthly' | 'installment';
  monthlyFee: number; // For 'monthly' type
  paymentPlans: PaymentPlan[]; // For 'installment' type
  examFees: ExamFee[];
}

export type StudentStatus = 'active' | 'left' | 'completed_paid' | 'completed_unpaid' | 'enrollment_pending';

export interface PaymentRecord {
  id: string;
  date: string; // ISO string
  amount: number;
  type: 'enrollment' | 'monthly' | 'installment' | 'exam' | 'custom' | 'partial';
  remarks?: string;
  // For linking payments to specific fees
  referenceId?: string; // Could be installment index, exam fee name, or custom fee id
  description?: string; // e.g. "Installment 1 of 2" or "M1 Exam Fee"
}

export interface CustomFee {
    id: string;
    name: string;
    amount: number;
    status: 'paid' | 'due';
    dateCreated: string; // ISO String
    datePaid?: string; // ISO String
}

export interface Student {
  id: string;
  enrollmentNumber: string;
  name:string;
  fatherName: string;
  dob: {
    day: string;
    month: string;
    year: string;
  };
  mobile: string;
  aadhar: string;
  enrollmentDate: string; // ISO string
  courseId: string;
  courseDurationValue: number;
  courseDurationUnit: 'months' | 'years';
  status: StudentStatus;
  paymentHistory: PaymentRecord[];
  photoUrl?: string;
  selectedPaymentPlanName?: string;
  customFees: CustomFee[];
  overriddenEnrollmentFee?: number;
  overriddenMonthlyFee?: number;
  attendancePercentage?: number;
  grades?: string;
}

// For form handling
export interface CourseFormData {
  name: string;
  enrollmentFee: number;
  paymentType: 'monthly' | 'installment';
  monthlyFee: number;
  examFees: ExamFee[];
  paymentPlans: PaymentPlan[];
}

export interface StudentFormData {
  name: string;
  fatherName: string;
  dob: { day: string; month: string; year: string };
  mobile: string;
  aadhar: string;
  enrollmentDate: { day: string; month: string; year: string; };
  courseId: string;
  courseDurationValue: number;
  courseDurationUnit: 'months' | 'years';
  photoUrl?: string;
  photoFile?: File | null;
  photoDataUri?: string | null;
  selectedPaymentPlanName?: string;
  overriddenEnrollmentFee?: number;
  overriddenMonthlyFee?: number;
}
