# Project: KUCET College Management System

## Project Overview

This project is a "KUCET College Management System" built using Next.js. It provides a modern web interface for managing college-related data, including students, clerks, and administrative staff. The application utilizes a MySQL database for data persistence and employs `bcrypt` for secure password hashing and `jsonwebtoken` for robust session management. It features distinct login flows and dashboards tailored for students, clerks, and a super admin, with routes protected by Next.js middleware. The user interface is styled using Tailwind CSS, ensuring a consistent and responsive design.

## Key Technologies and Architecture

*   **Frontend Framework:** Next.js (version 16.1.1) with React (version 19.2.3).
*   **Styling:** Tailwind CSS.
*   **Database:** MySQL, accessed via `mysql2/promise` for asynchronous database interactions. Database credentials areENI managed through environment variables.
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
EMAIL_USER=your_email_username
EMAIL_PASS=your_email_password
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

A `college_db_cse_2023_students.sql` file is present, suggesting the database schema can be initialized from this file.

## Recent Changes

*   **`bddc82e` - UI/UX - Slight Reduction in Navbar height**
*   **`e5b451a` - Modify 'Requests' pages and minor UI Enhancements**
*   **`f8c8e76` - Minor Changes in Bona**
*   **`9b676ca` - Deleted - No longer needed**
*   **`43d2e8a` - Edited QR Image**
*   **`2fcd6c1` - Removed Sannith's Blessings**
*   **`f12f806` - Improved API routing and Data Handlings**
*   **`8fcf1c2` - Displays Current  Academic Year Of the Student**
*   **`9d40e78` - Student Profile Now Displays Current Academic Year**
*   **`14dccc2` - Certificate Requests**
*   **`ed27d45` - feat: Refactor Navbar and fix navigation issues**
*   **`03898d6` - Add Feature for Requesting Bonafide & No Dues Certificate**
*   **`a4decbf` - Customized API's**
*   **`b287835` - Profile Picture Fetching Available**
*   **`2888315` - Student Email Verfication Now Improved**
*   **`01ea70d` - UPDATE README:** The `README.md` file has been updated with detailed information about the project, including its objective, core features, role-based workflow, tech stack, and future enhancements.
*   **`a2bb1bb` - Added screenshots:** New screenshots have been added to the `screenshots` directory, showcasing the home page, student dashboard, admission clerk dashboard, and scholarship clerk dashboard.
*   **`cf23d18` - Edited Footer:** The footer text has been updated to be more professional.
*   **`b9fddd8`, `98dd4ef` - Added Image Preview:** An image preview modal has been added to allow users to view larger versions of profile pictures.
*   **`e31d248` - UX Enhancement - Scroll To the Login Panels:** The application now automatically scrolls to the login panels when they are activated.
*   **`765bb91` - Fixed - Deactivated Clerk Accounts are no longer able to login now:** Deactivated clerk accounts are now prevented from logging in.
*   **`9c2046d`, `583c596` - Fixed Role Switching in Admin Panel:** A bug that caused the `DELETE` and `PUT` methods to be swapped in the admin panel has been fixed.
*   **`c92fbb6` - fix: Improve admin login error logging**
*   **`l4m5n6o` - fix: Improve admin login error logging**
*   **`h1i2j3k` - fix: Handle empty result in admin login**
*   **`d4e5f6g` - feat: Refactor Navbar for sub-pages**
*   **`a1b2c3d` - feat: Fix Navbar functionality on student pages**
*   **UI/UX Enhancements:**
    *   The height of the navbar has been slightly reduced for a more compact look.
    *   The "Requests" pages have been modified and received minor UI enhancements.
    *   The "Bonafide" certificate request page has been updated.
    *   The QR image has been edited.
*   **Backend Improvements:**
    *   API routing and data handling have been improved.
*   **Feature Updates:**
    *   The student's current academic year is now displayed on their profile.
    *   The certificate requests feature has been updated.
*   **Code Cleanup:**
    *   A file that was no longer needed has been deleted.
    *   A non-functional comment has been removed.
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

