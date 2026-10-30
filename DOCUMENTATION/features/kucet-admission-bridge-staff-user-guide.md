# KUCET Admission Bridge
## Staff Installation and User Guide

**Purpose:** Transfer student admission information from KUCET CMS to the Kakatiya University Online admission portal using the Chrome extension.

---

## 1. What does this extension do?

KUCET Admission Bridge helps admission staff transfer student information from the college system into the university admission portal.

It helps populate:

- College admission information.
- Student photograph and signature.
- Personal and family details.
- Date of birth and demographic information.
- Residential address.
- Annual income and other relevant details.

The extension reduces repetitive manual entry. Staff must still verify the information and manually submit the university form.

**Important:** The extension never automatically submits or finalizes a university admission.

---

## 2. What do you need?

Before starting, make sure you have:

1. A computer with Google Chrome.
2. The KUCET Admission Bridge extension installed.
3. Your existing KUCET CMS staff login credentials.
4. Your authorized admission staff account.
5. Access to the KU Online admission portal.

You do not need to open or log into the KUCET CMS website separately before using the extension. You can authenticate directly through the extension.

---

## 3. Installing the extension

The administrator will provide the approved extension folder.

1. Open Google Chrome.
2. Enter `chrome://extensions` in the address bar.
3. Press Enter.
4. Enable **Developer mode** if the administrator has provided an unpacked extension.
5. Click **Load unpacked**.
6. Select the folder containing the extension's `manifest.json` file.
7. Confirm that KUCET Admission Bridge appears in your installed extensions.
8. Pin the extension to the Chrome toolbar for easy access, if desired.

**Note:** Follow the administrator's instructions for the officially distributed extension package. Do not install an unofficial or modified copy.

---

## 4. Opening the extension and signing in

1. Open Google Chrome.
2. Click the KUCET Admission Bridge extension icon.
3. The extension side panel will open.
4. If you are not signed in, you will see the Sign In screen.
5. Enter your existing KUCET CMS staff username/email.
6. Enter your existing KUCET CMS password.
7. Click **Sign In**.
8. Wait for authentication to complete.

After successful sign-in, the extension checks whether your account is authorized to use the Admission Bridge.

If your account does not have the required permission, contact the CMS administrator.

**Security reminders:**
- Never share your password with another staff member.
- Do not save your password in an unofficial document.
- Sign out when you finish using the extension on a shared computer.

---

## 5. First-time tutorial

When you sign in for the first time, the extension displays a welcome screen.

You will see two options:

- **Start Tutorial:** Learn how the extension works step by step.
- **Skip Tutorial:** Go directly to the Admission Bridge workspace.

We recommend completing the tutorial once before processing real student records.

The tutorial covers:

1. Welcome and purpose of the extension.
2. Sign-in and session safety.
3. Understanding the workspace.
4. Finding a student.
5. Admission Information and student media.
6. Primary Details and income mapping.
7. Verification and staff responsibilities.
8. Final checklist.

The tutorial uses a fake demonstration student. It does not fetch real student information or fill the live university portal.

You can replay the tutorial at any time using the **Tutorial** option in the extension header.

---

## 6. Opening the KU Online admission portal

After signing in:

1. Open a new Chrome tab.
2. Navigate to:

   `https://kuonline.co.in/BTechsql/Btechreg.aspx`

3. Sign in to the university portal using the official credentials provided to you.
4. Open the appropriate student registration/admission page.
5. Open the KUCET Admission Bridge extension side panel.
6. Check that the extension recognizes the university portal page.

If the extension does not recognize the page, verify that you opened the correct KU Online registration page.

---

## 7. Finding a student

1. Locate the student search field in the extension.
2. Enter the student's correct roll number.
3. Click **Fetch**.
4. Wait for the student information to load.
5. Verify the student's name and roll number displayed in the identity banner.

**Very important:** Always confirm the student name and roll number before continuing. Do not process another student using the previous student's information.

If the student is not found, check the roll number and try again.

---

## 8. Step 1 – Admission Information

After fetching the student, review the Admission Information section.

Check the available details, including:

- College admission number.
- Academic scheme.
- Branch information.
- Student photograph.
- Student signature.

Check the photograph and signature previews.

The extension automatically optimizes the images before transferring them. It currently applies an internal safety limit of 190 KiB (194,560 bytes) to each image.

