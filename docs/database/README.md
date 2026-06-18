# Database Architecture & Security Guide
## KUCET Scholarship Management System

### 🛡️ Security Recommendations

1.  **Identity Management (Clerk Decoupling):**
    *   Never store passwords in this database. Rely on the `clerk_id` for authentication.
    *   Sync Clerk users to the `users` table via Webhooks.

2.  **Least Privilege Access:**
    *   **App User:** Grant only `SELECT`, `INSERT`, `UPDATE`, `DELETE` on specific tables.
    *   **Reporting User:** Grant `SELECT` only on the `Views`.
    *   **Super Admin:** Full access (reserved for DBA/Emergency).

3.  **Data Protection:**
    *   **PII:** Use Application-level encryption (AES-256-GCM) for Aadhaar and Mobile numbers.
    *   **Blind Indexing:** Store a SHA-256 hash of the mobile number in `mobile_hash` to allow searching without decrypting.

4.  **SQL Injection Prevention:**
    *   Always use parameterized queries (Drizzle ORM handles this by default).
    *   Sanitize all input in the Next.js API routes using Zod schemas.

---

### 🚀 Scalability & Optimization

1.  **Binary UUIDs:**
    *   We use `BINARY(16)` for primary keys. This is 50% smaller than string UUIDs and maintains index performance.
    *   In Node.js, use `uuid-parse` or similar to convert between strings and buffers.

2.  **Optimistic Locking:**
    *   The `version` column in `scholarship_applications` prevents "Last Write Wins" bugs. Always include `WHERE version = ?` in updates.

3.  **Indexing Strategy:**
    *   `idx_app_status`: Covers 80% of dashboard filtering.
    *   `idx_audit_created`: Essential for maintaining log performance as the system grows.

---

### 📥 MySQL Workbench Import Instructions

1.  **Open Workbench:** Connect to your KUCET instance.
2.  **Run Schema:** Open `docs/database/SCHEMA_V1.sql` and execute (Zap icon).
3.  **Visual ERD:** 
    *   Go to `Database` -> `Reverse Engineer`.
    *   Select `kucet_scholarship_system`.
    *   You will see the normalized relationship diagram.
4.  **Verify Views:** Check the `Views` section in the navigator to see the `active_applications_summary`.
