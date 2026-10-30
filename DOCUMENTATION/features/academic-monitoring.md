# Centralized Academic Monitoring & Reporting Console

**Feature Version:** Session 226 - Academic Monitoring Consolidation & Confirmed Policy Reconciliation
**Last Updated:** October 30, 2026
**Status:** Active Production
**Target Roles:** First-Year Coordinator, Head of Department (HOD), Designated Academic Supervisor, Super Admin

---

## 1. Confirmed Institutional Policy Settings

The following policy settings represent the authoritative institutional baseline for academic monitoring at KUCET:

| Policy Area | Confirmed Institutional Decision | Technical Implementation |
| :--- | :--- | :--- |
| **Attendance Attention Threshold** | Below 75% | Students with $< 75\%$ attendance identified with neutral label `Attendance Attention Required`. Actual %, attended, and total sessions displayed. No automatic detention, condonation, or notice generation. |
| **Internal Marks (CIE) Threshold** | None configured | No active pass/fail or risk classification based on CIE cutoffs (no 40%, 50%, or 12/30 thresholds). Displays actual marks, assessment components, and published/draft workflow status. Missing marks are not treated as zero. |
| **Consecutive Absence Alerts** | None configured | No automatic threshold-based alerts for 3 consecutive absences. No misleading `3+ consecutive absences` warning badges. Actual factual consecutive absence counts are tracked descriptively. |
| **Lecture Topic Entry** | Optional | Shows actual topic covered when recorded; displays `Topic not recorded` when missing. Never fabricated or made mandatory in attendance workflows. |
| **Academic Supervisor Scope** | Dedicated Dashboard | Dedicated route at `/staff/supervisor/academic-monitoring`. Requires active staff account with PRINCIPAL role, explicitly designated via `isDesignatedAcademicSupervisor()` fail-closed check. All 7 branches, semesters 1–8. |
| **Monitoring Operations** | Read-Only | Strictly monitoring and reporting. No write mutations to marks, attendance sessions, or student records. |

---

## 2. Role-Based Access Control (RBAC) Matrix

| Institutional Role | Permitted Semesters | Permitted Branches | Subject Scope | Mutation Rights | Authoritative Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **First-Year Coordinator** | Semesters 1 & 2 Only | All 7 Institutional Branches | S1-S2 Active Subjects | **Read-Only** | Active `FIRST_YEAR` assignment in `facultyCoordinatorAssignments` |
| **Head of Department (HOD)** | Semesters 1 through 8 | Department Authorized Branches | Department Subjects | **Read-Only** | Department assignment in `facultyHodAssignments` |
| **Designated Academic Supervisor** | Semesters 1 through 8 | All 7 Institutional Branches | All Active Subjects | **Read-Only** | Active account + `PRINCIPAL` role + authoritative designation check (`isDesignatedAcademicSupervisor`) |
| **Non-Designated Principal** | None (Console Forbidden) | None | None | None | Fails closed; PRINCIPAL role alone does not confer global scope |
| **Super Admin** | Semesters 1 through 8 | All 7 Institutional Branches | All Active Subjects | **Read-Only** | `admin` JWT role |
| **Regular Faculty** | None (Console Forbidden) | None | Assigned Subjects | None | Blocked with HTTP 403 Forbidden |

> [!IMPORTANT]
> The Academic Monitoring Console enforces strict server-side authorization boundaries inside `AcademicMonitoringService.resolveScope`. Frontend filter limits are paired with server-side HTTP 403 enforcement to prevent parameter tampering or IDOR vulnerability exploits.

---

## 3. API Endpoints

All endpoints are hosted under `/api/staff/academic-monitoring/` and require JWT authentication via `staff_auth` or `admin_auth` cookies:

| Endpoint | Method | Parameters | Description |
| :--- | :--- | :--- | :--- |
| `/overview` | `GET` | `branch`, `semester`, `academic_year` | Cohort KPIs, average attendance, attendance attention count, factual marks workflow counts, monthly trends |
| `/attendance` | `GET` | `branch`, `semester`, `academic_year`, `search`, `page`, `limit` | Student attendance grid with per-subject breakdown & factual consecutive absence counts |
| `/marks` | `GET` | `branch`, `semester`, `academic_year`, `search`, `page`, `limit` | Student CIE marks grid with assessment component breakdown and draft/published indicators |
| `/combined` | `GET` | `branch`, `semester`, `academic_year`, `category` | Integrated attendance % vs CIE marks matrix with neutral workflow categories (`Marks Available`, `Attendance Attention Required`, `Marks Not Published`, `Insufficient Data`) |
| `/students/[studentId]` | `GET` | `studentId`, `branch`, `semester`, `academic_year` | Individual student drilldown with session log, topics covered, and marks breakdown |
| `/export/csv` | `GET` | `type` (`attendance`\|`marks`\|`combined`), `branch`, `semester`, `academic_year` | Secure RFC-4180 CSV export with spreadsheet injection escaping (`=`, `+`, `-`, `@` escaped with `'`) |
| `/export/pdf` | `GET` | `type` (`attendance`\|`marks`\|`combined`), `branch`, `semester`, `academic_year` | Printable PDF report with institutional header, metadata, and neutral badges |

---

## 4. Academic Evaluation & Classification Formulae

### Attendance Calculation
$$\text{Attended Sessions} = \text{COUNT}(\text{PRESENT}) + \text{COUNT}(\text{NCC}) + \text{COUNT}(\text{MEDICAL})$$
$$\text{Attendance } \% = \left(\frac{\text{Attended Sessions}}{\text{Total Conducted Sessions}}\right) \times 100$$
$$\text{Admission Guard: } \text{attendance\_date} \ge \text{COALESCE}(\text{students.admission\_date}, \text{'1900-01-01'})$$

- Distinct session identities (`date + session_number`) are enforced to prevent duplicated attendance counts.
- Historical classification is resolved permanently through `faculty_subject_assignments`.

### Neutral Combined Status Categories
- **ATTENDANCE_ATTENTION**: Attendance $< 75\%$ with conducted sessions $\ge 1$ (`Attendance Attention Required`)
- **MARKS_AVAILABLE**: Attendance $\ge 75\%$ AND internal marks evaluated (`Marks Available`)
- **MARKS_NOT_PUBLISHED**: Attendance $\ge 75\%$ AND internal marks pending entry/publication (`Marks Not Published`)
- **INSUFFICIENT_DATA**: Zero conducted sessions AND no marks recorded (`Insufficient Data`)

---

## 5. UI Components & Workspace Integrations

The console is organized into modular React 19 components in `src/components/staff/academic/monitoring/`:
- `AcademicMonitoringConsole.jsx`: Main tabbed console container (`attendance`, `marks`, `combined`, `overview`).
- `AcademicOverviewCards.jsx`: Metric cards displaying total students, cohort attendance, attendance attention count, and marks workflow summary.
- `AcademicMonitoringFilters.jsx`: Role-scoped branch and semester dropdowns, academic year selector, and search input.
- `AttendanceMonitoringGrid.jsx`: Cohort attendance table with neutral badge indicators and quick drilldown trigger.
- `MarksMonitoringGrid.jsx`: Internal marks table highlighting draft/published states and assessment breakdowns.
- `CombinedAcademicOverview.jsx`: Neutral combined attendance and marks status table with individual student drilldown.
- `StudentAcademicDetailDrawer.jsx`: Slide-over drawer with chronological lecture log (session, date, faculty, topic covered, status, dispute indicator).

### Workspace Embedding:
1. **First-Year Coordinator Workspace**: `/staff/first-year/dashboard` embedded with `restrictSemesters={[1, 2]}`.
2. **Faculty / HOD Academics Hub**: `/staff/faculty/academics` with a dedicated "Academic Monitoring" tab for HODs.
3. **Supervisor / Principal Console**: Dedicated page at `/staff/supervisor/academic-monitoring` with dynamic navigation injected in `Navbar.js` and `Sidebar.js` exclusively when `staffData?.is_designated_supervisor` is verified.