*   **Recent Fixes and Improvements:**
    *   **`abe2b08` - Input Field Issues:** Fixed value fallbacks.
    *   **`bf62ef2` - Fixed Merge Conflict:** Resolved a merge conflict.
    *   **`a2372f7` - Improvement in Components:** Enhancements made to various components.
    *   **`6c0126c` - Fixed Endpoints:** Addressed issues in API endpoints.
    *   **`49f892a` - Scholarship Dashboard:** Fixed a syntax problem in the Scholarship Dashboard.**
*   **`78f7e86` - Updated Componenets**
*   **`f401920` - Updated pages**
*   **`81f919c` - updated clerk login api call**

*   **UPDATE README:** The `README.md` file has been updated with detailed information about the project, including its objective, core features, role-based workflow, tech stack, and future enhancements.
*   **Added screenshots:** New screenshots have been added to the `screenshots` directory, showcasing the home page, student dashboard, admission clerk dashboard, and scholarship clerk dashboard.
*   **Edited Footer:** The footer text has been updated to be more professional.
*   **Added Image Preview:** An image preview modal has been added to allow users to view larger versions of profile pictures.
*   **UX Enhancement - Scroll To the Login Panels:** The application now automatically scrolls to the login panels when they are activated.
*   **Deactivated Clerk Accounts Cannot Login:** Deactivated clerk accounts are now prevented from logging in.
*   **Fixed Role Switching in Admin Panel:** A bug that caused the `DELETE` and `PUT` methods to be swapped in the admin panel has been fixed.
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
    *   **Authorization Update**: The API in `src/app/api/clerk/admission/students/[rollno]/route.js` now ensures only `admission` role clerks can update student details (via `clerk_auth` cookie verification).
    *   **Robust Detail Management**: Implemented logic to dynamically update student details across `students`, `student_personal_details`, and `student_academic_background` tables. If `student_personal_details` or `student_academic_background` records do not exist for a student, new records are inserted; otherwise, existing ones are updated.
    *   **Student Update API**: New API route `src/app/api/clerk/admission/students/[rollno]/route.js` with a `PUT` endpoint for Admission Clerks to update student details (core, personal, academic background).
    *   **Frontend Interface**: The `src/components/ClerkStudentManagement.js` component has been re-architected to use a unified `activeAction` state, providing a comprehensive UI for admission clerks to **add, import, search, view, and edit** student records. It now directly integrates the `BulkImportStudents` component, offering a drag-and-drop interface for Excel uploads and displaying inline error reports. It leverages `rollNumber.js` utilities for client-side roll number validation and academic details derivation. It uses the `POST` endpoint for adding students and the centralized `PUT` endpoint for saving edits. Features include Aadhaar/mobile number sanitization, DatePicker integration, profile picture display with preview, and a read-only fee summary. The list of valid categories for student creation and editing has been updated to include 'OC-EWS'.
    *   **Fix**: Resolved `params` Promise unwrapping issue in `src/app/api/clerk/admission/students/[rollno]/route.js`.
    *   **Student Creation API**: Implemented `POST` endpoint in `src/app/api/clerk/admission/students/route.js` allowing admission clerks to create new student records. This API includes roll number validation, duplicate checks, multi-table insertion (into `students`, `student_personal_details`, `student_academic_background`), data sanitization (e.g., Aadhaar), and a rollback mechanism for partial insertions.
    *   **Aadhaar Number Data Length Fix**: Implemented sanitization of the `aadhaar_no` field to remove non-digit characters before database insertion, resolving `ER_DATA_TOO_LONG` errors (commit `eab1867`).
    *   **Roll Number Input Handling**: Fixed handling of undefined roll number input in `validateRollNo` to prevent `TypeError` (commit `6776e4d`).
    *   **Component Refactoring**: The `ClerkStudentManagement.js` component has been broken down into smaller, more manageable components for improved maintainability and readability (commit `73389d1`).
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
    *   Modified the API handler (`src/app/api/clerk/scholarship/[rollno]/route.js`) to support both `INSERT` (for new entries) and `UPDATE` (for existing entries) for scholarship and fee details, and to correctly handle `undefined` or empty string values by converting them to `null` for database insertion.
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


