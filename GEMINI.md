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

*   **Clerk & Faculty Experience Improvements:**
    *   **New Faculty Role:** The system now supports a "Faculty" role for clerks, with a dedicated dashboard page (`src/app/clerk/faculty/dashboard/page.js`).
    *   **Email on Clerk Creation:** When a super admin creates a new clerk account, an email is automatically sent to the clerk with their login credentials (temporary password) and a link to the portal. This is handled in `src/app/api/admin/create-clerk/route.js`. (commit `be94146`)
    *   **Clerk Redirection Fix:** Corrected a bug in the `src/proxy.js` middleware where clerks with the "Faculty" role were being incorrectly redirected to the admission dashboard. The logic now correctly routes them to `/clerk/faculty/dashboard`. Additionally, race conditions that caused "Access Denied" toast messages to appear on clerk dashboards during login have been resolved, with a loading state implemented to ensure authentication checks complete before content rendering (commit `501ac9d`).
    *   **Dashboard Loading State Fix:** Resolved a race condition that caused "Access Denied" toast messages to appear on clerk dashboards during login. A loading state has been implemented on all clerk dashboards (`faculty`, `scholarship`, `admission`) to ensure that authentication checks are complete before the dashboard content is rendered.

*   **Refactored Bulk Student Import:**
    *   **UI/UX Improvement:** The bulk student import feature has been refactored to display errors directly on the page in a table format, improving user experience by removing the need to download a separate error report.
    *   **Robust Client-side Excel Import Preview and Validation:** Implemented advanced client-side Excel import preview with robust date validation, category validation (including 'OC-EWS'), and phone number checks, significantly improving data quality and user feedback during bulk imports (commits `f529827`, `8888249`, `d86408a`).
    *   **Bug Fixes:**
        *   Resolved a critical bug where the bulk import feature would crash due to an attempt to insert into a non-existent `guardian_mobile` column in the database.
        *   Fixed a SQL syntax error in the student creation API (`src/app/api/clerk/admission/students/route.js`) where the number of placeholders did not match the number of columns.
        *   Resolved a critical syntax error in the bulk import API (`src/app/api/clerk/admission/bulk-import/route.js`) that was causing it to crash due to a corrupted import statement.
*   **Clerk Student Management Fixes:**
    *   Fixed a React warning (`Encountered two children with the same key`) caused by a duplicate `BC-D` entry in the student categories list.
    *   Resolved a React warning (`A component is changing a controlled input to be uncontrolled`) by ensuring that `annual_income` and `ranks` input fields always receive a string value.
    *   **Aadhaar Number Data Length Fix**: Implemented sanitization of the `aadhaar_no` field in `src/app/api/clerk/admission/students/[rollno]/route.js` to remove non-digit characters before database insertion, resolving `ER_DATA_TOO_LONG` errors (commit `eab1867`).
    *   **Roll Number Input Handling**: Fixed handling of undefined roll number input in `validateRollNo` to prevent `TypeError` (commit `6776e4d`).
    *   **Component Refactoring**: The `ClerkStudentManagement` component has been broken down into smaller, more manageable components for improved maintainability and readability (commit `73389d1`).

*   **Clerk Certificate Management Refactoring:**
    *   The previous monolithic `src/components/CertificateRequests.js` component has been replaced by a modular structure for better maintainability and scalability.
    *   **New Components:**
        *   `src/components/clerk/certificates/CertificateDashboard.js`: The main entry point for clerks to manage certificate requests, featuring "active" and "history" modes, and integrating other specialized components.
        *   `src/components/clerk/certificates/CertificateActionPanel.js`: Handles specific actions and displays details for an individual certificate request.
        *   `src/components/clerk/certificates/CertificateDateHistory.js`: Displays a list of dates for which certificate request history is available.
        *   `src/components/clerk/certificates/CertificateRecordsView.js`: Renders the list of certificate request records.
        *   `src/components/clerk/certificates/CertificateWorkspaceCard.js`: Allows switching between "active" and "history" modes for certificate requests.
        *   `src/components/clerk/certificates/CertificateFilters.js`, `src/components/clerk/certificates/FiltersButton.js`, `src/components/clerk/certificates/FiltersPopover.js`: Provide client-side filtering capabilities for certificate type and status.
    *   **API Updates:**
        *   `src/app/api/clerk/requests/route.js`: Enhanced to support fetching certificate requests based on clerk role (`clerkType`), workspace mode ("active" for pending, "history" for approved/rejected on a specific date), and filters (certificate type, status). It also provides distinct `completed_at` dates for history mode.
        *   `src/app/api/clerk/requests/[request_id]/route.js`: Updated to handle fetching details and updating the status of individual certificate requests. It enforces role-based authorization, allows approval, and mandates a `reject_reason` when rejecting a request, updating relevant timestamps and clerk action details.
    *   **Dashboard Integration:**
        *   Minor updates to `src/app/clerk/admission/dashboard/page.js` and `src/app/clerk/scholarship/dashboard/page.js` to integrate the new certificate management components.

*   **Robust Image Compression for Certificate Requests:**
    *   Implemented a more aggressive and reliable client-side image compression strategy in `src/app/student/requests/certificates/page.js` and `src/app/student/requests/bonafide/page.js`.
    *   The new logic uses a loop to repeatedly compress the payment screenshot with decreasing quality until its size is under a 60KB threshold. This ensures that the uploaded image will always fit within the `BLOB` column in the `student_requests` table, resolving the `ER_DATA_TOO_LONG` error without requiring a database schema change.

**Warning:** Students attempting to download approved certificates may encounter a `403 Forbidden` error if they have not completed the email verification process or set a password for their account. The system now provides more specific error messages to guide students in resolving this.

*   **Password Management:**
    *   **Deleted Forgot Password Pages:** The separate frontend pages for initiating forgot password requests for admin, clerk, and student roles have been removed (commit `26119a1`). The forgot password *APIs* and the reset password page still exist for functionality, but the specific entry point pages are gone.**
    *   **Fix `TypeError: dateString.split is not a function`**: The `parseDate` function in `src/lib/date.js` was updated to correctly handle JavaScript `Date` objects and Excel serial numbers, preventing runtime errors during date parsing.
    *   **Resolved `Unknown column 'token_hash'` Error**: A SQL patch (`college_db_patch_v12.sql`) was created and applied to add `token_hash` (VARCHAR(255) NOT NULL UNIQUE) and `used_at` (DATETIME NULL) columns to the `password_reset_tokens` table.
    *   **Robust Password Reset API**: The `src/app/api/auth/reset-password/[token]/route.js` API was significantly improved to enhance security and robustness. It now hashes tokens using `crypto`, queries the database by `token_hash`, checks the `used_at` field to prevent token reuse, marks tokens as used after a successful reset using database transactions, and returns more semantic HTTP status codes (e.g., `400` for invalid, `409` for used, `410` for expired).
    *   **Fix `ReferenceError: normalizeHeader is not defined`**: The `normalizeHeader` utility function was correctly re-inserted into the global scope of `src/components/BulkImportStudents.js`, resolving a runtime error.
    *   **Forgot/Reset Password:**
        *   New API routes for handling forgot password requests for admin, clerk, and student roles (`src/app/api/auth/forgot-password/...`).
        *   New API route for resetting the password using a token (`src/app/api/auth/reset-password/[token]/route.js`).
        *   **Student Forgot Password Logic Enhanced**: The student forgot password flow (`src/app/forgot-password/student/page.js` and `src/app/api/auth/forgot-password/student/route.js`) now conditionally offers a password reset. If the student has both a verified email and a set password, a reset link is sent. Otherwise, the student is informed to use their Date of Birth to log in.
        *   New pages for users to initiate the forgot password process (`src/app/forgot-password/...`).
        *   New page for users to reset their password (`src/app/reset-password/[token]/page.js`).
        *   New database table `password_reset_tokens` to store password reset tokens (`college_db_patch_v9.sql`).
    *   **Change Password:**
        *   New API routes for handling password changes for admin, clerk, and student roles (`src/app/api/auth/change-password/...`).
        *   A new `ChangePasswordModal.js` component to provide the UI for changing the password.
        *   The `AdminNavbar.js` and `Navbar.js` components have been updated to include a "Change Password" button that triggers the new modal.
