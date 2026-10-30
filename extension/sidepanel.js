/* global chrome */
/**
 * Side Panel Controller for KUCET Admission Bridge Chrome Extension.
 * Handles standalone staff authentication, interactive tutorial mode,
 * student retrieval, native client-side JPEG optimization (< 190 KiB), and portal form transfer.
 */

// Configuration Defaults
// Supports local development and production CMS origins
const CMS_BASE_URL = window.location.origin.includes('localhost') 
  ? 'http://localhost:3000' 
  : 'https://kucet.tech';

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

// Display Fields (Admission Info)
const dispName = document.getElementById('dispName');
const dispRollNo = document.getElementById('dispRollNo');
const dispAdmissionNo = document.getElementById('dispAdmissionNo');
const dispAdmissionTypeBadge = document.getElementById('dispAdmissionTypeBadge');
const dispBranch = document.getElementById('dispBranch');
const dispScheme = document.getElementById('dispScheme');
const dispAdmissionDate = document.getElementById('dispAdmissionDate');
const dispPreviousStudy = document.getElementById('dispPreviousStudy');
const warningsContainer = document.getElementById('warningsContainer');

// Display Fields (Primary Details - Phase 2)
const dispFatherName = document.getElementById('dispFatherName');
const dispMotherName = document.getElementById('dispMotherName');
const dispDob = document.getElementById('dispDob');
const dispGenderBlood = document.getElementById('dispGenderBlood');
const dispLocationNat = document.getElementById('dispLocationNat');
const dispSocialCaste = document.getElementById('dispSocialCaste');
const dispAadhaar = document.getElementById('dispAadhaar');
const dispContact = document.getElementById('dispContact');
const dispIncome = document.getElementById('dispIncome');
const dispCurrentAddress = document.getElementById('dispCurrentAddress');
const fillPrimaryBtn = document.getElementById('fillPrimaryBtn');
const fillPrimaryBtnText = document.getElementById('fillPrimaryBtnText');
const primaryResultAlert = document.getElementById('primaryResultAlert');

// Media Elements
const photoThumb = document.getElementById('photoThumb');
const photoFilename = document.getElementById('photoFilename');
const photoStats = document.getElementById('photoStats');
const downloadPhotoBtn = document.getElementById('downloadPhotoBtn');

const sigThumb = document.getElementById('sigThumb');
const sigFilename = document.getElementById('sigFilename');
const sigStats = document.getElementById('sigStats');
const downloadSigBtn = document.getElementById('downloadSigBtn');

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
async function checkPortalTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (tab && tab.url && tab.url.toLowerCase().includes('btechreg.aspx')) {
      portalDot.className = 'dot green';
      portalStatusText.textContent = 'Portal Active (Btechreg.aspx)';
    } else {
      portalDot.className = 'dot amber';
      portalStatusText.textContent = 'Open KU Online Tab';
    }
  } catch (_) {
    portalDot.className = 'dot amber';
    portalStatusText.textContent = 'Portal Tab Inactive';
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

function resetWorkspaceData() {
  if (studentCard) studentCard.classList.add('hidden');
  if (activeStudentBanner) activeStudentBanner.classList.add('hidden');
  if (rollInput) rollInput.value = '';
  if (fillResultAlert) fillResultAlert.classList.add('hidden');
  if (primaryResultAlert) primaryResultAlert.classList.add('hidden');
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
    updateStepper(2);
  } finally {
    fetchBtn.disabled = false;
    fetchBtnText.textContent = 'Fetch';
  }
}

function maskAadhaar(val) {
  if (!val) return '—';
  const clean = String(val).replace(/\D/g, '');
  if (clean.length < 4) return '••••';
  return `•••• •••• ${clean.slice(-4)}`;
}

function maskContact(val) {
  if (!val) return '—';
  const clean = String(val).replace(/\D/g, '');
  if (clean.length < 4) return '••••';
  return `••••••${clean.slice(-4)}`;
}