If an image is marked as needing attention, do not continue as though it were ready. Contact the administrator or follow the displayed instructions.

When the details are correct:

1. Open the corresponding Admission Information section in KU Online.
2. Click the extension's **Fill KU Online Admission Info (Step 1)** action.
3. Wait for the operation to finish.
4. Inspect the populated university form.

---

## 9. Step 2 – Primary Details

Navigate to the Primary Details section of the KU Online portal.

Review the details available in the extension, including:

- Student's full name.
- Father's name.
- Mother's name.
- Date of birth.
- Place of birth.
- Blood group.
- Gender.
- Local/non-local status.
- Address.
- Aadhaar and contact number.
- Nationality.
- Religion.
- Mother tongue.
- Social category and sub-caste.
- Father's occupation.
- Annual income.

When ready:

1. Click **Populate KU Online Primary Details**.
2. Wait for the operation to finish.
3. Inspect the fields populated in the university portal.

### Important income mapping

The extension uses the following institutional mapping:

| Annual income selected in CMS | KU Online value |
|---|---:|
| Less than 1,00,000 | 50000 |
| 1,00,001 - 2,50,000 | 100001 |
| 2,50,001 - 5,00,000 | 250001 |
| 5,00,001 - 8,00,000 | 500001 |
| Above 8,00,000 | 800001 |

If income information is missing or uncertain, review it manually. Do not guess.

### Email field

The student's email ID is intentionally excluded from automatic filling as per institutional instructions.

The extension will leave the university portal's email field untouched.

### Permanent address

The extension uses the same-address checkbox behaviour to copy the current address into the permanent address.

Always verify that the permanent address has actually been populated correctly.

---

## 10. Final verification – Most important

Before submitting anything, carefully inspect the university form.

Use this checklist:

- [ ] Correct student name.
- [ ] Correct roll number.
- [ ] Correct college admission number.
- [ ] Correct branch and scheme.
- [ ] Correct photograph.
- [ ] Correct signature.
- [ ] Correct personal details.
- [ ] Correct date of birth.
- [ ] Correct family details.
- [ ] Correct gender and demographic information.
- [ ] Correct current address.
- [ ] Correct permanent address.
- [ ] Correct contact and identity information.
- [ ] Correct annual income.
- [ ] Email field left untouched.
- [ ] No missing or incorrect information.

If any field is incorrect or missing, correct it manually before proceeding.

**Final submission is always the responsibility of authorized admission staff. The extension does not automatically click the university submit button.**

---

## 11. Signing out

When you have finished:

1. Open the extension side panel.
2. Click **Logout**.
3. Wait until the Sign In screen appears.

If your session expires while working, the extension will ask you to sign in again.

After signing in again, verify the active student and university page before continuing.

---

## 12. Common problems and what to do

| Problem | What you should do |
|---|---|
| Sign-in unsuccessful | Check your username and password. Contact the administrator if the problem continues. |
| Access denied | Your account may not have the required role. Contact the CMS administrator. |
| Session expired | Sign in again through the extension. |
| Student not found | Verify the roll number and try again. |
| KU Online page not detected | Open the correct university registration page. |
| Photograph/signature needs attention | Contact the administrator or review the image. |
| Some details are missing | Verify and enter the missing information manually. |
| University portal not responding | Wait and try again later. |
| Extension is not opening | Refresh Chrome or contact the administrator. |

---

## 13. Important rules for admission staff

1. Always use your own authorized staff account.
2. Never share your login credentials.
3. Verify the roll number and student's name before filling the form.
4. Review all automatically populated information.
5. Never assume that a field was populated correctly just because the extension reports completion.
6. Verify photographs and signatures.
7. Do not guess missing information.
8. Leave the email field untouched.
9. Never submit a university admission form without reviewing it.
10. Log out when finished, especially on shared computers.

---

## Quick workflow

**Open Chrome → Open Admission Bridge → Sign In → Complete or Skip Tutorial → Open KU Online → Find Student → Review Admission Information → Fill Step 1 → Review Primary Details → Fill Step 2 → Verify Everything → Manually Submit.**

**Remember:** KUCET Admission Bridge assists admission staff. The final responsibility for verifying and submitting each admission remains with authorized staff.
