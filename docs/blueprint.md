# **App Name**: AcademyEdge

## Core Features:

- Dashboard Overview: Dashboard providing at-a-glance overview of student counts, fees due, total revenue, and new registrations.
- Course Management: Tab to add courses, including name, enrollment fee, and monthly fee; allows adding unlimited courses.
- Student Enrollment: Dialog form to add new students, capturing name, father's name, date of birth (with dropdowns for day, month, year), mobile number (restricted to 10 digits), Aadhar number (restricted to 12 digits), enrollment date, and course selection via dropdown, as well as duration (number input and month/year dropdown). Automatically populates enrollment and monthly fees based on selected course.
- Student & Fee Tracking: Student List with filtering capabilities; Shows students who have left the academy. Keeps track of enrolled students with fee statuses: enrollment fees, paid fees, due fees, option to apply partial payments, option to move fully paid student records.
- Archived Students: Maintains records for students removed from the system upon successful completion of the course with all dues cleared. An option is also available for students whose course has ended, but who still have outstanding payments.
- Student Summaries: Displays payment and date-wise histories for students. It will generate and provide access to student histories or summaries related to their courses.
- Intervention Suggestion: AI-powered tool to recommend an appropriate length of study and intervention plan. Provides suggested actions the admins should take, based on student profiles.

## Style Guidelines:

- Primary color: A strong, bright blue (#29ABE2) representing reliability and intelligence, aligning with the educational focus.
- Background color: A light, desaturated blue (#E5F5F9), providing a clean, unobtrusive backdrop.
- Accent color: A vibrant purple (#9C27B0), used for calls to action and highlights to draw attention.
- Headline font: 'Space Grotesk' sans-serif; body font: 'Inter' sans-serif.
- Consistent use of flat, minimalist icons, using the primary color to denote interactive elements, and the accent color to denote alerts and status changes.
- Clean and structured layout, providing ample spacing and a clear hierarchy. Dashboard elements should be well-organized and easy to scan. Input fields should be clearly labeled with adequate space for entry. Use NextUI's styling.
- Subtle transitions for UI elements, such as dialog boxes sliding in and out, and feedback animations when clicking buttons. Not distracting, only serving to provide positive feedback to user.