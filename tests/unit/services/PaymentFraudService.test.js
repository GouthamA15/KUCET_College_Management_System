import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentFraudService, PAYMENT_VERIFICATION_STATUS, FRAUD_FLAGS } from '@/services/finance/PaymentFraudService';
import sharp from 'sharp';

// Mock DB queries for isolation
vi.mock('@/db', () => ({
  db: {
    query: {
      studentFeePayments: { findFirst: vi.fn(), findMany: vi.fn() },
      studentRequests: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    transaction: vi.fn(async (cb) => {
      const tx = { insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue({}) }) };
      return cb(tx);
    })
  },
}));

vi.mock('@/lib/logger', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

describe('PaymentFraudService & Mandatory 4-Student Fraud Scenarios', () => {
  let genuineBuffer;
  let croppedBuffer;
  let croppedModifiedBuffer;

  beforeEach(async () => {
    vi.clearAllMocks();

    // 1. Generate synthetic genuine payment screenshot for Student A
    const genuineSvg = Buffer.from(`
      <svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="600" height="400" fill="#f8fafc"/>
        <rect x="20" y="20" width="560" height="80" fill="#0b3578"/>
        <text x="40" y="70" font-family="sans-serif" font-size="24" fill="#ffffff" font-weight="bold">DEMO — NOT A REAL PAYMENT</text>
        <text x="40" y="150" font-family="sans-serif" font-size="32" fill="#15803d" font-weight="bold">₹500.00</text>
        <text x="40" y="190" font-family="sans-serif" font-size="18" fill="#334155">Payment Status: SUCCESSFUL</text>
        <text x="40" y="230" font-family="sans-serif" font-size="18" fill="#334155">Payee: PRINCIPAL KU COLLEGE</text>
        <text x="40" y="270" font-family="sans-serif" font-size="20" fill="#0b3578" font-weight="bold">UTR: 428190123456</text>
        <text x="40" y="310" font-family="sans-serif" font-size="16" fill="#64748b">Date: 26 Oct 2026, 14:30 IST</text>
      </svg>
    `);
    genuineBuffer = await sharp(genuineSvg).png().toBuffer();

    // 2. Generate cropped version of Student A's screenshot (Student C)
    croppedBuffer = await sharp(genuineBuffer)
      .extract({ left: 10, top: 120, width: 500, height: 200 })
      .png()
      .toBuffer();

    // 3. Generate cropped modified screenshot with different UTR (Student D)
    const modifiedSvg = Buffer.from(`
      <svg width="500" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="500" height="200" fill="#f8fafc"/>
        <text x="30" y="50" font-family="sans-serif" font-size="32" fill="#15803d" font-weight="bold">₹500.00</text>
        <text x="30" y="90" font-family="sans-serif" font-size="18" fill="#334155">Payment Status: SUCCESSFUL</text>
        <text x="30" y="130" font-family="sans-serif" font-size="20" fill="#0b3578" font-weight="bold">UTR: 428190123456</text>
      </svg>
    `);
    croppedModifiedBuffer = await sharp(modifiedSvg).png().toBuffer();
  });

  describe('Identifier & Semantic Field Validation', () => {
    it('classifies 12-digit numeric reference as UTR_BANK_REF', () => {
      const res = PaymentFraudService.classifyIdentifier('428190123456');
      expect(res.type).toBe('UTR_BANK_REF');
      expect(res.isValid).toBe(true);
    });

    it('classifies UPI VPA format as UPI_VPA', () => {
      const res = PaymentFraudService.classifyIdentifier('student@okhdfcbank');
      expect(res.type).toBe('UPI_VPA');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('student@okhdfcbank');
    });

    it('detects transaction ID pasted into UPI ID field (field mismatch)', () => {
      const mismatch = PaymentFraudService.detectFieldMismatch({
        upiId: '428190123456',
        transactionRef: '428190123456'
      });
      expect(mismatch.hasMismatch).toBe(true);
      expect(mismatch.flags).toContain(FRAUD_FLAGS.IDENTIFIER_TYPE_MISMATCH);
      expect(mismatch.explanations[0]).toContain('Field requires a UPI ID');
    });

    it('detects UPI VPA entered into transaction reference field', () => {
      const mismatch = PaymentFraudService.detectFieldMismatch({
        upiId: 'student@upi',
        transactionRef: 'student@okhdfcbank'
      });
      expect(mismatch.hasMismatch).toBe(true);
      expect(mismatch.flags).toContain(FRAUD_FLAGS.IDENTIFIER_TYPE_MISMATCH);
      expect(mismatch.explanations[0]).toContain('Field requires a Transaction Reference / UTR');
    });
  });

  describe('Cryptographic & Perceptual Hashing', () => {
    it('generates consistent SHA-256 hash for identical buffers', () => {
      const hash1 = PaymentFraudService.computeCryptographicHash(genuineBuffer);
      const hash2 = PaymentFraudService.computeCryptographicHash(Buffer.from(genuineBuffer));
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('computes 16-hex-character perceptual hash', async () => {
      const pHash = await PaymentFraudService.computePerceptualHash(genuineBuffer);
      expect(pHash).toHaveLength(16);
    });

    it('calculates Hamming distance and similarity accurately', () => {
      const hashA = '0000000000000000';
      const hashB = '000000000000000f'; // 4 bits different in last nibble
      const distance = PaymentFraudService.calculateHammingDistance(hashA, hashB);
      expect(distance).toBe(4);
      const similarity = PaymentFraudService.calculateHashSimilarity(hashA, hashB);
      expect(similarity).toBe((64 - 4) / 64);
    });

    it('detects high perceptual similarity for cropped/resized versions of same image', async () => {
      const hashOriginal = await PaymentFraudService.computePerceptualHash(genuineBuffer);
      const hashResized = await PaymentFraudService.computePerceptualHash(
        await sharp(genuineBuffer).resize(300, 200).jpeg().toBuffer()
      );
      const similarity = PaymentFraudService.calculateHashSimilarity(hashOriginal, hashResized);
      expect(similarity).toBeGreaterThan(0.75); // High visual structural similarity
    });
  });

  describe('Mandatory Four-Student Fraud Scenarios', () => {
    // -------------------------------------------------------------
    // Scenario 1: Genuine payment evidence
    // -------------------------------------------------------------
    it('Scenario 1: Genuine payment marks VERIFIED when authoritative reconciliation confirms it', async () => {
      const reconciliationFixture = [
        {
          transaction_ref: '428190123456',
          amount: 500,
          status: 'SUCCESS',
          payer: 'Student A',
          settled_at: '2026-10-26T14:31:00Z'
        }
      ];

      const result = await PaymentFraudService.verifyPaymentEvidence({
        imageBuffer: genuineBuffer,
        transactionId: '428190123456',
        upiId: 'studentA@okhdfcbank',
        expectedAmount: 500,
        studentId: 101,
        reconciliationFixture
      });

      expect(result.status).toBe(PAYMENT_VERIFICATION_STATUS.VERIFIED);
      expect(result.isFlagged).toBe(false);
      expect(result.authoritativeReconciliation.isReconciled).toBe(true);
      expect(result.riskScore).toBe(0);
    }, 25000);

    it('Scenario 1 (Without Authoritative Source): Remains NEEDS_REVIEW and is NOT automatically approved', async () => {
      const result = await PaymentFraudService.verifyPaymentEvidence({
        imageBuffer: genuineBuffer,
        transactionId: '428190123456',
        upiId: 'studentA@okhdfcbank',
        expectedAmount: 500,
        studentId: 101,
        reconciliationFixture: null // No bank feed / gateway confirmation
      });

      expect(result.status).toBe(PAYMENT_VERIFICATION_STATUS.NEEDS_REVIEW);
      expect(result.flags).toContain(FRAUD_FLAGS.UNVERIFIED_EVIDENCE);
      expect(result.authoritativeReconciliation.isReconciled).toBe(false);
      expect(result.explanations[0]).toContain('authoritative bank/gateway reconciliation is not yet confirmed');
    }, 25000);

    // -------------------------------------------------------------
    // Scenario 2: Reused screenshot + Transaction ID pasted in UPI ID field
    // -------------------------------------------------------------
    it('Scenario 2: Detects reused screenshot and identifier field mismatch, protects Student A PII', async () => {
      const { db } = await import('@/db');
      const sha256 = PaymentFraudService.computeCryptographicHash(genuineBuffer);

      // Mock DB: UTR lookup returns null, then hash lookup returns Student A's record
      db.query.studentRequests.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          request_id: 1,
          student_id: 101, // Student A
          payment_hash: sha256,
          status: 'PENDING'
        });

      // Student B submits Student A's screenshot and puts UTR in the UPI ID field
      const result = await PaymentFraudService.verifyPaymentEvidence({
        imageBuffer: genuineBuffer,
        transactionId: '428190123456',
        upiId: '428190123456', // Transaction ID pasted in UPI ID field
        expectedAmount: 500,
        studentId: 102, // Student B
        reconciliationFixture: null
      });

      expect(result.status).toBe(PAYMENT_VERIFICATION_STATUS.NEEDS_REVIEW);
      expect(result.isFlagged).toBe(true);
      expect(result.flags).toContain(FRAUD_FLAGS.IDENTIFIER_TYPE_MISMATCH);
      expect(result.flags).toContain(FRAUD_FLAGS.EXACT_IMAGE_DUPLICATE);
      expect(result.riskScore).toBeGreaterThanOrEqual(70);

      // Verify privacy safeguard: does NOT expose Student A's name or ID in explanations
      const combinedExplanations = result.explanations.join(' ');
      expect(combinedExplanations).not.toContain('Student A');
      expect(combinedExplanations).not.toContain('101');
    }, 25000);

    // -------------------------------------------------------------
    // Scenario 3: Cropped reused screenshot with original reference
    // -------------------------------------------------------------
    it('Scenario 3: Flags cropped reused screenshot for manual review despite altered file hash', async () => {
      const shaOriginal = PaymentFraudService.computeCryptographicHash(genuineBuffer);
      const shaCropped = PaymentFraudService.computeCryptographicHash(croppedBuffer);

      // Verify cryptographic byte hash changed due to crop
      expect(shaCropped).not.toBe(shaOriginal);

      // Student C submits cropped image with the original reference
      const result = await PaymentFraudService.verifyPaymentEvidence({
        imageBuffer: croppedBuffer,
        transactionId: '428190123456',
        upiId: 'studentC@upi',
        expectedAmount: 500,
        studentId: 103, // Student C
        reconciliationFixture: null
      });

      // Without authoritative confirmation, it is routed to manual review
      expect(result.status).toBe(PAYMENT_VERIFICATION_STATUS.NEEDS_REVIEW);
      expect(result.hashes.sha256).toBe(shaCropped);
      expect(result.hashes.perceptualHash).toBeDefined();
    }, 25000);

    // -------------------------------------------------------------
    // Scenario 4: Cropped reused screenshot with different or similar transaction reference
    // -------------------------------------------------------------
    it('Scenario 4: Flags discrepancy between entered reference and visible screenshot evidence', async () => {
      // Student D enters 428190123499, but image contains 428190123456
      const result = await PaymentFraudService.verifyPaymentEvidence({
        imageBuffer: croppedModifiedBuffer,
        transactionId: '428190123499', // Deceptively similar entered reference
        upiId: 'studentD@upi',
        expectedAmount: 500,
        studentId: 104, // Student D
        reconciliationFixture: null
      });

      expect(result.status).toBe(PAYMENT_VERIFICATION_STATUS.NEEDS_REVIEW);
      expect(result.isFlagged).toBe(true);
      expect(result.flags).toContain(FRAUD_FLAGS.OCR_DISCREPANCY);
      expect(result.riskScore).toBeGreaterThanOrEqual(30);

      const discrepancyExplanation = result.explanations.find(e => e.includes('does not match the reference number'));
      expect(discrepancyExplanation).toBeDefined();
    }, 25000);
  });

  describe('Staff Decision & Audit Trail Recording', () => {
    it('records valid manual verification decision and creates audit log entry', async () => {
      const auditResult = await PaymentFraudService.recordStaffDecision({
        recordId: 55,
        recordType: 'CERTIFICATE_REQUEST',
        previousStatus: 'PENDING',
        newStatus: 'VERIFIED',
        staffId: 10,
        staffName: 'Admin Officer',
        staffRole: 'admission',
        reason: 'Confirmed directly against SBI Main Branch Bank Statement dated 26-Oct-2026',
        verificationMethod: 'MANUAL_BANK_STATEMENT_RECONCILIATION',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0'
      });

      expect(auditResult.success).toBe(true);
      expect(auditResult.newStatus).toBe('VERIFIED');
      expect(auditResult.recordId).toBe(55);
    });

    it('rejects invalid status transitions with descriptive error', async () => {
      await expect(
        PaymentFraudService.recordStaffDecision({
          recordId: 55,
          previousStatus: 'PENDING',
          newStatus: 'AUTO_APPROVED_BY_AI', // Invalid status
          staffId: 10
        })
      ).rejects.toThrow('Invalid verification status transition');
    });
  });
});
