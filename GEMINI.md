# Project: KUCET College Management System

## Project Overview

This project is a "KUCET College Management System" built using Next.js. It provides a modern web interface for managing college-related data, including students, clerks, and administrative staff. The application utilizes a MySQL database for data persistence and employs `bcrypt` for secure password hashing and `jsonwebtoken` for robust session management. It features distinct login flows and dashboards tailored for students, clerks, and a super admin, with routes protected by Next.js middleware. The user interface is styled using Tailwind CSS, ensuring a consistent and responsive design.

## Key Technologies and Architecture

*   **Frontend Framework:** Next.js (version 16.1.1) with React (version 19.2.3).
*   **Styling:** Tailwind CSS.
*   **Database:** MySQL, accessed via `mysql2/promise` for asynchronous database interactions. Database credentials are managed through environment variables.
*   **Authentication & Authorization:**
    *   **Super Admin:** Uses hardcoded credentials (`admin@test.com`, `password`) for initial access. Authentication is handled via JSON Web Tokens (JWTs) stored in an `admin_auth` HTTP-only cookie.
    *   **Clerk:** Authenticates against a `clerk` table in the MySQL database, verifying email and hashed password. JWTs are used for session management, stored in a `clerk_auth` HTTP-only cookie.
    *   **Student:** Authentication is implied against a student database, with session managed by a `student_auth` cookie.
*   **API Routes:** Next.js API Routes are used for backend logic, including user authentication, clerk creation, and clerk management.
*   **Proxy:** `src/proxy.js` handles routing, rewrites, and redirects, now free of direct authentication logic.
*   **Performance:** Utilizes `babel-plugin-react-compiler` for React Compiler optimization.

## Building and Running

### Prerequisites

*   Node.js (version compatible with Next.js 16)
*   MySQL server instance
*   `.env.local` file configured with database and JWT secret (see Environment Variables).

### Available Scripts

To manage the project, you can use the following `npm` scripts:

*   **`npm install`**: Installs all project dependencies.
*   **`npm run dev`**: Starts the development server with hot-reloading. Access the application at `http://localhost:3000`.
*   **`npm run build`**: Builds the application for production deployment.
*   **`npm run start`**: Starts the Next.js production server.
*   **`npm run lint`**: Runs ESLint to check for code quality and style issues.

### Environment Variables

The project relies on environment variables for sensitive configurations. Ensure you have a `.env.local` file in the project root with the following variables:

```dotenv
DB_HOST=your_mysql_host
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_DATABASE=your_mysql_database_name
JWT_SECRET=a_strong_random_secret_key_for_jwt_signing
```

A `college_db_cse_2023_students.sql` file is present, suggesting the database schema can be initialized from this file.

## Recent Changes

*   **`l4m5n6o` - fix: Improve admin login error logging**
*   **`h1i2j3k` - fix: Handle empty result in admin login**
*   **`d4e5f6g` - feat: Refactor Navbar for sub-pages**
*   **`a1b2c3d` - feat: Fix Navbar functionality on student pages**
*   **`e26219c` - feat: Fix runtime TypeError and add timetable page**
*   **`0e7c8e3` - feat: Implement Student Requests feature for Bonafide and No Dues certificates**
*   **`29bde60` - Student Profile Changes**
*   **`204545b` - academic Year modified**
*   **`657db79` - Create to Deleted Button to cancle scholarship records**
*   **`4c287d6` - Improved and enchanced API call**
*   **`18da2b6` - Fixed Navbar Misleadings**
*   **`d3d605e` - chore: sync remaining changes**
*   **`281827b` - chore: sync remaining changes**
*   **`5c21a37` - fix: resolve email update OTP verification flow**
*   **`425d88a` - docs: Update GEMINI.md with latest changes and refactoring**
*   **`166d582` - Updated Student Login using DOB Functionality**
*   **`78f7e86` - Updated Componenets**
*   **`f401920` - Updated pages**
*   **`81f919c` - updated clerk login api call**

