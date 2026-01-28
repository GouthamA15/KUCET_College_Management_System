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