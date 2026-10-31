/* global chrome */
/**
 * Side Panel Controller for KUCET Admission Bridge Chrome Extension.
 * Handles standalone staff authentication, interactive tutorial mode,
 * student retrieval, native client-side JPEG optimization (< 190 KiB), and portal form transfer.
 */

// Configuration Defaults
// Supports local development and production CMS origins (kucet.tech and kucet.in)
const CMS_BASE_URL = window.location.origin.includes('localhost') 
  ? 'http://localhost:3000' 
  : (window.location.origin.includes('kucet.in') ? 'https://kucet.in' : 'https://kucet.tech');

// Browser Adapter Singleton
const browserAdapter = typeof window !== 'undefined' && window.KUCET_ADAPTER
  ? window.KUCET_ADAPTER.createBrowserAdapter(window)
  : null;

// Centralized Conservative Image Upload Limit Constants
// University portal assumes ~200 KB upload limit.
// Conservative hard ceiling: 190 KiB = 194,560 bytes
const MAX_PORTAL_IMAGE_BYTES = 194560; // 190 KiB (194,560 bytes)

// State
let authUser = null;
let tutorialState = null;
let currentStudent = null;
let optimizedPhoto = null;
let optimizedSignature = null;

// DOM Elements — Views
const authView = document.getElementById('authView');
const tutorialView = document.getElementById('tutorialView');
const workspaceView = document.getElementById('workspaceView');

// Header Elements
const tutorialBtn = document.getElementById('tutorialBtn');
const logoutBtn = document.getElementById('logoutBtn');
const staffIdentityBadge = document.getElementById('staffIdentityBadge');

// Status Bar Elements
const cmsDot = document.getElementById('cmsDot');
const cmsStatusText = document.getElementById('cmsStatusText');
const portalDot = document.getElementById('portalDot');
const portalStatusText = document.getElementById('portalStatusText');

// Auth Form Elements
const loginForm = document.getElementById('loginForm');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const signInBtn = document.getElementById('signInBtn');
const signInBtnText = document.getElementById('signInBtnText');
const authErrorAlert = document.getElementById('authErrorAlert');
const authInfoAlert = document.getElementById('authInfoAlert');

// Stepper & Active Banner
const stepAuth = document.getElementById('stepAuth');
const stepSearch = document.getElementById('stepSearch');
const stepAdmission = document.getElementById('stepAdmission');
const stepPrimary = document.getElementById('stepPrimary');
const stepReview = document.getElementById('stepReview');

const activeStudentBanner = document.getElementById('activeStudentBanner');
const bannerStudentName = document.getElementById('bannerStudentName');
const bannerStudentMeta = document.getElementById('bannerStudentMeta');
const bannerTypeBadge = document.getElementById('bannerTypeBadge');

// Tutorial Elements
const tutorialStepBadge = document.getElementById('tutorialStepBadge');
const tutorialStepId = document.getElementById('tutorialStepId');
const tutorialProgressFill = document.getElementById('tutorialProgressFill');
const tutorialTitle = document.getElementById('tutorialTitle');
const tutorialSubtitle = document.getElementById('tutorialSubtitle');
const tutorialDesc = document.getElementById('tutorialDesc');
const tutorialPoints = document.getElementById('tutorialPoints');
const tutorialCallout = document.getElementById('tutorialCallout');
const tutorialSkipBtn = document.getElementById('tutorialSkipBtn');
const tutorialBackBtn = document.getElementById('tutorialBackBtn');
const tutorialNextBtn = document.getElementById('tutorialNextBtn');

// Search & Workspace Elements
const rollInput = document.getElementById('rollInput');
const fetchBtn = document.getElementById('fetchBtn');
const fetchBtnText = document.getElementById('fetchBtnText');
const searchError = document.getElementById('searchError');
const studentCard = document.getElementById('studentCard');
const fillFormBtn = document.getElementById('fillFormBtn');
const fillBtnText = document.getElementById('fillBtnText');
const fillResultAlert = document.getElementById('fillResultAlert');

// Display Header Elements
const dispName = document.getElementById('dispName');
const dispAdmissionTypeBadge = document.getElementById('dispAdmissionTypeBadge');
const warningsContainer = document.getElementById('warningsContainer');
const fillPrimaryBtn = document.getElementById('fillPrimaryBtn');
const fillPrimaryBtnText = document.getElementById('fillPrimaryBtnText');
const primaryResultAlert = document.getElementById('primaryResultAlert');

// Media Elements
const photoThumb = document.getElementById('photoThumb');
const photoFilename = document.getElementById('photoFilename');
const photoStats = document.getElementById('photoStats');
const photoBadge = document.getElementById('photoBadge');
const downloadPhotoBtn = document.getElementById('downloadPhotoBtn');
const retryPhotoBtn = document.getElementById('retryPhotoBtn');

const sigThumb = document.getElementById('sigThumb');
const sigFilename = document.getElementById('sigFilename');
const sigStats = document.getElementById('sigStats');
const sigBadge = document.getElementById('sigBadge');
const downloadSigBtn = document.getElementById('downloadSigBtn');
const retrySigBtn = document.getElementById('retrySigBtn');

let isRetryingPhoto = false;
let isRetryingSig = false;

// ==========================================
// INITIAL SETUP & EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  checkPortalTab();
  await checkAuthSession();
});

function setupEventListeners() {
  // Portal Tab monitoring
  if (chrome?.tabs?.onActivated) {
    chrome.tabs.onActivated.addListener(checkPortalTab);
  }
  if (chrome?.tabs?.onUpdated) {
    chrome.tabs.onUpdated.addListener(checkPortalTab);
  }

  // Auth View Events
  if (loginForm) {
    loginForm.addEventListener('submit', handleSignIn);
  }
  if (togglePasswordBtn && loginPassword) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPwd = loginPassword.type === 'password';
      loginPassword.type = isPwd ? 'text' : 'password';
      togglePasswordBtn.textContent = isPwd ? 'Hide' : 'Show';
    });
  }
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleSignOut);
  }

  // Header Tutorial Replay
  if (tutorialBtn) {
    tutorialBtn.addEventListener('click', () => startTutorial(1));
  }

  // Tutorial Navigation Events
  if (tutorialNextBtn) {
    tutorialNextBtn.addEventListener('click', handleTutorialNext);
  }
  if (tutorialBackBtn) {
    tutorialBackBtn.addEventListener('click', handleTutorialBack);
  }
  if (tutorialSkipBtn) {
    tutorialSkipBtn.addEventListener('click', handleTutorialSkip);
  }

  // Workspace Lookup & Transfer Events
  if (rollInput) {
    rollInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleFetchStudent();
    });
  }
  if (fetchBtn) {
    fetchBtn.addEventListener('click', handleFetchStudent);
  }
  if (fillFormBtn) {
    fillFormBtn.addEventListener('click', handleFillPortal);
  }
  if (fillPrimaryBtn) {
    fillPrimaryBtn.addEventListener('click', handleFillPrimaryDetails);
  }
  if (downloadPhotoBtn) {
    downloadPhotoBtn.addEventListener('click', () => triggerDownload(optimizedPhoto));
  }
  if (downloadSigBtn) {
    downloadSigBtn.addEventListener('click', () => triggerDownload(optimizedSignature));
  }
  if (retryPhotoBtn) {
    retryPhotoBtn.addEventListener('click', handleRetryAttachPhoto);
  }
  if (retrySigBtn) {
    retrySigBtn.addEventListener('click', handleRetryAttachSig);
  }

  const retryPortalBtn = document.getElementById('retryPortalBtn');
  if (retryPortalBtn) {
    retryPortalBtn.addEventListener('click', () => checkPortalTab(true));
  }
}