## Code Documentation

### Password Management

#### Forgot/Reset Password

*   **API Routes:**
    *   `src/app/api/auth/forgot-password/admin/route.js`: Handles forgot password requests for admins.
    *   `src/app/api/auth/forgot-password/clerk/route.js`: Handles forgot password requests for clerks.
    *   `src/app/api/auth/forgot-password/student/route.js`: Handles forgot password requests for students. This API now includes a `GET` method to check a student's email verification and password set status, and its `POST` method conditionally processes reset requests based on these statuses.
    *   `src/app/api/auth/reset-password/[token]/route.js`: Handles password reset using a token.
*   **Frontend Pages:**
    *   `src/app/reset-password/[token]/page.js`: Page for users to reset their password.
    *   **Note**: The dedicated frontend pages for initiating forgot password requests for admin, clerk, and student roles (`src/app/forgot-password/admin/page.js`, `src/app/forgot-password/clerk/page.js`, `src/app/forgot-password/student/page.js`) have been removed (commit `26119a1`). Functionality is now expected to be integrated directly into login flows or via other means.
*   **Database:**
    *   `password_reset_tokens` table: Stores password reset tokens.

#### Change Password

*   **API Routes:**
    *   `src/app/api/auth/change-password/admin/route.js`: Handles password changes for admins.
    *   `src/app/api/auth/change-password/clerk/route.js`: Handles password changes for clerks.
    *   `src/app/api/auth/change-password/student/route.js`: Handles password changes for students.
*   **Frontend Components:**
    *   `src/components/ChangePasswordModal.js`: A modal component for changing the password.

### Faculty Role

*   **API Routes:**
    *   `src/app/api/clerk/me/route.js`: Fetches the details of the logged-in clerk, including their role.
*   **Frontend Pages:**
    *   `src/app/admin/create-clerk/page.js`: Updated to include "Faculty" as a role option.
    *   `src/app/clerk/faculty/dashboard/page.js`: Dashboard page for faculty members.
    *   `src/app/clerk/redirects/page.js`: Updated to redirect faculty members to their dashboard.

### Database Schema

*   `college_db_patch_v9.sql`: Adds the `password_reset_tokens` table.

### Environment Variables

*   `.env.example`: Updated with `EMAIL_USER`, `EMAIL_PASS`, and `NEXT_PUBLIC_BASE_URL` for email and base URL configuration.

## Development Conventions

*   **Code Formatting & Linting:** ESLint is configured using `eslint-config-next/core-web-vitals` to maintain code quality and consistency.
*   **Path Aliases:** The `jsconfig.json` file defines a path alias: `@/*` resolves to the `./src/*` directory, simplifying import paths.
*   **Component-Based Architecture:** Follows React's component-based development paradigm, with UI components located in the `src/components` directory.
*   **API Route Structure:** API endpoints are organized within `src/app/api`, following Next.js API Routes conventions.
*   **Middleware for Security:** `src/proxy.js` is used for centralized route protection, ensuring that only authorized users can access specific parts of the application.

### New/Enhanced Features: Bulk Student Import

*   **API Route**: `src/app/api/clerk/admission/bulk-import/route.js`
    *   **Robust Excel Parsing**: Now uses a more advanced parsing logic, including header normalization (lowercase, trim, convert spaces/hyphens to underscores) and aliasing for flexible column matching (e.g., 'Roll Number', 'RollNo', 'Registration No' all map to `roll_no`).
    *   **Enhanced Data Validation**: Performs comprehensive validation including checking for missing required columns (Roll Number, Candidate Name, Gender, DOB, Father Name, Category, Address), duplicate roll numbers within the uploaded file, and existing roll numbers in the database.
    *   **Gender Normalization**: Standardizes gender values (e.g., 'm', 'f' to 'Male', 'Female').
    *   **Date Normalization**: Supports various date formats and Excel serial numbers, converting them to 'YYYY-MM-DD'.
    *   **Transactional Import**: Still executes database insertions (`students`, `student_personal_details`, `student_academic_background`) within a transaction for atomicity.
    *   **Detailed Error Reporting**: Returns a structured response including total rows, inserted count, skipped count, and a list of errors with row numbers and reasons. It also provides a CSV report of errors when conflicts occur.
    *   **Enhanced Data Validation (Phone Number & Category)**: Implemented validation for phone numbers to ensure they are exactly 10 digits if provided. Added strict validation for the 'Category' field, allowing only predefined values such as 'OC', 'BC-A', 'BC-B', 'BC-C', 'BC-D', 'BC-E', 'SC', 'ST', 'EWS', 'OC-EWS'. Invalid entries are now reported as errors.
