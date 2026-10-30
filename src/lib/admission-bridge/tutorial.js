/**
 * KUCET Admission Bridge — Interactive Tutorial Engine & Specifications.
 * 
 * Provides an 8-step onboarding and interactive guided tour for admission staff.
 * Uses 100% fake mock demonstration data isolated from real student records or portal forms.
 */

export const TUTORIAL_STORAGE_KEY = 'kucet_bridge_tutorial_completed';
export const TOTAL_TUTORIAL_STEPS = 8;

/**
 * 100% Fake Static Mock Student for Tutorial Demonstrations.
 * Strictly non-PII, synthetic mock values.
 */
export const TUTORIAL_DEMO_STUDENT = Object.freeze({
  name: 'DEMO STUDENT (TUTORIAL MODE)',
  rollNo: '26567T0000',
  admissionNo: '26-567-000',
  admissionType: 'Regular',
  portalBranch: 'COMPUTER SCIENCE & ENGINEERING',
  cmsBranch: 'CSE',
  scheme: '2013',
  formattedAdmissionDate: '01/08/2026',
  previousStudying: 'TS INTERMEDIATE',
  warnings: [],
  primaryDetails: Object.freeze({
    fatherName: 'DEMO FATHER',
    motherName: 'DEMO MOTHER',
    dateOfBirth: '15/05/2005',
    dobComponents: Object.freeze({ day: '15', month: '05', monthName: 'MAY', year: '2005' }),
    gender: 'MALE',
    bloodGroup: 'O+',
    location: 'LOCAL',
    nationality: 'INDIAN',
    socialStatus: 'BC-B',
    subCaste: 'DEMO SUBCASTE',
    aadhaarNumber: '999988887777',
    contactNumber: '9876543210',
    incomeRange: '1,00,001 - 2,50,000',
    portalIncome: 100001,
    currentAddress: 'H.No 1-2-3, Demo Colony, Warangal, 506009',
  }),
  photo: Object.freeze({
    filename: '26567T0000_photo.jpg',
    sizeBytes: 135400, // ~132 KiB (Safely below 194,560 bytes)
    isSimulated: true,
  }),
  signature: Object.freeze({
    filename: '26567T0000_sign.jpg',
    sizeBytes: 74200, // ~72 KiB (Safely below 194,560 bytes)
    isSimulated: true,
  }),
});

/**
 * 8 Authoritative Tutorial Step Definitions
 */
export const TUTORIAL_STEPS = Object.freeze([
  {
    step: 1,
    id: 'welcome',
    badge: 'Getting Started',
    title: 'Welcome to KUCET Admission Bridge',
    subtitle: 'Assisted university registration for KUCET admission staff',
    description: 'This extension eliminates manual double-entry by transferring verified student admission data from KUCET CMS directly into the Kakatiya University Online B.Tech registration portal.',
    keyPoints: [
      'Two-step assisted workflow: Admission Info (Step 1) & Primary Details (Step 2)',
      'Automated client-side image compression: Photographs and signatures prepared below conservative limits',
      'Mandatory human verification: The extension never automatically submits the university form',
    ],
    callout: 'Safe & Secure: Operates entirely under staff supervision with verified institutional rules.',
  },
  {
    step: 2,
    id: 'auth_safety',
    badge: 'Authentication',
    title: 'Sign In & Session Safety',
    subtitle: 'Official KUCET credentials with zero password persistence',
    description: 'Sign in directly within the extension using your existing KUCET CMS employee email and password. No separate account or parallel identity system is used.',
    keyPoints: [
      'RBAC Enforced: Only authorized Admission Staff and Administrators may access bridge records',
      'Zero Credential Storage: Passwords are used solely for the login handshake and never saved',
      'Session Expiry & Silent Refresh: Tied to your active CMS identity with graceful expiry handling',
    ],
    callout: 'Tip: You do not need to keep the KUCET website open in another browser tab to use the bridge.',
  },
  {
    step: 3,
    id: 'workspace',
    badge: 'Navigation',
    title: 'Understanding the Workspace',
    subtitle: 'Unified side panel layout with live connection detection',
    description: 'The extension workspace presents everything you need in an intuitive, single-action hierarchy.',
    keyPoints: [
      'Status Bar: Continuously displays CMS session health and active KU Online tab detection',
      'Workflow Stepper: Highlights your current progress across the admission transfer sequence',
      'Search & Identity Cards: Fast lookup with prominent student identity confirmation',
    ],
    callout: 'Look for the green indicator dot confirming the KU Online Btechreg.aspx tab is active.',
  },
  {
    step: 4,
    id: 'student_lookup',
    badge: 'Student Search',
    title: 'Finding a Student Record',
    subtitle: 'Automatic college admission number derivation',
    description: 'Enter a 10-character KUCET roll number (e.g. 26567T0332 or 26567T0001L) to load verified student data from CMS.',
    keyPoints: [
      'Regular Admission No: Derived as YY-567-XXX (e.g., 26-567-332)',
      'Lateral Admission No: Preserves trailing L (e.g., 26-567-001L)',
      'Always visually verify the student name and admission type badge before proceeding',
    ],
    callout: 'Accountability: Every student record access is logged in the CMS audit ledger.',
  },
  {
    step: 5,
    id: 'admission_info',
    badge: 'KU Online Step 1',
    title: 'Admission Info & Media Optimization',
    subtitle: 'Academic metadata and conservative 190 KiB image ceiling',
    description: 'Step 1 prepares academic enrollment data and converts photos/signatures into optimized JPEGs.',
    keyPoints: [
      'Academic Scheme: 2013 (institutionally verified for B.Tech)',
      'Branch Mapping: Officially mapped to portal names (e.g., CSD ➔ DATA SCIENCE)',
      '190 KiB Hard Ceiling: Both photo and signature are strictly compressed below 194,560 bytes',
      'Click "Fill KU Online Admission Info" to populate Step 1 fields in the university portal',
    ],
    callout: 'Images can also be downloaded individually if manual portal attachment is preferred.',
  },
  {
    step: 6,
    id: 'primary_details',
    badge: 'KU Online Step 2',
    title: 'Primary Details & 5-Tier Income',
    subtitle: 'Demographics, UTC-safe DOB, and institutional income mapping',
    description: 'Step 2 populates student personal information, parent names, social status, and address details.',
    keyPoints: [
      '5-Tier Income: Strictly mapped to numeric values (50000, 100001, 250001, 500001, 800001)',
      'UTC-Safe Date of Birth: Separated cleanly across Day, Month, and Year portal dropdowns',
      'Permanent Address: Automatically selects "Same as Current" checkbox on the portal',
      'Institutional Policy: Student personal email is strictly excluded from portal population',
    ],
    callout: 'Notice: Income "Less than 1,00,000" maps to 50000 per university institutional rules.',
  },
  {
    step: 7,
    id: 'verification_safeguard',
    badge: 'Verification Safeguard',
    title: 'Staff Oversight (Never Auto-Submits)',
    subtitle: 'Inviolable compliance rule for university registration',
    description: 'The KUCET Admission Bridge prepares and fills form fields, but will NEVER automatically submit a form to the university portal.',
    keyPoints: [
      'Visually inspect every field in the KU Online browser window',
      'Confirm that the photograph and signature appear correctly in portal file pickers',
      'Staff must manually click "Submit & Step2" or final submission buttons on the university site',
    ],
    callout: 'Human Responsibility: You remain the authoritative registrar verifying all submissions.',
  },
  {
    step: 8,
    id: 'completion',
    badge: 'Ready to Start',
    title: 'Checklist & Ready to Start',
    subtitle: 'You are now ready to transfer admissions with confidence',
    description: 'Keep these three golden rules in mind whenever transferring student records:',
    keyPoints: [
      '1. Open KU Online (Btechreg.aspx) in your active browser window',
      '2. Double-check student name and admission number before populating',
      '3. Visually verify portal contents before clicking submit on the university page',
    ],
    callout: 'Need a refresher? Click the "Tutorial" button in the extension header anytime to replay.',
  },
]);

