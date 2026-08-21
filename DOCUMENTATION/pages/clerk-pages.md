# Administrative Clerk Portal (Legacy Reference)

> ⚠️ **Note (Session 207 Update):** The Clerk subsystem was comprehensively refactored and unified under the **Institutional Staff Portal (`/staff/*`)**.
> 
> Please refer to the updated canonical documentation in [Institutional Staff Portal Documentation](./staff-pages.md).

---

## Migration Summary
- `/clerk/admission/*` → `/staff/admission/*` (See [Staff Pages](./staff-pages.md#21-admission-staff-portal-staffadmission))
- `/clerk/scholarship/*` → `/staff/scholarship/*` (See [Staff Pages](./staff-pages.md#22-scholarship-staff-portal-staffscholarship))
- `/clerk/faculty/*` → `/staff/faculty/*` (See [Faculty Pages](./faculty-pages.md))
- `/clerk/hod/*` → `/staff/hod/*` (See [HOD Pages](./hod-pages.md))
- `clerk_auth` → `staff_auth`
- `clerks` database table → `staff_accounts`

For full details, see [Staff Management Architecture](../features/staff-management.md) and [Session 207 Testvanilla Changes](../history/session-207-testvanilla-changes.md).

- [Authentication Architecture](../authentication/authentication.md)
- [Authorization System & RBAC Matrix](../authentication/authorization.md)
- [Student Portal Fee Ledger & Receipts](./student-pages.md#6-fee-ledger--receipt-modal-feetransactionhistoryjs)
- [Super Admin Staff Management](./admin-pages.md#2-staff--faculty-account-management-adminmanage-clerks-admincreate-clerk)