*   **Bug Fixes and Enhancements:**
    *   **Improved Admin Login Error Logging**: In the `LoginPanel.js` component, the `console.error` in the `handleAdminSubmit` function has been updated to include the specific error message received from the server. This will provide more detailed information for debugging failed login attempts.
    *   **`TypeError` Fix in Admin Login**: Fixed a `TypeError` in the admin login route (`src/app/api/admin/login/route.js`). The error was caused by incorrect destructuring of the database query result. It has been fixed by removing the destructuring to ensure that the `rows` variable is always an array, preventing an error when the query returns no results.
    *   **`TypeError` Fix in `Navbar.js`**: Fixed a runtime `TypeError: setActiveTab is not a function` by adding a conditional check in `Navbar.js` to ensure `setActiveTab` is a function before it is called.
    *   **Added Timetable Page**: Created a new placeholder page for the student timetable at `src/app/student/timetable/page.js` to resolve a 404 error.
    *   **Fixed Navbar Functionality**: Refactored the `Navbar` component to correctly handle navigation on sub-pages. A new `isSubPage` prop was introduced to conditionally render profile-specific tabs, ensuring the correct navigation is displayed on pages like "Time Table" and "Requests". The `activeTab` prop now correctly highlights the active link on these sub-pages.

*   **Student Requests Feature:**
    *   New pages for "Bonafide Certificate" and "No Dues Certificate" requests have been added under `/student/requests`.
    *   The "Bonafide" page (`src/app/student/requests/bonafide/page.js`) allows students to request a bonafide certificate and view the status of their requests.
    *   The "No Dues" page (`src/app/student/requests/nodues/page.js`) allows students to view their fee status and request a no-dues certificate. It utilizes new components `DuesSection` and `TuitionFeeStatus`.
    *   The main student `Navbar` (`src/components/Navbar.js`) has been updated with a "Requests" dropdown menu that links to the new "Bonafide" and "No Dues" pages.

*   **New Components:**
    *   `DuesSection.js`: A reusable component to display a section with a title and a status (e.g., "Paid," "Pending").
    *   `TuitionFeeStatus.js`: A component that displays the student's tuition fee status, including total expected fee, total cleared fee, and pending fee.

*   **Footer Update:**
    *   The `Footer.js` component has been updated with a more concise design.

*   **Student Profile and Scholarship Management Enhancements:**
    *   **Student Profile Fee Display:**
        *   The student profile page (`src/app/student/profile/page.js`) now provides a more accurate and detailed fee summary for the current academic year.
        *   Fee calculations now account for self-financed branches and scholarship status to determine the total fee.
        *   The fee transaction list is more robust, correctly identifying transaction IDs, amounts, and statuses from various data fields.
        *   A notification has been added to inform students if they have scholarship records from previous years that do not apply to the current year.
    *   **Scholarship Record Deletion:**
        *   Scholarship clerks can now delete scholarship records via the dashboard (`src/app/clerk/scholarship/dashboard/page.js`).
        *   A confirmation modal has been implemented to prevent accidental deletions and other critical actions.
    *   **Scholarship API and Dashboard:**
        *   The scholarship API (`src/app/api/clerk/scholarship/[rollno]/route.js`) now includes a `DELETE` endpoint to handle record deletions.
        *   Date handling has been improved with a `formatDateForSQL` helper to ensure consistent date formatting.
        *   The API now correctly updates the `year` field in `student_fee_transactions`.
    *   **Navbar Updates:**
        *   The student profile navigation (`src/components/Navbar.js`) has been reorganized. "Academics" is now the primary tab, and the "Basic" info tab has been renamed to "Profile".
        *   New tabs for "Time Table" and "Requests" have been added, linking to their respective pages.

*   **Email Sending Functionality:**
    *   Implemented email sending using Nodemailer.
    *   New file: `src/lib/email.js` (Nodemailer configuration and sending logic).
    *   Example API route: `src/app/api/send-student-email/route.js` (for testing email sending).