// ==========================================
// VIEW SWITCHER
// ==========================================
function switchView(viewName) {
  authView.classList.add('hidden');
  tutorialView.classList.add('hidden');
  workspaceView.classList.add('hidden');

  if (viewName === 'auth') {
    authView.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
  } else if (viewName === 'tutorial') {
    tutorialView.classList.remove('hidden');
    if (authUser) logoutBtn.classList.remove('hidden');
  } else if (viewName === 'workspace') {
    workspaceView.classList.remove('hidden');
    if (authUser) logoutBtn.classList.remove('hidden');
    if (rollInput) rollInput.focus();
  }
}

// ==========================================
// AUTHENTICATION CONTROLLER
// ==========================================
async function checkAuthSession() {
  setCMSStatus('checking', 'Checking Session...');

  try {
    const res = await fetch(`${CMS_BASE_URL}/api/staff/admission/bridge/session`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    if (res.status === 200) {
      const data = await res.json();
      authUser = data.user;
      setCMSStatus('active', `Active: ${authUser.name || authUser.email}`);

      if (staffIdentityBadge) {
        const staffName = authUser.name || (authUser.email ? authUser.email.split('@')[0] : 'Staff');
        staffIdentityBadge.textContent = staffName;
        staffIdentityBadge.classList.remove('hidden');
      }

      // Check if user has already completed the tutorial
      const isCompleted = await getTutorialCompletedFlag();
      if (!isCompleted) {
        startTutorial(1);
      } else {
        switchView('workspace');
      }
      return true;
    }

    if (res.status === 403) {
      authUser = null;
      setCMSStatus('error', 'Access Forbidden');
      showAuthError('Access restricted: Your account does not have Admission Staff privileges. Please log in with an authorized admission or admin account.');
      switchView('auth');
      return false;
    }

    // 401 or others: Prompt sign in
    authUser = null;
    setCMSStatus('amber', 'Sign In Required');
    switchView('auth');
    return false;
  } catch (_err) {
    authUser = null;
    setCMSStatus('error', 'CMS Unreachable');
    showAuthError(`Cannot connect to KUCET CMS (${CMS_BASE_URL}). Please verify your network connection.`);
    switchView('auth');
    return false;
  }
}

async function handleSignIn(e) {
  e.preventDefault();
  hideAuthAlerts();

  const email = (loginEmail.value || '').trim();
  const password = loginPassword.value || '';

  if (!email || !password) {
    showAuthError('Please enter both your staff email and password.');
    return;
  }

  // Clear password from memory and form immediately
  loginPassword.value = '';

  signInBtn.disabled = true;
  signInBtnText.innerHTML = '<span class="spinner"></span> Signing In...';

  try {
    const res = await fetch(`${CMS_BASE_URL}/api/auth/employee-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password, rememberMe: true })
    });

    const json = await res.json().catch(() => ({}));

    if (res.status === 401) {
      throw new Error('Invalid email or password. Please verify your KUCET CMS credentials.');
    }
    if (res.status === 403) {
      throw new Error(json.message || 'Account not active or insufficient privileges.');
    }
    if (res.status === 429) {
      throw new Error('Too many login attempts. Please wait a few minutes before trying again.');
    }
    if (!res.ok) {
      throw new Error(json.message || `Login failed (Status ${res.status}).`);
    }

    // Handshake successful, verify bridge session & role
    await checkAuthSession();
  } catch (err) {
    showAuthError(err.message);
  } finally {
    signInBtn.disabled = false;
    signInBtnText.textContent = 'Sign In to Admission Bridge';
  }
}

async function handleSignOut() {
  logoutBtn.disabled = true;
  try {
    await fetch(`${CMS_BASE_URL}/api/staff/admission/bridge/session`, {
      method: 'DELETE',
      credentials: 'include'
    }).catch(() => {});
  } finally {
    logoutBtn.disabled = false;
    authUser = null;
    currentStudent = null;
    optimizedPhoto = null;
    optimizedSignature = null;
    if (staffIdentityBadge) staffIdentityBadge.classList.add('hidden');
    resetWorkspaceData();
    setCMSStatus('amber', 'Signed Out');
    showAuthInfo('You have successfully signed out of KUCET Admission Bridge.');
    switchView('auth');
  }
}

function showAuthError(msg) {
  authErrorAlert.textContent = msg;
  authErrorAlert.classList.remove('hidden');
  authInfoAlert.classList.add('hidden');
}

function showAuthInfo(msg) {
  authInfoAlert.textContent = msg;
  authInfoAlert.classList.remove('hidden');
  authErrorAlert.classList.add('hidden');
}

function hideAuthAlerts() {
  authErrorAlert.classList.add('hidden');
  authInfoAlert.classList.add('hidden');
}

function setCMSStatus(state, text) {
  cmsStatusText.textContent = text;
  cmsDot.className = 'dot';
  if (state === 'active') cmsDot.classList.add('green');
  else if (state === 'checking' || state === 'amber') cmsDot.classList.add('amber');
  else if (state === 'error') cmsDot.classList.add('red');
}

// ==========================================
// INTERACTIVE TUTORIAL CONTROLLER
// ==========================================
async function getTutorialCompletedFlag() {
  if (browserAdapter) {
    const res = await browserAdapter.getStorage('kucet_bridge_tutorial_completed');
    return res === true || res === 'true';
  }
  try {
    if (chrome?.storage?.local) {
      const res = await chrome.storage.local.get('kucet_bridge_tutorial_completed');
      return !!res.kucet_bridge_tutorial_completed;
    }
    return localStorage.getItem('kucet_bridge_tutorial_completed') === 'true';
  } catch (_) {
    return false;
  }
}

async function setTutorialCompletedFlag(completed = true) {
  if (browserAdapter) {
    await browserAdapter.setStorage('kucet_bridge_tutorial_completed', completed);
    return;
  }
  try {
    if (chrome?.storage?.local) {
      await chrome.storage.local.set({ kucet_bridge_tutorial_completed: completed });
    } else {
      localStorage.setItem('kucet_bridge_tutorial_completed', String(completed));
    }
  } catch (_err) {
    // Storage write failed or unavailable
  }
}

function startTutorial(stepNumber = 1) {
  const engine = window.KUCET_TUTORIAL;
  if (!engine) {
    switchView('workspace');
    return;
  }

  tutorialState = engine.createTutorialState(stepNumber);
  renderTutorialStep();
  switchView('tutorial');
}

function renderTutorialStep() {
  if (!tutorialState) return;
  const engine = window.KUCET_TUTORIAL;
  const step = tutorialState.stepData;

  tutorialStepBadge.textContent = `Step ${step.step} of ${tutorialState.totalSteps}`;
  tutorialStepId.textContent = step.badge;
  
  const pct = engine.getTutorialProgressPercent(step.step);
  tutorialProgressFill.style.width = `${pct}%`;

  tutorialTitle.textContent = step.title;
  tutorialSubtitle.textContent = step.subtitle;
  tutorialDesc.textContent = step.description;
  tutorialCallout.textContent = step.callout;

  // Key points
  tutorialPoints.innerHTML = '';
  step.keyPoints.forEach((point) => {
    const li = document.createElement('li');
    li.textContent = point;
    tutorialPoints.appendChild(li);
  });

  // Buttons
  tutorialBackBtn.disabled = step.step <= 1;
  if (step.step === tutorialState.totalSteps) {
    tutorialNextBtn.textContent = 'Start Using Bridge';
    tutorialNextBtn.className = 'btn btn-success';
  } else {
    tutorialNextBtn.textContent = 'Next';
    tutorialNextBtn.className = 'btn btn-primary';
  }
}

function handleTutorialNext() {
  const engine = window.KUCET_TUTORIAL;
  if (!engine || !tutorialState) return;

  if (tutorialState.currentStep >= tutorialState.totalSteps) {
    finishTutorial();
    return;
  }

  tutorialState = engine.tutorialNext(tutorialState);
  renderTutorialStep();
}

function handleTutorialBack() {
  const engine = window.KUCET_TUTORIAL;
  if (!engine || !tutorialState) return;

  tutorialState = engine.tutorialBack(tutorialState);
  renderTutorialStep();
}

async function handleTutorialSkip() {
  await finishTutorial();
}

async function finishTutorial() {
  await setTutorialCompletedFlag(true);
  switchView('workspace');
}

// ==========================================
// WORKSPACE: PORTAL TAB & STEPPER
// ==========================================
async function checkPortalTab(forceReinject = false) {
  portalStatusText.textContent = 'Checking Portal...';
  try {
    const tab = browserAdapter 
      ? await browserAdapter.getActiveTab() 
      : (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))?.[0];

    if (!tab || !tab.url || !tab.url.toLowerCase().includes('btechreg.aspx')) {
      portalDot.className = 'dot amber';
      portalStatusText.textContent = 'Portal Tab Not Found';
      return false;
    }

    if (forceReinject && browserAdapter && tab.id) {
      portalStatusText.textContent = 'Injecting Bridge...';
      await browserAdapter.ensureContentScript(tab.id);
    }

    // Lightweight readiness handshake
    const pingRes = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tab.id, { action: 'PORTAL_CHECK_READY' }, (res) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(res);
      });
    });

    if (pingRes && pingRes.ready) {
      portalDot.className = 'dot green';
      portalStatusText.textContent = 'Connected (Btechreg.aspx)';
      return true;
    }

    // Try auto-inject once if not responding
    if (browserAdapter && tab.id) {
      const injectRes = await browserAdapter.ensureContentScript(tab.id);
      if (injectRes.success) {
        portalDot.className = 'dot green';
        portalStatusText.textContent = 'Connected (Btechreg.aspx)';
        return true;
      }
    }

    portalDot.className = 'dot amber';
    portalStatusText.textContent = 'Bridge Inactive (Click Retry)';
    return false;
  } catch (_) {
    portalDot.className = 'dot amber';
    portalStatusText.textContent = 'Portal Tab Inactive';
    return false;
  }
}

function updateStepper(step) {
  const items = [stepAuth, stepSearch, stepAdmission, stepPrimary, stepReview];
  items.forEach((item, index) => {
    if (!item) return;
    item.classList.remove('active', 'completed');
    if (index + 1 < step) {
      item.classList.add('completed');
    } else if (index + 1 === step) {
      item.classList.add('active');
    }
  });
}

// ==========================================
// INDIVIDUAL STUDENT FIELD REGISTRY & COPY ENGINE
// ==========================================

const COPY_ICON_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg><span>Copy</span>';

/**
 * Copies a single field value to clipboard with accessible feedback and fallback.
 */
async function copyFieldValue(value, btnEl) {
  if (!value || value === 'Not provided' || value === '—') return;
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(String(value));
    } else {
      const ta = document.createElement('textarea');
      ta.value = String(value);
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const success = document.execCommand('copy');
      document.body.removeChild(ta);
      if (!success) throw new Error('execCommand copy failed');
    }

    if (btnEl) {
      btnEl.classList.add('copied');
      btnEl.innerHTML = '<span>✓ Copied!</span>';
      setTimeout(() => {
        btnEl.classList.remove('copied');
        btnEl.innerHTML = COPY_ICON_SVG;
      }, 1500);
    }
  } catch (_err) {
    if (btnEl) {
      btnEl.innerHTML = '<span>Failed</span>';
      setTimeout(() => {
        btnEl.innerHTML = COPY_ICON_SVG;
      }, 1500);
    }
  }
}

/**
 * Updates a single field's display value and wires its dedicated Copy button.
 */
function updateField(valElId, btnElId, value, options = {}) {
  const valEl = document.getElementById(valElId);
  const btnEl = document.getElementById(btnElId);

  const isAvailable = value !== null && value !== undefined && String(value).trim() !== '' && String(value).trim() !== '—';
  const displayVal = isAvailable ? String(value).trim() : 'Not provided';
  const rawCopyVal = isAvailable ? (options.rawCopy !== undefined ? options.rawCopy : String(value).trim()) : '';

  if (valEl) {
    valEl.textContent = displayVal;
    if (!isAvailable) {
      valEl.classList.add('not-provided');
    } else {
      valEl.classList.remove('not-provided');
    }
  }

  if (btnEl) {
    if (!isAvailable) {
      btnEl.disabled = true;
      btnEl.setAttribute('aria-disabled', 'true');
      btnEl.title = 'No value available to copy';
      btnEl.onclick = null;
    } else {
      btnEl.disabled = false;
      btnEl.removeAttribute('aria-disabled');
      btnEl.title = `Copy ${options.fieldName || 'field value'}`;
      btnEl.onclick = () => copyFieldValue(rawCopyVal, btnEl);
    }
  }
}

/**
 * Resets a single field and disables its Copy button.
 */
function resetField(valElId, btnElId) {
  const valEl = document.getElementById(valElId);
  const btnEl = document.getElementById(btnElId);
  if (valEl) {
    valEl.textContent = '—';
    valEl.classList.remove('not-provided');
  }
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = COPY_ICON_SVG;
    btnEl.onclick = null;
  }
}

const STUDENT_FIELDS = [
  // A. Basic Student Information
  { id: 'dispStudentName', btnId: 'copyBtn_name', label: 'Student Name', getValue: s => s.name },
  { id: 'dispRollNo', btnId: 'copyBtn_rollNo', label: 'Student Roll Number', getValue: s => s.rollNo },
  { id: 'dispAdmissionNo', btnId: 'copyBtn_admissionNo', label: 'College Admission Number', getValue: s => s.admissionNo },
  { id: 'dispAdmissionType', btnId: 'copyBtn_admissionType', label: 'Admission Type', getValue: s => s.admissionType },
  { id: 'dispBranch', btnId: 'copyBtn_branch', label: 'Branch', getValue: s => s.portalBranch || s.cmsBranch },
  { id: 'dispAdmissionDate', btnId: 'copyBtn_admissionDate', label: 'Admission Date', getValue: s => s.formattedAdmissionDate || s.admissionDate },
  { id: 'dispPreviousStudy', btnId: 'copyBtn_previousStudy', label: 'Previous Studying', getValue: s => s.previousStudying },
  { id: 'dispAcademicYear', btnId: 'copyBtn_academicYear', label: 'Academic Year', getValue: s => s.academicYear || '2026-2027' },
  { id: 'dispStudentStatus', btnId: 'copyBtn_studentStatus', label: 'Student Status', getValue: s => s.studentStatus || 'ACTIVE' },
  { id: 'dispScheme', btnId: 'copyBtn_scheme', label: 'KU Online Scheme', getValue: s => s.scheme || '2013' },

  // B. Personal Details
  { id: 'dispFatherName', btnId: 'copyBtn_fatherName', label: "Father's Name", getValue: s => s.primaryDetails?.fatherName },
  { id: 'dispMotherName', btnId: 'copyBtn_motherName', label: "Mother's Name", getValue: s => s.primaryDetails?.motherName },
  { id: 'dispDob', btnId: 'copyBtn_dob', label: 'Date of Birth', getValue: s => s.primaryDetails?.dateOfBirth },
  { id: 'dispGender', btnId: 'copyBtn_gender', label: 'Gender', getValue: s => s.primaryDetails?.gender },
  { id: 'dispBloodGroup', btnId: 'copyBtn_bloodGroup', label: 'Blood Group', getValue: s => s.primaryDetails?.bloodGroup },
  { id: 'dispPob', btnId: 'copyBtn_pob', label: 'Place of Birth', getValue: s => s.primaryDetails?.placeOfBirth },
  { id: 'dispReligion', btnId: 'copyBtn_religion', label: 'Religion', getValue: s => s.primaryDetails?.religion },
  { id: 'dispMotherTongue', btnId: 'copyBtn_motherTongue', label: "Mother's Tongue", getValue: s => s.primaryDetails?.motherTongue },
  { id: 'dispNationality', btnId: 'copyBtn_nationality', label: 'Nationality', getValue: s => s.primaryDetails?.nationality },
  { id: 'dispSocialStatus', btnId: 'copyBtn_socialStatus', label: 'Social Status', getValue: s => s.primaryDetails?.socialStatus },
  { id: 'dispSubcategory', btnId: 'copyBtn_subcategory', label: 'Subcategory (Allotment)', getValue: s => s.primaryDetails?.subCategory },
  { id: 'dispSubCaste', btnId: 'copyBtn_subCaste', label: 'Sub-Caste', getValue: s => s.primaryDetails?.subCaste },
  { id: 'dispFatherOccupation', btnId: 'copyBtn_fatherOccupation', label: "Father's Occupation", getValue: s => s.primaryDetails?.fatherOccupation },
  { id: 'dispMotherOccupation', btnId: 'copyBtn_motherOccupation', label: "Mother's Occupation", getValue: s => s.primaryDetails?.motherOccupation },
  { id: 'dispIncome', btnId: 'copyBtn_income', label: 'Annual Income', getValue: s => s.primaryDetails?.incomeRange || s.primaryDetails?.portalIncome },

  // C. Contact & Identity Details
  { 
    id: 'dispContact', 
    btnId: 'copyBtn_contact', 
    label: 'Student Contact Number', 
    getValue: s => formatContact(s.primaryDetails?.contactNumber), 
    rawCopy: s => s.primaryDetails?.contactNumber ? String(s.primaryDetails.contactNumber).replace(/\D/g, '').slice(-10) : '' 
  },
  { id: 'dispEmail', btnId: 'copyBtn_email', label: 'Student Email', getValue: s => s.primaryDetails?.email },
  { 
    id: 'dispGuardianContact', 
    btnId: 'copyBtn_guardianContact', 
    label: 'Guardian Contact Number', 
    getValue: s => formatContact(s.primaryDetails?.guardianContact), 
    rawCopy: s => s.primaryDetails?.guardianContact ? String(s.primaryDetails.guardianContact).replace(/\D/g, '').slice(-10) : '' 
  },
  { 
    id: 'dispAadhaar', 
    btnId: 'copyBtn_aadhaar', 
    label: 'Aadhaar Number', 
    getValue: s => formatAadhaar(s.primaryDetails?.aadhaarNumber), 
    rawCopy: s => s.primaryDetails?.aadhaarNumber ? String(s.primaryDetails.aadhaarNumber).replace(/\D/g, '') : '' 
  },
  { id: 'dispApaarId', btnId: 'copyBtn_apaarId', label: 'APAAR ID', getValue: s => s.primaryDetails?.apaarId },

  // D. Address Details
  { id: 'dispCurrentAddress', btnId: 'copyBtn_currentAddress', label: 'Current Address', getValue: s => s.primaryDetails?.currentAddress },
  { id: 'dispPermanentAddress', btnId: 'copyBtn_permanentAddress', label: 'Permanent Address', getValue: s => s.primaryDetails?.permanentAddress },
  { id: 'dispState', btnId: 'copyBtn_state', label: 'State', getValue: s => s.primaryDetails?.state },
  { id: 'dispDistrict', btnId: 'copyBtn_district', label: 'District / City', getValue: s => s.primaryDetails?.district },
  { id: 'dispMandalStreet', btnId: 'copyBtn_mandalStreet', label: 'Mandal / Street', getValue: s => s.primaryDetails?.mandal },
  { id: 'dispHouseVillage', btnId: 'copyBtn_houseVillage', label: 'Village / House No', getValue: s => s.primaryDetails?.village },
  { id: 'dispPincode', btnId: 'copyBtn_pincode', label: 'PIN Code', getValue: s => s.primaryDetails?.pincode },
];

function resetWorkspaceData() {
  if (studentCard) studentCard.classList.add('hidden');
  if (activeStudentBanner) activeStudentBanner.classList.add('hidden');
  if (rollInput) rollInput.value = '';
  if (fillResultAlert) fillResultAlert.classList.add('hidden');
  if (primaryResultAlert) primaryResultAlert.classList.add('hidden');

  STUDENT_FIELDS.forEach(f => resetField(f.id, f.btnId));

  if (photoThumb && photoThumb.src && photoThumb.src.startsWith('blob:')) {
    URL.revokeObjectURL(photoThumb.src);
    photoThumb.src = '';
  }
  if (sigThumb && sigThumb.src && sigThumb.src.startsWith('blob:')) {
    URL.revokeObjectURL(sigThumb.src);
    sigThumb.src = '';
  }

  if (photoFilename) photoFilename.textContent = 'photo.jpg';
  if (sigFilename) sigFilename.textContent = 'sign.jpg';
  if (photoStats) photoStats.textContent = 'Processing...';
  if (sigStats) sigStats.textContent = 'Processing...';
  if (photoBadge) { photoBadge.className = 'badge badge-amber'; photoBadge.textContent = 'Ready'; }
  if (sigBadge) { sigBadge.className = 'badge badge-amber'; sigBadge.textContent = 'Ready'; }
  if (retryPhotoBtn) retryPhotoBtn.classList.add('hidden');
  if (retrySigBtn) retrySigBtn.classList.add('hidden');

  currentStudent = null;
  optimizedPhoto = null;
  optimizedSignature = null;
  hideError();
  updateStepper(2);
}

// ==========================================
// WORKSPACE: FETCH & RENDER STUDENT
// ==========================================
async function handleFetchStudent() {
  const rollNo = (rollInput.value || '').trim().toUpperCase();
  if (!rollNo) {
    showError('Please enter a KUCET Roll Number.');
    return;
  }

  hideError();
  fillResultAlert.classList.add('hidden');
  if (primaryResultAlert) primaryResultAlert.classList.add('hidden');
  fetchBtn.disabled = true;
  fetchBtnText.innerHTML = '<span class="spinner"></span>';

  try {
    const apiUrl = `${CMS_BASE_URL}/api/staff/admission/bridge/students/${encodeURIComponent(rollNo)}`;
    const res = await fetch(apiUrl, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    if (res.status === 401) {
      showAuthError('Your CMS session has expired. Please sign in again.');
      switchView('auth');
      return;
    }
    if (res.status === 403) {
      throw new Error('Access forbidden: Only staff with Admission privileges can access this bridge record.');
    }
    if (res.status === 404) {
      throw new Error(`Student with roll number "${rollNo}" not found in KUCET CMS.`);
    }
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `CMS server error (${res.status})`);
    }

    const payload = await res.json();

    // Revoke old image blobs and clear old records to prevent cross-student contamination
    if (photoThumb && photoThumb.src && photoThumb.src.startsWith('blob:')) {
      URL.revokeObjectURL(photoThumb.src);
      photoThumb.src = '';
    }
    if (sigThumb && sigThumb.src && sigThumb.src.startsWith('blob:')) {
      URL.revokeObjectURL(sigThumb.src);
      sigThumb.src = '';
    }
    optimizedPhoto = null;
    optimizedSignature = null;

    currentStudent = payload.data || payload;

    renderStudentDetails(currentStudent);
    updateStepper(3);

    // Fetch & Optimize Media in Parallel
    await processMediaAssets(currentStudent);

    studentCard.classList.remove('hidden');
  } catch (err) {
    showError(err.message);
    studentCard.classList.add('hidden');
    activeStudentBanner.classList.add('hidden');
    currentStudent = null;
    optimizedPhoto = null;
    optimizedSignature = null;
    STUDENT_FIELDS.forEach(f => resetField(f.id, f.btnId));
    updateStepper(2);
  } finally {
    fetchBtn.disabled = false;
    fetchBtnText.textContent = 'Fetch';
  }
}

function formatAadhaar(val) {
  if (!val) return 'Not provided';
  const clean = String(val).replace(/\D/g, '');
  if (clean.length === 12) {
    return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)}`;
  }
  return clean || 'Not provided';
}

function formatContact(val) {
  if (!val) return 'Not provided';
  const clean = String(val).replace(/\D/g, '');
  if (clean.length >= 10) {
    return clean.slice(-10);
  }
  return clean || 'Not provided';
}

function renderStudentDetails(s) {
  if (dispName) dispName.textContent = s.name || '—';
  if (dispAdmissionTypeBadge) {
    dispAdmissionTypeBadge.textContent = s.admissionType || 'Regular';
    dispAdmissionTypeBadge.className = s.admissionType === 'Lateral' ? 'badge badge-amber' : 'badge badge-blue';
  }

  // Active Student Banner
  if (bannerStudentName) bannerStudentName.textContent = s.name || 'Student';
  if (bannerStudentMeta) bannerStudentMeta.textContent = `${s.rollNo} • ${s.portalBranch || s.cmsBranch || ''}`;
  if (bannerTypeBadge) {
    bannerTypeBadge.textContent = s.admissionType || 'Regular';
    bannerTypeBadge.className = s.admissionType === 'Lateral' ? 'badge badge-amber' : 'badge badge-blue';
  }
  if (activeStudentBanner) activeStudentBanner.classList.remove('hidden');

  // Render every individual student field with dedicated copy button
  STUDENT_FIELDS.forEach(field => {
    const val = field.getValue(s);
    const raw = field.rawCopy ? field.rawCopy(s) : val;
    updateField(field.id, field.btnId, val, { rawCopy: raw, fieldName: field.label });
  });

  // Warnings
  if (warningsContainer) {
    warningsContainer.innerHTML = '';
    if (s.warnings && s.warnings.length > 0) {
      s.warnings.forEach(w => {
        const div = document.createElement('div');
        div.className = 'alert alert-amber';
        div.innerHTML = `<span>⚠</span><span>${w.message || w}</span>`;
        warningsContainer.appendChild(div);
      });
    }
  }
}

function setMediaBadge(type, color, text) {
  const badgeEl = type === 'photo' ? photoBadge : sigBadge;
  if (!badgeEl) return;
  badgeEl.className = `badge badge-${color}`;
  badgeEl.textContent = text;
}

// ==========================================
// MEDIA ASSET PROCESSING (< 190 KiB)
// ==========================================
async function processMediaAssets(s) {
  const admissionNo = s.admissionNo ? String(s.admissionNo).trim().toUpperCase() : null;
  const photoName = s.photo?.expectedFilename || s.photoFilename || (admissionNo ? `${admissionNo}.jpg` : `${s.rollNo}_photo.jpg`);
  const sigName = s.signature?.expectedFilename || s.signatureFilename || (admissionNo ? `${admissionNo}(1).jpg` : `${s.rollNo}_sign.jpg`);
  s.photoFilename = photoName;
  s.signatureFilename = sigName;

  if (photoFilename) photoFilename.textContent = photoName;
  if (sigFilename) sigFilename.textContent = sigName;

  setMediaBadge('photo', 'amber', 'Loading');
  setMediaBadge('sig', 'amber', 'Loading');
  photoStats.textContent = 'Downloading...';
  sigStats.textContent = 'Downloading...';
  if (retryPhotoBtn) retryPhotoBtn.classList.add('hidden');
  if (retrySigBtn) retrySigBtn.classList.add('hidden');

  const photoUrl = `${CMS_BASE_URL}/api/staff/admission/bridge/students/${encodeURIComponent(s.rollNo)}/photo`;
  const sigUrl = `${CMS_BASE_URL}/api/staff/admission/bridge/students/${encodeURIComponent(s.rollNo)}/signature`;

  const [photoBlob, sigBlob] = await Promise.all([
    fetchImageBlob(photoUrl),
    fetchImageBlob(sigUrl)
  ]);

  if (photoBlob) {
    setMediaBadge('photo', 'amber', 'Optimizing');
    photoStats.textContent = 'Optimizing JPEG (< 190 KiB)...';
    optimizedPhoto = await optimizeImageClient(photoBlob, 'photo');
    optimizedPhoto.filename = photoName;
    if (photoThumb.src && photoThumb.src.startsWith('blob:')) {
      URL.revokeObjectURL(photoThumb.src);
    }
    photoThumb.src = URL.createObjectURL(optimizedPhoto.blob);
    photoStats.textContent = `${formatBytes(optimizedPhoto.sizeBytes)} • ${optimizedPhoto.dimensions.width}×${optimizedPhoto.dimensions.height} JPEG`;
    setMediaBadge('photo', 'green', 'Ready');
    downloadPhotoBtn.disabled = false;
  } else {
    photoStats.textContent = 'No photo uploaded';
    setMediaBadge('photo', 'amber', 'Missing');
    photoThumb.src = '';
    downloadPhotoBtn.disabled = true;
  }

  if (sigBlob) {
    setMediaBadge('sig', 'amber', 'Optimizing');
    sigStats.textContent = 'Optimizing JPEG (< 190 KiB)...';
    optimizedSignature = await optimizeImageClient(sigBlob, 'signature');
    optimizedSignature.filename = sigName;
    if (sigThumb.src && sigThumb.src.startsWith('blob:')) {
      URL.revokeObjectURL(sigThumb.src);
    }
    sigThumb.src = URL.createObjectURL(optimizedSignature.blob);
    sigStats.textContent = `${formatBytes(optimizedSignature.sizeBytes)} • ${optimizedSignature.dimensions.width}×${optimizedSignature.dimensions.height} JPEG`;
    setMediaBadge('sig', 'green', 'Ready');
    downloadSigBtn.disabled = false;
  } else {
    sigStats.textContent = 'No signature uploaded';
    setMediaBadge('sig', 'amber', 'Missing');
    sigThumb.src = '';
    downloadSigBtn.disabled = true;
  }
}

async function handleRetryAttachPhoto() {
  if (!currentStudent || !optimizedPhoto?.blob || isRetryingPhoto) return;
  isRetryingPhoto = true;
  if (retryPhotoBtn) {
    retryPhotoBtn.disabled = true;
    retryPhotoBtn.textContent = 'Attaching...';
  }
  setMediaBadge('photo', 'blue', 'Attaching...');

  try {
    const photoBase64 = await blobToBase64(optimizedPhoto.blob);
    const res = await sendPortalMessage({
      action: 'PORTAL_ATTACH_STUDENT_MEDIA',
      type: 'photo',
      base64: photoBase64,
      filename: currentStudent.photoFilename,
    });

    if (res?.success) {
      setMediaBadge('photo', 'green', 'Attached');
      if (retryPhotoBtn) retryPhotoBtn.classList.add('hidden');
    } else {
      setMediaBadge('photo', 'red', 'Failed');
      if (retryPhotoBtn) retryPhotoBtn.textContent = '↻ Retry Attach';
    }
  } catch (_err) {
    setMediaBadge('photo', 'red', 'Failed');
    if (retryPhotoBtn) retryPhotoBtn.textContent = '↻ Retry Attach';
  } finally {
    isRetryingPhoto = false;
    if (retryPhotoBtn) retryPhotoBtn.disabled = false;
  }
}

async function handleRetryAttachSig() {
  if (!currentStudent || !optimizedSignature?.blob || isRetryingSig) return;
  isRetryingSig = true;
  if (retrySigBtn) {
    retrySigBtn.disabled = true;
    retrySigBtn.textContent = 'Attaching...';
  }
  setMediaBadge('sig', 'blue', 'Attaching...');

  try {
    const sigBase64 = await blobToBase64(optimizedSignature.blob);
    const res = await sendPortalMessage({
      action: 'PORTAL_ATTACH_STUDENT_MEDIA',
      type: 'signature',
      base64: sigBase64,
      filename: currentStudent.signatureFilename,
    });

    if (res?.success) {
      setMediaBadge('sig', 'green', 'Attached');
      if (retrySigBtn) retrySigBtn.classList.add('hidden');
    } else {
      setMediaBadge('sig', 'red', 'Failed');
      if (retrySigBtn) retrySigBtn.textContent = '↻ Retry Attach';
    }
  } catch (_err) {
    setMediaBadge('sig', 'red', 'Failed');
    if (retrySigBtn) retrySigBtn.textContent = '↻ Retry Attach';
  } finally {
    isRetryingSig = false;
    if (retrySigBtn) retrySigBtn.disabled = false;
  }
}

async function fetchImageBlob(url) {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return null;
    return await res.blob();
  } catch (_) {
    return null;
  }
}

async function optimizeImageClient(blob, type) {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(blob);

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);

      let maxDim = type === 'photo' ? 1024 : 800;
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.85;
      let resultBlob = await canvasToBlob(canvas, quality);

      while (resultBlob.size > MAX_PORTAL_IMAGE_BYTES && quality > 0.3) {
        quality -= 0.1;
        resultBlob = await canvasToBlob(canvas, quality);
      }

      if (resultBlob.size > MAX_PORTAL_IMAGE_BYTES) {
        let curW = width;
        let curH = height;
        while (resultBlob.size > MAX_PORTAL_IMAGE_BYTES && curW > 300) {
          curW = Math.round(curW * 0.8);
          curH = Math.round(curH * 0.8);
          canvas.width = curW;
          canvas.height = curH;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, curW, curH);
          ctx.drawImage(img, 0, 0, curW, curH);
          resultBlob = await canvasToBlob(canvas, 0.75);
        }
      }

      resolve({
        blob: resultBlob,
        sizeBytes: resultBlob.size,
        dimensions: { width: canvas.width, height: canvas.height }
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        blob,
        sizeBytes: blob.size,
        dimensions: { width: 0, height: 0 }
      });
    };

    img.src = objectUrl;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', quality);
  });
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function triggerDownload(asset) {
  if (!asset || !asset.blob) return;
  const url = URL.createObjectURL(asset.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = asset.filename || 'kucet_image.jpg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==========================================
// WORKSPACE: FORM POPULATION (STEP 1 & STEP 2)
// ==========================================

let isTransferringStep1 = false;
let isTransferringStep2 = false;

/**
 * Sends a message to the active university portal tab via Background Relay with direct fallback.
 * Ensures the content script is active and ready before dispatching.
 */
async function sendPortalMessage(message) {
  // 1. Try background relay first (preferred MV3 architecture)
  try {
    const bgResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'RELAY_TO_PORTAL', portalMessage: message }, (res) => {
        if (chrome.runtime.lastError) {
          resolve(null);
        } else {
          resolve(res);
        }
      });
    });

    if (bgResponse) {
      if (bgResponse.errorCode) {
        throw new Error(bgResponse.message || bgResponse.errorCode);
      }
      if (bgResponse.success || bgResponse.populatedFields || bgResponse.requiresPostback) {
        return bgResponse;
      }
    }
  } catch (err) {
    if (err.message && (
      err.message.includes('Btechreg.aspx') || 
      err.message.includes('permission') || 
      err.message.includes('Cannot access') ||
      err.message.includes('Missing host permission') ||
      err.message.includes('portal session has expired')
    )) {
      throw err;
    }
  }

  // 2. Fallback: Direct tab communication
  const targetTab = browserAdapter
    ? await browserAdapter.getActiveTab()
    : (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))?.[0];

  if (!targetTab || !targetTab.url || !targetTab.url.toLowerCase().includes('btechreg.aspx')) {
    throw new Error('Please open and activate the KU Online registration tab (https://kuonline.co.in/BTechsql/Btechreg.aspx).');
  }

  if (browserAdapter) {
    const readyRes = await browserAdapter.ensureContentScript(targetTab.id);
    if (!readyRes.success) {
      if (readyRes.errorCode === 'HOST_PERMISSION_MISSING') {
        let host = 'kuonline.co.in';
        try { host = new URL(targetTab.url).hostname; } catch (_) {}
        throw new Error(`Missing host permission for "${host}". Please reload the KUCET Admission Bridge extension in chrome://extensions.`);
      }
      throw new Error(readyRes.error || 'Could not connect to KU Online portal tab.');
    }
    return await browserAdapter.sendMessageToTab(targetTab.id, message);
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(targetTab.id, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function renderTransferStatus(response, alertEl, title) {
  const populated = response.populatedFields || [];
  const skipped = response.skippedFields || [];
  const failed = response.failedFields || [];
  const warnings = response.warnings || [];
  const timeStr = new Date().toLocaleTimeString();

  let statusClass = 'alert alert-green';
  let statusBadge = '<span class="badge badge-green" style="font-size: 10px; margin-left: 6px;">COMPLETED</span>';

  if (failed.length > 0) {
    statusClass = 'alert alert-red';
    statusBadge = '<span class="badge badge-red" style="font-size: 10px; margin-left: 6px;">NEEDS ATTENTION</span>';
  } else if (response.requiresPostback) {
    statusClass = 'alert alert-amber';
    statusBadge = '<span class="badge badge-amber" style="font-size: 10px; margin-left: 6px;">POSTBACK PENDING</span>';
  } else if (warnings.length > 0) {
    statusClass = 'alert alert-amber';
    statusBadge = '<span class="badge badge-amber" style="font-size: 10px; margin-left: 6px;">VERIFIED WITH WARNINGS</span>';
  }

  let html = `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
    <div><strong>${title}</strong> ${statusBadge}</div>
    <div style="font-size: 10px; color: var(--text-muted);">${timeStr}</div>
  </div>`;

  if (response.requiresPostback) {
    html += `<div style="font-size: 11px; margin-bottom: 4px;">${response.message || 'Portal postback triggered. Waiting for university page reload...'}</div>`;
  }

  // Counts summary
  html += `<div style="display: flex; gap: 8px; font-size: 11px; margin-top: 4px; padding-top: 4px; border-top: 1px dashed rgba(0,0,0,0.15);">
    <span style="color: var(--success); font-weight: 600;">✓ ${populated.length} populated</span>`;
  if (skipped.length > 0) {
    html += `<span style="color: var(--warning); font-weight: 600;">○ ${skipped.length} skipped</span>`;
  }
  if (failed.length > 0) {
    html += `<span style="color: var(--error); font-weight: 600;">✗ ${failed.length} failed</span>`;
  }
  html += `</div>`;

  // Failures detail
  if (failed.length > 0) {
    html += `<div style="margin-top: 4px; font-size: 10px; color: var(--error);">
      <strong>Attention required for:</strong> ${failed.join(', ')}
    </div>`;
  }

  // Warnings detail
  if (warnings.length > 0) {
    html += `<div style="margin-top: 4px; font-size: 10px; color: #854d0e;">
      <strong>Note:</strong> ${warnings.slice(0, 2).join('; ')}
    </div>`;
  }

  alertEl.className = statusClass;
  alertEl.innerHTML = html;
  alertEl.classList.remove('hidden');
}

function renderTransferError(err, alertEl, title) {
  let guidance = '';
  const msg = err.message || 'Unknown transfer error';

  if (msg.includes('Could not establish connection') || msg.includes('Receiving end does not exist')) {
    guidance = `<div style="margin-top: 4px; font-size: 11px; line-height: 1.3;">
      The extension lost connection with the university portal tab. Click <strong>Retry</strong> in the status bar above or refresh the portal page.
    </div>`;
  } else if (msg.includes('Btechreg.aspx')) {
    guidance = `<div style="margin-top: 4px; font-size: 11px; line-height: 1.3;">
      Please ensure <a href="https://kuonline.co.in/BTechsql/Btechreg.aspx" target="_blank" style="color: #0b3578; font-weight: 600; text-decoration: underline;">KU Online Registration (Btechreg.aspx)</a> is open and active.
    </div>`;
  }

  alertEl.className = 'alert alert-red';
  alertEl.innerHTML = `<div style="font-weight: 600;">Transfer Error: ${title}</div>
    <div style="font-size: 11px; margin-top: 2px;">${msg}</div>
    ${guidance}`;
  alertEl.classList.remove('hidden');
}

async function handleFillPortal() {
  if (!currentStudent || isTransferringStep1) return;

  isTransferringStep1 = true;
  fillFormBtn.disabled = true;
  fillBtnText.innerHTML = '<span class="spinner"></span> Transferring Step 1...';
  fillResultAlert.classList.add('hidden');

  try {
    let photoBase64 = null;
    let sigBase64 = null;
    if (optimizedPhoto?.blob) {
      setMediaBadge('photo', 'blue', 'Attaching...');
      photoBase64 = await blobToBase64(optimizedPhoto.blob);
    }
    if (optimizedSignature?.blob) {
      setMediaBadge('sig', 'blue', 'Attaching...');
      sigBase64 = await blobToBase64(optimizedSignature.blob);
    }

    const message = {
      action: 'PORTAL_POPULATE_ADMISSION_INFO',
      student: currentStudent,
      photo: photoBase64 ? {
        base64: photoBase64,
        filename: currentStudent.photoFilename || `${currentStudent.rollNo}_photo.jpg`,
      } : null,
      signature: sigBase64 ? {
        base64: sigBase64,
        filename: currentStudent.signatureFilename || `${currentStudent.rollNo}_sign.jpg`,
      } : null,
    };

    const response = await sendPortalMessage(message);

    if (response && (response.success || response.requiresPostback || (response.populatedFields && response.populatedFields.length > 0))) {
      // Update media badges based on verified portal attachment status
      if (response.verification?.photoAttached) {
        setMediaBadge('photo', 'green', 'Attached');
        if (retryPhotoBtn) retryPhotoBtn.classList.add('hidden');
      } else if (optimizedPhoto?.blob) {
        setMediaBadge('photo', 'red', 'Failed');
        if (retryPhotoBtn) retryPhotoBtn.classList.remove('hidden');
      }

      if (response.verification?.signatureAttached) {
        setMediaBadge('sig', 'green', 'Attached');
        if (retrySigBtn) retrySigBtn.classList.add('hidden');
      } else if (optimizedSignature?.blob) {
        setMediaBadge('sig', 'red', 'Failed');
        if (retrySigBtn) retrySigBtn.classList.remove('hidden');
      }

      renderTransferStatus(response, fillResultAlert, 'Step 1: Admission Info');
      updateStepper(4);
    } else {
      if (optimizedPhoto?.blob) setMediaBadge('photo', 'red', 'Failed');
      if (optimizedSignature?.blob) setMediaBadge('sig', 'red', 'Failed');
      throw new Error(response?.error || response?.message || 'Could not populate portal admission info fields.');
    }
  } catch (err) {
    if (optimizedPhoto?.blob) {
      setMediaBadge('photo', 'red', 'Failed');
      if (retryPhotoBtn) retryPhotoBtn.classList.remove('hidden');
    }
    if (optimizedSignature?.blob) {
      setMediaBadge('sig', 'red', 'Failed');
      if (retrySigBtn) retrySigBtn.classList.remove('hidden');
    }
    renderTransferError(err, fillResultAlert, 'Admission Info');
  } finally {
    isTransferringStep1 = false;
    fillFormBtn.disabled = false;
    fillBtnText.textContent = 'Fill KU Online Admission Info (Step 1)';
  }
}

async function handleFillPrimaryDetails() {
  if (!currentStudent || !currentStudent.primaryDetails || isTransferringStep2) return;

  isTransferringStep2 = true;
  fillPrimaryBtn.disabled = true;
  fillPrimaryBtnText.innerHTML = '<span class="spinner"></span> Transferring Step 2...';
  primaryResultAlert.classList.add('hidden');

  try {
    const message = {
      action: 'PORTAL_POPULATE_PRIMARY_DETAILS',
      student: currentStudent,
      primaryDetails: currentStudent.primaryDetails,
    };

    const response = await sendPortalMessage(message);

    if (response && (response.success || (response.populatedFields && response.populatedFields.length > 0))) {
      renderTransferStatus(response, primaryResultAlert, 'Step 2: Primary Details');
      updateStepper(5);
    } else {
      throw new Error(response?.error || response?.message || 'Could not populate Primary Details on the portal page.');
    }
  } catch (err) {
    renderTransferError(err, primaryResultAlert, 'Primary Details');
  } finally {
    isTransferringStep2 = false;
    fillPrimaryBtn.disabled = false;
    fillPrimaryBtnText.textContent = 'Populate KU Online Primary Details';
  }
}

function blobToBase64(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function showError(msg) {
  searchError.textContent = msg;
  searchError.classList.remove('hidden');
}

function hideError() {
  searchError.classList.add('hidden');
}
