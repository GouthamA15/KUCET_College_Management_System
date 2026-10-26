# KUCET College Management System
## Staff Operational Training Guide — Payment Verification & Fraud Prevention

**Target Audience:** Admission Clerks, Admission Cell Staff, Verification Faculty, Department Coordinators, and Principals  
**System Module:** `/admin/payments` & `/staff/admission/requests`  
**Video File:** `artifacts/task4_video/kucet_payment_fraud_training.mp4`  
**Captions Subtitles:** `artifacts/task4_video/captions.srt` & `captions.vtt`  

---

### 1. Training Purpose & Institutional Context

Every academic admission cycle at KU College of Engineering & Technology involves substantial student fee collection, including SFC tuition fees (₹70,000/year), Non-SFC tuition fees (₹35,000/year), and certificate fees (₹500). 

With widespread adoption of digital UPI payments, students frequently submit screenshots of transaction receipts as proof of payment. However:
1. **Screenshots are easily manipulated:** Dozens of mobile apps and image editors can generate authentic-looking payment receipts in seconds.
2. **Screenshots are easily reused:** An unscrupulous candidate or agent can submit a receipt paid by an earlier student.
3. **Data entry errors occur:** Candidates frequently confuse a UPI ID handle (e.g., `user@okaxis`) with a 12-digit bank reference number (UTR).

**The Inviolable Institutional Rule:**
> **A payment screenshot is evidence to review, never proof that money was received in the university account.**

---

### 2. Video Playback & Presentation Instructions

The generated training video is stored at:
`artifacts/task4_video/kucet_payment_fraud_training.mp4`

#### Option A: Playing with VLC Media Player (Recommended)
1. Open VLC Media Player.
2. Drag and drop `kucet_payment_fraud_training.mp4` into VLC.
3. Subtitles are auto-loaded from `captions.srt` (or select `Subtitle` → `Add Subtitle File...` → select `captions.srt`).
4. Ensure volume is adjusted to a comfortable listening level for the lecture hall or conference room.

#### Option B: Playing via Web Browser (Chrome / Edge / Firefox)
1. Open any modern web browser.
2. Press `Ctrl + O` and select `kucet_payment_fraud_training.mp4`.
3. The video features native high-definition 1080p resolution and clear English narration.

---

### 3. Key Discussion Points for Session Facilitators

#### Segment 1: Why Visual Checkmarks Are Insufficient
- Explain that mock payment generators can mimic Google Pay, PhonePe, and Paytm receipts down to the pixel.
- Emphasize: Never approve an admission simply because the student shows a green checkmark or "Payment Successful".

#### Segment 2: Anatomy of a UPI Transaction Reference
- Explain the 12-digit numeric UTR (Unique Transaction Reference) / RRN issued by the remitter's bank.
- Contrast UTR with Virtual Payment Addresses (VPAs).

#### Segment 3: The 4 Test Scenarios
- **Scenario 1:** Genuine payment matched against State Bank of India direct settlement ledger → Status: `VERIFIED`.
- **Scenario 2:** Reused screenshot from Student A + UTR pasted into UPI ID field → Flags: `EXACT_IMAGE_DUPLICATE` & `IDENTIFIER_TYPE_MISMATCH` → Status: `NEEDS_REVIEW` (Student A PII protected).
- **Scenario 3:** Cropped screenshot (SHA-256 changes) → 64-bit dHash detects 88% visual similarity → Flag: `PERCEPTUAL_IMAGE_MATCH` → Status: `NEEDS_REVIEW`.
- **Scenario 4:** Cropped screenshot showing UTR 428190123456, but candidate entered 428190123499 → Native OCR extracts text and detects contradiction → Flag: `OCR_DISCREPANCY` → Status: `NEEDS_REVIEW`.

---

### 4. Staff Operational Checklist Handout

Keep this 7-point checklist pinned beside every admission verification terminal:

- [ ] **Check 1: Application Record:** Is the correct candidate profile open?
- [ ] **Check 2: Fee Amount:** Does the expected fee match the student's category (SFC / Non-SFC / Bonafide)?
- [ ] **Check 3: Identifier Format:** Is the reference a 12-digit bank UTR number and not a UPI VPA?
- [ ] **Check 4: Visual Agreement:** Does the uploaded screenshot visibly display the entered reference number?
- [ ] **Check 5: Integrity Flags:** Has the system raised any duplicate screenshot, perceptual match, or OCR discrepancy alerts?
- [ ] **Check 6: Bank Corroboration:** Has the payment been matched against the official university bank settlement report?
- [ ] **Check 7: Audit Documentation:** Have you entered the bank settlement date and sequence number in the decision notes?

---

### 5. Escalation & Support Contacts

For payment discrepancies or technical assistance during admission counseling:
- **Admission Cell Office:** Administrative Block, Room 104 (`admissions@kucet.ac.in`)
- **Finance & Accounts Officer:** Accounts Wing, Room 112
- **College IT Support:** `it.support@kucet.ac.in`