function renderStudentDetails(s) {
  dispName.textContent = s.name || '—';
  dispRollNo.textContent = s.rollNo || '—';
  dispAdmissionNo.textContent = s.admissionNo || '—';
  dispAdmissionTypeBadge.textContent = s.admissionType || 'Regular';
  dispAdmissionTypeBadge.className = s.admissionType === 'Lateral' ? 'badge badge-amber' : 'badge badge-blue';
  
  dispBranch.textContent = s.portalBranch || s.cmsBranch || '—';
  dispScheme.textContent = s.scheme || '2013';
  dispAdmissionDate.textContent = s.formattedAdmissionDate || '—';
  dispPreviousStudy.textContent = s.previousStudying || '—';

  // Active Student Banner
  bannerStudentName.textContent = s.name || 'Student';
  bannerStudentMeta.textContent = `${s.rollNo} • ${s.portalBranch || s.cmsBranch || ''}`;
  bannerTypeBadge.textContent = s.admissionType || 'Regular';
  bannerTypeBadge.className = s.admissionType === 'Lateral' ? 'badge badge-amber' : 'badge badge-blue';
  activeStudentBanner.classList.remove('hidden');

  // Phase 2: Primary Details Rendering
  const pd = s.primaryDetails || {};
  if (dispFatherName) dispFatherName.textContent = pd.fatherName || '—';
  if (dispMotherName) dispMotherName.textContent = pd.motherName || '—';
  if (dispDob) dispDob.textContent = pd.dateOfBirth ? `${pd.dateOfBirth} (${pd.dobComponents?.monthName || ''})` : '—';
  if (dispGenderBlood) dispGenderBlood.textContent = `${pd.gender || '—'} / ${pd.bloodGroup || '—'}`;
  if (dispLocationNat) dispLocationNat.textContent = `${pd.location || '—'} / ${pd.nationality || 'Indian'}`;
  if (dispSocialCaste) dispSocialCaste.textContent = `${pd.socialStatus || '—'}${pd.subCaste ? ' (' + pd.subCaste + ')' : ''}`;
  if (dispAadhaar) dispAadhaar.textContent = maskAadhaar(pd.aadhaarNumber);
  if (dispContact) dispContact.textContent = maskContact(pd.contactNumber);
  if (dispIncome) dispIncome.textContent = pd.portalIncome ? `${pd.incomeRange || 'Range'} ➔ ${pd.portalIncome}` : (pd.incomeRange || '—');
  if (dispCurrentAddress) dispCurrentAddress.textContent = pd.currentAddress || '—';

  // Warnings
  warningsContainer.innerHTML = '';
  if (s.warnings && s.warnings.length > 0) {
    s.warnings.forEach(w => {
      const div = document.createElement('div');
      div.className = 'alert alert-amber';
      div.innerHTML = `<span>⚠</span><span>${w}</span>`;
      warningsContainer.appendChild(div);
    });
  }
}