/**
 * Creates an initial tutorial state
 * @param {number} initialStep - 1 to 8 (default 1)
 */
export function createTutorialState(initialStep = 1) {
  const boundedStep = Math.max(1, Math.min(initialStep, TOTAL_TUTORIAL_STEPS));
  return {
    currentStep: boundedStep,
    totalSteps: TOTAL_TUTORIAL_STEPS,
    isCompleted: false,
    stepData: TUTORIAL_STEPS[boundedStep - 1],
  };
}

/**
 * Advances tutorial to next step
 * @param {Object} state
 * @returns {Object} Updated tutorial state
 */
export function tutorialNext(state) {
  if (state.currentStep >= TOTAL_TUTORIAL_STEPS) {
    return {
      ...state,
      isCompleted: true,
    };
  }
  const nextStep = state.currentStep + 1;
  return {
    ...state,
    currentStep: nextStep,
    isCompleted: false,
    stepData: TUTORIAL_STEPS[nextStep - 1],
  };
}

/**
 * Goes back to previous tutorial step
 * @param {Object} state
 * @returns {Object} Updated tutorial state
 */
export function tutorialBack(state) {
  if (state.currentStep <= 1) {
    return state;
  }
  const prevStep = state.currentStep - 1;
  return {
    ...state,
    currentStep: prevStep,
    isCompleted: false,
    stepData: TUTORIAL_STEPS[prevStep - 1],
  };
}

/**
 * Jumps to specific step
 * @param {Object} state 
 * @param {number} stepNumber 
 */
export function tutorialGoTo(state, stepNumber) {
  const target = Math.max(1, Math.min(stepNumber, TOTAL_TUTORIAL_STEPS));
  return {
    ...state,
    currentStep: target,
    isCompleted: target === TOTAL_TUTORIAL_STEPS && state.isCompleted,
    stepData: TUTORIAL_STEPS[target - 1],
  };
}

/**
 * Marks tutorial as completed
 * @param {Object} state 
 */
export function tutorialFinish(state) {
  return {
    ...state,
    isCompleted: true,
  };
}

/**
 * Calculates progress percentage (12.5% to 100%)
 * @param {number} currentStep 
 * @returns {number} Percentage from 12.5 to 100
 */
export function getTutorialProgressPercent(currentStep) {
  const step = Math.max(1, Math.min(currentStep, TOTAL_TUTORIAL_STEPS));
  return Math.round((step / TOTAL_TUTORIAL_STEPS) * 100);
}
