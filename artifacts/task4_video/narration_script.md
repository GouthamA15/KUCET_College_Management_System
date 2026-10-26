# KUCET CMS Payment Evidence Verification & Fraud Prevention
## Staff Training Video Narration Script (Comprehensive 12-Scene Master)

---

### Scene 1: Introduction (00:00 - 00:45)
**Visual:** KUCET College Header with emblem, Kakatiya University Navy and Gold branding. Title card: "Payment Evidence Verification and Fraud Prevention — Staff Operational Training".  
**Speaker:** Senior Technical & Academic Training Specialist  
**Narration:**  
"Welcome to the official payment verification and fraud prevention training for the KUCET College Management System. Every academic semester, Kakatiya University College of Engineering and Technology processes thousands of admission applications, certificate requests, and fee transactions. Verifying these payments with rigor and speed is essential to protecting university funds and ensuring equity for genuine students. 

However, digital transaction screenshots and reference numbers can be accidentally entered incorrectly, submitted in duplicate, or deliberately altered using image-editing software. The KUCET CMS includes an intelligent fraud-detection and evidence-guard subsystem designed to assist staff in detecting inconsistencies. 

Most importantly, our foundational institutional rule is this: a payment screenshot submitted by a student is evidence to review, never definitive proof that money was received in the university bank account. Let us walk through the complete verification workflow."

---

### Scene 2: The Payment-Verification Workflow (00:45 - 01:30)
**Visual:** Clean, interactive multi-step workflow diagram highlighting six sequential phases: Student Submission → Format Validation → Duplicate & Perceptual Hashing → OCR & Cross-Field Consistency → Authoritative Reconciliation → Staff Review & Audit Trail.  
**Narration:**  
"The payment verification lifecycle operates through six well-defined operational phases. 

First, the student completes an admission or certificate application, uploads a payment receipt screenshot, and enters their transaction reference. 

Second, the system performs strict format validation to ensure that 12-digit bank UTR numbers are not confused with UPI Virtual Payment Addresses. 

Third, our layered hash engine calculates both an exact cryptographic SHA-256 hash and a perceptual Difference Hash to catch reused, cropped, or recompressed images. 

Fourth, native optical character recognition extracts visible text and compares it against entered numbers and expected fees. 

Fifth, the transaction is cross-referenced against authoritative bank settlement files. If verified by the bank, it receives confirmation. 

Finally, if any discrepancy or lack of external proof exists, the record enters the Staff Review Queue with clear, explainable risk indicators. Let us now examine how to inspect a submitted payment screenshot."

---

### Scene 3: Examine a Payment Screenshot (01:30 - 02:30)
**Visual:** High-resolution demonstration screenshot prominently labeled `DEMO — NOT A REAL PAYMENT`, displaying numbered callouts 1 through 4 pointing to Status, Amount, UTR, and Payee.  
**Narration:**  
"Here is a demonstration payment screenshot, prominently marked as synthetic evidence for training purposes. When reviewing evidence submitted by a candidate, staff must inspect four critical areas. 

First, examine Callout One: the displayed payment status. While a green checkmark or the word 'Successful' looks reassuring, mock UPI payment generator apps can easily fabricate this screen in seconds. Never rely on the visual status alone. 

Second, examine Callout Two: the displayed amount. Confirm that the amount matches the exact fee required for the applicant's category or certificate. 

Third, examine Callout Three: the 12-digit Bank Reference or UTR Number. In India, genuine UPI transactions generate a 12-digit numeric reference issued by the remitter's bank. Verify this number carefully. 

Fourth, inspect Callout Four: the beneficiary name. Ensure the money was transferred to 'Principal KU College of Engineering and Technology', and not to a personal account. Remember: even a visually perfect screenshot only establishes what the student claims happened. Authoritative verification must follow."

---

### Scene 4: Correct Submission by a Student (02:30 - 03:15)
**Visual:** Actual KUCET CMS Certificate Payment Portal (/student/requests/certificates) displaying certificate selection, institutional eligibility, official UPI payment details, QR code ('SCAN & PAY'), official payee ('PRINCIPAL KU COLLEGE OF ENGINEERING AND TECHNOLOGY'), fee amount, 12-digit UTR input field, and payment screenshot upload preview.  
**Narration:**  
"Let us see how a genuine, error-free submission proceeds. 

