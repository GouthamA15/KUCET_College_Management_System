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
*   **Middleware:** `src/middleware.js` centralizes authentication and route protection logic. It verifies JWTs for `admin_auth` and `clerk_auth` cookies to secure routes such as `/admin/*`, `/clerk/dashboard`, and `/student/profile`.
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

*   **Super Admin Student Data Visibility:**
    *   Created new API endpoints for super admin to fetch student data: `/api/admin/students` (for all students filtered by year/branch) and `/api/admin/students/[rollno]` (for a single student).
    *   Updated `src/app/admin/dashboard/page.js` to use these new admin-specific API endpoints and to fetch/display all available student data fields.
    *   Updated `src/components/StudentProfileCard.js` to display a comprehensive set of student information, including `admission_no`, `mother_name`, `date_of_birth`, `nationality`, `religion`, `caste`, `sub_caste`, `address`, `email`, `qualifying_exam`, `scholarship_status`, and `fee_payment_details`.
    *   Fixed import statements in `src/app/api/admin/students/route.js` and `src/app/api/admin/students/[rollno]/route.js` to correctly use named exports from `src/lib/db.js`.
    *   Corrected the `params` handling in `src/app/api/admin/students/[rollno]/route.js` to properly destructure route parameters.
*   **Clerk Management API Enhancement:**
    *   Updated the `GET` handler in `src/app/api/admin/clerks/route.js` to include the `employee_id` column in the returned clerk data.
*   **Admission and Scholarship Clerk Features:**
    *   **Database Schema Update:** Created `db_schema_update.sql` to:
        *   Add new columns to the `students` table (`course`, `branch`, `admission_type`, `mother_tongue`, `place_of_birth`, `father_occupation`, `student_aadhar_no`, `father_guardian_mobile_no`, `fee_reimbursement_category`, `identification_marks`, `present_address`, `permanent_address`, `apaar_id`, `is_tc_taken`, `tc_taken_date`, `is_bonafide_issued`, `bonafide_issued_date`, `photo_path`).
        *   Create a new `academics` table to store scholastic and extra-curricular information.
        *   Create a new `fees` table to store detailed fee particulars for students.
        *   Create a new `scholarship` table to store detailed scholarship particulars for students.
    *   **Admission Clerk Dashboard:**
        *   Created `src/app/clerk/admission/dashboard/page.js` with a form for adding new student data, encompassing all fields from the updated `students` and new `academics` tables.
        *   Created `src/app/api/clerk/admission/students/route.js` with a `POST` method to handle the submission of new student data, including basic roll number generation.
    *   **Scholarship Clerk Dashboard:**
        *   Created `src/app/clerk/scholarship/dashboard/page.js` with functionality to search for a student by roll number and display/edit their fee and scholarship details for all years.
        *   Created `src/app/api/clerk/scholarship/[rollno]/route.js` with `GET` and `PUT` methods to fetch and update student-specific fee and scholarship information.

## Development Conventions

*   **Code Formatting & Linting:** ESLint is configured using `eslint-config-next/core-web-vitals` to maintain code quality and consistency.
*   **Path Aliases:** The `jsconfig.json` file defines a path alias: `@/*` resolves to the `./src/*` directory, simplifying import paths.
*   **Component-Based Architecture:** Follows React's component-based development paradigm, with UI components located in the `src/components` directory.
*   **API Route Structure:** API endpoints are organized within `src/app/api`, following Next.js API Routes conventions.
*   **Middleware for Security:** `src/middleware.js` is used for centralized authentication and route protection, ensuring that only authorized users can access specific parts of the application.