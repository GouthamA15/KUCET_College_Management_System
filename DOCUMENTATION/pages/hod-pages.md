# Head of Department (HOD) Console Workflows & Interface Specifications

## Overview

The Head of Department (HOD) Console (`/staff/hod/*`) equips department heads with high-level oversight of departmental academic scheduling, faculty workload balances, attendance condonation analytics, and marks approval workflows.

Access requires `staff_auth` credentials where `is_hod: true` and a recognized departmental branch (`CSE`, `ECE`, `EEE`, `MECH`, `CIVIL`).

---

## Route Structure & Departmental Management Matrix

| Route Path | Feature Module | Core Functionality | Primary RBAC Permissions |
| :--- | :--- | :--- | :---: |
| `/staff/hod/dashboard` | HOD Overview | Department summary, attendance health, faculty status | `VIEW_OWN_RECORDS` |
| `/staff/hod/staff-management` | Active Faculty Management | Manage faculty accounts, subject accesses, and interests | `STAFF_MANAGE` |
| `/staff/hod/syllabus` | Syllabus & Elective Groups | Core curriculum mapping, Elective group buckets, and subject catalogue | `STAFF_MANAGE` |
| `/staff/hod/timetable` | Semester Timetable Matrix | Schedule 8 semesters (S1-S8), resolve room conflicts | `ATTENDANCE_EDIT` |
| `/staff/hod/faculty-load` | Faculty Workload Tracker | Weekly lecture hour distribution, substitutions | `REPORT_EXPORT` |
| `/staff/hod/attendance-analytics` | Attendance Condonation | Identify low attendance, generate condonation lists | `REPORT_EXPORT` |

---

## Key Departmental Workflows

### 1. Active Faculty & Staff Management (`/staff/hod/staff-management`)
HODs manage their departmental faculty via the Active Faculty module. This replaces individual actions with a central "Manage Faculty" modal. The modal aggregates controls into three distinct sections:
- **Account Access**: Toggle a faculty member's active or disabled status. Changing an account status to `DISABLED` triggers an aggressive purge of their active `user_sessions` and `refresh_tokens`.
- **Subject Access (Assigned Subjects)**: Granular toggle for active subject assignments managed within `faculty_subject_assignments`. HODs can assign and revoke available subjects directly to manage teaching loads. **Note on HOD Self-Assignment (Phase H5.9):** HOD self-assignments are strictly bound by their `staff_academic_affiliations`. An HOD can ONLY assign themselves subjects from academic programs explicitly linked to their department. The API `POST /api/staff/hod/subject-assignments` validates this boundary server-side and throws a 403 Forbidden if violated.
- **Requested Subjects (Faculty Interests)**: Faculty can submit subject interests (`faculty_subject_interests`). HODs can view these requests by department code (inclusive of all underlying academic program codes, e.g., 'CSD' and 'IT' for 'CSE' HOD) and approve them inline. Approval converts the interest into an active assignment and sets the request status to `APPROVED`.

All modal state modifications use atomic bulk update endpoints (`PATCH /api/staff/hod/active-faculty/[staffId]/manage`), are wrapped in database transactions, and are logged via `auditLogs`.

---

### 2. Semester Timetable Matrix (S1 - S8)
The timetable configuration grid (`branch_timetable`) manages weekly schedules across all 8 semesters:
- **Grid Layout**: Days (Monday to Saturday) vs Periods (Periods 1 through 7, including lunch break).
- **Subject Constraints**: Assigns available subjects (as filtered by the active curriculum and faculty constraints) and primary faculty members to period slots.
- **Conflict Detection Engine**: Automatically validates timetable allocations against active schedules across the institution to prevent:
  - Assigning the same faculty member to two different classes in the same period slot.
  - Assigning the same physical laboratory or lecture room simultaneously.

---

### 3. Faculty Workload Tracker & Substitutions (`/staff/hod/faculty-load`)
Maintains balanced teaching loads across departmental staff:
- **Workload Analytics**: Visualizes total weekly teaching hours per faculty member. Highlights overload (> 16 hours/week) or underload (< 8 hours/week) states.
- **Faculty Substitution Engine**: In the event of faculty leave, HODs manage leaves and assign temporary substitute faculty to specific class periods (`faculty_substitutions`), seamlessly transferring attendance recording permissions (`ATTENDANCE_MARK`) for that session.

---

### 4. Branch Condonation Analytics (`/staff/hod/attendance-analytics`)
Monitors student attendance compliance across all branch sections:
- **Threshold Categorization**:
  - **Satisfactory ($\ge 75\%$)**: Regular exam eligibility.
  - **Condonation Range ($65\% - 74.9\%$)**: Eligible for condonation upon medical proof and fee payment.
  - **Detained ($< 65\%$)**: Highlighted in red; ineligible for university end-semester examinations.
- **Report Exporter (`REPORT_EXPORT`)**: Generates official PDF/Excel condonation list reports for submission to the Academic Audit Cell and University Registrar.

---

### 5. Syllabus & Elective Groups Management Console (`/staff/hod/syllabus`)
Equips HODs with full interactive curriculum configuration across semesters S1-S8 for their authorized department branches:
- **Dual Curriculum Architecture**:
  - **Core Subjects Matrix**: Mandatory foundational theory and laboratory courses mapped via `syllabus_structure`.
  - **Elective Group Buckets**: Group-based course selections (`elective_groups`) categorized as:
    - `PROFESSIONAL_ELECTIVE` (e.g., PE-I, PE-II)
    - `OPEN_ELECTIVE` (e.g., OE-I, OE-II)
    - `MANDATORY_NON_CREDIT` (e.g., Constitution of India, Environmental Science)
    - `OTHER`
- **Interactive UI Modals (`SyllabusManager.js`)**:
  - **Add Core Subject**: Manual entry of subject code, name, and subject type (`theory`/`lab`).
  - **Create Elective Group**: Specify Group Code, Group Name, Group Type, Subject Mode (`theory`/`lab`), Sequence Number, and Display Order.
  - **Add Elective Subject**: Map specific theory or lab subjects into an existing elective group (via catalogue search or manual entry).
  - **Edit Subject Details**: Update title and subject type in the global catalogue (`syllabus_subjects`) with read-only subject code.
  - **Edit Elective Group**: Modify group name, subject mode, and display order dynamically.
  - **Delete Mapping / Group**: Core subject mapping deletion is guarded by `ValidationService.checkSubjectBranchDependencies`; elective group deletion is blocked if `elective_group_subjects` rows remain assigned to the group.
- **Security & Authorization Boundaries**: Strict server-side verification in `/api/staff/hod/syllabus` ensures HODs can only manage curriculums belonging to their affiliated department branches (`authorizedBranches`).

---

## Cross-References

- [Authentication Architecture](../authentication/authentication.md)
- [Authorization System & Fine-Grained RBAC](../authentication/authorization.md)
- [Faculty Portal & Attendance Sheets](./faculty-pages.md)
- [Database Schema (Academic Domain)](../database/schema.md#2-academic-domain)
- [Student Portal Attendance View](./student-pages.md#3-subject-wise-attendance-analytics-studentattendance)
