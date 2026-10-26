# KUCET CMS Payment Evidence Verification & Fraud Prevention
## Scene-by-Scene Video Storyboard

| Scene # | Scene Title | Target Time | Visual Assets & Screen Elements | Key Narration Focus | Technical / Audio Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Scene 1** | Introduction & Problem Overview | 00:00 - 00:45 | KUCET Institutional Crest, Kakatiya Navy/Gold background, Title: "Payment Evidence Verification and Fraud Prevention" | Importance of payment verification, risk of screenshots being manipulated or reused, and core invariant: screenshot ≠ proof of payment. | Tone: Professional, authoritative, calm. Intro music fade-in (1.5s). |
| **Scene 2** | Payment-Verification Workflow | 00:45 - 01:30 | 6-stage flowchart diagram: Submission → Format Validation → Hash Fingerprinting → OCR & Field Check → Bank Reconciliation → Staff Decision | Overview of the automated guard layers and how human review integrates with automated signals. | Highlight current step with animated glow border. |
| **Scene 3** | Anatomy of a Payment Screenshot | 01:30 - 02:30 | High-res synthetic payment receipt (`DEMO — NOT A REAL PAYMENT`) with 4 numbered callouts: 1 (Status), 2 (Amount), 3 (UTR), 4 (Payee) | Detailed inspection of visual status vs reality, amount, 12-digit UTR, and official payee verification. | Visual zoom on each numbered callout sequentially. |
| **Scene 4** | Student Submission Portal | 02:30 - 03:15 | Student CMS portal with official college QR code, UPI VPA handle, screenshot upload zone, and UTR input box | Demonstrating correct submission process and why status is initially pending/review. | Highlight live format validation during entry. |
| **Scene 5** | Test Case 1: Genuine Evidence | 03:15 - 04:15 | Student A profile: Genuine receipt, UTR 428190123456, amount ₹500, side-by-side with SBI Bank settlement ledger fixture | Verification succeeds ONLY because authoritative bank confirmation exists. | Badge transition from `PENDING` → `VERIFIED`. |
| **Scene 6** | Test Case 2: Reused Proof & Field Mismatch | 04:15 - 05:15 | Student B profile: Duplicate screenshot upload; UTR entered in UPI ID field. Alert banner: `IDENTIFIER_TYPE_MISMATCH` & `EXACT_IMAGE_DUPLICATE` | Detecting duplicate file hash and field semantic error. Emphasizing candidate privacy protection (no Student A PII leaked). | Amber alert banner with explainable tags. |
| **Scene 7** | Test Case 3: Cropped Reused Screenshot | 05:15 - 06:15 | Student C profile: Cropped version of Student A receipt. SHA-256 hash comparison shows mismatch, but dHash shows 88% visual match | Why byte hashes fail on cropped images and how Perceptual Difference Hashing (dHash) catches modified proofs. | Side-by-side image comparison with similarity score. |
| **Scene 8** | Test Case 4: Cropped with Altered Reference | 06:15 - 07:15 | Student D profile: Cropped receipt visible UTR 428190123456, entered UTR 428190123499. Alert: `OCR_DISCREPANCY` | OCR text extraction, detecting contradictions between visible receipt text and entered values, routing to manual review. | OCR bounding box highlights visible reference in red. |
| **Scene 9** | Staff Review & Decision Console | 07:15 - 08:30 | Real KUCET CMS Staff Payments Console (`/admin/payments` / Staff Dashboard), opening transaction modal, screenshot preview, audit log entry | How admission officers inspect evidence, check university bank statement, select verification method, and record decisions. | Demonstrate modal review and audit log recording. |
| **Scene 10** | Common Mistakes to Avoid | 08:30 - 09:30 | 9-point danger card infographic with red warning badges and operational safeguards | Critical errors: trusting visual status, ignoring amount mismatches, unverified approvals, leaking student banking data. | Clear bullet points with visual check/cross markers. |
| **Scene 11** | Staff Operational Checklist | 09:30 - 10:15 | Clean 7-point operational review checklist with animated checkmarks | Practical 7-step checklist for clerks and faculty before approving any payment. | High-contrast, easy-to-read typography. |
| **Scene 12** | Summary & Conclusion | 10:15 - 11:00 | KUCET Golden Jubilee crest, Institutional Motto: "A screenshot is evidence to review, not proof of money received", Support contacts | Final takeaways, transparency, accountability, and institutional excellence. | Closing chime and music fade-out (3s). |

---

### Visual Source Classification

- **Authentic Application Captures:**
  - KUCET Staff Payment Management Console (`/admin/payments`)
  - Transaction Details Modal with Risk Indicators
  - Student Requests Review Panel
  - Audit Trail Table
- **Synthetic Demonstration Visuals (Prominently Labeled):**
  - Payment Screenshot: `artifacts/task4_video/demo_payment_screenshot.png` (`DEMO — NOT A REAL PAYMENT`)
  - Bank Settlement Ledger Fixture (`SBI Settlement Batch Demo Fixture`)
  - Test Candidate Profiles (Student A, Student B, Student C, Student D)
