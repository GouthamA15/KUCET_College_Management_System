# Encryption Key Rotation Utility

This utility allows you to securely rotate the AES-256-GCM encryption key used for sensitive student data (Mobile numbers, Aadhaar, etc.) across the entire database.

## When to use this?
- **Security Breach:** If you suspect your `.env` file or `ENCRYPTION_KEY` has been compromised.
- **Compliance:** As part of a standard annual security audit/maintenance.
- **Key Upgrade:** If you are moving to a stronger key format.

---

## 🚀 Step-by-Step Guide

### 1. Generate a New Key
Run this command in your terminal to generate a fresh 32-byte (64-character hex) key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
*Copy the output string.*

### 2. Configure Environment Variables
Modify your `.env` or `.env.local` file. You must provide both the current (old) key and the new key:

```env
# 1. Rename your current ENCRYPTION_KEY to this:
OLD_ENCRYPTION_KEY=your_current_active_key_here

# 2. Paste the NEW key you generated in Step 1:
ENCRYPTION_KEY=the_new_hex_string_here
```

### 3. Run the Rotation
Execute the administrative script:
```bash
npm run db:rotate-keys
```

---

## 🛡️ Safety & Integrity Features
- **Atomic Transactions:** The script runs inside a `db.transaction`. If any single record fails to update, the entire process is **rolled back**. Your data will never be left in a partially encrypted or corrupted state.
- **Field Coverage:** Automatically rotates:
    - Student Mobile Numbers (`students` table)
    - Aadhaar Numbers (`student_personal_details` table)
    - Guardian Mobile Numbers (`student_personal_details` table)
- **Validation:** The script will refuse to run if the keys are missing or identical.

---

## ⚠️ Critical Final Steps
Once you see the message `✅ KEY ROTATION SUCCESSFUL`:

1. **Delete** the `OLD_ENCRYPTION_KEY` line from your `.env` file immediately.
2. **Update** the `ENCRYPTION_KEY` in your production environment variables (e.g., Vercel Dashboard).
3. **Restart** your application to ensure all new sessions use the new key.

**Warning:** Always ensure a fresh database backup exists before running administrative data mutations.
