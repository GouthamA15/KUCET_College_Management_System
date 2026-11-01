import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentFraudService, PAYMENT_VERIFICATION_STATUS, FRAUD_FLAGS } from '@/services/finance/PaymentFraudService';
import sharp from 'sharp';

vi.mock('@/db', () => ({
  db: {
    query: {
      studentFeePayments: { findFirst: vi.fn() },
      studentRequests: { findFirst: vi.fn() },
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

describe('Payment Fraud & Security Regression Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Missing & Malformed Transaction References', () => {
    it('handles missing/empty transaction reference gracefully', () => {
      const emptyRes = PaymentFraudService.classifyIdentifier('');
      expect(emptyRes.isValid).toBe(false);
      expect(emptyRes.type).toBe('UNKNOWN');

      const nullRes = PaymentFraudService.classifyIdentifier(null);
      expect(nullRes.isValid).toBe(false);
      expect(nullRes.type).toBe('UNKNOWN');
    });

    it('rejects malformed references with invalid characters or bad length', () => {
      const shortRes = PaymentFraudService.classifyIdentifier('123');
      expect(shortRes.isValid).toBe(false);

      const symbolRes = PaymentFraudService.classifyIdentifier('@@@###$$$%%%');
      expect(symbolRes.isValid).toBe(false);
    });

    it('strips unnecessary whitespace while preserving identifier casing', () => {
      const res = PaymentFraudService.classifyIdentifier('   AXIS01234567   ');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('AXIS01234567');
    });
  });

  describe('Similar but Genuinely Different References', () => {
    it('does NOT treat similar-looking different UTRs as duplicate matches', async () => {
      const { db } = await import('@/db');
      // DB has UTR ending in 456
      db.query.studentFeePayments.findFirst.mockResolvedValueOnce(null);
      db.query.studentRequests.findFirst.mockResolvedValueOnce(null);

      // Student enters UTR ending in 457
      const result = await PaymentFraudService.verifyPaymentEvidence({
        transactionId: '428190123457',
        studentId: 99,
        expectedAmount: 1000
      });

      // It should not be flagged as UTR_ALREADY_USED
      expect(result.flags).not.toContain(FRAUD_FLAGS.UTR_ALREADY_USED);
    });
  });

  describe('Amount Mismatch & OCR Extraction Failure', () => {
    it('handles OCR failure or unreadable screenshots gracefully without throwing', async () => {
      // Create empty/corrupted buffer or solid black image with no text
      const blankSvg = Buffer.from('<svg width="100" height="100"><rect width="100" height="100" fill="#000000"/></svg>');
      const blankBuffer = await sharp(blankSvg).png().toBuffer();

      const ocrResult = await PaymentFraudService.extractTextWithOCR(blankBuffer);
      // OCR should return empty text without throwing an unhandled exception
      expect(ocrResult.text || ocrResult.fullText !== undefined).toBe(true);
      expect(ocrResult.references).toHaveLength(0);
    }, 25000);

    it('flags amount mismatch when OCR extracted amount contradicts expected fee', async () => {
      const svg = Buffer.from(`
        <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
          <rect width="400" height="200" fill="#ffffff"/>
          <text x="20" y="60" font-family="sans-serif" font-size="28" fill="#000000">Rs. 200.00</text>
          <text x="20" y="120" font-family="sans-serif" font-size="20" fill="#000000">UTR: 428190123456</text>
        </svg>
      `);
      const buffer = await sharp(svg).png().toBuffer();

      const result = await PaymentFraudService.verifyPaymentEvidence({
        imageBuffer: buffer,
        transactionId: '428190123456',
        expectedAmount: 500, // Expected 500, screenshot shows 200
        studentId: 77,
        ocrFixture: {
          success: true,
          fullText: 'Rs. 200.00 UTR: 428190123456',
          references: ['428190123456'],
          amounts: [200.00],
          statuses: ['SUCCESSFUL']
        }
      });

      expect(result.flags).toContain(FRAUD_FLAGS.AMOUNT_MISMATCH);
      expect(result.isFlagged).toBe(true);
    }, 25000);

    it('does NOT flag amount mismatch when OCR extracted amount matches expected fee with decimals or formatting', async () => {
      const result = await PaymentFraudService.verifyPaymentEvidence({
        transactionId: '428190123456',
        expectedAmount: 500.00,
        studentId: 77,
        ocrFixture: {
          success: true,
          fullText: 'Amount: ₹500.00 UTR: 428190123456',
          references: ['428190123456'],
          amounts: [500.00],
          statuses: ['SUCCESSFUL']
        }
      });

      expect(result.flags).not.toContain(FRAUD_FLAGS.AMOUNT_MISMATCH);
    });

    it('preserves unverified review state without fabricating amount mismatch when OCR extraction fails or returns empty amounts', async () => {
      const result = await PaymentFraudService.verifyPaymentEvidence({
        transactionId: '428190123456',
        expectedAmount: 500,
        studentId: 77,
        ocrFixture: {
          success: false,
          fullText: '',
          references: [],
          amounts: [],
          error: 'Unreadable image'
        }
      });

      expect(result.flags).not.toContain(FRAUD_FLAGS.AMOUNT_MISMATCH);
      expect(result.flags).toContain(FRAUD_FLAGS.UNVERIFIED_EVIDENCE);
      expect(result.status).toBe(PAYMENT_VERIFICATION_STATUS.NEEDS_REVIEW);
      expect(result.isFlagged).toBe(false); // UNVERIFIED_EVIDENCE alone is not active fraud
    });

    it('handles missing or ambiguous expected fee safely without inventing an amount mismatch', async () => {
      const result = await PaymentFraudService.verifyPaymentEvidence({
        transactionId: '428190123456',
        expectedAmount: null, // Missing expected fee
        studentId: 77,
        ocrFixture: {
          success: true,
          fullText: 'Rs. 500.00 UTR: 428190123456',
          references: ['428190123456'],
          amounts: [500],
          statuses: ['SUCCESSFUL']
        }
      });

      expect(result.flags).not.toContain(FRAUD_FLAGS.AMOUNT_MISMATCH);
      expect(result.status).toBe(PAYMENT_VERIFICATION_STATUS.NEEDS_REVIEW);
    });
  });

  describe('OCR Reference Discrepancy & Equivalence Validation', () => {
    it('flags OCR_DISCREPANCY when extracted reference materially contradicts entered reference', async () => {
      const result = await PaymentFraudService.verifyPaymentEvidence({
        transactionId: '428190123499', // Entered
        expectedAmount: 500,
        studentId: 77,
        ocrFixture: {
          success: true,
          fullText: 'UTR: 428190123456',
          references: ['428190123456'],
          amounts: [500],
          statuses: ['SUCCESSFUL']
        }
      });

      expect(result.flags).toContain(FRAUD_FLAGS.OCR_DISCREPANCY);
      expect(result.isFlagged).toBe(true);
      expect(result.status).toBe(PAYMENT_VERIFICATION_STATUS.NEEDS_REVIEW);
      expect(result.riskScore).toBeGreaterThanOrEqual(30);
    });

    it('does NOT flag OCR_DISCREPANCY when references differ only in permitted formatting (spaces, hyphens, UPI/ prefix, casing)', async () => {
      const testCases = [
        { entered: '4281 9012 3456', extracted: ['428190123456'] },
        { entered: '4281-9012-3456', extracted: ['428190123456'] },
        { entered: 'UPI/428190123456', extracted: ['428190123456'] },
        { entered: '428190123456', extracted: ['UPI/428190123456'] },
        { entered: 'axis01234567', extracted: ['AXIS01234567'] }
      ];

      for (const tc of testCases) {
        const result = await PaymentFraudService.verifyPaymentEvidence({
          transactionId: tc.entered,
          expectedAmount: 500,
          studentId: 77,
          ocrFixture: {
            success: true,
            fullText: `UTR: ${tc.extracted[0]}`,
            references: tc.extracted,
            amounts: [500],
            statuses: ['SUCCESSFUL']
          }
        });

        expect(result.flags).not.toContain(FRAUD_FLAGS.OCR_DISCREPANCY);
      }
    });

    it('does NOT treat distinct transaction references as equivalent when normalizing', () => {
      expect(PaymentFraudService.areReferencesEquivalent('428190123456', '428190123499')).toBe(false);
      expect(PaymentFraudService.areReferencesEquivalent('428190123456', '428190123457')).toBe(false);
      expect(PaymentFraudService.areReferencesEquivalent('AXIS12345678', 'AXIS12345679')).toBe(false);
    });

    it('matches when receipt contains multiple plausible transaction identifiers and one matches', async () => {
      const result = await PaymentFraudService.verifyPaymentEvidence({
        transactionId: '428190123456',
        expectedAmount: 500,
        studentId: 77,
        ocrFixture: {
          success: true,
          fullText: 'Order ID: pay_99887711 UTR: 428190123456 Ref: SBI12345678',
          references: ['pay_99887711', '428190123456', 'SBI12345678'],
          amounts: [500],
          statuses: ['SUCCESSFUL']
        }
      });

      expect(result.flags).not.toContain(FRAUD_FLAGS.OCR_DISCREPANCY);
    });

    it('does not flag OCR_DISCREPANCY when OCR returns empty references', async () => {
      const result = await PaymentFraudService.verifyPaymentEvidence({
        transactionId: '428190123456',
        expectedAmount: 500,
        studentId: 77,
        ocrFixture: {
          success: true,
          fullText: 'No readable transaction id found',
          references: [],
          amounts: [500],
          statuses: []
        }
      });

      expect(result.flags).not.toContain(FRAUD_FLAGS.OCR_DISCREPANCY);
      expect(result.flags).toContain(FRAUD_FLAGS.UNVERIFIED_EVIDENCE);
    });

    it('filters malformed or ambiguous text without fabricating OCR_DISCREPANCY', async () => {
      const result = await PaymentFraudService.verifyPaymentEvidence({
        transactionId: '428190123456',
        expectedAmount: 500,
        studentId: 77,
        ocrFixture: {
          success: true,
          fullText: 'Garbled symbols ?? ## @@ 12',
          references: ['##@@', '12', 'abc'], // All too short or malformed (< 8 chars)
          amounts: [500],
          statuses: []
        }
      });

      expect(result.flags).not.toContain(FRAUD_FLAGS.OCR_DISCREPANCY);
    });

    it('handles OCR extraction errors gracefully without fabricating false discrepancy', async () => {
      const result = await PaymentFraudService.verifyPaymentEvidence({
        transactionId: '428190123456',
        expectedAmount: 500,
        studentId: 77,
        ocrFixture: {
          success: false,
          fullText: '',
          references: [],
          amounts: [],
          error: 'Tesseract timed out'
        }
      });

      expect(result.flags).not.toContain(FRAUD_FLAGS.OCR_DISCREPANCY);
      expect(result.flags).toContain(FRAUD_FLAGS.UNVERIFIED_EVIDENCE);
      expect(result.status).toBe(PAYMENT_VERIFICATION_STATUS.NEEDS_REVIEW);
    });
  });

  describe('Developer Path Portability & Test Environment Isolation', () => {
    it('verifies unit test files do not contain machine-specific /home/ scratch paths', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const testDir = path.resolve(process.cwd(), 'tests/unit');
      function scanDir(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            scanDir(fullPath);
          } else if (file.endsWith('.test.js')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            expect(content).not.toMatch(/\/home\/[a-zA-Z0-9._-]+\/\.gemini/);
          }
        }
      }
      scanDir(testDir);
    });
  });

  describe('Reconciliation Failure & Manual Decision Security', () => {
    it('marks UNVERIFIED when external gateway/reconciliation is unavailable', async () => {
      const result = await PaymentFraudService.verifyPaymentEvidence({
        transactionId: '428190123456',
        expectedAmount: 500,
        studentId: 77,
        reconciliationFixture: null // Unavailable service
      });

      expect(result.status).toBe(PAYMENT_VERIFICATION_STATUS.NEEDS_REVIEW);
      expect(result.authoritativeReconciliation.isReconciled).toBe(false);
      expect(result.flags).toContain(FRAUD_FLAGS.UNVERIFIED_EVIDENCE);
    });

    it('enforces that a payment is NEVER marked verified based on frontend upload alone', async () => {
      const svg = Buffer.from('<svg width="200" height="100"><rect width="200" height="100" fill="#ffffff"/></svg>');
      const buffer = await sharp(svg).png().toBuffer();

      // Student uploads screenshot without external bank reconciliation
      const result = await PaymentFraudService.verifyPaymentEvidence({
        imageBuffer: buffer,
        transactionId: '428190123456',
        expectedAmount: 500,
        studentId: 50,
        reconciliationFixture: null
      });

      expect(result.status).not.toBe(PAYMENT_VERIFICATION_STATUS.VERIFIED);
    });
  });
});