*   **Bulk Import Feature Enhancements:**
    *   **Editable Client-side Preview**: The bulk student import preview table (`src/components/BulkImportStudents.js`) is now editable, allowing clerks to directly modify parsed Excel data in the table before final submission. This includes real-time validation feedback.
    *   **Backend API Update for Edited Data**: The `src/app/api/clerk/admission/bulk-import/route.js` API now accepts both `FormData` (for original file uploads) and JSON payloads (for client-side edited data), enabling the import of corrected student information.
    *   **Enhanced Alias Recognition**: Added support for new column header aliases (e.g., "Hall Ticket No", "Category/cast", "Mobile No.") in both client-side `REQUIRED_HEADERS_MAP` and server-side `ALIASES` for fields like 'Roll Number' (`HALL TICKET NO`), 'Category' (`CATEGORY/cast`), and 'Mobile' (`Mobile No./Phone number /mobile number /student number/number`).
    *   **Mobile Number Validation Adjustment**: The client-side validation in `src/components/BulkImportStudents.js` now issues a warning for empty mobile number fields instead of a critical error.
    *   **Category Validation Normalization**: Category input strings are now normalized by removing spaces around hyphens (e.g., "OC - EWS" becomes "OC-EWS") in both client-side and server-side validation, ensuring correct recognition.
    *   **Fixed Table Scrolling**: Adjusted the styling of the bulk import preview table by removing `min-w-full` to ensure proper horizontal scrolling and full data visibility.
    *   **Fixed `category` Redeclaration Error**: Resolved a syntax error in `src/app/api/clerk/admission/bulk-import/route.js` where the `category` variable was declared multiple times.

*   **Database Schema Updates:**
    *   `college_db_patch_v9.sql`: Adds the `password_reset_tokens` table.
    *   `college_db_patch_v10.sql`: Adds a unique constraint to the `email` column in the `students` table to ensure email uniqueness across all students.
    *   `college_db_patch_v11.sql`: Adds a `gender` column (VARCHAR(10) NULL) to the `students` table.
    *   `college_db_patch_v12.sql`: Adds `token_hash` (VARCHAR(255) NOT NULL UNIQUE) and `used_at` (DATETIME NULL) columns to the `password_reset_tokens` table.
*   **Environment Variables:**
    *   The `.env.example` file has been updated with `EMAIL_USER`, `EMAIL_PASS`, and `NEXT_PUBLIC_BASE_URL` for email and base URL configuration.
*   **Faculty Role:**
    *   The `admin/create-clerk/page.js` is updated to include a "Faculty" role.
    *   A new dashboard page for faculty (`src/app/clerk/faculty/dashboard/page.js`).
    *   The redirects page is updated to handle faculty role.
