# Privacy Policy: KUCET College Management System (CMS)

**Last Updated:** March 31, 2026

## 1. Introduction
Kakatiya University College of Engineering & Technology (KUCET) is committed to protecting the privacy of its students, faculty, and staff. This Privacy Policy explains how we collect, use, and safeguard your personal information within the KUCET CMS portal (`login.kucet.ac.in`).

## 2. Information We Collect

### A. Personal Identification Information
We collect data necessary for academic and administrative purposes:
- **Identity:** Name, Roll Number, Father's Name, Mother's Name.
- **Sensitive Data:** Aadhaar Number and Mobile Numbers (**Stored using AES-256-GCM encryption**).
- **Academic:** Attendance, Marks, Scholarship status, and Entrance Exam ranks.

### B. Automated Verification Data
To maintain the integrity of institutional documents and prevent forgery:
- **QR Code Scans:** When a third party (e.g., employer or embassy) scans a QR code on a KUCET-issued certificate, we automatically log the **IP Address**, **Device Type**, and **Approximate Location** (via GeoIP) of the scanner.
- **Purpose:** This data is used solely for audit trails and to detect "High-Frequency Scan" anomalies which may indicate counterfeit documents.

### C. System Logs
- **Audit Logs:** We log all administrative actions (updates to marks, certificate approvals) including the performer's IP address and timestamp.
- **Attendance:** GPS coordinates are captured during attendance marking to verify physical presence within the campus radius.

## 3. Data Protection & Security
- **Encryption at Rest:** Sensitive fields like Aadhaar and Mobile numbers are encrypted.
- **Access Control:** Access to student data is restricted based on roles (Super Admin, HOD, Clerk).
- **Secure Transit:** All traffic is enforced via TLS 1.2+ (HTTPS).

## 4. Data Sharing & Disclosure
KUCET does **not** sell or rent student data to third parties. Data is only shared with:
- **Government Agencies:** For scholarship processing (e.g., ePass).
- **Verification Entities:** When you present a certificate QR code for verification, the entity will see your name, roll number, and certificate details to confirm authenticity.

## 5. Data Retention
- **Academic Records:** Retained permanently as part of institutional history.
- **Verification Logs:** Moved to cold storage after 6 months and purged after 2 years.
- **Audit Logs:** Retained for 2 years for legal and administrative accountability.

## 6. Your Rights
Students have the right to:
- Review their personal and academic data.
- Request corrections to inaccuracies through the "Profile Update" portal (subject to clerk approval).
- View their certificate request history.

## 7. Contact Information
For privacy-related inquiries, please contact the **KUCET Administration Office** or the **Department of Computer Science & Engineering**.

---
*This policy is subject to change based on institutional requirements and government regulations.*