When a candidate makes a payment, they scan the official KUCET College QR code or transfer to the college UPI ID. They then upload their genuine receipt and enter the 12-digit UTR into the transaction reference field. 

The system validates the input, generates the image fingerprint, and assigns an initial status of 'SUBMITTED' or 'NEEDS_REVIEW'. Notice that the system deliberately does not mark the payment 'VERIFIED' immediately upon upload. The application is placed in the admissions staff queue, awaiting official bank ledger matching or manual reconciliation by an authorized admission officer."

---

### Scene 5: Test Case 1 — Genuine Payment Evidence (03:15 - 04:15)
**Visual:** Student A record: Genuine screenshot, entered UTR 428190123456, expected fee ₹500, authoritative bank ledger fixture confirming transaction matching beneficiary and amount. Status transitions to `VERIFIED`.  
**Narration:**  
"Now let us study our first mandatory test scenario: Student A, who has submitted genuine payment evidence. 

Student A uploaded a genuine SBI UPI payment screenshot for five hundred rupees with UTR 428190123456. The entered reference matches the screenshot perfectly, and the cryptographic hash is unique in our database. 

When our automated reconciliation engine connects to the authorized bank fixture, it discovers a matching settlement record confirmed by State Bank of India with the identical UTR and amount. 

Because authoritative external confirmation exists, the status transitions to 'VERIFIED'. Staff can view the verified badge and external bank reference in the dashboard. If external bank data were temporarily unavailable, the system would keep the record in 'NEEDS_REVIEW' rather than guessing."

---

### Scene 6: Test Case 2 — Reused Screenshot & Field Mismatch (04:15 - 05:15)
**Visual:** Student B record: Duplicate screenshot uploaded; Candidate enters 12-digit UTR into the UPI ID field. System flags `EXACT_IMAGE_DUPLICATE` and `IDENTIFIER_TYPE_MISMATCH`. Privacy masking hides Student A details.  
**Narration:**  
"Our second mandatory scenario features Student B. In this case, Student B uploaded the exact same screenshot previously submitted by Student A, and entered a 12-digit transaction ID into the field designated for their UPI ID handle. 

The system's integrity engine immediately flags two explainable risk indicators. 

First, it detects an 'Identifier Type Mismatch', alerting staff that a 12-digit bank reference was entered into a field requiring a UPI address like name@bank. 

Second, the cryptographic SHA-256 fingerprint matches an existing submission on record. 

Notice how our system protects privacy: the alert explains that a duplicate screenshot was detected on another record, without exposing Student A's name, roll number, or private information to unauthorized parties. The record is flagged for manual review, allowing staff to investigate whether this is an accidental re-upload or fraudulent claim."

---

### Scene 7: Test Case 3 — Cropped Reused Screenshot (05:15 - 06:15)
**Visual:** Student C record: Cropped version of Student A screenshot (header banner removed). Comparison card shows SHA-256 mismatch, but Perceptual Hash (dHash) detects 88% visual similarity.  
**Narration:**  
"In our third mandatory scenario, Student C attempts to bypass detection by cropping the top and bottom headers of Student A's screenshot before uploading it with the original transaction reference. 

Notice an important technical reality: because pixels were cropped, the byte-for-byte SHA-256 hash changes completely. A primitive system relying solely on cryptographic hashes would fail to detect this duplicate. 

However, the KUCET CMS computes a 64-bit perceptual difference hash using structural pixel gradients. Even after cropping and compression, the perceptual comparison detects an eighty-eight percent visual similarity with prior evidence on file. 

The system flags 'Perceptual Image Match' and warns staff that this evidence strongly resembles an earlier submission. The payment is held in 'NEEDS_REVIEW', prompting staff to inspect both images."

---

### Scene 8: Test Case 4 — Cropped Screenshot with Altered Reference (06:15 - 07:15)
**Visual:** Student D record: Cropped screenshot showing UTR 428190123456, but candidate entered UTR 428190123499. System OCR extracts visible text and highlights discrepancy.  
**Narration:**  
"Our fourth mandatory scenario demonstrates a deceptive submission. Student D submits a cropped screenshot that visually displays UTR 428190123456, but in the application form, Student D enters a slightly altered reference: 428190123499. 