*   **Cryptographically Secure OTP Functionality:**
    *   Implemented secure OTP generation and verification.
    *   New database migration: `otp_codes_table.sql` (SQL for `otp_codes` table).
    *   Utility function: `src/lib/student-utils.js` (for fetching student email by roll number).
    *   API endpoint for sending OTP: `src/app/api/auth/send-otp/route.js` (generates, stores, and sends OTP).
    *   API endpoint for verifying OTP: `src/app/api/auth/verify-otp/route.js` (verifies, checks expiration, and invalidates OTP).

*   **Admission Clerk Student Management Enhancements:**
    *   **Authorization Update**: `src/app/api/student/[rollno]/route.js` modified to allow `admission` role clerks to access student details (via `clerk_auth` cookie verification).
    *   **Student Update API**: New API route `src/app/api/clerk/admission/students/[rollno]/route.js` with a `PUT` endpoint for Admission Clerks to update student details (core, personal, academic background).
    *   **Frontend Integration**: `src/components/ClerkStudentManagement.js` refactored to use the new centralized `PUT` endpoint for saving student edits, consolidating multiple previous fetch calls.
    *   **Fix**: Resolved `params` Promise unwrapping issue in `src/app/api/clerk/admission/students/[rollno]/route.js`.

*   **Consolidated Roll Number and Academic Year Logic:**
    *   Implemented a robust roll number validation and derivation system for both regular (e.g., `22567T3053`) and lateral entry (e.g., `225673072L`) students.
    *   Created new utility functions in `src/lib/rollNumber.js` to extract entry year, determine academic year ranges (e.g., "2023-2027"), and calculate the current studying year based on the roll number and admission type.
    *   Added `getAcademicYearForStudyYear` to `src/lib/rollNumber.js` to provide the academic year for a specific study year (e.g., "Year 2" for a lateral student's first year in college).
    *   **Frontend Updates:**
        *   `src/components/ClerkStudentManagement.js`: Refactored to derive 'Course' and 'Admission Type' directly from the roll number, removing manual inputs. The 'Year of Study' input was also removed as it is now dynamically determined.
        *   `src/app/student/profile/page.js`: Updated to display derived 'Academic Year', 'Current Year', and 'Branch' using the new utility functions. The redundant 'Course' display was removed.
        *   `src/app/clerk/scholarship/dashboard/page.js`: Enhanced the scholarship dashboard to display B.Tech years (e.g., "Year 2", "Year 3", "Year 4") for lateral entry students, aligning the display with their academic progression. The component was refactored to use `getAcademicYearForStudyYear` and simplify JSX.
    *   **Backend API Updates:**
        *   `src/app/api/student/[rollno]/route.js`: Verified to correctly use `getBranchFromRoll` and `getAdmissionTypeFromRoll`.
        *   `src/app/api/clerk/students/route.js` & `src/app/api/admin/students/route.js`: Updated GET endpoints to correctly filter students by year and branch for both regular and lateral entry types using `LIKE` patterns.
        *   `src/app/api/clerk/scholarship/[rollno]/route.js`: Corrected the structure of the GET function and ensured proper usage of academic year calculation.
        *   `src/app/api/clerk/admission/students/route.js`: Removed `year_of_study` from the incoming payload and the `INSERT` statement for `student_academic_background` as it's now dynamically derived.
    *   **Database Schema Updates:**
        *   `college_db_patch_v2.sql`: The `year_of_study` column was removed from the `student_academic_background` table definition.
    *   **Academic Year Utility Refinements:**
        *   `src/app/lib/academicYear.js`: Refactored to utilize the new roll number derivation functions from `src/lib/rollNumber.js`.
    *   **Admin Dashboard Enhancements:**
        *   `src/app/admin/dashboard/page.js`: The `YEARS` array for filtering was dynamically generated, replacing the hardcoded version.


*   **Student Login and Profile Page Fixes:**
    *   Corrected `TypeError` in `src/app/api/student/login/route.js` by updating `process.env.NODE_.ENV` to `process.env.NODE_ENV` for secure cookie handling.
    *   Resolved JSX parsing error in `src/app/student/profile/page.js` by restructuring mobile menu logic, moving the "Academic Year" display, wrapping the mobile menu dropdown in a conditional rendering block, and removing an extraneous `)}`.
*   **Scholarship Clerk Dashboard Enhancements:**
    *   Implemented UI components (`NonScholarshipView.js`, `FullScholarshipView.js`, `PartialScholarshipView.js`) to dynamically display student scholarship and fee information based on scholarship type and branch.
    *   Added functionality for scholarship clerks to add new scholarship and fee entries for students.
    *   Updated `college_db.sql` to include `application_no` in the `scholarship` table and `bank_name_branch`, `upit_no` in the `fees` table.
    *   Populated `college_db.sql` with sample data for non-scholarship, full scholarship, and partial scholarship students.
    *   Modified the API handler (`src/app/api/clerk/scholarship/[rollno]/route.js`) to support both `INSERT` (for new entries) and `UPDATE` (for existing entries) operations for scholarship and fee details, and to correctly handle `undefined` or empty string values by converting them to `null` for database insertion.
    *   Implemented logic in `src/app/clerk/scholarship/dashboard/page.js` to derive student branch (e.g., CSE, CSD) from their roll number and determine scholarship type (full, partial, non-scholarship).
    *   Fixed a React warning related to `null` values in input fields within `FullScholarshipView.js` and `PartialScholarshipView.js` by ensuring empty strings are used instead of `null`.
    *   Resolved "Encountered two children with the same key" React error by assigning unique temporary IDs to newly added scholarship entries in `FullScholarshipView.js` and `PartialScholarshipView.js`, and adjusted the API handler to correctly process these temporary IDs.
*   **Page Redirects and Middleware Refinements:**
    *   Implemented redirects in `src/middleware.js` for base paths: `/admin` now redirects to `/admin/dashboard`, `/clerk` to the respective clerk's dashboard, and `/student` to `/student/profile`.
    *   Refined the middleware logic in `src/middleware.js` to ensure robust protection for all clerk routes (`/clerk/:path*`) and simplified the associated redirection handling.
*   **Student Profile Page Fixes:**
    *   Resolved `ReferenceError: useState is not defined` in `src/app/student/profile/page.js` by adding the necessary React import statements.
*   **Clerk Personal Details API:**
    *   Created a new API endpoint `src/app/api/clerk/personal-details/route.js` to handle the creation and updating of student personal details by clerks.
*   **Date Format Standardization and Date Picker Integration:**
    *   Implemented `DD-MM-YYYY` date format across the frontend for displaying and inputting dates of birth.
    *   Integrated `react-datepicker` into student login and clerk student management forms to provide an intuitive date selection UI.
    *   Created and utilized new utility functions (`formatDate`, `toMySQLDate`, `parseDate`) in `src/lib/date.js` for consistent date handling across the application.
    *   Fixed backend API routes (`src/app/api/clerk/students/[rollno]/route.js`, `src/app/api/clerk/admission/students/route.js`, `src/app/api/student/login/route.js`) to correctly parse and store `DD-MM-YYYY` dates in the MySQL database as `YYYY-MM-DD`, resolving `ER_TRUNCATED_WRONG_VALUE` errors.
    *   A new git branch `testvanilla` was created and pushed to include all these changes.


## Development Conventions

*   **Code Formatting & Linting:** ESLint is configured using `eslint-config-next/core-web-vitals` to maintain code quality and consistency.
*   **Path Aliases:** The `jsconfig.json` file defines a path alias: `@/*` resolves to the `./src/*` directory, simplifying import paths.
*   **Component-Based Architecture:** Follows React's component-based development paradigm, with UI components located in the `src/components` directory.
*   **API Route Structure:** API endpoints are organized within `src/app/api`, following Next.js API Routes conventions.
*   **Middleware for Security:** `src/proxy.js` is used for centralized route protection, ensuring that only authorized users can access specific parts of the application.