// ==========================================
// MEDIA ASSET PROCESSING (< 190 KiB)
// ==========================================
async function processMediaAssets(s) {
  photoStats.textContent = 'Downloading...';
  sigStats.textContent = 'Downloading...';

  const photoUrl = `${CMS_BASE_URL}/api/staff/admission/bridge/students/${encodeURIComponent(s.rollNo)}/photo`;
  const sigUrl = `${CMS_BASE_URL}/api/staff/admission/bridge/students/${encodeURIComponent(s.rollNo)}/signature`;

  const [photoBlob, sigBlob] = await Promise.all([
    fetchImageBlob(photoUrl),
    fetchImageBlob(sigUrl)
  ]);

  if (photoBlob) {
    photoFilename.textContent = s.photoFilename || `${s.rollNo}_photo.jpg`;
    photoStats.textContent = 'Optimizing JPEG (< 190 KiB)...';
    optimizedPhoto = await optimizeImageClient(photoBlob, 'photo');
    photoThumb.src = URL.createObjectURL(optimizedPhoto.blob);
    photoStats.textContent = `${formatBytes(optimizedPhoto.sizeBytes)} • ${optimizedPhoto.dimensions.width}×${optimizedPhoto.dimensions.height} JPEG`;
    downloadPhotoBtn.disabled = false;
  } else {
    photoStats.textContent = 'No photo uploaded';
    photoThumb.src = '';
    downloadPhotoBtn.disabled = true;
  }

  if (sigBlob) {
    sigFilename.textContent = s.signatureFilename || `${s.rollNo}_sign.jpg`;
    sigStats.textContent = 'Optimizing JPEG (< 190 KiB)...';
    optimizedSignature = await optimizeImageClient(sigBlob, 'signature');
    sigThumb.src = URL.createObjectURL(optimizedSignature.blob);
    sigStats.textContent = `${formatBytes(optimizedSignature.sizeBytes)} • ${optimizedSignature.dimensions.width}×${optimizedSignature.dimensions.height} JPEG`;
    downloadSigBtn.disabled = false;
  } else {
    sigStats.textContent = 'No signature uploaded';
    sigThumb.src = '';
    downloadSigBtn.disabled = true;
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
async function handleFillPortal() {
  if (!currentStudent) return;

  fillFormBtn.disabled = true;
  fillBtnText.innerHTML = '<span class="spinner"></span> Transferring Step 1...';
  fillResultAlert.classList.add('hidden');

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const targetTab = tabs[0];

    if (!targetTab || !targetTab.url || !targetTab.url.toLowerCase().includes('btechreg.aspx')) {
      throw new Error('Please open and activate the KU Online registration tab (Btechreg.aspx) before clicking fill.');
    }

    let photoBase64 = null;
    let sigBase64 = null;
    if (optimizedPhoto?.blob) {
      photoBase64 = await blobToBase64(optimizedPhoto.blob);
    }
    if (optimizedSignature?.blob) {
      sigBase64 = await blobToBase64(optimizedSignature.blob);
    }

    const message = {
      action: 'POPULATE_ADMISSION_INFO',
      student: currentStudent,
      photo: photoBase64 ? {
        base64: photoBase64,
        filename: currentStudent.photoFilename || `${currentStudent.rollNo}_photo.jpg`
      } : null,
      signature: sigBase64 ? {
        base64: sigBase64,
        filename: currentStudent.signatureFilename || `${currentStudent.rollNo}_sign.jpg`
      } : null
    };

    const response = await chrome.tabs.sendMessage(targetTab.id, message);

    if (response && response.success) {
      fillResultAlert.className = 'alert alert-green';
      fillResultAlert.innerHTML = `<strong>Success:</strong> Step 1 populated (${response.populatedFields.length} fields). Visual audit required before Step 2.`;
      fillResultAlert.classList.remove('hidden');
      updateStepper(4);
    } else {
      throw new Error(response?.error || 'Could not populate portal fields.');
    }
  } catch (err) {
    fillResultAlert.className = 'alert alert-red';
    fillResultAlert.innerHTML = `<strong>Transfer Error:</strong> ${err.message}`;
    fillResultAlert.classList.remove('hidden');
  } finally {
    fillFormBtn.disabled = false;
    fillBtnText.textContent = 'Fill KU Online Admission Info (Step 1)';
  }
}

async function handleFillPrimaryDetails() {
  if (!currentStudent || !currentStudent.primaryDetails) return;

  fillPrimaryBtn.disabled = true;
  fillPrimaryBtnText.innerHTML = '<span class="spinner"></span> Transferring Step 2...';
  primaryResultAlert.classList.add('hidden');

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const targetTab = tabs[0];

    if (!targetTab || !targetTab.url || !targetTab.url.toLowerCase().includes('btechreg.aspx')) {
      throw new Error('Please open and activate the KU Online registration tab (Btechreg.aspx).');
    }

    const message = {
      action: 'POPULATE_PRIMARY_DETAILS',
      student: currentStudent
    };

    const response = await chrome.tabs.sendMessage(targetTab.id, message);

    if (response && response.success) {
      primaryResultAlert.className = 'alert alert-green';
      primaryResultAlert.innerHTML = `<strong>Success:</strong> Step 2 Primary Details populated (${response.populatedFields.length} fields). Please visually verify and click submit on the portal page.`;
      primaryResultAlert.classList.remove('hidden');
      updateStepper(5);
    } else {
      throw new Error(response?.error || 'Could not populate Primary Details on the portal page.');
    }
  } catch (err) {
    primaryResultAlert.className = 'alert alert-red';
    primaryResultAlert.innerHTML = `<strong>Transfer Error:</strong> ${err.message}`;
    primaryResultAlert.classList.remove('hidden');
  } finally {
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