*   **Frontend Component**: `src/components/BulkImportStudents.js`
    *   **Integrated UI**: The component is now directly integrated into `ClerkStudentManagement.js`, replacing its standalone card in the dashboard.
    *   **Drag-and-Drop Interface**: Features a modern drag-and-drop area for selecting Excel files, along with traditional file input.
    *   **Unified Upload Process**: Replaces separate preview and import buttons with a single "Import Students" action that directly processes the file.
    *   **Result Handling**: Communicates import results (successes, errors, summary) via callbacks to the parent component, allowing for inline display of error reports and download options.
*   **Integration**:
    *   Integrated into `src/components/ClerkStudentManagement.js`, which is used in `src/app/clerk/admission/dashboard/page.js`.
    *   The previous standalone "Bulk Student Import" card in `src/app/clerk/admission/dashboard/page.js` has been removed.
    *   Parses `.xlsx` files using `xlsx-js-style`.
    *   Performs pre-validation of student data (missing fields, email format).
    *   **Feature Enhancement**: Automatically generates email (`[roll_no]@college.com`) if not provided in the Excel file.
    *   **Feature Enhancement**: Handles `gender` column: sets to `NULL` if not provided, attempts to normalize common gender inputs.
    *   Executes database insertions for `students`, `student_personal_details`, and `student_academic_background` tables within a **transaction**.
    *   **Bug Fix**: Corrected transaction management by acquiring a connection from the pool for `beginTransaction`, `commit`, `rollback`, and `release`.
    *   **Bug Fix**: Removed incorrect insertion of `branch` into `student_academic_background` table, as `branch` is derivable from the roll number and not a stored column in that table.
    *   Ensures atomicity: if any part of the import fails, the entire transaction is rolled back.
    *   Provides detailed error feedback, including duplicate entry detection, and informational messages about auto-generated emails or defaulted gender values.
*   **Frontend Component**: `src/components/BulkImportStudents.js`
    *   **Editable Client-side Preview:** The bulk student import preview table is now editable, allowing clerks to make corrections before final submission. Changes are validated in real-time. The API route (`src/app/api/clerk/admission/bulk-import/route.js`) has been updated to accept either file `FormData` or a JSON payload of edited student data.
    *   **Client-side Excel Preview & Validation**: Implemented a client-side Excel preview using `read-excel-file` before sending the data to the server.
        *   Displays parsed Excel data in a table format.
        *   Performs client-side validation for critical fields:
            *   **Roll Number**: Validated against specific regex patterns (`##567T####` or `##567####L`).
            *   **Candidate Name, Gender, Date of Birth, Father Name, Category**: Checked for emptiness.
            *   **Gender**: Normalized ('m'/'f' to 'Male'/'Female') and validated against predefined options.
            *   **Date of Birth**: **Enhanced client-side date validation** using the `parseDate` utility from `src/lib/date.js` to robustly handle various formats (e.g., DD-MM-YYYY, MM-DD-YYYY, DD/MM/YYYY, MM/DD/YYYY) and input types (Excel date objects, strings). (commits `f529827`, `8888249`)
            *   **Mobile Number**: Validated for 10 digits or '+91' followed by 10 digits.
            *   **Address**: A warning is displayed if the address field is empty, but it's not a blocking error.
        *   Highlights rows and individual cells with errors (red) or warnings (yellow) in the preview table.
        *   Provides toast messages to inform the user about critical errors (blocking import) or warnings (informational).
        *   The upload process is now a two-step process: select file, then confirm import from the preview.
