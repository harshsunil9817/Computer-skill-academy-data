
export interface Course {
  id: string;
  name: string;
  enrollmentFee: number;
  monthlyFee: number;
}

export type StudentStatus = 'active' | 'left' | 'completed_paid' | 'completed_unpaid' | 'enrollment_pending';

export interface PaymentRecord {
  id: string;
  date: string; // ISO string
  amount: number;
  type: 'enrollment' | 'monthly' | 'partial';
  monthFor?: string; // e.g., "January 2024" for monthly fee
  remarks?: string;
}

export interface Student {
  id: string;
  name: string;
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
  // For GenAI intervention suggestion - can be optional or fetched/input separately
  attendancePercentage?: number;
  grades?: string; // Could be a more structured object like { subject: grade }
}

// For form handling
export type CourseFormData = Omit<Course, 'id'>;

// StudentFormData now has enrollmentDate as an object for easier form handling with dropdowns
export interface StudentFormData {
  name: string;
  fatherName: string;
  dob: { day: string; month: string; year: string };
  mobile: string;
  aadhar: string;
  enrollmentDate: { day: string; month: string; year: string; }; // Changed from string to object
  courseId: string;
  courseDurationValue: number;
  courseDurationUnit: 'months' | 'years';
}
