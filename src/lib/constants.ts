
export const APP_NAME = "Computer Skill Academy Nagra Ballia Student Portal";

export const DOB_DAYS = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
export const DOB_MONTHS = [
  { value: "01", label: "January" }, { value: "02", label: "February" },
  { value: "03", label: "March" }, { value: "04", label: "April" },
  { value: "05", label: "May" }, { value: "06", label: "June" },
  { value: "07", label: "July" }, { value: "08", label: "August" },
  { value: "09", label: "September" }, { value: "10", label: "October" },
  { value: "11", label: "November" }, { value: "12", label: "December" },
];
// For Date of Birth, typically for students who might be younger
export const DOB_YEARS = Array.from({ length: 100 }, (_, i) => (new Date().getFullYear() - 5 - i).toString()); 

// For Enrollment Date, more recent years
const currentYear = new Date().getFullYear();
export const ENROLLMENT_YEARS = Array.from({ length: 7 }, (_, i) => (currentYear - 5 + i).toString()).reverse(); // Last 5 years, current year, next year

export const MOBILE_REGEX = /^\d{10}$/;
export const AADHAR_REGEX = /^\d{12}$/;

export const COURSE_DURATION_UNITS = [
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
];

