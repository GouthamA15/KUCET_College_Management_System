# Project: KUCET College Management System

## Project Overview

This project is a "KUCET College Management System" built using Next.js. It provides a modern web interface for managing college-related data, including students, clerks, and administrative staff. The application utilizes a MySQL database for data persistence and employs `bcrypt` for secure password hashing and `jsonwebtoken` for robust session management. It features distinct login flows and dashboards tailored for students, clerks, and a super admin, with routes protected by Next.js middleware. The user interface is styled using Tailwind CSS, ensuring a consistent and responsive design.

## Key Technologies and Architecture

*   **Frontend Framework:** Next.js (version 16.1.6) with React (version 19.2.4).
*   **Styling:** Tailwind CSS.
*   **Database:** MySQL, accessed via `mysql2/promise` for asynchronous database interactions. Database credentials are managed through environment variables.
*   **Authentication & Authorization:**
    *   **Super Admin:** Uses JSON Web Tokens (JWTs) stored in an `admin_auth` HTTP-only cookie.
    *   **Clerk:** Authenticates against a `clerk` table in the MySQL database, verifying email and hashed password. JWTs are used for session management, stored in a `clerk_auth` HTTP-only cookie.
    *   **Student:** Authentication against student database, session managed by a `student_auth` cookie. Supports login via Date of Birth (initial) or custom password.
*   **API Routes:** Next.js API Routes handle backend logic, including authentication, student management, and certificate processing.
*   **Email Service:** Integrated with **Brevo HTTP API** for reliable OTP and notification delivery in production environments.
*   **Performance:** Utilizes `babel-plugin-react-compiler` for React Compiler optimization and optimized image handling for large BLOBs.

## Building and Running

### Prerequisites

*   Node.js (version compatible with Next.js 16)
*   MySQL server instance
*   `.env.local` file (development) or environment variables (production) configured.

### Available Scripts

To manage the project, you can use the following `npm` scripts:

*   **`npm install`**: Installs all project dependencies.
*   **`npm run dev`**: Starts the development server with hot-reloading.
*   **`npm run build`**: Builds the application for production deployment.
*   **`npm run start`**: Starts the Next.js production server.
*   **`npm run lint`**: Runs ESLint to check for code quality and style issues.

### Environment Variables

Ensure your environment is configured with the following variables:

```dotenv
DB_HOST=your_mysql_host
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_DATABASE=your_mysql_database_name
DB_PORT=your_mysql_port
JWT_SECRET=a_strong_random_secret_key
EMAIL_USER=your_sender_email
BREVO_API_KEY=your_brevo_api_key
NEXT_PUBLIC_BASE_URL=https://your-deployment-url.com
CERTIFICATE_SECRET=your_qr_verification_secret
```

## Recent Changes

*   **General Enhancements:**
    *   **Developers Page:** Added a dedicated page (`src/app/developers/page.js`) listing the development team with animations and responsive layout. Included a "View more details" link in the global footer.

*   **Student Features & Fixes:**
    *   **Profile Editing:** Implemented the "Edit Profile" page (`src/app/student/settings/edit-profile/page.js`), allowing students to update their phone number, address, and profile picture. Integrated with existing API routes (`upload-photo`, `update-profile`) and includes client-side validation for image size/type.
    *   **Request Image Caching:** Fixed an issue where resubmitted payment screenshots were not updating in the clerk dashboard due to aggressive browser caching.
        *   Updated `src/app/api/student/requests/image/[request_id]/route.js` to set `Cache-Control: no-store` and other headers to prevent caching.
        *   Updated `src/components/clerk/certificates/CertificateActionPanel.js` to append a timestamp (based on `updated_at` or `created_at`) to the image URL, ensuring the latest version is always fetched.

*   **Production Readiness & Stability Fixes:**
    *   **Brevo API Integration:** Migrated from Gmail SMTP to the **Brevo HTTP API** (`src/lib/email.js`). This bypasses outbound SMTP port blocking (465/587) common on cloud platforms like Render, ensuring 100% reliability for OTP delivery.
    *   **Critical React Fixes:** Resolved multiple "cascading render" errors in `useEffect` hooks across `NoDuesRequestPage`, `VerifyPage`, and `AdminContext`. State updates are now handled via direct initialization or guarded conditions to prevent infinite loops.
    *   **Dependency Cleanup:** Uninstalled `nodemailer` as it was replaced by standard `fetch` calls to the Brevo API, reducing bundle size and security risk.
    *   **Accessibility:** Added missing `alt` text to all PDF generation components (`CertificateHeader`, `CertificateWatermark`, `QRBlock`, `SignatureBlock`) to comply with standards.

*   **Clerk Security & Navigation Enhancements:**
    *   **Clerk Change Password:** Implemented a dedicated "Security & Privacy" page for Clerks (`src/app/clerk/settings/security/page.js`). It includes a secure password update form with a real-time **strength meter** and current password verification.
    *   **Navbar Overhaul:** Updated the Clerk Navbar to point to actual routes instead of placeholders (`#`).
    *   **"Coming Soon" Placeholders:** Created a reusable `ComingSoon.js` component and implemented professional placeholder pages for Departments, Admissions, Time Table, and Faculties to ensure a smooth user experience.

*   **Student OTP & Email Sanitization:**
    *   **Robust Sanitization:** Updated OTP APIs to aggressively clean email inputs, removing all whitespace and invalid characters globally. This prevents delivery failures caused by accidental spaces (e.g., "user @gmail.com").
    *   **Improved Logging:** Added detailed server-side logging for OTP requests, distinguishing between database management and email service responses.

*   **Database Optimization and Image Handling Overhaul:**
    *   **Architecture Change:** Heavy BLOB columns (profile pictures, payment screenshots) moved to dedicated tables (`student_images`, `student_request_images`) to drastically improve query performance for student lists.
    *   **Image Serving APIs:** New routes created to serve images on-demand with role-based authorization.
    *   **Frontend Optimization:** Implemented a 4MB size limit and unoptimized rendering for full-quality image display.

*   **Certificate Request System Improvements:**
    *   **Rejection Reasons:** Added functionality for clerks to provide, and students to view, detailed rejection reasons for certificate requests.
    *   **Dynamic QR Codes:** Certificates now generate dynamic QR codes based on the certificate type and fee, using the UPI standard.
    *   **PDF Generation System:** Replaced HTML templates with a robust, component-based PDF generation system utilizing `@react-pdf/renderer`.

## Code Documentation

### Email System (`src/lib/email.js`)
Uses the Brevo SMTP API v3. It requires `BREVO_API_KEY` and `EMAIL_USER`. The system is designed to be "firewall-proof" by using standard HTTPS (Port 443).

### Password Management
*   **Students:** Can set a password upon first login (DOB). Requires verified email.
*   **Clerks/Admins:** Have dedicated "Security & Privacy" pages for changing passwords. All passwords are hashed using `bcrypt` with 10 salt rounds.

### Role-Based Access Control
Managed via `src/middleware.js` and `src/proxy.js`, ensuring students, clerks, and admins are restricted to their respective dashboards and API endpoints.

## Gemini CLI Usage Guidelines

*   **SMTP Port Issues:** Never attempt to fix connection timeouts on cloud hosts by changing ports (465/587) if the platform blocks them. Always prefer HTTP-based API services for production email.
*   **Production Builds:** Always run `npm run lint` before committing major changes to catch synchronous state updates that Next.js might optimize away in dev but crash in production.