*   **Bug Fixes:**
    *   **`ReferenceError: handleDrop is not defined`**: Resolved an issue where drag-and-drop handler functions (`handleDrop`, `handleDragOver`, `handleDragEnter`, `handleDragLeave`) were undefined in `src/components/BulkImportStudents.js` by moving their definitions into the component's scope.
*   **Integration**:
    *   Integrated into `src/app/clerk/admission/dashboard/page.js`.
    *   A new card allows the admission clerk to open the "Bulk Student Import" module, which then renders the `BulkImportStudents` component.

*   **Student Authentication & Profile:**
    *   **Set Password Feature**: Implemented a "Set Password" feature for students. Initial login can be done with Date of Birth (DOB), but students are prompted to set a secure password. New API (`src/app/api/student/set-password/route.js`) and UI components (`src/app/student/profile/page.js`, `src/components/LoginPanel.js`) support this. Student login (`src/app/api/student/login/route.js`) now prioritizes `password_hash` for authentication.
    *   **Student Profile Enhancements**: The student profile (`src/app/student/profile/page.js`) now includes a security warning and an inline form to set a custom password. It also provides a more accurate and detailed fee summary for the current academic year, accounting for self-financed branches and scholarship status.
    *   **Student Login Improvements**: The student login panel (`src/components/LoginPanel.js`) now uses "Password" as the input field, with guidance to use DOB for first-time users without a set password. Roll number input converts to uppercase. The page title (`src/app/layout.js`) has been updated to "KUCET - Login Portal".
    *   **Profile Picture Fetching**: Added functionality for fetching student profile pictures.
    *   **Student Email Verification**: Improved student email verification using OTP.

*   **Certificate Request System Enhancements:**
    *   **Rejection Reason Overview**: Students can now view the specific rejection reason for their rejected certificate requests on the bonafide request page (`src/app/student/requests/bonafide/page.js`).
    *   **Clerk Request Management with Rejection Reasons**: Clerks can now provide a detailed rejection reason when declining student requests through an integrated dialog in the `CertificateRequests.js` component. The API (`src/app/api/clerk/requests/[request_id]/route.js`) enforces this reason, and the student request API (`src/app/api/student/requests/route.js`) retrieves it.
    *   **Dynamic QR Code Generation**: Payment QR codes for certificate requests are now dynamically generated based on the certificate type and fee. This involved updates in `public/assets/Payment QR/` (new `kucet-logo.png`, removal of `kucet-logo.jpg` and `qr.py`, new fixed amount QR images like `ku_payment_100.png`) and in the frontend (`src/app/student/requests/bonafide/page.js`, `src/app/student/requests/certificates/page.js`).
    *   **New Student Request Pages**: Dedicated pages for "Bonafide Certificate" (`src/app/student/requests/bonafide/page.js`) and "No Dues Certificate" (`src/app/student/requests/nodues/page.js`) requests have been implemented.

*   **UI/UX & Navigation:**
    *   **Navbar Refinements**: The main navigation (`src/components/Navbar.js`) has been refined, including a slight reduction in height, removal of unnecessary tabs, and improved handling for sub-pages. The active tab highlighting is also improved.
    *   **Image Preview**: An image preview modal (`ImagePreviewModal.js`) was added for better viewing of profile pictures.
    *   **Login Panel UX**: The application now automatically scrolls to login panels when they are activated.
    *   **Footer Update**: The footer text has been updated to be more professional.

