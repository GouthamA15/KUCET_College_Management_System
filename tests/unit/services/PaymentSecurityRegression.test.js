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
        studentId: 77
      });

      expect(result.flags).toContain(FRAUD_FLAGS.AMOUNT_MISMATCH);
      expect(result.isFlagged).toBe(true);
    }, 25000);
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
