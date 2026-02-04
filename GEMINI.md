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
EMAIL_USER=your_email_username
EMAIL_PASS=your_email_password
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

A `college_db_cse_2023_students.sql` file is present, suggesting the database schema can be initialized from this file.

## Recent Changes

### Student Profile and Dashboard
- **Complete Redesign of Student Profile Page:** The student profile page (`src/app/student/profile/page.js`) has been completely redesigned with a modern and professional UI/UX. It now features a two-column layout:
    - The left column prominently displays the student's profile picture, name, and roll number.
    - The right column shows academic basics like course, branch, year of study, and current academic year.
- **Tabbed Interface:** A new tabbed interface has been introduced for easy access to "Personal" and "Scholarship Details".
- **Enhanced Scholarship View:** The scholarship details tab provides a clear, year-wise breakdown of scholarship information in a tabular format on desktop and a card-based layout on mobile.
- **Improved Warning System:** A clear warning bar is now displayed at the top of the profile page to notify students about missing email, unverified email, or if a password has not been set.

### Authentication and Security
- **Enhanced Password Flow:** The password validation and saving flow has been significantly improved.
- **Email Verification:** The email editing and verification process is now more robust. Students are required to verify their email to access all portal features.
- **API Route Guards:** API routes have been secured with guards to prevent unauthorized access.
- **Mandatory Email Verification:** New constraints have been added that require students to have a verified email to access certain features.
- **New Verification Page:** A dedicated page (`src/app/student/requests/verification-required/page.js`) has been added to guide students through the verification process.
- **Email Uniqueness Enforcement:**
    -   **Database:** A unique constraint has been added to the `email` column in the `students` table (`college_db_patch_v10.sql`).
    -   **Frontend Validation:** Client-side checks (`src/app/api/student/check-email-uniqueness/route.js`, `src/app/student/profile/page.js`) ensure that a student cannot use an email already registered to another student.
    -   **Server-side Validation:** The `src/app/api/student/send-update-email-otp/route.js` API now includes a server-side check for email uniqueness before sending an OTP.

### UI/UX and Navigation
- **Optimized Student Navbar:** The student navbar has been optimized for better user experience.
- **New "Menu" Dropdown:** A new "Menu" dropdown has been added to the navbar, providing access to "Edit Profile", "Security & Privacy", and "Logout".
- **Certificate Request Improvements:** The UI for viewing certificate requests has been improved, including a modal to show the reason for rejection.

## Code Documentation

### Password Management

#### Forgot/Reset Password

*   **API Routes:**
    *   `src/app/api/auth/forgot-password/admin/route.js`: Handles forgot password requests for admins.
    *   `src/app/api/auth/forgot-password/clerk/route.js`: Handles forgot password requests for clerks.
    *   `src/app/api/auth/forgot-password/student/route.js`: Handles forgot password requests for students.
    *   `src/app/api/auth/reset-password/[token]/route.js`: Handles password reset using a token.
*   **Frontend Pages:**
    *   `src/app/forgot-password/admin/page.js`: Page for admins to initiate the forgot password process.
    *   `src/app/forgot-password/clerk/page.js`: Page for clerks to initiate the forgot password process.
    *   `src/app/forgot-password/student/page.js`: Page for students to initiate the forgot password process.
    *   `src/app/reset-password/[token]/page.js`: Page for users to reset their password.
*   **Database:**
    *   `password_reset_tokens` table: Stores password reset tokens.

#### Change Password

*   **API Routes:**
    *   `src/app/api/auth/change-password/admin/route.js`: Handles password changes for admins.
    *   `src/app/api/auth/change-password/clerk/route.js`: Handles password changes for clerks.
    *   `src/app/api/auth/change-password/student/route.js`: Handles password changes for students.
*   **Frontend Components:**
    *   `src/components/ChangePasswordModal.js`: A modal component for changing the password.
    *   `src/components/SetPasswordModal.js`: A modal component for forcing students to set a password after email verification.

### Faculty Role

*   **API Routes:**
    *   `src/app/api/clerk/me/route.js`: Fetches the details of the logged-in clerk, including their role.