Our native optical character recognition engine reads the visible text directly from the receipt image. It extracts the visible reference number 428190123456 and compares it against the entered reference 428190123499. 

The system flags an 'OCR Discrepancy' warning, clearly explaining to staff that the entered number contradicts the text visible on the image. 

The system also flags that no bank settlement exists for the entered number. The submission is routed to manual review with an elevated risk score, allowing admissions staff to inspect the discrepancy directly."

---

### Scene 9: Staff Review & Decision Workflow (07:15 - 08:30)
**Visual:** Admission staff console: Opening transaction modal, reviewing high-resolution screenshot viewer, examining risk warning banner, selecting 'Confirm via SBI Bank Statement', recording reason, and checking audit history.  
**Narration:**  
"Now let us examine how authorized admission staff review and resolve these records. 

An authorized officer opens the transaction details modal. If the record has been flagged, a clear Amber Alert banner displays the exact risk indicators, such as duplicate UTR, perceptual match, or format mismatch. 

Staff can click 'View Screenshot' to inspect the full receipt in our secure image viewer. 

Next, the officer consults the university's daily bank statement or official gateway portal. 

If the payment is confirmed in the bank statement, the officer records the verification method as 'Manual Bank Statement Reconciliation', enters the bank transaction date, and marks the status as 'VERIFIED'. 

If the payment cannot be found or evidence is clearly forged, the officer selects 'REJECTED' and enters a mandatory reason. Every action is permanently recorded in the immutable audit log with staff ID, timestamp, and IP address."

---

### Scene 10: Common Mistakes to Avoid (08:30 - 09:30)
**Visual:** Animated 'Do's and Don'ts' slide with highlighted danger icons and operational rules.  
**Narration:**  
"As admission staff, avoid these nine common pitfalls: 

First, never approve a payment solely because the screenshot looks clean or professional. 

Second, never assume an entered transaction reference proves funds arrived without bank confirmation. 

Third, do not treat every duplicate warning as intentional fraud; it could be a student re-submitting an application after an initial network failure. Always investigate. 

Fourth, do not reject a candidate simply because an external bank portal is temporarily down. Mark the record as 'NEEDS_REVIEW' and retry later. 

Fifth, do not confuse a UPI handle with a bank reference number. 

Sixth, always check for fee amount mismatches. 

Seventh, never leave an approval decision undocumented. 

Eighth, never share candidate payment receipts containing personal banking details across unencrypted channels. 

And ninth, never mark an application verified without establishing an authoritative source."

---

### Scene 11: Staff Operational Checklist (09:30 - 10:15)
**Visual:** Clear, high-contrast 7-point operational checklist with interactive checkboxes.  
**Narration:**  
"Before approving any admission or certificate payment, follow this concise seven-point checklist: 

Number One: Is the correct student application record open? 

Number Two: Does the fee amount match the candidate's course and category? 

Number Three: Is the transaction reference in the correct format? 

Number Four: Does the screenshot agree with all entered details? 

Number Five: Are there any duplicate screenshot or perceptual match warnings? 

Number Six: Has the payment been matched against the official university bank statement or gateway settlement report? 

And Number Seven: Have you recorded the verification method and reason in the decision log? 

If all seven answers are satisfactory, you may confidently finalize the verification."

---

### Scene 12: Conclusion (10:15 - 11:00)
**Visual:** Kakatiya University College of Engineering & Technology crest, gold and navy title card: "Payment Verification — Staff Operational Training", contact information for Admission Cell and IT Support.  
**Narration:**  
"In conclusion, remember our guiding institutional principle: 'A screenshot is evidence to review, not proof of money received.' 

By combining the KUCET CMS fraud-detection engine with conscientious human oversight, we maintain institutional transparency, protect student interests, and safeguard the financial integrity of Kakatiya University College of Engineering and Technology. 

Thank you for your dedication to institutional excellence. For questions or system support, please contact the Admission Cell or College IT Office."