*   **`0ab5a03` - Add Set Password feature in Student Login**
    ```diff
    diff --git a/src/app/api/student/login/route.js b/src/app/api/student/login/route.js
    index c2a7c7b..2c2859c 100644
    --- a/src/app/api/student/login/route.js
    +++ b/src/app/api/student/login/route.js
    @@ -2,17 +2,18 @@ import { query } from '@/lib/db';
     import { toMySQLDate } from '@/lib/date';
     import { NextResponse } from 'next/server';
     import { SignJWT } from 'jose';
    +import bcrypt from'bcrypt'
     
     export async function POST(req) {
       try {
         const body = await req.json();
    -    const { rollno, dob } = body;
    +    const { rollno, dob } = body; //dob used as password input field
         if (!rollno || !dob) {
           return NextResponse.json({ error: 'Missing rollno or dob' }, { status: 400 });
         }
         
         const rows = await query(
    -      `SELECT s.roll_no, s.name, sp.father_name, sp.category, s.mobile, s.date_of_birth
    +      `SELECT s.roll_no, s.name, sp.father_name, sp.category, s.mobile, s.date_of_birth, s.password_hash
            FROM students s
            LEFT JOIN student_personal_details sp ON s.id = sp.student_id
            WHERE s.roll_no = ?`,
    @@ -24,17 +25,46 @@ export async function POST(req) {
         }
     
         const student = rows[0];
    +    let isAuthenticated = false
    +
    +    // 1. CHECK PASSWORD (If set)
    +    if (student.password_hash) {
    +      // The user entered a password in the 'dob' field
    +      const match = await bcrypt.compare(dob, student.password_hash);
    +      if (match) {
    +        isAuthenticated = true;
    +      } else {
    +        return NextResponse.json({ error: 'Invalid Password' }, { status: 401 });
    +      }
    +    }
    +    else {
         const dobInputMySQL = toMySQLDate(dob);
     
         const dbDate = new Date(student.date_of_birth);
         const dbDateString = dbDate.getFullYear() + '-' + String(dbDate.getMonth() + 1).padStart(2, '0') + '-' + String(dbDate.getDate()).padStart(2, '0');
    +    // Helper: Normalize Input to YYYY-MM-DD
    +      // This handles if frontend sends "15-08-2005" OR "2005-08-15"
    +      let inputDateString = dob;
    +      if (dob.includes('-')) {
    +        const parts = dob.split('-');
    +        if (parts[0].length === 2 && parts[2].length === 4) {
    +           // It's DD-MM-YYYY -> Convert to YYYY-MM-DD
    +           inputDateString = `${parts[2]}-${parts[1]}-${parts[0]}`;
    +        }
    +      }
    +
    +    if (dbDateString === inputDateString) {
    +        isAuthenticated = true;
    +      } else {
    +        return NextResponse.json({ error: 'Invalid Date of Birth' }, { status: 401 });
    +      }
    +    }
     
    -    if (dbDateString !== dobInputMySQL) {
    -      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    +    if (!isAuthenticated) {
    +        return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
         }
     
    -    const { date_of_birth: _dob, ...profile } = student;
    +    const { date_of_birth: _dob, password_hash = _ph, ...profile } = student;
     
         const secret = new TextEncoder().encode(process.env.JWT_SECRET);
         const token = await new SignJWT({ student_id: student.id, roll_no: student.roll_no, name: student.name })
    diff --git a/src/app/api/student/set-password/route.js b/src/app/api/student/set-password/route.js
    new file mode 100644
    index 0000000..8ac67b4
    --- /dev/null
    +++ b/src/app/api/student/set-password/route.js
    @@ -0,0 +1,52 @@
    +import { query } from '@/lib/db';
    +import { NextResponse } from 'next/server';
    +import bcrypt from 'bcrypt';
    +
    +// GET: Check if password is set
    +export async function GET(req) {
    +  try {
    +    const { searchParams } = new URL(req.url);
    +    const rollno = searchParams.get('rollno');
    +
    +    if (!rollno) return NextResponse.json({ error: 'Roll number required' }, { status: 400 });
    +
    +    const rows = await query(
    +      'SELECT password_hash FROM students WHERE roll_no = ?',
    +      [rollno]
    +    );
    +
    +    if (rows.length === 0) return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    +
    +    const isPasswordSet = !!rows[0].password_hash;
    +
    +    return NextResponse.json({ isPasswordSet }, { status: 200 });
    +  } catch (err) {
    +    console.error(err);
    +    return NextResponse.json({ error: 'Server error' }, { status: 500 });
    +  }
    +}
    +
    +// POST: Set new password
    +export async function POST(req) {
    +  try {
    +    const body = await req.json();
    +    const { rollno, password } = body;
    +
    +    if (!rollno || !password) {
    +      return NextResponse.json({ error: 'Missing details' }, { status: 400 });
    +    }
    +
    +    const saltRounds = 10;
    +    const hashedPassword = await bcrypt.hash(password, saltRounds);
    +
    +    await query(
    +      'UPDATE students SET password_hash = ? WHERE roll_no = ?',
    +      [hashedPassword, rollno]
    +    );
    +
    +    return NextResponse.json({ success: true, message: 'Password set successfully' }, { status: 200 });
    +  } catch (err) {
    +    console.error('Password set error:', err);
    +    return NextResponse.json({ error: 'Server error' }, { status: 500 });
    +  }
    +}
    +\ No newline at end of file
    diff --git a/src/app/layout.js b/src/app/layout.js
    index e51e894..fb7715b 100644
    --- a/src/app/layout.js
    +++ b/src/app/layout.js
    @@ -2,7 +2,7 @@ import "./globals.css";
     import { Toaster } from 'react-hot-toast';
     
     export const metadata = {
    -  title: "KUCET - KU College of Engineering and Technology",
    +  title: "KUCET - Login Portal",
       description: "KU College of Engineering and Technology - A premier engineering institution affiliated with Kakatiya University, Warangal",
     };
     
    diff --git b/src/app/student/profile/page.js b/src/app/student/profile/page.js
    index 5e3b5ce..280e55b 100644
    --- a/src/app/student/profile/page.js
    +++ b/src/app/student/profile/page.js
    @@ -44,6 +44,12 @@ export default function StudentProfile() {
       const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
       const [imagePreviewSrc, setImagePreviewSrc] = useState(null);
     
    +  // PASSWORD SETTING STATES
    +  const [isPasswordSet, setIsPasswordSet] = useState(true); // Default true to prevent flash
    +  const [newPassword, setNewPassword] = useState('');
    +  const [confirmPassword, setConfirmPassword] = useState('');
    +  const [passwordSaving, setPasswordSaving] = useState(false);
    +
       const sanitizeDigits = (val, maxLen = 12) => {
         if (val == null) return '';
         return String(val).replace(/\D/g, '').slice(0, maxLen);
    @@ -85,6 +91,17 @@ export default function StudentProfile() {
               setEmailLocked(false);
             setOriginalAddress(pdAddress);
             setProfilePhoto(data.student.pfp);
    +
    +        // CHECK IF PASSWORD IS SET
    +        try {
    +          const passRes = await fetch(`/api/student/set-password?rollno=${rollno}`);
    +          if (passRes.ok) {
    +            const passData = await passRes.json();
    +            setIsPasswordSet(passData.isPasswordSet);
    +          }
    +        } catch (e) {
    +          console.error("Error checking password status", e);
    +        }
           } else {
             toast.error(data.message || 'Unable to load profile. Please try again.');
           }
    @@ -293,7 +311,61 @@ export default function StudentProfile() {
         }
       };
     
    +  const handlePasswordSave = async () => {
    +    if (newPassword !== confirmPassword) {
    +      toast.error('Passwords do not match');
    +      return;
    +    }
    +    if (newPassword.length < 6) {
    +      toast.error('Password must be at least 6 characters long');
    +      return;
    +    }
    +    setPasswordSaving(true);
    +    try {
    +      const res = await fetch('/api/student/set-password', {
    +        method: 'POST',
    +        headers: { 'Content-Type': 'application/json' },
    +        body: JSON.stringify({
    +          rollno: studentData.student.roll_no,
    +          password: newPassword
    +        })
    +      });
    +      const data = await res.json();
    +      if (res.ok) {
    +        toast.success('Password set successfully! Please use this for future logins.');
    +        setIsPasswordSet(true);
    +        setNewPassword('');
    +        setConfirmPassword('');
    +      } else {
    +        toast.error(data.error || 'Failed to set password');
    +      }
    +    } catch (e) {
    +      toast.error('Network error');
    +    } finally {
    +      setPasswordSaving(false);
    +    }
    +  };
    +
       if (!studentData) return null;
     
       const { student = {} } = studentData; // Default to empty object if student is null
    @@ -371,7 +443,61 @@ export default function StudentProfile() {
           <Navbar studentProfileMode={true} onLogout={handleLogout} activeTab={activeTab} setActiveTab={setActiveTab} />
     
           <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
    -        <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-lg p-8">
    +  <div className="max-w-5xl mx-auto">
    +    
    +    {/* --- START OF NEW WARNING SECTION --- */}
    +    {!isPasswordSet && (
    +      <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8 shadow-md rounded-r-lg">
    +        <div className="flex items-start">
    +          <div className="flex-shrink-0">
    +            <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    +              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    +            </svg>
    +          </div>
    +          <div className="ml-3 w-full">
    +            <h3 className="text-lg font-medium text-red-800">Security Warning: Please set your password ASAP</h3>
    +            <p className="text-sm text-red-700 mt-1">You are currently logged in using your Date of Birth. For better security, please set a custom password immediately.</p>
    +
    +            <div className="mt-4 bg-white p-4 rounded-md shadow-sm border border-red-100 max-w-md">
    +              <h4 className="text-sm font-semibold text-gray-700 mb-3">Set New Password</h4>
    +              <div className="space-y-3">
    +                <div>
    +                  <label className="block text-xs font-medium text-gray-500 mb-1">New Password</label>
    +                  <input 
    +                    type="password" 
    +                    value={newPassword}
    +                    onChange={(e) => setNewPassword(e.target.value)}
    +                    className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
    +                    placeholder="Enter new password"
    +                  />
    +                </div>
    +                <div>
    +                  <label className="block text-xs font-medium text-gray-500 mb-1">Confirm Password</label>
    +                  <input 
    +                    type="password" 
    +                    value={confirmPassword}
    +                    onChange={(e) => setConfirmPassword(e.target.value)}
    +                    className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 outline-none"
    +                    placeholder="Confirm new password"
    +                  />
    +                </div>
    +                <button 
    +                  onClick={handlePasswordSave}
    +                  disabled={!newPassword || newPassword !== confirmPassword || passwordSaving}
    +                  className={`w-full py-2 px-4 rounded text-sm font-medium text-white transition-colors
    +                    ${(!newPassword || newPassword !== confirmPassword || passwordSaving) 
    +                      ? 'bg-gray-400 cursor-not-allowed' 
    +                      : 'bg-red-600 hover:bg-red-700'}`}
    +                >
    +                  {passwordSaving ? 'Saving...' : 'Set Password'}
    +                </button>
    +              </div>
    +            </div>
    +          </div>
    +        </div>
    +      </div>
    +    )}
    +    {/* --- END OF NEW WARNING SECTION --- */}
               <div className="border-b border-gray-200 relative">
                 <nav className="hidden md:flex -mb-px space-x-8" aria-label="Tabs">
                   <button onClick={() => setActiveTab('basic')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'basic' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
    diff --git b/src/components/LoginPanel.js b/src/components/LoginPanel.js
    index fd6aaa4..27ab56b 100644
    --- a/src/components/LoginPanel.js
    +++ b/src/components/LoginPanel.js
    @@ -165,7 +165,7 @@ export default function LoginPanel({ activePanel, onClose, onStudentLogin }) {
                         <input
                           type="text"
                           value={studentForm.rollNumber}
    -                      onChange={(e) => setStudentForm({ ...studentForm, rollNumber: e.target.value })}
    +                      onChange={(e) => setStudentForm({ ...studentForm, rollNumber: e.target.value.toUpperCase() })}
                           placeholder="Enter your Roll Number"
                           className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b3578] focus:border-transparent transition-all duration-200 text-gray-800 placeholder-gray-400"
                           required
    @@ -174,53 +174,16 @@ export default function LoginPanel({ activePanel, onClose, onStudentLogin }) {
     
                       <div>
                         <label className="block text-sm font-medium text-gray-700 mb-2">
    -                      Date of Birth
    +                      Password
                           <span className="block text-xs text-gray-500 font-normal mt-0.5">
    -                        (used as password for first login)
    +                        First time user ? Use your DOB in the format : DD-MM-YYYY
                           </span>
                         </label>
    -                    {/* Numeric-only DD-MM-YYYY input with auto-inserted, locked hyphens */}
                         <input
                           type="text"
    -                      inputMode="numeric"
    -                      placeholder="DD-MM-YYYY"
    -                      maxLength={10}
                           value={studentForm.dob}
    -                      onKeyDown={(e) => {
    -                        const allowedKeys = [
    -                          'Backspace', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'
    -                        ];
    -                        if (allowedKeys.includes(e.key)) return;
    -                        // allow only digits
    -                        if (/^[0-9]$/.test(e.key)) return;
    -                        e.preventDefault();
    -                      }}
    -                      onChange={(e) => {
    -                        const raw = e.target.value;
    -                        // strip non-digits
    -                        const digits = raw.replace(/\D/g, '').slice(0, 8);
    -                        let formatted = digits;
    -                        if (digits.length >= 5) {
    -                          formatted = `${digits.slice(0,2)}-${digits.slice(2,4)}-${digits.slice(4)}`;
    -                        } else if (digits.length >= 3) {
    -                          formatted = `${digits.slice(0,2)}-${digits.slice(2)}`;
    -                        } else if (digits.length >= 1) {
    -                          formatted = digits;
    -                        }
    -                        setStudentForm({ ...studentForm, dob: formatted });
    -                      }}
    -                      onPaste={(e) => {
    -                        e.preventDefault();
    -                        const paste = (e.clipboardData || window.clipboardData).getData('text') || '';
    -                        const digits = paste.replace(/\D/g, '').slice(0, 8);
    -                        let formatted = digits;
    -                        if (digits.length >= 5) {
    -                          formatted = `${digits.slice(0,2)}-${digits.slice(2,4)}-${digits.slice(4)}`;
    -                        } else if (digits.length >= 3) {
    -                          formatted = `${digits.slice(0,2)}-${digits.slice(2)}`;
    -                        }
    -                        setStudentForm({ ...studentForm, dob: formatted });
    -                      }}
    +                      onChange={(e) => setStudentForm({ ...studentForm, dob: e.target.value })}
    +                      placeholder="Enter Password"
                           className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b3578] focus:border-transparent transition-all duration-200 text-gray-800"
                           required
                         />
    @@ -238,8 +201,8 @@ export default function LoginPanel({ activePanel, onClose, onStudentLogin }) {
                       )}
                     </form>
     
    -                <p className="text-center text-xs text-gray-500 mt-4">
    -                  First time user? Use your Date of Birth as password
    +                <p className="text-center text-xs text-gray-700 mt-4">
    +                  Note : Login by DOB will work only for the students who haven't set their password yet
                     </p>
                   </div>
                 )}
    ```
*   **`000b98d` - Added Rejection Reason Overview**
    ```diff
    diff --git a/src/app/student/requests/bonafide/page.js b/src/app/student/requests/bonafide/page.js
    index 27f51e3..d70320f 100644
    --- a/src/app/student/requests/bonafide/page.js
    +++ b/src/app/student/requests/bonafide/page.js
    @@ -15,6 +15,7 @@ export default function BonafideRequestPage() {
       const [requests, setRequests] = useState([]);
       const [downloadingId, setDownloadingId] = useState(null);
       const [downloadErrors, setDownloadErrors] = useState({});
    +  const [selectedRejectedRequest, setSelectedRejectedRequest] = useState(null);
       const [isSubmitting, setIsSubmitting] = useState(false);
       const [previewUrl, setPreviewUrl] = useState(null);
       const [previewAspect, setPreviewAspect = useState(9/16); // default portrait 9:16
    @@ -293,7 +294,9 @@ export default function BonafideRequestPage() {
                                 )}
                               </div>
                             ) : req.status === 'REJECTED' ? (
    -                          <div className="text-sm text-gray-500">N/A</div>
    +                          <div className="flex items-center justify-center">
    +                            <button onClick={() => setSelectedRejectedRequest(req)} className="text-indigo-600 hover:text-indigo-900 cursor-pointer">View Details</button>
    +                          </div>
                             ) : (
                               <div className="text-sm text-gray-500">Processing</div>
                             )}
    @@ -315,6 +318,32 @@ export default function BonafideRequestPage() {
             </div>
           </main>
     
    +      {/* Rejection reason modal (read-only) */}
    +      {selectedRejectedRequest && (
    +        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
    +          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col relative">
    +            <button onClick={() => setSelectedRejectedRequest(null)} aria-label="Close" className="cursor-pointer absolute right-3 top-3 text-gray-500 hover:text-gray-800">✕</button>
    +            <div className="p-6">
    +              <h3 className="text-xl font-semibold mb-4">Reason for Rejection</h3>
    +              <div className="space-y-3 text-sm text-gray-800">
    +                <p><strong>Certificate Type:</strong> {selectedRejectedRequest.certificate_type || '-'}</p>
    +                <p><strong>Academic Year:</strong> {selectedRejectedRequest.academic_year || '-'}</p>
    +                <p><strong>Status:</strong> <span className="text-red-700 font-semibold">Rejected</span></p>
    +                <div>
    +                  <h4 className="font-medium">Rejection Reason</h4>
    +                  <div className="mt-2 p-3 border rounded bg-gray-50 text-sm text-gray-900" style={{ whiteSpace: 'pre-wrap' }}>
    +                    {selectedRejectedRequest.reject_reason || 'No reason provided.'}
    +                  </div>
    +                </div>
    +              </div>
    +            </div>
    +            <div className="p-4 bg-gray-50 border-t flex justify-end">
    +              <button onClick={() => setSelectedRejectedRequest(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Close</button>       
    +            </div>
    +          </div>
    +        </div>
    +      )}
    +
           <Footer />
         </div>
       );
    diff --git b/src/components/CertificateRequests.js b/src/components/CertificateRequests.js
    index f293464..6943435 100644
    --- a/src/components/CertificateRequests.js
    +++ b/src/components/CertificateRequests.js
    @@ -7,6 +7,8 @@ export default function CertificateRequests({ clerkType }) {
       const [isLoading, setIsLoading] = useState(true);
       const [selectedRequest, setSelectedRequest] = useState(null);
       const [actionInProgress, setActionInProgress] = useState(false);
    +  const [rejectReason, setRejectReason] = useState('');
    +  const [showRejectDialog, setShowRejectDialog] = useState(false);
     
       useEffect(() => {
         fetchRequests();
    @@ -39,20 +41,24 @@ export default function CertificateRequests({ clerkType }) {
         return `${dd}-${mm}-${yyyy}`;
       }
     
    -  const handleUpdateStatus = async (requestId, status) => {
    +  const handleUpdateStatus = async (requestId, status, reason) => {
         setActionInProgress(true);
         try {
    +      const body = { status };
    +      if (status === 'REJECTED') body.reject_reason = String(reason || '').trim();
           const response = await fetch(`/api/clerk/requests/${requestId}`, {
             method: 'PUT',
             credentials: 'same-origin',
             headers: { 'Content-Type': 'application/json' },
    -        body: JSON.stringify({ status }),
    +        body: JSON.stringify(body),
           });
     
           if (response.ok) {
             toast.success(status === 'APPROVED' ? 'Request approved!' : 'Request rejected');
             await fetchRequests();
             setSelectedRequest(null);
    +        setShowRejectDialog(false);
    +        setRejectReason('');
           } else {
             const errorData = await response.json().catch(() => ({}));
             toast.error(errorData.error || 'Failed to update request.');
    @@ -63,6 +69,16 @@ export default function CertificateRequests({ clerkType }) {
           setActionInProgress(false);
         }
       };
    +
    +  const confirmReject = async () => {
    +    if (!rejectReason || String(rejectReason).trim().length === 0) {
    +      toast.error('Rejection reason is required');
    +      return;
    +    }
    +    // call API and close dialog afterwards
    +    await handleUpdateStatus(selectedRequest.request_id, 'REJECTED', rejectReason);
    +    setShowRejectDialog(false);
    +  };
     
       const arrayBufferToBase64 = (buffer) => {
         let binary = '';
    @@ -112,61 +128,74 @@ export default function CertificateRequests({ clerkType }) {
     
           {selectedRequest && (
             <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
    -          <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col relative">
    -            <button onClick={() => setSelectedRequest(null)} aria-label="Close" className="cursor-pointer absolute right-3 top-3 text-gray-500 hover:text-gray-800">✕</button>
    +          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl flex flex-col relative">
    +            <button onClick={() => { setSelectedRequest(null); setRejectReason(''); setShowRejectDialog(false); }} aria-label="Close" className="cursor-pointer absolute right-3 top-3 text-gray-500 hover:text-gray-800">✕</button>
                 <div className="p-6 overflow-y-auto max-h-[80vh]">
    -              <h3 className="text-xl font-semibold mb-4">Request Details</h3>
    -              <div className="space-y-4 text-sm">
    -                <div>
    -                  <h4 className="font-medium">Student Details</h4>
    -                  <p><strong>Name:</strong> {selectedRequest.student_name}</p>
    -                  <p><strong>Roll No:</strong> {selectedRequest.roll_number}</p>
    -                  <p><strong>Academic Year:</strong> {selectedRequest.academic_year || '-'}</p>
    -                </div>
    +              <div className="flex gap-6">
    +                {/* LEFT COLUMN: Details */}
    +                <div className="w-1/2 overflow-y-auto">
    +                  <h3 className="text-xl font-semibold mb-4">Request Details</h3>
    +                  <div className="space-y-4 text-sm">
    +                    <div>
    +                      <h4 className="font-medium">Student Details</h4>
    +                      <p><strong>Name:</strong> {selectedRequest.student_name}</p>
    +                      <p><strong>Roll No:</strong> {selectedRequest.roll_number}</p>
    +                      <p><strong>Academic Year:</strong> {selectedRequest.academic_year || '-'}</p>
    +                    </div>
     
    -                <div>
    -                  <h4 className="font-medium">Request Details</h4>
    -                  <p><strong>Certificate Type:</strong> {selectedRequest.certificate_type}</p>
    -                  <p><strong>Requested On:</strong> {formatDateDDMMYYYY(selectedRequest.created_at)}</p>
    -                  <p><strong>Fee:</strong> ₹{selectedRequest.payment_amount}</p>
    -                </div>
    +                    <div>
    +                      <h4 className="font-medium">Request Details</h4>
    +                      <p><strong>Certificate Type:</strong> {selectedRequest.certificate_type}</p>
    +                      <p><strong>Requested On:</strong> {formatDateDDMMYYYY(selectedRequest.created_at)}</p>
    +                      <p><strong>Status:</strong> {selectedRequest.status}</p>
    +                      <p><strong>Fee:</strong> ₹{selectedRequest.payment_amount}</p>
    +                    </div>
     
    -                <div>
    -                  <h4 className="font-medium">Payment</h4>
    -                  {selectedRequest.payment_amount > 0 ? (
    -                    <>
    +                    <div>
    +                      <h4 className="font-medium">Transaction</h4>
                           <p><strong>Transaction ID:</strong> {selectedRequest.transaction_id || '—'}</p>
    -                      <div>
    -                        <strong>Payment Screenshot:</strong>
    -                        {selectedRequest.payment_screenshot ? (
    -                          <img
    -                            src={`data:image/jpeg;base64,${arrayBufferToBase64(selectedRequest.payment_screenshot.data)}`}
    -                            alt="Payment Screenshot"
    -                            className="mt-2 rounded-lg border w-full h-auto"
    -                          />
    -                        ) : <p>Not provided.</p>}
    -                      </div>
    -                    </>
    -                  ) : <p>No payment required.</p>}
    +                    </div>
+
+                      {selectedRequest.status === 'REJECTED' && selectedRequest.reject_reason && (
+                        <div>
+                          <h4 className="font-medium text-red-700">Rejection Reason</h4>
+                          <div className="mt-2 p-3 border rounded bg-red-50 text-sm text-red-800" style={{ whiteSpace: 'pre-wrap' }}>
+                            {selectedRequest.reject_reason}
+                          </div>
+                        </div>
+                      )}
+                    </div>
+                  </div>
+
+                  {/* RIGHT COLUMN: Screenshot preview */}
+                  <div className="w-1/2 flex flex-col items-center justify-start">
+                    <h4 className="font-medium mb-3">Payment Screenshot</h4>
+                    <div className="w-full h-full flex items-center justify-center border rounded-lg bg-gray-50 p-4">
+                      {selectedRequest.payment_screenshot ? (
+                        <img
+                          src={`data:image/jpeg;base64,${arrayBufferToBase64(selectedRequest.payment_screenshot.data)}`}
+                          alt="Payment Screenshot"
+                          className="max-w-full max-h-[60vh] object-contain rounded-md shadow"
+                        />
+                      ) : (
+                        <div className="text-sm text-gray-500">No screenshot provided.</div>
+                      )}
+                    </div>
+                    <div className="mt-6 w-full flex justify-end space-x-3">
+                      <button onClick={() => { setSelectedRequest(null); setRejectReason(''); }} disabled={actionInProgress} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Close</button>
+                      {selectedRequest.status === 'PENDING' && (
+                        <>
+                          <button onClick={() => setShowRejectDialog(true)} disabled={actionInProgress} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Reject</button>
+                          <button onClick={() => handleUpdateStatus(selectedRequest.request_id, 'APPROVED')} disabled={actionInProgress} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Approve</button>
+                        </>
+                      )}
+                    </div>
+                  </div>
                 </div>
               </div>
             </div>
-            <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3">
-              <button onClick={() => setSelectedRequest(null)} disabled={actionInProgress} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 cursor-pointer">Close</button>
-              <button
-                onClick={() => handleUpdateStatus(selectedRequest.request_id, 'REJECTED')}
-                disabled={actionInProgress}
-                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 cursor-pointer"
-              >
-                Reject
-              </button>
-              <button
-                onClick={() => handleUpdateStatus(selectedRequest.request_id, 'APPROVED')}
-                disabled={actionInProgress}
-                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer"
-              >
-                Approve
-              </button>
-            </div>
-          </div>
-        </div>
-      )}
-    
+          )}
+
       {showRejectDialog && selectedRequest && (
         <div className="fixed inset-0 flex items-center justify-center z-60 p-4" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
           <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col relative">
@@ -176,6 +205,32 @@ export default function CertificateRequests({ clerkType }) {
             <div className="p-6">
               <h3 className="text-xl font-semibold mb-3">Reason for Rejection</h3>
               <p className="text-sm text-gray-600 mb-4">Provide a clear reason so the student can understand and re-apply if needed.</p>
               <textarea id="reject-dialog-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={6} className="w-full p-3 border border-gray-300 rounded-md resize-none text-sm" placeholder="Enter rejection reason" />
             </div>
             <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3">
               <button onClick={() => setShowRejectDialog(false)} disabled={actionInProgress} className="px-4 py-2 bg-white border rounded-md cursor-pointer">Cancel</button>
               <button onClick={confirmReject} disabled={actionInProgress} className="px-4 py-2 bg-red-600 text-white rounded-md cursor-pointer">Confirm Reject</button>  
             </div>
           </div>
         </div>
    ```
*   **`a72dff5` - APIs follows new table column insert**
    ```diff
    diff --git a/src/app/api/clerk/requests/[request_id]/route.js b/src/app/api/clerk/requests/[request_id]/route.js
    index 09f8683..8220391 100644
    --- a/src/app/api/clerk/requests/[request_id]/route.js
    +++ b/src/app/api/clerk/requests/[request_id]/route.js
    @@ -25,7 +25,9 @@ export async function PUT(request, { params }) {
     
         const resolvedParams = await params;
         const { request_id } = resolvedParams;
    -    let { status } = await request.json();
    +    const body = await request.json();
    +    let { status } = body;
    +    const reject_reason = body.reject_reason;
         if (!status) {
             return NextResponse.json({ error: 'Status is required' }, { status: 400 });
         }
    @@ -62,15 +64,23 @@ export async function PUT(request, { params }) {
                         return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                 }
     
    -        // Now, update the status. Only set completed_at when marking final states.
    +        // Now, update the status. Require non-empty reject_reason when rejecting.
             let result;
    -        if (status === 'APPROVED' || status === 'REJECTED') {
    +        if (status === 'REJECTED') {
    +            if (!reject_reason || String(reject_reason).trim().length === 0) {
    +                return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
    +            }
    +            result = await query(
    +                'UPDATE student_requests SET status = ?, reject_reason = ?, completed_at = NOW() WHERE request_id = ?',
    +                [status, String(reject_reason).trim(), request_id]
    +            );
    +        } else if (status === 'APPROVED') {
                 result = await query(
                     'UPDATE student_requests SET status = ?, completed_at = NOW() WHERE request_id = ?',
                     [status, request_id]
                 );
             } else {
    -            // PENDING or other non-final state: don't set completed_at
    +            // PENDING or other non-final state: don't set completed_at or reject_reason
                 result = await query(
                     'UPDATE student_requests SET status = ? WHERE request_id = ?',
                     [status, request_id]
    diff --git a/src/app/api/student/requests/route.js b/src/app/api/student/requests/route.js
    index da7607b..8bf258a 100644
    --- a/src/app/api/student/requests/route.js
    +++ b/src/app/api/student/requests/route.js
    @@ -33,7 +33,7 @@ export async function GET(request) {
     
       try {
         const rows = await query(
    -      `SELECT sr.request_id, sr.certificate_type, sr.status, sr.academic_year, sr.created_at, s.roll_no as roll_number
    +      `SELECT sr.request_id, sr.certificate_type, sr.status, sr.academic_year, sr.created_at, sr.reject_reason, s.roll_no as roll_number
            FROM student_requests sr
            JOIN students s ON sr.student_id = s.id
            WHERE sr.student_id = ?
    ```
*   **`2efda6c` - Dynamically Generate QR & amt acc to Certificate Type**
    ```diff
    diff --git a/public/assets/Payment QR/kucet-logo.jpg b/public/assets/Payment QR/kucet-logo.jpg
    deleted file mode 100644
    index 043e94b..0000000
    Binary files a/public/assets/Payment QR/kucet-logo.jpg and /dev/null differ
    diff --git a/public/assets/Payment QR/kucet-logo.png b/public/assets/Payment QR/kucet-logo.png
    new file mode 100644
    index 0000000..2d2934d
    Binary files /dev/null and b/public/assets/Payment QR/kucet-logo.png differ
    diff --git a/public/assets/Payment QR/qr.py b/public/assets/Payment QR/qr.py
    deleted file mode 100644
    index b8b83dc..0000000
    --- a/public/assets/Payment QR/qr.py
    +++ /dev/null
    @@ -1,36 +0,0 @@
    -import qrcode
    -
    -def generate_ku_qr(amount):
    -    # 1. Define the specific KU Engineering College details
    -    upi_id = "kuengineeringcollege@sbi"
    -    payee_name = "PRINCIPALK U COLLEGE OF ENGIN"
    -    currency = "INR"
    -    
    -    # 2. Construct the UPI string with the fixed amount
    -    # Format: upi://pay?pa={id}&pn={name}&am={amount}&cu={currency}
    -    upi_payload = f"upi://pay?pa={upi_id}&pn={payee_name}&am={amount}&cu={currency}"
    -    
    -    # 3. Create the QR code
    -    qr = qrcode.QRCode(
    -        version=1,
    -        error_correction=qrcode.constants.ERROR_CORRECT_H, # High error correction
    -        box_size=10,
    -        border=4,
    -    )
    -    qr.add_data(upi_payload)
    -    qr.make(fit=True)
    -
    -    # 4. Save the image
    -    file_name = f"ku_payment_{amount}.png"
    -    img = qr.make_image(fill_color="black", back_color="white")
    -    img.save(file_name)
    -    print(f"✅ Success! QR code saved as: {file_name}")
    -
    -# --- Run the function ---
    -try:
    -    amount_input = input("Enter the amount to fix (e.g. 500): ")
    -    # Verify it's a number
    -    float(amount_input)
    -    generate_ku_qr(amount_input)
    -except ValueError:
    -    print("Please enter a valid number.")
    -\ No newline at end of file
    diff --git a/src/app/student/requests/bonafide/page.js b/src/app/student/requests/bonafide/page.js
    index 978fabd..27f51e3 100644
    --- a/src/app/student/requests/bonafide/page.js
    +++ b/src/app/student/requests/bonafide/page.js
    @@ -200,7 +200,7 @@ export default function BonafideRequestPage() {
             <p className="text-s font-semibold text-gray-700 mb-4">SCAN & PAY - Enter UTR - Upload the Screenshot</p>
             <div className="flex items-center justify-center space-x-2 mb-4">
             <img
    -              src="/assets/Payment QR/kucet-logo.jpg"
    +              src="/assets/Payment QR/kucet-logo.png" 
               alt="PRINCIPAL KU"
               className="h-8 w-auto object-contain"
               onError={(e) => {e.target.style.display = 'none'}} // Hide if broken
    @@ -208,7 +208,7 @@ export default function BonafideRequestPage() {
             <p className="text-sm font-semibold text-gray-600">PRINCIPAL KU COLLEGE OF ENGINEERING AND TECHNOLOGY</p>
             </div>
              <div className="flex items-center justify-center">
    -              <img src="/assets/Payment QR/principal_ku_qr.png" alt="QR" className="w-40 h-40 bg-white rounded-md shadow-lg" />
    +              <img src="/assets/Payment QR/ku_payment_100.png" alt="QR" className="w-40 h-40 bg-white rounded-md shadow-lg" />
             </div>
             <div className="w-full mt-4">
               <p className="text-sm text-gray-700 mb-2">Payment Fee: <span className="font-bold text-indigo-600">₹{FEE}</span></p>
    diff --git a/src/app/student/requests/certificates/page.js b/src/app/student/requests/certificates/page.js
    index 0c4fa36..f36e222 100644
    --- a/src/app/student/requests/certificates/page.js
    +++ b/src/app/student/requests/certificates/page.js
    @@ -15,6 +15,9 @@ const certificateTypes = {
       "Study Conduct Certificate": { fee: 100, clerk: "admission" },
     };
     
    +const UPI_VPA = 'kuengineeringcollege@sbi'; 
    +const PAYEE_NAME = 'PRINCIPAL KU COLLEGE OF ENGINEERING AND TECHNOLOGY';
    +
     export default function CertificateRequestsPage() {
       const [selectedCertificate, setSelectedCertificate] = useState(Object.keys(certificateTypes)[0]);
       const [transactionId, setTransactionId] = useState('');
    @@ -26,6 +29,8 @@ export default function CertificateRequestsPage() {
     
       const fee = certificateTypes[selectedCertificate].fee;
     
    +  const upiLink = `upi://pay?pa=${UPI_VPA}&pn=${encodeURIComponent(PAYEE_NAME)}&am=${fee}&cu=INR`;
    +  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`;
       useEffect(() => {
         fetchRequests();
       }, []);
    @@ -159,7 +164,7 @@ export default function CertificateRequestsPage() {
                         </div>
                         <div className="flex items-center justify-center space-x-2 mb-4">
             <img
    -              src="/assets/Payment QR/kucet-logo.jpg"
    +              src="/assets/Payment QR/kucet-logo.png" 
               alt="PRINCIPAL KU"
               className="h-9 w-auto object-contain"
               onError={(e) => {e.target.style.display = 'none'}} // Hide if broken
    @@ -167,7 +172,12 @@ export default function CertificateRequestsPage() {
             <p className="text-sm font-semibold text-gray-600">PRINCIPAL KU COLLEGE OF ENGINEERING AND TECHNOLOGY</p>
             </div>
                         <div className="flex justify-center">
    -                            <img src="/assets/Payment QR/principal_ku_qr.png" alt="Payment QR Code" className="w-48 h-48" />
    +                            {/* DYNAMIC QR CODE REPLACEMENT */}
    +                            <img 
    +                                src={qrCodeUrl} 
    +                                alt={`Pay ₹${fee}`} 
    +                                className="w-48 h-48 border border-gray-200 rounded-md bg-white p-1" 
    +                            />
                         </div>
                     </div>
                     <div>
    ```
*   **`672aec1` - QR codes with Fixed amount with code to generate them**
    ```diff
    diff --git a/public/assets/Payment QR/ku_payment_100.png b/public/assets/Payment QR/ku_payment_100.png
    new file mode 100644
    index 0000000..7c2423b
    Binary files /dev/null and b/public/assets/Payment QR/ku_payment_100.png differ
    diff --git a/public/assets/Payment QR/ku_payment_150.png b/public/assets/Payment QR/ku_payment_150.png
    new file mode 100644
    index 0000000..e65f62b
    Binary files /dev/null and b/public/assets/Payment QR/ku_payment_150.png differ
    diff --git a/public/assets/Payment QR/ku_payment_200.png b/public/assets/Payment QR/ku_payment_200.png
    new file mode 100644
    index 0000000..20f76f2
    Binary files /dev/null and b/public/assets/Payment QR/ku_payment_200.png differ
    diff --git a/public/assets/Payment QR/qr.py b/public/assets/Payment QR/qr.py
    new file mode 100644
    index 0000000..b8b83dc
    --- /dev/null
    +++ b/public/assets/Payment QR/qr.py
    @@ -0,0 +1,36 @@
    +import qrcode
    +
    +def generate_ku_qr(amount):
    +    # 1. Define the specific KU Engineering College details
    +    upi_id = "kuengineeringcollege@sbi"
    +    payee_name = "PRINCIPALK U COLLEGE OF ENGIN"
    +    currency = "INR"
    +    
    +    # 2. Construct the UPI string with the fixed amount
    +    # Format: upi://pay?pa={id}&pn={name}&am={amount}&cu={currency}
    +    upi_payload = f"upi://pay?pa={upi_id}&pn={payee_name}&am={amount}&cu={currency}"
    -
    -    # 3. Create the QR code
    -    qr = qrcode.QRCode(
    -        version=1,
    -        error_correction=qrcode.constants.ERROR_CORRECT_H, # High error correction
    -        box_size=10,
    -        border=4,
    -    )
    -    qr.add_data(upi_payload)
    -    qr.make(fit=True)
    -
    -    # 4. Save the image
    -    file_name = f"ku_payment_{amount}.png"
    -    img = qr.make_image(fill_color="black", back_color="white")
    -    img.save(file_name)
    -    print(f"✅ Success! QR code saved as: {file_name}")
    -
    -# --- Run the function ---
    -try:
    -    amount_input = input("Enter the amount to fix (e.g. 500): ")
    -    # Verify it's a number
    -    float(amount_input)
    -    generate_ku_qr(amount_input)
    -except ValueError:
    -    print("Please enter a valid number.")
    -\ No newline at end of file
    ```
*   **`7fd13d2` - docs: Update GEMINI.md with latest changes**
*   **UI/UX Improvements In Certificates Viewing - Clerk Dashboard (`ef939f7`)**
*   **Fixed Navbar - Removed Unnecessary Tabs (`a7d03c2`)**
*   **Optimized Academic Year Calculations (`12ba8a1`)**
*   **PDF Generator using Puppeteer (`82cd61d`)**
*   **Database Schema Updates (`college_db_patch_v7.sql`):**
    *   The `course` and `admission_type` columns have been removed from the `students` table. These are now dynamically derived from the roll number using `src/lib/rollNumber.js`.
    *   A `UNIQUE KEY` `roll_no` has been added to the `students` table, enforcing uniqueness for student roll numbers.
*   **Clerk Request Management:**
    *   New API endpoints (`src/app/api/clerk/requests/route.js`, `src/app/api/clerk/requests/[request_id]/route.js`) for clerks to fetch pending student requests (with role-based filtering) and update their status (approve/reject) with authorization.
    *   `src/components/CertificateRequests.js`: Clerk-side component to view, approve, and reject student certificate requests, including payment screenshot preview (converted from BLOB to base64).
*   **Student Login & Profile Enhancements:**
    *   `src/app/api/student/login/route.js`: Refined student login process with improved Date of Birth (DOB) input handling and secure cookie management.
    *   `src/components/LoginPanel.js`: Client-side input formatting for DD-MM-YYYY DOB for student login.
    *   `src/app/student/profile/page.js`: Significant update with tabbed navigation, profile editing (mobile, email, address), profile picture management (upload, compress, remove), and a crucial OTP-based email verification flow. Enhanced fee details display, academic year information.
*   **Student Certificate Request System:**
    *   `src/app/api/student/requests/download/[request_id]/route.js`: API for secure PDF generation and download of approved certificates, dynamically populating HTML templates with student data.
    *   `src/app/api/student/requests/route.js`: API for students to view their request history and submit new certificate requests, including payment details, image compression, and robust handling for duplicate/rejected requests.
    *   `src/app/student/requests/bonafide/page.js`: Dedicated student-facing page for Bonafide certificate requests, including payment, image compression, and request history.
    *   `src/app/student/requests/certificates/page.js`: General student-facing page for requesting various other certificates with dynamic fees and clerk assignments.
*   **UI/UX Components Refinements:**
    *   `src/components/Header.js`: Responsive design, enhanced college branding, and contact information with a copy-to-clipboard feature for the phone number.
    *   `src/components/Navbar.js`: Refactored for dynamic role-based navigation, including a new "Requests" dropdown for students, active tab highlighting, and improved mobile responsiveness.
*   **New/Enhanced Utilities:**
    *   `src/lib/pdf-generator.js`: A new utility leveraging Puppeteer for server-side HTML to PDF conversion, used for certificate generation.
    *   `src/lib/rollNumber.js`: Centralized and enhanced logic for roll number validation, parsing, and derivation of comprehensive academic information (entry year, branch, admission type, current studying year, academic year ranges), now used across multiple components and API routes.
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
    *   Implemented a robust roll number validation and derivation system for both regular (e.g., `22567T####`) and lateral entry (e.g., `22567####L`) students.
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

*   **Recent Fixes and Improvements:**
    *   **`abe2b08` - Input Field Issues:** Fixed value fallbacks.
    *   **`bf62ef2` - Fixed Merge Conflict:** Resolved a merge conflict.
    *   **`a2372f7` - Improvement in Components:** Enhancements made to various components.
    *   **`6c0126c` - Fixed Endpoints:** Addressed issues in API endpoints.
    *   **`49f892a` - Scholarship Dashboard:** Fixed a syntax problem in the Scholarship Dashboard.**
    *   **`78f7e86` - Updated Components:** General updates to components.
    *   **`f401920` - Updated pages:** General updates to pages.
    *   **`81f919c` - Updated Clerk Login API Call:** Improved clerk login API call.
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
        *   `college_db_patch_v7.sql`: The `course` and `admission_type` columns have been removed from the `students` table. These are now dynamically derived from the roll number using `src/lib/rollNumber.js`. A `UNIQUE KEY` `roll_no` has been added to the `students` table, enforcing uniqueness for student roll numbers.
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

*   **UI/UX Improvements:**
    *   **Responsive PFP Upload Options (`271e824`)**: Fixed overflow issues with profile picture upload options.
    *   **Optimized Image Rendering (`8581bfd`)**: Improved BaseURL conversions for image rendering in certificates.
    *   **Optimized System Components (`21771d7`)**: Enhanced system components for better input constraints and viewing options.
    *   **Fixed Image Source URLs (`cc1c8e3`)**: Corrected various image source URLs.
    *   **Updated Page Titles (`066830b`)**: Changed various page titles for clarity.
    *   **Fixed Navbars (`57aa399`)**: Addressed issues in navigation bars.
    *   **Added Loading Screen (`9642a5b`)**: Implemented a loading screen for better user experience.
    *   **Upgrade UI in Certificate Verification Page (`ca2e8a1`)**: Improved the user interface of the certificate verification page.
    *   **Minor UI Change (`2cd7874`)**: Implemented minor user interface adjustments.
    *   **Ensure Dynamic Number Inputs are Strings (`cf615bc`)**: Fixed controlled input issues by ensuring all dynamic number inputs are always strings.
    *   **Ensure Annual Income and Ranks are Strings (`28a9bed`)**: Ensured `annual_income` and `ranks` input fields always receive a string value.
    *   **Remove Duplicate Category Entry (`7d216b2`)**: Removed duplicate 'BC-D' from the categories array.
    *   **Bulk Import Error Display and Lint Fixes (`f0fce79`)**: Refactored bulk import to display errors in a table and fixed lint warnings.
    *   **UI/UX Improved (`5c16aa9`)**: General UI/UX improvements.
    *   **Email Edit & Verification Enhanced (`db20b4e`)**: Improved email editing and verification process.
    *   **NextImage Import Error (`ff689f7`)**: Fixed an error related to Next.js Image component import.
    *   **Professional UI/UX - Redesign Student Profile Page (`cfbbab5`)**: Master commit for redesigning the entire student profile page for a more professional UI/UX.
    *   **Fixed Date Format (`99df5b4`)**: Corrected date formatting issues.
    *   **Optimized Student Navbar (`c8d2702`)**: Optimized the student navigation bar.
    *   **Added Menu Settings (`c41eab3`)**: Introduced new menu settings.
    *   **Added Verification-Required Page (`2f75a93`)**: Implemented a new page for verification requirements.

*   **Backend & API Improvements:**
    *   **Generate Attendance Dynamically for Bonafide Certificate (`ead7e96`)**: Implemented dynamic attendance generation for bonafide certificates.
    *   **Watermark Added (`17180c7`, `5f00ad4`)**: Added watermark functionality.
    *   **Updating Year of Study Logic (`5287af8`)**: Updated the logic for adding the year of study.
    *   **Add Total Student Count to Admin Dashboard (`bcc3798`)**: Implemented functionality to display total student count on the admin dashboard.
    *   **Remove Query to Non-existent 'Academics' Table (`a1934a1`)**: Removed a query to a non-existent 'academics' table.
    *   **Configure DB_PORT and Fix Admin Login TypeError (`2d6b238`)**: Configured the `DB_PORT` environment variable and fixed a `TypeError` in admin login.
    *   **Make More Certificates Downloadable and Embed with QR Code and ID (`2e7add2`)**: Enhanced certificate download functionality with unique QR codes and IDs.
    *   **Add New Certificate Templates (`34d7deb`)**: Added new certificate templates.
    *   **Fixed Token Use Error for Reset Password (`b891958`)**: Resolved a token use error for password reset.
    *   **Restore Bulk-Import API File to Correct Syntax (`3abcdcf`)**: Corrected the syntax of the bulk-import API file.
    *   **Re-apply Guardian_Mobile Fix to Bulk-Import API (`ffb43d2`)**: Re-applied the `guardian_mobile` fix to the bulk-import API.
    *   **Correct SQL INSERT for Student Personal Details (`719194c`)**: Corrected the SQL INSERT statement for `student_personal_details`.
    *   **Remove Guardian_Mobile from Student Personal Details Insert (`c4bf851`)**: Removed `guardian_mobile` from `student_personal_details` insert.
    *   **Remove Guardian_Mobile and NCC/NSS References from Backend APIs (`2e78f2b`)**: Refactored backend APIs to remove references to `guardian_mobile` and `ncc_nss_details`.
    *   **Add Logging to Email Uniqueness Check (`a7ff47c`)**: Added logging to the email uniqueness check in the `send-update-email-otp` API.
    *   **Ensure Email Column Contains Unique Values (`14a7667`)**: Ensured the email column contains unique values for each student.
    *   **API Route Guard Added (`474b67d`)**: Implemented an API route guard.
    *   **Added Constraints - Email Verification Needed (`1b4f0fd`)**: Added constraints requiring email verification.
    *   **Implement Payment QR Code and Documentation (`db9e72a`, `742eb55`)**: Implemented payment QR code based on certificate fee and added code documentation.
    *   **Forget and Change Password (`238160b`)**: Implemented forget and change password functionality.
    *   **QR Codes with Fixed Amount and Generation Code (`1273bda`)**: Added QR codes with fixed amounts and the code to generate them.

*   **Bug Fixes:**
    *   **Package Typo (`84d5609`)**: Corrected a typo in package.
    *   **Ensure Reliable Login Redirection (`35f73b6`, `7d3a11e`)**: Fixed issues to ensure reliable login redirection for all roles.
    *   **Fix ReferenceError in ClerkStudentManagement.js (`43c1141`)**: Resolved `ReferenceError` in `ClerkStudentManagement.js`.
    *   **Resolve 'router is not defined' in Student Forgot Password Page (`8eeae78`)**: Fixed 'router is not defined' error in the student forgot password page.
    *   **Fixed Merge Conflicts (`a6c68b2`)**: Resolved merge conflicts.

*   **Feature Updates:**
    *   **Add Verification Page for Generated Certificates (`45babec`)**: Implemented a verification page for generated certificates.
    *   **Ensure Student Email is Verified Upon Password Set (`9c1e64e`)**: Ensured student email is verified upon password set.
    *   **Fixed Password Validation and Saving Flow (`10565bf`)**: Corrected password validation and saving flow.
    *   **Fixed Routing - New Student Profile Page (`106ad6e`)**: Fixed routing for the new student profile page.

*   **Code Cleanup/Refactoring:**
    *   **Merge Commits (`c685aff`, `62da4c6`, `ef914f8`, `4977196`, `2d13b10`, `089a3f5`, `9841dad`, `0302e6e`, `de80cee`, `cd248bb`)**: Numerous merge commits.
    *   **Fixing Sanni's Blessings (`b5cb49d`)**: Removed unnecessary code/comments related to 'Sanni's Blessings'.
    *   **Deleted Forgot Password Pages (`26119a1`)**: Removed dedicated frontend pages for initiating forgot password requests.
    *   **Optimized Components (`9ef22b8`, `dd2b5ab`)**: General optimization of components.
    *   **UI/UX Improvement (`d085912`)**: General UI/UX improvements.
    *   **Deleted Files (`4f12acd`, `7a03883`, `b515e11`)**: Removed various unnecessary files.
    *   **Shifted Import Using Excel (`dd3bdae`)**: Changes related to shifting import using Excel.
    *   **Added Excel Header Mapping for Efficient Import (`f4f3880`)**: Implemented Excel header mapping for efficient imports.
    *   **Remove Guardian_Mobile and NCC/NSS Details from ClerkStudentManagement.js (`143a681`)**: Refactored `ClerkStudentManagement.js` to remove references to `guardian_mobile` and `ncc_nss_details`.
    *   **Update GEMINI.md (`54e3d08`, `b2c7a1c`, `ababed9`, `693dc3a`)**: Updates to the `GEMINI.md` file itself.
    *   **Delete college_db_patch_v8.sql (`eabcd8d`)**: Removed `college_db_patch_v8.sql`.
    *   **Add Set Password feature in Student Login (`0ab5a03`)**: Implemented a feature to allow students to set their password.
    *   **Added Rejection Reason Overview (`000b98d`)**: Added functionality to view rejection reasons for certificate requests.

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