*   **Frontend Pages:**
    *   `src/app/admin/create-clerk/page.js`: Updated to include "Faculty" as a role option.
    *   `src/app/clerk/faculty/dashboard/page.js`: Dashboard page for faculty members.
    *   `src/app/clerk/redirects/page.js`: Updated to redirect faculty members to their dashboard.

### Database Schema

*   `college_db_patch_v9.sql`: Adds the `password_reset_tokens` table.
*   `college_db_patch_v10.sql`: Adds a unique constraint to the `email` column in the `students` table to ensure email uniqueness across all students.

### Environment Variables

*   `.env.example`: Updated with `EMAIL_USER`, `EMAIL_PASS`, and `NEXT_PUBLIC_BASE_URL` for email and base URL configuration.

## Development Conventions

*   **Code Formatting & Linting:** ESLint is configured using `eslint-config-next/core-web-vitals` to maintain code quality and consistency.
*   **Path Aliases:** The `jsconfig.json` file defines a path alias: `@/*` resolves to the `./src/*` directory, simplifying import paths.
*   **Component-Based Architecture:** Follows React's component-based development paradigm, with UI components located in the `src/components` directory.
*   **API Route Structure:** API endpoints are organized within `src/app/api`, following Next.js API Routes conventions.
*   **Middleware for Security:** `src/proxy.js` is used for centralized route protection, ensuring that only authorized users can access specific parts of the application.

## Improved Authentication and Password Flow

The authentication and password management flow for students has been significantly improved to address security vulnerabilities and improve the user experience.

*   **Mandatory Password Change:** After a student verifies their email for the first time, they are now required to set a password immediately. This prevents them from continuing to use their Date of Birth as a password.
*   **Conditional "Change Password" Button:** The "Change Password" button in the student's navigation bar is now only visible if they have already set a password. This provides a cleaner user interface and avoids confusion.
*   **Secure "Forgot Password" Flow:** The "Forgot Password" functionality is now only available to students who have a verified email address. This prevents a deadlock scenario where a student with an incorrect or unverified email address is unable to reset their password.
*   **Atomic Operations:** The process of setting a password and verifying an email is now an atomic operation, ensuring that a student's email is only marked as verified after they have successfully set a password.
*   **Restricted Student Page Access for Unverified Users:**
    *   `src/app/student/profile/page.js`: Implemented conditional display of "Scholarship Details", "Fee Details", and "Academic Details" tabs. These tabs are now always visible but appear grayed out and are inactive for students who have not verified their email and set a password. Unverified students are automatically directed to the "Basic Information" tab and forced into editing mode to complete verification. Fixed a "Rules of Hooks" violation by moving the conditional logic inside an unconditionally-called `useEffect` hook.
    *   `src/app/student/requests/bonafide/page.js`: Added client-side verification check and redirect logic. Students who have not verified their email and set a password are redirected to their profile page with a toast message, preventing them from accessing certificate request functionality.
    *   `src/app/student/requests/certificates/page.js`: Implemented client-side verification check and redirect logic. Students who have not verified their email and set a password are redirected to their profile page with a toast message, preventing them from accessing certificate request functionality.
    *   `src/app/api/student/requests/route.js`: Implemented server-side protection in the `POST` function, ensuring that certificate requests can only be submitted by students who have a verified email and a set password. This prevents direct API access by unverified users.
*   **Navbar Enhancements:**
    *   `src/components/Navbar.js`: Added a "Basic Info" tab to the student navigation. The "Bonafide Certificate", "No Dues Certificate", and "Other Certificates" links in the Requests dropdown are now visually grayed out and made inactive for unverified email students.

### New/Enhanced Utilities:
*   `src/lib/auth.js`: A new utility file providing a `verifyJwt` function for JWT token verification.
*   `src/lib/pdf-generator.js`: A new utility leveraging Puppeteer for server-side HTML to PDF conversion, used for certificate generation.
*   `src/lib/rollNumber.js`: Centralized and enhanced logic for roll number validation, parsing, and derivation of comprehensive academic information (entry year, branch, admission type, current studying year, academic year ranges), now used across multiple components and API routes.
