export const APP_NAME = "AcademyEdge";

export const DOB_DAYS = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
export const DOB_MONTHS = [
  { value: "01", label: "January" }, { value: "02", label: "February" },
  { value: "03", label: "March" }, { value: "04", label: "April" },
  { value: "05", label: "May" }, { value: "06", label: "June" },
  { value: "07", label: "July" }, { value: "08", label: "August" },
  { value: "09", label: "September" }, { value: "10", label: "October" },
  { value: "11", label: "November" }, { value: "12", label: "December" },
];
export const DOB_YEARS = Array.from({ length: 100 }, (_, i) => (new Date().getFullYear() - 18 - i).toString()); // For adults, adjust as needed for younger students

export const MOBILE_REGEX = /^\d{10}$/;
export const AADHAR_REGEX = /^\d{12}$/;

export const COURSE_DURATION_UNITS = [
  { value: "months", label: "Months" },
  { value: "years", label: "Years" },
];