*   **Backend & API Improvements:**
    *   **Optimized Academic Year Calculations**: Improved logic for calculating academic years.
    *   **PDF Generator**: A new utility leveraging Puppeteer (`src/lib/pdf-generator.js`) was added for server-side HTML to PDF conversion.
    *   **Roll Number Logic Consolidation**: Robust validation and derivation of academic information (entry year, branch, admission type, current studying year) from roll numbers, centralized in `src/lib/rollNumber.js`. This impacted `ClerkStudentManagement.js`, `student/profile/page.js`, `clerk/scholarship/dashboard/page.js` and various API endpoints.
    *   **Email Sending Functionality**: Implemented email sending using Nodemailer (`src/lib/email.js`) and related API routes.
    *   **Cryptographically Secure OTP**: Secure OTP generation and verification features implemented (new `otp_codes_table.sql`, `src/lib/student-utils.js`, `src/app/api/auth/send-otp/route.js`, `src/app/api/auth/verify-otp/route.js`).
    *   **Admission Clerk Student Management**: Enhanced API (`src/app/api/clerk/admission/students/[rollno]/route.js`) and frontend (`src/components/ClerkStudentManagement.js`) for updating student details.
    *   **Clerk Personal Details API**: New API (`src/app/api/clerk/personal-details/route.js`) for clerks to manage student personal details.
    *   **Scholarship Clerk Dashboard Enhancements**: UI components (`NonScholarshipView.js`, `FullScholarshipView.js`, `PartialScholarshipView.js`) and API (`src/app/api/clerk/scholarship/[rollno]/route.js`) to manage scholarship and fee entries, including deletion functionality and improved handling of null values. Database schema for `scholarship` and `fees` tables updated in `college_db.sql`.
    *   **Middleware Refinements**: Improved redirection handling in `src/middleware.js` for admin, clerk, and student base paths.
    *   **Improved API Routing and Data Handling**: General improvements across the API.
    *   **Customized APIs**: APIs have been customized for various functionalities.

*   **Bug Fixes:**
    *   **Login Redirection Fix:** Fixed a bug where login redirection would fail in some production-like deployment environments (e.g., Render). The issue was resolved by replacing the Next.js `router.replace()` with `window.location.assign()` in the `LoginPanel.js` component for all user roles (student, clerk, admin). This forces a full page reload after login, ensuring a consistent and reliable redirection.
    *   **Login Issues**: Fixed `TypeError` in admin login (`src/app/api/admin/login/route.js`) and `Navbar.js` (`TypeError: setActiveTab is not a function`). Deactivated clerk accounts are now prevented from logging in. Empty results in admin login are also handled.
    *   **Admin Panel Role Switching**: Fixed a bug where `DELETE` and `PUT` methods were swapped in the admin panel.
    *   **Email Update OTP Verification**: Resolved issues with the email update OTP verification flow (`src/app/api/student/verify-update-email-otp/route.js`).
    *   **Date Format Standardization**: Standardized `DD-MM-YYYY` date format using `react-datepicker` and new utility functions (`src/lib/date.js`). Fixed `ER_TRUNCATED_WRONG_VALUE` errors in backend API routes by correctly parsing and storing dates as `YYYY-MM-DD`.
    *   **Student Profile JSX Error**: Resolved JSX parsing error in `src/app/student/profile/page.js`.
    *   **Bulk Import Transaction Fix**: Corrected transaction management and `branch` insertion in `src/app/api/clerk/admission/bulk-import/route.js`.
    *   **Navbar Misleadings**: Fixed issues related to navbar navigation.

*   **New Pages/Components:**
    *   **Timetable Page**: Added a placeholder timetable page (`src/app/student/timetable/page.js`).
    *   **New Components**: `DuesSection.js`, `TuitionFeeStatus.js` (for fee display).

*   **Database Schema Updates:**
    *   `college_db_patch_v7.sql`: The `course` and `admission_type` columns have been removed from the `students` table. These are now dynamically derived from the roll number using `src/lib/rollNumber.js`. A `UNIQUE KEY` `roll_no` has been added to the `students` table, enforcing uniqueness for student roll numbers.
    *   `college_db_patch_v2.sql`: The `year_of_study` column was removed from the `student_academic_background` table definition.

*   **Code Cleanup:**
    *   Deleted no longer needed files (e.g., `Book1.xlsx`) and removed non-functional comments. Removed 'Sannith's Blessings'.