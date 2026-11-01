import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../artifacts/task4_video');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1920x1080 SVG Slide Templates with Kakatiya Navy (#0b3578) and Gold (#f59e0b)
const slides = [
  // Scene 1: Introduction
  {
    name: 'scene1.png',
    svg: `
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0b2447" />
          <stop offset="50%" stop-color="#0b3578" />
          <stop offset="100%" stop-color="#19376d" />
        </linearGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#bg1)" />
      
      <!-- Gold Accent Border Top & Bottom -->
      <rect x="0" y="0" width="1920" height="16" fill="#f59e0b" />
      <rect x="0" y="1064" width="1920" height="16" fill="#f59e0b" />

      <!-- Center Card -->
      <rect x="160" y="120" width="1600" height="840" rx="20" fill="#ffffff" fill-opacity="0.06" stroke="#ffffff" stroke-opacity="0.2" stroke-width="2" />

      <circle cx="960" cy="270" r="70" fill="#f59e0b" fill-opacity="0.2" stroke="#f59e0b" stroke-width="4" />
      <text x="960" y="285" font-family="DejaVu Sans, Arial, sans-serif" font-size="44" fill="#f59e0b" font-weight="900" text-anchor="middle">KU</text>

      <text x="960" y="380" font-family="DejaVu Sans, Arial, sans-serif" font-size="28" fill="#93c5fd" font-weight="bold" letter-spacing="4" text-anchor="middle">KAKATIYA UNIVERSITY COLLEGE OF ENGINEERING &amp; TECHNOLOGY</text>
      
      <text x="960" y="470" font-family="DejaVu Sans, Arial, sans-serif" font-size="56" fill="#ffffff" font-weight="900" text-anchor="middle">Payment Evidence Verification</text>
      <text x="960" y="540" font-family="DejaVu Sans, Arial, sans-serif" font-size="48" fill="#f59e0b" font-weight="900" text-anchor="middle">&amp; Fraud Prevention Subsystem</text>

      <rect x="360" y="600" width="1200" height="4" fill="#f59e0b" />

      <text x="960" y="670" font-family="DejaVu Sans, Arial, sans-serif" font-size="28" fill="#ffffff" font-weight="bold" text-anchor="middle">Staff Operational Training — Admission Officers, Faculty, &amp; Principals</text>

      <rect x="420" y="730" width="1080" height="130" rx="12" fill="#0f172a" fill-opacity="0.8" stroke="#38bdf8" stroke-width="2" />
      <text x="960" y="780" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#38bdf8" font-weight="bold" text-anchor="middle">CORE INVIOLABLE INSTITUTIONAL INVARIANT</text>
      <text x="960" y="825" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" fill="#ffffff" font-weight="bold" text-anchor="middle">"A screenshot is evidence to review, never proof that money was received."</text>
    </svg>
    `
  },

  // Scene 2: Workflow Diagram
  {
    name: 'scene2.png',
    svg: `
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1920" height="1080" fill="#0f172a" />
      <rect x="0" y="0" width="1920" height="16" fill="#f59e0b" />
      <rect x="0" y="1064" width="1920" height="16" fill="#f59e0b" />

      <text x="960" y="90" font-family="DejaVu Sans, Arial, sans-serif" font-size="38" fill="#ffffff" font-weight="bold" text-anchor="middle">THE KUCET 6-STAGE VERIFICATION WORKFLOW</text>
      <text x="960" y="130" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#94a3b8" text-anchor="middle">End-to-End Execution Pipeline from Student Submission to Immutable Audit Trail</text>

      <!-- 6 Flowchart Cards -->
      <!-- Step 1 -->
      <g transform="translate(100, 200)">
        <rect width="250" height="600" rx="16" fill="#1e293b" stroke="#3b82f6" stroke-width="3" />
        <circle cx="125" cy="70" r="36" fill="#2563eb" />
        <text x="125" y="80" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" fill="#ffffff" font-weight="bold" text-anchor="middle">1</text>
        <text x="125" y="150" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#60a5fa" font-weight="bold" text-anchor="middle">Evidence Submission</text>
        <text x="125" y="210" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">Student completes form</text>
        <text x="125" y="240" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">Uploads receipt image</text>
        <text x="125" y="270" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">Enters transaction ref</text>
        <rect x="25" y="480" width="200" height="50" rx="8" fill="#0f172a" />
        <text x="125" y="512" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#93c5fd" font-weight="bold" text-anchor="middle">State: SUBMITTED</text>
      </g>

      <!-- Step 2 -->
      <g transform="translate(380, 200)">
        <rect width="250" height="600" rx="16" fill="#1e293b" stroke="#06b6d4" stroke-width="3" />
        <circle cx="125" cy="70" r="36" fill="#0891b2" />
        <text x="125" y="80" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" fill="#ffffff" font-weight="bold" text-anchor="middle">2</text>
        <text x="125" y="150" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#38bdf8" font-weight="bold" text-anchor="middle">Format Validation</text>
        <text x="125" y="210" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">Whitespace strip</text>
        <text x="125" y="240" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">UPI VPA syntax check</text>
        <text x="125" y="270" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">12-digit UTR validation</text>
        <rect x="25" y="480" width="200" height="50" rx="8" fill="#0f172a" />
        <text x="125" y="512" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#38bdf8" font-weight="bold" text-anchor="middle">Catches VPA Mismatches</text>
      </g>

      <!-- Step 3 -->
      <g transform="translate(660, 200)">
        <rect width="250" height="600" rx="16" fill="#1e293b" stroke="#a855f7" stroke-width="3" />
        <circle cx="125" cy="70" r="36" fill="#9333ea" />
        <text x="125" y="80" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" fill="#ffffff" font-weight="bold" text-anchor="middle">3</text>
        <text x="125" y="150" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#c084fc" font-weight="bold" text-anchor="middle">Multi-Layer Hashing</text>
        <text x="125" y="210" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">SHA-256 (exact duplicate)</text>
        <text x="125" y="240" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">64-bit Difference Hash</text>
        <text x="125" y="270" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">Catches cropped images</text>
        <rect x="25" y="480" width="200" height="50" rx="8" fill="#0f172a" />
        <text x="125" y="512" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#c084fc" font-weight="bold" text-anchor="middle">Resilient Visual dHash</text>
      </g>

      <!-- Step 4 -->
      <g transform="translate(940, 200)">
        <rect width="250" height="600" rx="16" fill="#1e293b" stroke="#f59e0b" stroke-width="3" />
        <circle cx="125" cy="70" r="36" fill="#d97706" />
        <text x="125" y="80" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" fill="#ffffff" font-weight="bold" text-anchor="middle">4</text>
        <text x="125" y="150" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#fbbf24" font-weight="bold" text-anchor="middle">OCR Consistency</text>
        <text x="125" y="210" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">Reads visible text</text>
        <text x="125" y="240" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">Extracts visible UTR</text>
        <text x="125" y="270" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">Compares visible fee</text>
        <rect x="25" y="480" width="200" height="50" rx="8" fill="#0f172a" />
        <text x="125" y="512" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#fbbf24" font-weight="bold" text-anchor="middle">Native Tesseract OCR</text>
      </g>

      <!-- Step 5 -->
      <g transform="translate(1220, 200)">
        <rect width="250" height="600" rx="16" fill="#1e293b" stroke="#10b981" stroke-width="3" />
        <circle cx="125" cy="70" r="36" fill="#059669" />
        <text x="125" y="80" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" fill="#ffffff" font-weight="bold" text-anchor="middle">5</text>
        <text x="125" y="150" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#34d399" font-weight="bold" text-anchor="middle">Bank Reconciliation</text>
        <text x="125" y="210" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">Authoritative source</text>
        <text x="125" y="240" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">Settlement ledger feed</text>
        <text x="125" y="270" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">Mandatory for approval</text>
        <rect x="25" y="480" width="200" height="50" rx="8" fill="#0f172a" />
        <text x="125" y="512" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#34d399" font-weight="bold" text-anchor="middle">True Fund Verification</text>
      </g>

      <!-- Step 6 -->
      <g transform="translate(1500, 200)">
        <rect width="250" height="600" rx="16" fill="#1e293b" stroke="#ec4899" stroke-width="3" />
        <circle cx="125" cy="70" r="36" fill="#db2777" />
        <text x="125" y="80" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" fill="#ffffff" font-weight="bold" text-anchor="middle">6</text>
        <text x="125" y="150" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#f472b6" font-weight="bold" text-anchor="middle">Staff Review &amp; Audit</text>
        <text x="125" y="210" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">Human verification</text>
        <text x="125" y="240" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">Explainable risk flags</text>
        <text x="125" y="270" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">Immutable audit log</text>
        <rect x="25" y="480" width="200" height="50" rx="8" fill="#0f172a" />
        <text x="125" y="512" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#f472b6" font-weight="bold" text-anchor="middle">Logged Staff Sign-off</text>
      </g>

      <!-- Connecting Arrows -->
      <path d="M350 500 L380 500" stroke="#f59e0b" stroke-width="4" stroke-dasharray="6" />
      <path d="M630 500 L660 500" stroke="#f59e0b" stroke-width="4" stroke-dasharray="6" />
      <path d="M910 500 L940 500" stroke="#f59e0b" stroke-width="4" stroke-dasharray="6" />
      <path d="M1190 500 L1220 500" stroke="#f59e0b" stroke-width="4" stroke-dasharray="6" />
      <path d="M1470 500 L1500 500" stroke="#f59e0b" stroke-width="4" stroke-dasharray="6" />

      <!-- Footer Banner -->
      <rect x="100" y="850" width="1650" height="90" rx="12" fill="#1e293b" stroke="#334155" stroke-width="2" />
      <text x="960" y="905" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#38bdf8" font-weight="bold" text-anchor="middle">Key Rule: AI &amp; Hashing Provide Explainable Risk Signals — Final Decisions Rest with Authorized Officers</text>
    </svg>
    `
  },

  // Scene 3: Examine a Payment Screenshot
  {
    name: 'scene3.png',
    svg: `
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1920" height="1080" fill="#0b1329" />
      <rect x="0" y="0" width="1920" height="16" fill="#f59e0b" />
      <rect x="0" y="1064" width="1920" height="16" fill="#f59e0b" />

      <text x="960" y="90" font-family="DejaVu Sans, Arial, sans-serif" font-size="38" fill="#ffffff" font-weight="bold" text-anchor="middle">ANATOMY OF A PAYMENT RECEIPT</text>
      <text x="960" y="130" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#94a3b8" text-anchor="middle">4 Critical Areas Staff Must Inspect on Submitted Evidence</text>

      <!-- Left Card: Screenshot Preview -->
      <g transform="translate(100, 180)">
        <rect width="700" height="780" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="3" />
        <rect width="700" height="70" rx="16" fill="#dc2626" />
        <rect y="50" width="700" height="20" fill="#dc2626" />
        <text x="350" y="46" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#ffffff" font-weight="bold" text-anchor="middle">DEMO — NOT A REAL PAYMENT</text>
        
        <circle cx="350" cy="170" r="38" fill="#dcfce7" stroke="#16a34a" stroke-width="3" />
        <path d="M336 170 L346 180 L366 156" fill="none" stroke="#16a34a" stroke-width="5" stroke-linecap="round" />
        <text x="350" y="240" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" fill="#16a34a" font-weight="bold" text-anchor="middle">Paid Successfully</text>
        
        <text x="350" y="320" font-family="DejaVu Sans, Arial, sans-serif" font-size="44" fill="#0f172a" font-weight="bold" text-anchor="middle">₹500.00</text>
        <line x1="50" y1="360" x2="650" y2="360" stroke="#e2e8f0" stroke-width="2" />

        <text x="60" y="410" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#64748b" font-weight="bold">PAID TO BENEFICIARY</text>
        <text x="60" y="440" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#0b3578" font-weight="bold">PRINCIPAL KU COLLEGE OF ENGG &amp; TECH</text>

        <rect x="50" y="480" width="600" height="70" rx="8" fill="#eff6ff" stroke="#bfdbfe" stroke-width="2" />
        <text x="70" y="508" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#1e40af" font-weight="bold">12-DIGIT BANK REFERENCE / UTR</text>
        <text x="70" y="535" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#0b3578" font-weight="bold" letter-spacing="2">428190123456</text>

        <text x="60" y="590" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#64748b">Date: 26 Oct 2026, 02:30 PM IST</text>
        <text x="60" y="620" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#64748b">Debited: SBI Bank A/c •••• 9812</text>

        <rect y="720" width="700" height="60" rx="16" fill="#fef2f2" />
        <rect y="720" width="700" height="20" fill="#fef2f2" />
        <text x="350" y="755" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#b91c1c" font-weight="bold" text-anchor="middle">SYNTHETIC EVIDENCE FOR STAFF TRAINING ONLY</text>
      </g>

      <!-- Right Inspection Cards -->
      <g transform="translate(860, 180)">
        <!-- Callout 1 -->
        <rect width="960" height="170" rx="12" fill="#1e293b" stroke="#22c55e" stroke-width="2" />
        <circle cx="50" cy="50" r="24" fill="#16a34a" />
        <text x="50" y="58" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#ffffff" font-weight="bold" text-anchor="middle">1</text>
        <text x="100" y="45" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#4ade80" font-weight="bold">Displayed Payment Status</text>
        <text x="100" y="75" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#cbd5e1">Shows "Paid Successfully" or green checkmark. WARNING: Free apps generate fake successful UPI screens!</text>
        <text x="100" y="105" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="#f87171" font-weight="bold">NEVER accept visual success status alone as receipt of funds.</text>

        <!-- Callout 2 -->
        <g transform="translate(0, 200)">
          <rect width="960" height="170" rx="12" fill="#1e293b" stroke="#3b82f6" stroke-width="2" />
          <circle cx="50" cy="50" r="24" fill="#2563eb" />
          <text x="50" y="58" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#ffffff" font-weight="bold" text-anchor="middle">2</text>
          <text x="100" y="45" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#60a5fa" font-weight="bold">Payment Amount &amp; Category</text>
          <text x="100" y="75" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#cbd5e1">Verify whether the amount matches the exact fee: Tuition Fee (SFC ₹70,000 / Non-SFC ₹35,000) or Bonafide Fee (₹500).</text>
          <text x="100" y="105" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="#f59e0b" font-weight="bold">Watch for partial payments, old fees, or manipulated numbers.</text>
        </g>

        <!-- Callout 3 -->
        <g transform="translate(0, 400)">
          <rect width="960" height="170" rx="12" fill="#1e293b" stroke="#a855f7" stroke-width="2" />
          <circle cx="50" cy="50" r="24" fill="#9333ea" />
          <text x="50" y="58" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#ffffff" font-weight="bold" text-anchor="middle">3</text>
          <text x="100" y="45" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#c084fc" font-weight="bold">12-Digit Bank UTR / Reference</text>
          <text x="100" y="75" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#cbd5e1">Every genuine Indian UPI transfer receives a 12-digit numeric Reference from the remitter's bank.</text>
          <text x="100" y="105" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="#c084fc" font-weight="bold">Do not confuse UTR numbers with UPI VPA addresses (e.g. name@okhdfcbank).</text>
        </g>

        <!-- Callout 4 -->
        <g transform="translate(0, 600)">
          <rect width="960" height="170" rx="12" fill="#1e293b" stroke="#f59e0b" stroke-width="2" />
          <circle cx="50" cy="50" r="24" fill="#d97706" />
          <text x="50" y="58" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#ffffff" font-weight="bold" text-anchor="middle">4</text>
          <text x="100" y="45" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#fbbf24" font-weight="bold">Beneficiary / Payee Details</text>
          <text x="100" y="75" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#cbd5e1">Must explicitly read "PRINCIPAL KU COLLEGE OF ENGG &amp; TECH".</text>
          <text x="100" y="105" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="#f87171" font-weight="bold">Reject payments made to personal mobile numbers or unauthorized private handles.</text>
        </g>
      </g>
    </svg>
    `
  },

  // Scene 4: Student Submission Portal
  {
    name: 'scene4.png',
    svg: `
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1920" height="1080" fill="#0f172a" />
      <rect x="0" y="0" width="1920" height="16" fill="#f59e0b" />
      <rect x="0" y="1064" width="1920" height="16" fill="#f59e0b" />

      <text x="960" y="90" font-family="DejaVu Sans, Arial, sans-serif" font-size="38" fill="#ffffff" font-weight="bold" text-anchor="middle">STUDENT SUBMISSION PORTAL</text>
      <text x="960" y="130" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#94a3b8" text-anchor="middle">How Candidates Submit Payment Proofs in KUCET CMS</text>

      <!-- Center Browser Window -->
      <g transform="translate(260, 180)">
        <rect width="1400" height="780" rx="16" fill="#ffffff" stroke="#334155" stroke-width="2" />
        <rect width="1400" height="50" rx="16" fill="#e2e8f0" />
        <circle cx="30" cy="25" r="8" fill="#ef4444" />
        <circle cx="55" cy="25" r="8" fill="#f59e0b" />
        <circle cx="80" cy="25" r="8" fill="#10b981" />
        <rect x="200" y="12" width="1000" height="26" rx="6" fill="#ffffff" />
        <text x="220" y="30" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#64748b">https://kucet.ac.in/student/requests/new-certificate</text>

        <!-- Form Content -->
        <text x="60" y="100" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" fill="#0b3578" font-weight="bold">Bonafide Certificate Payment Submission</text>

        <!-- QR Box -->
        <g transform="translate(60, 130)">
          <rect width="360" height="420" rx="12" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2" />
          <rect x="70" y="40" width="220" height="220" fill="#ffffff" stroke="#0b3578" stroke-width="4" />
          <!-- QR pattern mock -->
          <rect x="90" y="60" width="60" height="60" fill="#0b3578" />
          <rect x="210" y="60" width="60" height="60" fill="#0b3578" />
          <rect x="90" y="180" width="60" height="60" fill="#0b3578" />
          <rect x="170" y="140" width="40" height="40" fill="#f59e0b" />
          <text x="180" y="300" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#0b3578" font-weight="bold" text-anchor="middle">Official Institutional QR Code</text>
          <text x="180" y="330" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#64748b" text-anchor="middle">UPI: principal.kucet@sbi</text>
          <text x="180" y="360" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#15803d" font-weight="bold" text-anchor="middle">Fixed Fee: ₹500.00</text>
        </g>

        <!-- Right Inputs -->
        <g transform="translate(460, 130)">
          <!-- File Upload -->
          <text x="0" y="30" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="#334155" font-weight="bold">1. Upload Payment Screenshot (JPEG, PNG, WebP)</text>
          <rect x="0" y="45" width="860" height="130" rx="10" fill="#f1f5f9" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6" />
          <text x="430" y="105" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#475569" text-anchor="middle">✓ payment_receipt_26oct.png (1.2 MB selected)</text>
          <text x="430" y="135" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#16a34a" text-anchor="middle">Auto-Fingerprinted: SHA-256 + 64-bit dHash calculated server-side</text>

          <!-- Input UTR -->
          <text x="0" y="220" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="#334155" font-weight="bold">2. Bank Transaction Reference (12-Digit UTR)</text>
          <rect x="0" y="235" width="860" height="50" rx="8" fill="#ffffff" stroke="#0b3578" stroke-width="2" />
          <text x="20" y="267" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#0b3578" font-weight="bold" letter-spacing="2">428190123456</text>

          <!-- Submit Button -->
          <rect x="0" y="320" width="860" height="60" rx="10" fill="#0b3578" />
          <text x="430" y="358" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#ffffff" font-weight="bold" text-anchor="middle">Submit Application &amp; Payment Evidence</text>

          <!-- Notice -->
          <rect x="0" y="410" width="860" height="70" rx="8" fill="#fffbeb" stroke="#fde68a" stroke-width="1" />
          <text x="430" y="440" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#92400e" font-weight="bold" text-anchor="middle">Status Notice: Application status remains SUBMITTED / NEEDS_REVIEW</text>
          <text x="430" y="462" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" fill="#92400e" text-anchor="middle">Payment is verified only after official university bank reconciliation is completed.</text>
        </g>
      </g>
    </svg>
    `
  },

  // Scene 5: Test Case 1 - Genuine Payment Evidence
  {
    name: 'scene5.png',
    svg: `
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1920" height="1080" fill="#0b1329" />
      <rect x="0" y="0" width="1920" height="16" fill="#10b981" />
      <rect x="0" y="1064" width="1920" height="16" fill="#10b981" />

      <!-- Scenario Badge -->
      <rect x="100" y="40" width="280" height="40" rx="20" fill="#10b981" />
      <text x="240" y="66" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#ffffff" font-weight="bold" text-anchor="middle">TEST SCENARIO 1</text>
      
      <text x="960" y="90" font-family="DejaVu Sans, Arial, sans-serif" font-size="38" fill="#ffffff" font-weight="bold" text-anchor="middle">GENUINE EVIDENCE + BANK RECONCILIATION</text>
      <text x="960" y="130" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#94a3b8" text-anchor="middle">Student A: Legit Receipt, Matching UTR, Confirmed SBI Settlement Ledger</text>

      <!-- 2 Side-by-Side Comparison Cards -->
      <!-- Left: Student A Submission -->
      <g transform="translate(140, 180)">
        <rect width="780" height="680" rx="16" fill="#1e293b" stroke="#334155" stroke-width="2" />
        <rect width="780" height="60" rx="16" fill="#0f172a" />
        <text x="40" y="38" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#60a5fa" font-weight="bold">Candidate Evidence: Student A</text>

        <g transform="translate(40, 90)">
          <text x="0" y="30" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#94a3b8">Application No:</text>
          <text x="200" y="30" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#ffffff" font-weight="bold">KUCET-2026-APP-101</text>

          <text x="0" y="80" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#94a3b8">Submitted UTR:</text>
          <text x="200" y="80" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#38bdf8" font-weight="bold" letter-spacing="2">428190123456</text>

          <text x="0" y="130" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#94a3b8">Expected Fee:</text>
          <text x="200" y="130" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#ffffff" font-weight="bold">₹500.00 (Bonafide Fee)</text>

          <text x="0" y="180" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#94a3b8">Image SHA-256:</text>
          <text x="200" y="180" font-family="monospace" font-size="14" fill="#a78bfa" >e3b0c44298fc1c149afbf4c8996fb92427ae41e...</text>

          <text x="0" y="230" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#94a3b8">Duplicate Check:</text>
          <text x="200" y="230" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#4ade80" font-weight="bold">✓ UNIQUE (0 prior occurrences)</text>

          <text x="0" y="280" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#94a3b8">OCR Verification:</text>
          <text x="200" y="280" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#4ade80" font-weight="bold">✓ Text matches UTR &amp; Amount</text>
        </g>

        <!-- Initial Status Box -->
        <rect x="40" y="460" width="700" height="160" rx="12" fill="#0f172a" stroke="#334155" stroke-width="2" />
        <text x="390" y="500" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle">Initial Automated State:</text>
        <text x="390" y="540" font-family="DejaVu Sans, Arial, sans-serif" font-size="28" fill="#f59e0b" font-weight="bold" text-anchor="middle">STATUS: NEEDS_REVIEW</text>
        <text x="390" y="580" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1" text-anchor="middle">Awaiting authoritative bank reconciliation match</text>
      </g>

      <!-- Right: Authoritative Bank Reconciliation Match -->
      <g transform="translate(1000, 180)">
        <rect width="780" height="680" rx="16" fill="#1e293b" stroke="#10b981" stroke-width="3" />
        <rect width="780" height="60" rx="16" fill="#064e3b" />
        <text x="40" y="38" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#34d399" font-weight="bold">Authoritative Bank Settlement Ledger</text>

        <g transform="translate(40, 90)">
          <text x="0" y="30" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#94a3b8">Source Channel:</text>
          <text x="220" y="30" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#ffffff" font-weight="bold">SBI Direct Core Banking Feed</text>

          <text x="0" y="80" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#94a3b8">Bank Txn Ref:</text>
          <text x="220" y="80" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#34d399" font-weight="bold" letter-spacing="2">428190123456</text>

          <text x="0" y="130" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#94a3b8">Credit Amount:</text>
          <text x="220" y="130" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#ffffff" font-weight="bold">₹500.00 (Cleared Funds)</text>

          <text x="0" y="180" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#94a3b8">Beneficiary:</text>
          <text x="220" y="180" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#ffffff">PRINCIPAL KU COLLEGE OF ENGG</text>

          <text x="0" y="230" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#94a3b8">Reconciliation:</text>
          <text x="220" y="230" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#34d399" font-weight="bold">✓ 100% MATCH CONFIRMED</text>
        </g>

        <!-- Final Status Box -->
        <rect x="40" y="460" width="700" height="160" rx="12" fill="#064e3b" stroke="#10b981" stroke-width="2" />
        <circle cx="90" cy="540" r="32" fill="#10b981" />
        <path d="M78 540 L86 548 L102 528" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" />
        <text x="140" y="525" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#a7f3d0" font-weight="bold">FINAL AUTHORITATIVE VERIFICATION</text>
        <text x="140" y="565" font-family="DejaVu Sans, Arial, sans-serif" font-size="34" fill="#ffffff" font-weight="900">STATUS: VERIFIED</text>
      </g>

      <rect x="140" y="900" width="1640" height="70" rx="12" fill="#0f172a" stroke="#334155" stroke-width="1" />
      <text x="960" y="942" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#cbd5e1" text-anchor="middle">Rule Demonstrated: Genuine evidence transitions to VERIFIED only when corroborated by authoritative bank records.</text>
    </svg>
    `
  },

  // Scene 6: Test Case 2 - Reused Proof + Field Mismatch
  {
    name: 'scene6.png',
    svg: `
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1920" height="1080" fill="#0b1329" />
      <rect x="0" y="0" width="1920" height="16" fill="#f59e0b" />
      <rect x="0" y="1064" width="1920" height="16" fill="#f59e0b" />

      <!-- Scenario Badge -->
      <rect x="100" y="40" width="280" height="40" rx="20" fill="#f59e0b" />
      <text x="240" y="66" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#0f172a" font-weight="bold" text-anchor="middle">TEST SCENARIO 2</text>
      
      <text x="960" y="90" font-family="DejaVu Sans, Arial, sans-serif" font-size="38" fill="#ffffff" font-weight="bold" text-anchor="middle">REUSED SCREENSHOT &amp; IDENTIFIER MISMATCH</text>
      <text x="960" y="130" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#94a3b8" text-anchor="middle">Student B: Submits Student A's Screenshot + Pastes 12-digit UTR into UPI ID Field</text>

      <!-- Center Comparison Grid -->
      <g transform="translate(160, 180)">
        <rect width="1600" height="740" rx="16" fill="#1e293b" stroke="#f59e0b" stroke-width="3" />
        
        <!-- Header -->
        <rect width="1600" height="70" rx="16" fill="#78350f" />
        <text x="40" y="45" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#fef3c7" font-weight="bold">Fraud &amp; Integrity Guard Evaluation: Student B (KUCET-APP-102)</text>

        <!-- 2 Warning Cards -->
        <g transform="translate(60, 110)">
          <!-- Risk Banner 1: Field Mismatch -->
          <rect width="700" height="260" rx="12" fill="#0f172a" stroke="#f59e0b" stroke-width="2" />
          <rect width="700" height="45" rx="12" fill="#b45309" />
          <text x="20" y="30" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#ffffff" font-weight="bold">⚠️ RISK FLAG 1: IDENTIFIER_TYPE_MISMATCH</text>
          <g transform="translate(20, 65)">
            <text x="0" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="#94a3b8">Submitted Value in UPI ID Field:</text>
            <text x="280" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#f87171" font-weight="bold">"428190123456"</text>
            <text x="0" y="65" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1">Semantic Detection:</text>
            <text x="0" y="95" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#fbbf24">• Field requires a UPI VPA (e.g. name@okhdfcbank)</text>
            <text x="0" y="125" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#fbbf24">• Received a 12-digit numeric bank reference format</text>
            <text x="0" y="165" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#94a3b8">Risk Contribution: +35 points</text>
          </g>

          <!-- Risk Banner 2: Exact Duplicate Image -->
          <g transform="translate(760, 0)">
            <rect width="720" height="260" rx="12" fill="#0f172a" stroke="#ef4444" stroke-width="2" />
            <rect width="720" height="45" rx="12" fill="#b91c1c" />
            <text x="20" y="30" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#ffffff" font-weight="bold">🚨 RISK FLAG 2: EXACT_IMAGE_DUPLICATE</text>
            <g transform="translate(20, 65)">
              <text x="0" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="#94a3b8">Cryptographic SHA-256 Match:</text>
              <text x="240" y="25" font-family="monospace" font-size="15" fill="#f87171" >e3b0c44298fc1c149a...</text>
              <text x="0" y="65" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1">Database Hash Conflict:</text>
              <text x="0" y="95" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#fca5a5">• Image byte hash identical to a previously submitted payment proof</text>
              <text x="0" y="125" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#4ade80">• PRIVACY SAFEGUARD: Student A PII redacted</text>
              <text x="0" y="165" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#94a3b8">Risk Contribution: +50 points (Composite Risk: 85/100)</text>
            </g>
          </g>
        </g>

        <!-- Final Status & Action Required Box -->
        <g transform="translate(60, 420)">
          <rect width="1480" height="260" rx="12" fill="#0f172a" stroke="#334155" stroke-width="2" />
          <text x="40" y="50" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#93c5fd" font-weight="bold">System Automated Resolution:</text>
          
          <rect x="40" y="80" width="360" height="60" rx="8" fill="#78350f" stroke="#f59e0b" stroke-width="2" />
          <text x="220" y="120" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" fill="#fef3c7" font-weight="bold" text-anchor="middle">STATUS: NEEDS_REVIEW</text>

          <text x="440" y="105" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#ffffff" font-weight="bold">Action Required by Admission Staff:</text>
          <text x="440" y="135" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="#cbd5e1">1. Do not auto-reject: Investigate if student re-submitted an accidental duplicate or genuine sibling payment.</text>
          <text x="440" y="165" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="#cbd5e1">2. Check university bank statement for a separate deposit by Student B.</text>
          <text x="440" y="195" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="#cbd5e1">3. Record reasoned decision (Verified or Rejected) with supporting audit notes.</text>
        </g>
      </g>
    </svg>
    `
  },

  // Scene 7: Test Case 3 - Cropped Reused Screenshot
  {
    name: 'scene7.png',
    svg: `
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1920" height="1080" fill="#0b1329" />
      <rect x="0" y="0" width="1920" height="16" fill="#a855f7" />
      <rect x="0" y="1064" width="1920" height="16" fill="#a855f7" />

      <!-- Scenario Badge -->
      <rect x="100" y="40" width="280" height="40" rx="20" fill="#a855f7" />
      <text x="240" y="66" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#ffffff" font-weight="bold" text-anchor="middle">TEST SCENARIO 3</text>
      
      <text x="960" y="90" font-family="DejaVu Sans, Arial, sans-serif" font-size="38" fill="#ffffff" font-weight="bold" text-anchor="middle">CROPPED SCREENSHOT + PERCEPTUAL HASHING</text>
      <text x="960" y="130" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#94a3b8" text-anchor="middle">Student C: Crops Student A Screenshot — Byte Hash Fails, but 64-bit dHash Catches Similarity</text>

      <!-- Comparison of Cryptographic vs Perceptual Hash -->
      <g transform="translate(140, 180)">
        <!-- Box 1: Why SHA-256 Fails -->
        <rect width="780" height="720" rx="16" fill="#1e293b" stroke="#ef4444" stroke-width="2" />
        <rect width="780" height="60" rx="16" fill="#7f1d1d" />
        <text x="40" y="38" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#fca5a5" font-weight="bold">1. Traditional Cryptographic Byte Hash (SHA-256)</text>

        <g transform="translate(40, 90)">
          <text x="0" y="30" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#94a3b8">Student A Original Hash:</text>
          <text x="0" y="60" font-family="monospace" font-size="14" fill="#ffffff" >e3b0c44298fc1c149afbf4c8996fb92427ae41e...</text>

          <text x="0" y="120" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#94a3b8">Student C Cropped Image Hash:</text>
          <text x="0" y="150" font-family="monospace" font-size="14" fill="#f87171" >8b1a9953c4611296a827abf8c47804d7...</text>

          <rect x="0" y="210" width="700" height="110" rx="10" fill="#0f172a" stroke="#ef4444" stroke-width="1" />
          <text x="20" y="245" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#ef4444" font-weight="bold">LIMITATION OF SHA-256</text>
          <text x="20" y="275" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1">Cropping or recompressing changes image pixels. SHA-256 reports "DIFFERENT FILE".</text>
          <text x="20" y="300" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1">A system using only SHA-256 would miss the fraud completely!</text>

          <g transform="translate(0, 360)">
            <rect width="700" height="230" rx="10" fill="#0f172a" />
            <text x="350" y="100" font-family="DejaVu Sans, Arial, sans-serif" font-size="28" fill="#ef4444" font-weight="bold" text-anchor="middle">❌ SHA-256: NO MATCH DETECTED</text>
            <text x="350" y="140" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#94a3b8" text-anchor="middle">(Byte avalanche effect renders exact hashes useless on modified media)</text>
          </g>
        </g>
      </g>

      <!-- Box 2: How KUCET dHash Catches It -->
      <g transform="translate(1000, 180)">
        <rect width="780" height="720" rx="16" fill="#1e293b" stroke="#a855f7" stroke-width="3" />
        <rect width="780" height="60" rx="16" fill="#581c87" />
        <text x="40" y="38" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#e9d5ff" font-weight="bold">2. KUCET Perceptual Difference Hash (dHash)</text>

        <g transform="translate(40, 90)">
          <text x="0" y="30" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#94a3b8">How dHash Works in KUCET CMS:</text>
          <text x="0" y="60" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#e9d5ff">• Converts screenshot to 9x8 grayscale matrix using Sharp</text>
          <text x="0" y="85" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#e9d5ff">• Compares adjacent pixel gradient values (64-bit fingerprint)</text>
          <text x="0" y="110" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#e9d5ff">• Calculates Hamming Distance across submitted receipts</text>

          <rect x="0" y="150" width="700" height="150" rx="10" fill="#0f172a" stroke="#a855f7" stroke-width="1" />
          <text x="20" y="185" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#c084fc" font-weight="bold">PERCEPTUAL MATCH DETECTED</text>
          <text x="20" y="220" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="#ffffff">Student A dHash: </text>
          <text x="160" y="220" font-family="monospace" font-size="14" fill="#a78bfa" >00110011aacc8844</text>
          <text x="20" y="250" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="#ffffff">Student C dHash: </text>
          <text x="160" y="250" font-family="monospace" font-size="14" fill="#a78bfa" >00110011aacc884e (Distance: 2)</text>
          <text x="20" y="280" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#4ade80" font-weight="bold">Calculated Visual Similarity: 96.8% (Threshold: &gt;= 82%)</text>

          <g transform="translate(0, 340)">
            <rect width="700" height="250" rx="10" fill="#0f172a" stroke="#a855f7" stroke-width="2" />
            <circle cx="80" cy="80" r="32" fill="#9333ea" />
            <text x="80" y="90" font-family="DejaVu Sans, Arial, sans-serif" font-size="28" fill="#ffffff" font-weight="bold" text-anchor="middle">⚠️</text>
            <text x="140" y="70" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#e9d5ff" font-weight="bold">FLAG: PERCEPTUAL_IMAGE_MATCH</text>
            <text x="140" y="100" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1">Suspected cropped or recompressed version of earlier evidence</text>
            <text x="140" y="140" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" fill="#f59e0b" font-weight="bold">Status: NEEDS_REVIEW</text>
            <text x="140" y="170" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#94a3b8">Routed to human review with explainable similarity score</text>
          </g>
        </g>
      </g>
    </svg>
    `
  },

  // Scene 8: Test Case 4 - Cropped with Altered Reference (OCR)
  {
    name: 'scene8.png',
    svg: `
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1920" height="1080" fill="#0b1329" />
      <rect x="0" y="0" width="1920" height="16" fill="#ef4444" />
      <rect x="0" y="1064" width="1920" height="16" fill="#ef4444" />

      <!-- Scenario Badge -->
      <rect x="100" y="40" width="280" height="40" rx="20" fill="#ef4444" />
      <text x="240" y="66" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#ffffff" font-weight="bold" text-anchor="middle">TEST SCENARIO 4</text>
      
      <text x="960" y="90" font-family="DejaVu Sans, Arial, sans-serif" font-size="38" fill="#ffffff" font-weight="bold" text-anchor="middle">OCR EXTRACTION &amp; DECEPTIVE REFERENCE MISMATCH</text>
      <text x="960" y="130" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#94a3b8" text-anchor="middle">Student D: Submits Image Visible UTR 428190123456, but Enters Altered Reference 428190123499</text>

      <g transform="translate(160, 180)">
        <rect width="1600" height="740" rx="16" fill="#1e293b" stroke="#ef4444" stroke-width="3" />
        <rect width="1600" height="60" rx="16" fill="#7f1d1d" />
        <text x="40" y="38" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#fca5a5" font-weight="bold">Automated OCR Text Extraction vs Entered Input Discrepancy</text>

        <!-- 3 Comparison Columns -->
        <!-- Col 1: Submitted Input -->
        <g transform="translate(60, 100)">
          <rect width="450" height="580" rx="12" fill="#0f172a" stroke="#334155" stroke-width="2" />
          <rect width="450" height="50" rx="12" fill="#1e293b" />
          <text x="225" y="32" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#93c5fd" font-weight="bold" text-anchor="middle">1. Entered by Student D</text>
          
          <g transform="translate(30, 80)">
            <text x="0" y="20" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#94a3b8">Entered Transaction Ref:</text>
            <rect x="0" y="40" width="390" height="50" rx="6" fill="#1e293b" stroke="#ef4444" stroke-width="2" />
            <text x="20" y="72" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#f87171" font-weight="bold" letter-spacing="1">428190123499</text>

            <text x="0" y="140" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#94a3b8">Claimed Amount:</text>
            <text x="0" y="170" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#ffffff" font-weight="bold">₹500.00</text>

            <text x="0" y="230" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#94a3b8">Candidate Remarks:</text>
            <text x="0" y="260" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1">"Fee paid via PhonePe"</text>
          </g>
        </g>

        <!-- Col 2: OCR Extracted -->
        <g transform="translate(570, 100)">
          <rect width="450" height="580" rx="12" fill="#0f172a" stroke="#f59e0b" stroke-width="2" />
          <rect width="450" height="50" rx="12" fill="#78350f" />
          <text x="225" y="32" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#fde68a" font-weight="bold" text-anchor="middle">2. OCR Visible Text (Tesseract)</text>
          
          <g transform="translate(30, 80)">
            <text x="0" y="20" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#94a3b8">Extracted Visible UTR:</text>
            <rect x="0" y="40" width="390" height="50" rx="6" fill="#1e293b" stroke="#f59e0b" stroke-width="2" />
            <text x="20" y="72" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#fbbf24" font-weight="bold" letter-spacing="1">428190123456</text>

            <text x="0" y="140" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#94a3b8">Extracted Visible Amount:</text>
            <text x="0" y="170" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#4ade80" font-weight="bold">₹500.00</text>

            <text x="0" y="230" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#94a3b8">Visible Status Word:</text>
            <text x="0" y="260" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#4ade80" font-weight="bold">SUCCESSFUL</text>
          </g>
        </g>

        <!-- Col 3: Comparison Verdict -->
        <g transform="translate(1080, 100)">
          <rect width="460" height="580" rx="12" fill="#0f172a" stroke="#ef4444" stroke-width="3" />
          <rect width="460" height="50" rx="12" fill="#b91c1c" />
          <text x="230" y="32" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#ffffff" font-weight="bold" text-anchor="middle">3. Automated Verdict</text>
          
          <g transform="translate(30, 80)">
            <rect x="0" y="10" width="400" height="120" rx="8" fill="#7f1d1d" stroke="#ef4444" stroke-width="2" />
            <text x="200" y="50" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#ffffff" font-weight="bold" text-anchor="middle">⚠️ FLAG: OCR_DISCREPANCY</text>
            <text x="200" y="80" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#fca5a5" text-anchor="middle">Entered UTR (*499) contradicts</text>
            <text x="200" y="102" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#fca5a5" text-anchor="middle">visible screenshot receipt UTR (*456)</text>

            <rect x="0" y="160" width="400" height="90" rx="8" fill="#1e293b" />
            <text x="20" y="195" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#94a3b8">Bank Reconciliation Status:</text>
            <text x="20" y="225" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="#f87171" font-weight="bold">No Bank Record for *499</text>

            <rect x="0" y="280" width="400" height="120" rx="8" fill="#0f172a" stroke="#f59e0b" stroke-width="2" />
            <text x="200" y="320" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" fill="#f59e0b" font-weight="bold" text-anchor="middle">STATUS: NEEDS_REVIEW</text>
            <text x="200" y="355" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#cbd5e1" text-anchor="middle">Elevated Risk Score: 60/100</text>
            <text x="200" y="380" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#fca5a5" text-anchor="middle">Staff must request original receipt</text>
          </g>
        </g>
      </g>
    </svg>
    `
  },

  // Scene 9: Staff Review Console
  {
    name: 'scene9.png',
    svg: `
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1920" height="1080" fill="#0f172a" />
      <rect x="0" y="0" width="1920" height="16" fill="#f59e0b" />
      <rect x="0" y="1064" width="1920" height="16" fill="#f59e0b" />

      <text x="960" y="90" font-family="DejaVu Sans, Arial, sans-serif" font-size="38" fill="#ffffff" font-weight="bold" text-anchor="middle">KUCET CMS STAFF PAYMENT MANAGEMENT CONSOLE</text>
      <text x="960" y="130" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#94a3b8" text-anchor="middle">Real CMS Application Interface at /admin/payments with Transaction Modal</text>

      <!-- Dashboard Table Mock -->
      <g transform="translate(100, 180)">
        <rect width="1720" height="780" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" />

        <!-- Top Stats Row -->
        <g transform="translate(40, 30)">
          <rect width="380" height="90" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2" />
          <text x="30" y="40" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" fill="#64748b" font-weight="bold">FEE COLLECTION</text>
          <text x="30" y="72" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" fill="#15803d" font-weight="bold">₹24,50,000</text>

          <rect x="420" y="0" width="380" height="90" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2" />
          <text x="450" y="40" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" fill="#64748b" font-weight="bold">CERTIFICATE REVENUE</text>
          <text x="450" y="72" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" fill="#0b3578" font-weight="bold">₹82,500</text>

          <rect x="840" y="0" width="380" height="90" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2" />
          <text x="870" y="40" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" fill="#64748b" font-weight="bold">PENDING REVIEW</text>
          <text x="870" y="72" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" fill="#d97706" font-weight="bold">4 Submissions</text>

          <rect x="1260" y="0" width="380" height="90" rx="8" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2" />
          <text x="1290" y="40" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" fill="#64748b" font-weight="bold">INTEGRITY FLAGS</text>
          <text x="1290" y="72" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" fill="#dc2626" font-weight="bold">3 Active Alerts</text>
        </g>

        <!-- Table Header -->
        <g transform="translate(40, 150)">
          <rect width="1640" height="40" fill="#f1f5f9" />
          <text x="30" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" fill="#475569" font-weight="bold">DATE</text>
          <text x="160" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" fill="#475569" font-weight="bold">STUDENT / ROLL NO</text>
          <text x="460" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" fill="#475569" font-weight="bold">TYPE</text>
          <text x="600" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" fill="#475569" font-weight="bold">AMOUNT</text>
          <text x="760" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" fill="#475569" font-weight="bold">REFERENCE ID</text>
          <text x="1000" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" fill="#475569" font-weight="bold">STATUS</text>
          <text x="1280" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" fill="#475569" font-weight="bold">INTEGRITY GUARD</text>
          <text x="1530" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" fill="#475569" font-weight="bold">ACTION</text>

          <!-- Row 1: Student A -->
          <g transform="translate(0, 50)">
            <text x="30" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#334155">26 Oct 2026</text>
            <text x="160" y="20" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#0f172a" font-weight="bold">Student A (Demo)</text>
            <text x="160" y="38" font-family="DejaVu Sans, Arial, sans-serif" font-size="11" fill="#64748b">22051A0501 (CSE)</text>
            <text x="460" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#0b3578" font-weight="bold">CERTIFICATE</text>
            <text x="600" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#0f172a" font-weight="bold">₹500</text>
            <text x="760" y="25" font-family="monospace" font-size="13" fill="#334155" >428190123456</text>
            <rect x="990" y="8" width="90" height="26" rx="13" fill="#dcfce7" />
            <text x="1035" y="26" font-family="DejaVu Sans, Arial, sans-serif" font-size="11" fill="#15803d" font-weight="bold" text-anchor="middle">VERIFIED</text>
            <text x="1280" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" fill="#16a34a">✓ Clean / Bank Matched</text>
            <rect x="1510" y="6" width="90" height="28" rx="6" fill="#0b3578" />
            <text x="1555" y="24" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" fill="#ffffff" font-weight="bold" text-anchor="middle">Details</text>
          </g>

          <!-- Row 2: Student B (Flagged) -->
          <g transform="translate(0, 100)">
            <rect y="-5" width="1640" height="50" fill="#fffbeb" />
            <text x="30" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#334155">26 Oct 2026</text>
            <text x="160" y="20" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#0f172a" font-weight="bold">Student B (Demo)</text>
            <text x="160" y="38" font-family="DejaVu Sans, Arial, sans-serif" font-size="11" fill="#64748b">22051A0402 (ECE)</text>
            <text x="460" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#0b3578" font-weight="bold">CERTIFICATE</text>
            <text x="600" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#0f172a" font-weight="bold">₹500</text>
            <text x="760" y="25" font-family="monospace" font-size="13" fill="#334155" >428190123456</text>
            <rect x="990" y="8" width="110" height="26" rx="13" fill="#fef3c7" />
            <text x="1045" y="26" font-family="DejaVu Sans, Arial, sans-serif" font-size="11" fill="#b45309" font-weight="bold" text-anchor="middle">NEEDS_REVIEW</text>
            <rect x="1270" y="6" width="170" height="28" rx="6" fill="#fee2e2" stroke="#fca5a5" stroke-width="1" />
            <text x="1355" y="24" font-family="DejaVu Sans, Arial, sans-serif" font-size="11" fill="#b91c1c" font-weight="bold" text-anchor="middle">⚠️ REUSED SCREENSHOT</text>
            <rect x="1510" y="6" width="90" height="28" rx="6" fill="#b45309" />
            <text x="1555" y="24" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" fill="#ffffff" font-weight="bold" text-anchor="middle">Review</text>
          </g>

          <!-- Row 3: Student D (OCR Discrepancy) -->
          <g transform="translate(0, 150)">
            <rect y="-5" width="1640" height="50" fill="#fef2f2" />
            <text x="30" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#334155">26 Oct 2026</text>
            <text x="160" y="20" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#0f172a" font-weight="bold">Student D (Demo)</text>
            <text x="160" y="38" font-family="DejaVu Sans, Arial, sans-serif" font-size="11" fill="#64748b">22051A0204 (EEE)</text>
            <text x="460" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#0b3578" font-weight="bold">CERTIFICATE</text>
            <text x="600" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#0f172a" font-weight="bold">₹500</text>
            <text x="760" y="25" font-family="monospace" font-size="13" fill="#b91c1c" >428190123499</text>
            <rect x="990" y="8" width="110" height="26" rx="13" fill="#fee2e2" />
            <text x="1045" y="26" font-family="DejaVu Sans, Arial, sans-serif" font-size="11" fill="#b91c1c" font-weight="bold" text-anchor="middle">NEEDS_REVIEW</text>
            <rect x="1270" y="6" width="170" height="28" rx="6" fill="#fef3c7" stroke="#fcd34d" stroke-width="1" />
            <text x="1355" y="24" font-family="DejaVu Sans, Arial, sans-serif" font-size="11" fill="#92400e" font-weight="bold" text-anchor="middle">⚠️ OCR DISCREPANCY</text>
            <rect x="1510" y="6" width="90" height="28" rx="6" fill="#b91c1c" />
            <text x="1555" y="24" font-family="DejaVu Sans, Arial, sans-serif" font-size="12" fill="#ffffff" font-weight="bold" text-anchor="middle">Review</text>
          </g>
        </g>

        <!-- Popover Transaction Details Modal Mock in Foreground -->
        <g transform="translate(460, 240)">
          <rect width="800" height="490" rx="12" fill="#ffffff" stroke="#0b3578" stroke-width="3" filter="drop-shadow(0 20px 25px rgba(0,0,0,0.5))" />
          <rect width="800" height="50" rx="12" fill="#0b3578" />
          <text x="30" y="32" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#ffffff" font-weight="bold">TRANSACTION SECURITY &amp; FRAUD INSPECTION</text>

          <g transform="translate(30, 70)">
            <rect width="740" height="90" rx="8" fill="#fffbeb" stroke="#f59e0b" stroke-width="2" />
            <text x="20" y="30" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="#b45309" font-weight="bold">⚠️ SECURITY &amp; INTEGRITY RISK ALERT</text>
            <text x="20" y="55" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#78350f">• EXACT_IMAGE_DUPLICATE: Screenshot byte hash matches prior record.</text>
            <text x="20" y="75" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#78350f">• IDENTIFIER_TYPE_MISMATCH: 12-digit UTR pasted into UPI ID field.</text>

            <g transform="translate(0, 110)">
              <text x="0" y="25" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#64748b">Verification Method Required:</text>
              <rect x="0" y="35" width="740" height="40" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" />
              <text x="20" y="60" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#0f172a">MANUAL_BANK_STATEMENT_RECONCILIATION</text>

              <text x="0" y="105" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#64748b">Staff Decision Notes / Reason:</text>
              <rect x="0" y="115" width="740" height="50" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" />
              <text x="20" y="145" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#334155">"Confirmed deposit on SBI daily statement dated 26-Oct-2026, Txn Seq #8812"</text>
            </g>

            <!-- Action Buttons -->
            <g transform="translate(0, 310)">
              <rect width="230" height="45" rx="6" fill="#15803d" />
              <text x="115" y="28" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#ffffff" font-weight="bold" text-anchor="middle">✓ Verify Payment</text>

              <rect x="255" y="0" width="230" height="45" rx="6" fill="#dc2626" />
              <text x="370" y="28" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#ffffff" font-weight="bold" text-anchor="middle">✗ Reject Evidence</text>

              <rect x="510" y="0" width="230" height="45" rx="6" fill="#475569" />
              <text x="625" y="28" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#ffffff" font-weight="bold" text-anchor="middle">Hold in Needs Review</text>
            </g>
          </g>
        </g>
      </g>
    </svg>
    `
  },

  // Scene 10: Common Mistakes to Avoid
  {
    name: 'scene10.png',
    svg: `
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1920" height="1080" fill="#0f172a" />
      <rect x="0" y="0" width="1920" height="16" fill="#dc2626" />
      <rect x="0" y="1064" width="1920" height="16" fill="#dc2626" />

      <text x="960" y="90" font-family="DejaVu Sans, Arial, sans-serif" font-size="38" fill="#ffffff" font-weight="bold" text-anchor="middle">COMMON MISTAKES TO AVOID</text>
      <text x="960" y="130" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#fca5a5" text-anchor="middle">Critical Operational Errors that Compromise Institutional Integrity</text>

      <!-- 6 Mistake Warning Cards in Grid -->
      <g transform="translate(140, 180)">
        <!-- Card 1 -->
        <rect width="500" height="230" rx="12" fill="#1e293b" stroke="#ef4444" stroke-width="2" />
        <text x="30" y="45" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#f87171" font-weight="bold">1. Trusting Visual Screenshot Appearance</text>
        <text x="30" y="85" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1">Never approve simply because a screenshot looks crisp, professional, or has a green tick. Free mock payment apps forge these instantly.</text>
        <rect x="30" y="160" width="440" height="40" rx="6" fill="#7f1d1d" />
        <text x="250" y="185" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#fecaca" font-weight="bold" text-anchor="middle">Rule: Visual appearance is never proof of funds</text>

        <!-- Card 2 -->
        <g transform="translate(570, 0)">
          <rect width="500" height="230" rx="12" fill="#1e293b" stroke="#ef4444" stroke-width="2" />
          <text x="30" y="45" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#f87171" font-weight="bold">2. Confusing UPI ID with Bank UTR</text>
          <text x="30" y="85" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1">A UPI ID (VPA) is an address like student@upi. A UTR is a 12-digit bank reference issued upon transfer completion. They are not interchangeable.</text>
          <rect x="30" y="160" width="440" height="40" rx="6" fill="#7f1d1d" />
          <text x="250" y="185" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#fecaca" font-weight="bold" text-anchor="middle">Rule: Verify identifier type semantics</text>
        </g>

        <!-- Card 3 -->
        <g transform="translate(1140, 0)">
          <rect width="500" height="230" rx="12" fill="#1e293b" stroke="#ef4444" stroke-width="2" />
          <text x="30" y="45" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#f87171" font-weight="bold">3. Auto-Assuming Fraud on Duplicates</text>
          <text x="30" y="85" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1">Do not immediately accuse students. A duplicate alert can occur when a student re-submits after network timeout or submits sibling fees. Investigate first.</text>
          <rect x="30" y="160" width="440" height="40" rx="6" fill="#7f1d1d" />
          <text x="250" y="185" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#fecaca" font-weight="bold" text-anchor="middle">Rule: Warnings are reasons to investigate</text>
        </g>

        <!-- Card 4 -->
        <g transform="translate(0, 270)">
          <rect width="500" height="230" rx="12" fill="#1e293b" stroke="#ef4444" stroke-width="2" />
          <text x="30" y="45" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#f87171" font-weight="bold">4. Ignoring Fee Amount Mismatches</text>
          <text x="30" y="85" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1">Students may upload an old receipt from previous semester or a partial payment. Always compare receipt amount with current fee requirement.</text>
          <rect x="30" y="160" width="440" height="40" rx="6" fill="#7f1d1d" />
          <text x="250" y="185" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#fecaca" font-weight="bold" text-anchor="middle">Rule: Exact fee matching is mandatory</text>
        </g>

        <!-- Card 5 -->
        <g transform="translate(570, 270)">
          <rect width="500" height="230" rx="12" fill="#1e293b" stroke="#ef4444" stroke-width="2" />
          <text x="30" y="45" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#f87171" font-weight="bold">5. Leaving Approval Undocumented</text>
          <text x="30" y="85" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1">Never verify a payment without recording the bank statement date and sequence number. Unrecorded approvals fail external statutory audits.</text>
          <rect x="30" y="160" width="440" height="40" rx="6" fill="#7f1d1d" />
          <text x="250" y="185" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#fecaca" font-weight="bold" text-anchor="middle">Rule: Document reconciliation method</text>
        </g>

        <!-- Card 6 -->
        <g transform="translate(1140, 270)">
          <rect width="500" height="230" rx="12" fill="#1e293b" stroke="#ef4444" stroke-width="2" />
          <text x="30" y="45" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#f87171" font-weight="bold">6. Sharing Banking Proofs Publicly</text>
          <text x="30" y="85" font-family="DejaVu Sans, Arial, sans-serif" font-size="14" fill="#cbd5e1">Candidate receipts contain bank account snippets, mobile numbers, and UPI handles. Never share unredacted screenshots over messaging groups.</text>
          <rect x="30" y="160" width="440" height="40" rx="6" fill="#7f1d1d" />
          <text x="250" y="185" font-family="DejaVu Sans, Arial, sans-serif" font-size="13" fill="#fecaca" font-weight="bold" text-anchor="middle">Rule: Enforce student data privacy</text>
        </g>
      </g>
    </svg>
    `
  },

  // Scene 11: Staff Checklist
  {
    name: 'scene11.png',
    svg: `
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1920" height="1080" fill="#0f172a" />
      <rect x="0" y="0" width="1920" height="16" fill="#10b981" />
      <rect x="0" y="1064" width="1920" height="16" fill="#10b981" />

      <text x="960" y="90" font-family="DejaVu Sans, Arial, sans-serif" font-size="38" fill="#ffffff" font-weight="bold" text-anchor="middle">STAFF OPERATIONAL CHECKLIST</text>
      <text x="960" y="130" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#94a3b8" text-anchor="middle">7 Questions to Answer Before Approving Any Admission or Fee Payment</text>

      <!-- Checklist Items -->
      <g transform="translate(260, 180)">
        <rect width="1400" height="780" rx="16" fill="#1e293b" stroke="#10b981" stroke-width="2" />

        <!-- 7 Checklist Rows -->
        <!-- Item 1 -->
        <g transform="translate(60, 40)">
          <circle cx="30" cy="30" r="22" fill="#10b981" />
          <path d="M22 30 L28 36 L38 24" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
          <text x="80" y="38" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#ffffff" font-weight="bold">1. Is the correct student / application record open?</text>
        </g>

        <!-- Item 2 -->
        <g transform="translate(60, 140)">
          <circle cx="30" cy="30" r="22" fill="#10b981" />
          <path d="M22 30 L28 36 L38 24" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
          <text x="80" y="38" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#ffffff" font-weight="bold">2. Does the fee amount match the candidate's course, branch, and category?</text>
        </g>

        <!-- Item 3 -->
        <g transform="translate(60, 240)">
          <circle cx="30" cy="30" r="22" fill="#10b981" />
          <path d="M22 30 L28 36 L38 24" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
          <text x="80" y="38" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#ffffff" font-weight="bold">3. Is the transaction reference in the correct 12-digit UTR format?</text>
        </g>

        <!-- Item 4 -->
        <g transform="translate(60, 340)">
          <circle cx="30" cy="30" r="22" fill="#10b981" />
          <path d="M22 30 L28 36 L38 24" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
          <text x="80" y="38" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#ffffff" font-weight="bold">4. Does the receipt screenshot visibly agree with entered transaction details?</text>
        </g>

        <!-- Item 5 -->
        <g transform="translate(60, 440)">
          <circle cx="30" cy="30" r="22" fill="#10b981" />
          <path d="M22 30 L28 36 L38 24" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
          <text x="80" y="38" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#ffffff" font-weight="bold">5. Are there any duplicate screenshot, perceptual match, or OCR discrepancy flags?</text>
        </g>

        <!-- Item 6 -->
        <g transform="translate(60, 540)">
          <circle cx="30" cy="30" r="22" fill="#10b981" />
          <path d="M22 30 L28 36 L38 24" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
          <text x="80" y="38" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#ffffff" font-weight="bold">6. Has the transaction been corroborated on official university bank statement / gateway?</text>
        </g>

        <!-- Item 7 -->
        <g transform="translate(60, 640)">
          <circle cx="30" cy="30" r="22" fill="#10b981" />
          <path d="M22 30 L28 36 L38 24" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
          <text x="80" y="38" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#ffffff" font-weight="bold">7. Have you recorded the verification method and reason in the decision audit log?</text>
        </g>
      </g>
    </svg>
    `
  },

  // Scene 12: Conclusion
  {
    name: 'scene12.png',
    svg: `
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg12" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0b2447" />
          <stop offset="50%" stop-color="#0b3578" />
          <stop offset="100%" stop-color="#19376d" />
        </linearGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#bg12)" />
      <rect x="0" y="0" width="1920" height="16" fill="#f59e0b" />
      <rect x="0" y="1064" width="1920" height="16" fill="#f59e0b" />

      <!-- Center Crest & Summary -->
      <circle cx="960" cy="240" r="70" fill="#f59e0b" fill-opacity="0.2" stroke="#f59e0b" stroke-width="4" />
      <text x="960" y="255" font-family="DejaVu Sans, Arial, sans-serif" font-size="44" fill="#f59e0b" font-weight="900" text-anchor="middle">KU</text>

      <text x="960" y="360" font-family="DejaVu Sans, Arial, sans-serif" font-size="44" fill="#ffffff" font-weight="bold" text-anchor="middle">Payment Verification — Staff Operational Training</text>
      <text x="960" y="410" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" fill="#93c5fd" text-anchor="middle">Kakatiya University College of Engineering and Technology</text>

      <!-- Central Principle Card -->
      <rect x="360" y="470" width="1200" height="240" rx="20" fill="#0f172a" fill-opacity="0.9" stroke="#f59e0b" stroke-width="3" />
      <text x="960" y="530" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" fill="#f59e0b" font-weight="bold" text-anchor="middle">FOUNDATIONAL INSTITUTIONAL PRINCIPLE</text>
      
      <text x="960" y="600" font-family="DejaVu Sans, Arial, sans-serif" font-size="34" fill="#ffffff" font-weight="900" text-anchor="middle">"A screenshot is evidence to review,</text>
      <text x="960" y="650" font-family="DejaVu Sans, Arial, sans-serif" font-size="34" fill="#ffffff" font-weight="900" text-anchor="middle">not proof of money received."</text>

      <!-- Bottom Contacts -->
      <text x="960" y="780" font-family="DejaVu Sans, Arial, sans-serif" font-size="20" fill="#cbd5e1" text-anchor="middle">For Support or Reconciliation Enquiries:</text>
      <text x="960" y="820" font-family="DejaVu Sans, Arial, sans-serif" font-size="18" fill="#38bdf8" font-weight="bold" text-anchor="middle">KUCET Admission Cell: admissions@kucet.ac.in • College IT Office: it.support@kucet.ac.in</text>
      
      <text x="960" y="890" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="#64748b" text-anchor="middle">KUCET CMS Enterprise Platform • Session 225 Production Architecture</text>
    </svg>
    `
  }
];

async function renderSlides() {
  console.log('Rendering 12 high-definition 1920x1080 slides...');
  for (const slide of slides) {
    const dest = path.join(outDir, slide.name);
    await sharp(Buffer.from(slide.svg))
      .png()
      .toFile(dest);
    console.log(`Rendered: ${slide.name}`);
  }
  console.log('All 12 slides rendered successfully in', outDir);
}

renderSlides();
