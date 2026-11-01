import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  EMAIL_CATEGORIES,
  CATEGORY_CONFIG_MAP,
  DEFAULT_SENDER_NAMES,
  isValidEmailCategory,
  resolveBrevoCategoryConfig
} from '@/lib/email-categories';
import BrevoEmailProvider from '@/lib/providers/email/BrevoEmailProvider';
import { getBreaker } from '@/lib/utils/CircuitBreaker';

describe('Categorized Brevo Email Routing & Sender Identity Resolution', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset all email-related env vars before each test
    delete process.env.BREVO_API_KEY;
    delete process.env.EMAIL_USER;
    delete process.env.ENABLE_LEGACY_BREVO_KEY_FALLBACK;

    Object.values(CATEGORY_CONFIG_MAP).forEach(cfg => {
      delete process.env[cfg.apiKey];
      delete process.env[cfg.senderEmail];
      delete process.env[cfg.senderName];
      delete process.env[cfg.replyToEmail];
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('Category Definitions and Configuration Mapping', () => {
    it('should define all 7 required categories', () => {
      expect(EMAIL_CATEGORIES).toEqual({
        AUTH_OTP: 'AUTH_OTP',
        PASSWORD_RECOVERY: 'PASSWORD_RECOVERY',
        SECURITY_ALERTS: 'SECURITY_ALERTS',
        STAFF_ONBOARDING: 'STAFF_ONBOARDING',
        ADMISSIONS: 'ADMISSIONS',
        SCHOLARSHIP: 'SCHOLARSHIP',
        SYSTEM_OPERATIONS: 'SYSTEM_OPERATIONS',
      });
    });

    it('should correctly map categories to dedicated environment variables', () => {
      expect(CATEGORY_CONFIG_MAP[EMAIL_CATEGORIES.AUTH_OTP]).toEqual({
        apiKey: 'BREVO_API_KEY_AUTH_OTP',
        senderEmail: 'BREVO_SENDER_EMAIL_AUTH_OTP',
        senderName: 'BREVO_SENDER_NAME_AUTH_OTP',
        replyToEmail: 'BREVO_REPLY_TO_EMAIL_AUTH_OTP',
      });
      expect(CATEGORY_CONFIG_MAP[EMAIL_CATEGORIES.PASSWORD_RECOVERY]).toEqual({
        apiKey: 'BREVO_API_KEY_PASSWORD_RECOVERY',
        senderEmail: 'BREVO_SENDER_EMAIL_PASSWORD_RECOVERY',
        senderName: 'BREVO_SENDER_NAME_PASSWORD_RECOVERY',
        replyToEmail: 'BREVO_REPLY_TO_EMAIL_PASSWORD_RECOVERY',
      });
      expect(CATEGORY_CONFIG_MAP[EMAIL_CATEGORIES.SECURITY_ALERTS]).toEqual({
        apiKey: 'BREVO_API_KEY_SECURITY_ALERTS',
        senderEmail: 'BREVO_SENDER_EMAIL_SECURITY_ALERTS',
        senderName: 'BREVO_SENDER_NAME_SECURITY_ALERTS',
        replyToEmail: 'BREVO_REPLY_TO_EMAIL_SECURITY_ALERTS',
      });
      expect(CATEGORY_CONFIG_MAP[EMAIL_CATEGORIES.STAFF_ONBOARDING]).toEqual({
        apiKey: 'BREVO_API_KEY_STAFF_ONBOARDING',
        senderEmail: 'BREVO_SENDER_EMAIL_STAFF_ONBOARDING',
        senderName: 'BREVO_SENDER_NAME_STAFF_ONBOARDING',
        replyToEmail: 'BREVO_REPLY_TO_EMAIL_STAFF_ONBOARDING',
      });
      expect(CATEGORY_CONFIG_MAP[EMAIL_CATEGORIES.ADMISSIONS]).toEqual({
        apiKey: 'BREVO_API_KEY_ADMISSIONS',
        senderEmail: 'BREVO_SENDER_EMAIL_ADMISSIONS',
        senderName: 'BREVO_SENDER_NAME_ADMISSIONS',
        replyToEmail: 'BREVO_REPLY_TO_EMAIL_ADMISSIONS',
      });
      expect(CATEGORY_CONFIG_MAP[EMAIL_CATEGORIES.SCHOLARSHIP]).toEqual({
        apiKey: 'BREVO_API_KEY_SCHOLARSHIP',
        senderEmail: 'BREVO_SENDER_EMAIL_SCHOLARSHIP',
        senderName: 'BREVO_SENDER_NAME_SCHOLARSHIP',
        replyToEmail: 'BREVO_REPLY_TO_EMAIL_SCHOLARSHIP',
      });
      expect(CATEGORY_CONFIG_MAP[EMAIL_CATEGORIES.SYSTEM_OPERATIONS]).toEqual({
        apiKey: 'BREVO_API_KEY_SYSTEM_OPERATIONS',
        senderEmail: 'BREVO_SENDER_EMAIL_SYSTEM_OPERATIONS',
        senderName: 'BREVO_SENDER_NAME_SYSTEM_OPERATIONS',
        replyToEmail: 'BREVO_REPLY_TO_EMAIL_SYSTEM_OPERATIONS',
      });
    });

    it('should validate allowed categories and reject unknown categories', () => {
      expect(isValidEmailCategory(EMAIL_CATEGORIES.AUTH_OTP)).toBe(true);
      expect(isValidEmailCategory(EMAIL_CATEGORIES.PASSWORD_RECOVERY)).toBe(true);
      expect(isValidEmailCategory(EMAIL_CATEGORIES.SECURITY_ALERTS)).toBe(true);
      expect(isValidEmailCategory(EMAIL_CATEGORIES.STAFF_ONBOARDING)).toBe(true);
      expect(isValidEmailCategory(EMAIL_CATEGORIES.ADMISSIONS)).toBe(true);
      expect(isValidEmailCategory(EMAIL_CATEGORIES.SCHOLARSHIP)).toBe(true);
      expect(isValidEmailCategory(EMAIL_CATEGORIES.SYSTEM_OPERATIONS)).toBe(true);

      expect(isValidEmailCategory('MARKETING')).toBe(false);
      expect(isValidEmailCategory('UNKNOWN')).toBe(false);
      expect(isValidEmailCategory('')).toBe(false);
      expect(isValidEmailCategory(null)).toBe(false);
      expect(isValidEmailCategory(undefined)).toBe(false);
    });
  });

  describe('resolveBrevoCategoryConfig — Strict Credential and Sender Resolution', () => {
    it('1. should resolve AUTH_OTP API key, sender email, sender name, and optional reply-to', () => {
      process.env.BREVO_API_KEY_AUTH_OTP = 'key-otp-12345';
      process.env.BREVO_SENDER_EMAIL_AUTH_OTP = 'otp@kucet.ac.in';
      process.env.BREVO_SENDER_NAME_AUTH_OTP = 'KUCET Auth Desk';
      process.env.BREVO_REPLY_TO_EMAIL_AUTH_OTP = 'auth-reply@kucet.ac.in';

      const config = resolveBrevoCategoryConfig(EMAIL_CATEGORIES.AUTH_OTP);
      expect(config.apiKey).toBe('key-otp-12345');
      expect(config.senderEmail).toBe('otp@kucet.ac.in');
      expect(config.senderName).toBe('KUCET Auth Desk');
      expect(config.replyToEmail).toBe('auth-reply@kucet.ac.in');
      expect(config.isFallback).toBe(false);
    });

    it('2. should resolve PASSWORD_RECOVERY credentials and sender identity', () => {
      process.env.BREVO_API_KEY_PASSWORD_RECOVERY = 'key-pwd-12345';
      process.env.BREVO_SENDER_EMAIL_PASSWORD_RECOVERY = 'recovery@kucet.ac.in';
      process.env.BREVO_SENDER_NAME_PASSWORD_RECOVERY = 'KUCET Recovery';

      const config = resolveBrevoCategoryConfig(EMAIL_CATEGORIES.PASSWORD_RECOVERY);
      expect(config.apiKey).toBe('key-pwd-12345');
      expect(config.senderEmail).toBe('recovery@kucet.ac.in');
      expect(config.senderName).toBe('KUCET Recovery');
      expect(config.replyToEmail).toBeUndefined();
      expect(config.isFallback).toBe(false);
    });

    it('3. should resolve SECURITY_ALERTS credentials and sender identity', () => {
      process.env.BREVO_API_KEY_SECURITY_ALERTS = 'key-sec-12345';
      process.env.BREVO_SENDER_EMAIL_SECURITY_ALERTS = 'security@kucet.ac.in';
      process.env.BREVO_SENDER_NAME_SECURITY_ALERTS = 'KUCET Security';

      const config = resolveBrevoCategoryConfig(EMAIL_CATEGORIES.SECURITY_ALERTS);
      expect(config.apiKey).toBe('key-sec-12345');
      expect(config.senderEmail).toBe('security@kucet.ac.in');
      expect(config.senderName).toBe('KUCET Security');
      expect(config.isFallback).toBe(false);
    });

    it('4. should resolve STAFF_ONBOARDING credentials and sender identity', () => {
      process.env.BREVO_API_KEY_STAFF_ONBOARDING = 'key-staff-12345';
      process.env.BREVO_SENDER_EMAIL_STAFF_ONBOARDING = 'staff@kucet.ac.in';
      process.env.BREVO_SENDER_NAME_STAFF_ONBOARDING = 'KUCET Staff Onboarding';

      const config = resolveBrevoCategoryConfig(EMAIL_CATEGORIES.STAFF_ONBOARDING);
      expect(config.apiKey).toBe('key-staff-12345');
      expect(config.senderEmail).toBe('staff@kucet.ac.in');
      expect(config.senderName).toBe('KUCET Staff Onboarding');
      expect(config.isFallback).toBe(false);
    });

    it('5. should resolve ADMISSIONS credentials and sender identity', () => {
      process.env.BREVO_API_KEY_ADMISSIONS = 'key-adm-12345';
      process.env.BREVO_SENDER_EMAIL_ADMISSIONS = 'admissions@kucet.ac.in';
      process.env.BREVO_SENDER_NAME_ADMISSIONS = 'KUCET Admissions Office';

      const config = resolveBrevoCategoryConfig(EMAIL_CATEGORIES.ADMISSIONS);
      expect(config.apiKey).toBe('key-adm-12345');
      expect(config.senderEmail).toBe('admissions@kucet.ac.in');
      expect(config.senderName).toBe('KUCET Admissions Office');
      expect(config.isFallback).toBe(false);
    });

    it('6. should resolve SCHOLARSHIP credentials and sender identity', () => {
      process.env.BREVO_API_KEY_SCHOLARSHIP = 'key-sch-12345';
      process.env.BREVO_SENDER_EMAIL_SCHOLARSHIP = 'scholarship@kucet.ac.in';
      process.env.BREVO_SENDER_NAME_SCHOLARSHIP = 'KUCET Scholarship Cell';

      const config = resolveBrevoCategoryConfig(EMAIL_CATEGORIES.SCHOLARSHIP);
      expect(config.apiKey).toBe('key-sch-12345');
      expect(config.senderEmail).toBe('scholarship@kucet.ac.in');
      expect(config.senderName).toBe('KUCET Scholarship Cell');
      expect(config.isFallback).toBe(false);
    });

    it('7. should resolve SYSTEM_OPERATIONS credentials and sender identity', () => {
      process.env.BREVO_API_KEY_SYSTEM_OPERATIONS = 'key-sys-12345';
      process.env.BREVO_SENDER_EMAIL_SYSTEM_OPERATIONS = 'ops@kucet.ac.in';
      process.env.BREVO_SENDER_NAME_SYSTEM_OPERATIONS = 'KUCET System Alerts';

      const config = resolveBrevoCategoryConfig(EMAIL_CATEGORIES.SYSTEM_OPERATIONS);
      expect(config.apiKey).toBe('key-sys-12345');
      expect(config.senderEmail).toBe('ops@kucet.ac.in');
      expect(config.senderName).toBe('KUCET System Alerts');
      expect(config.isFallback).toBe(false);
    });
  });

  describe('Strict Configuration Validation & Isolation', () => {
    it('should throw explicit error when API key is missing in strict mode', () => {
      process.env.BREVO_SENDER_EMAIL_AUTH_OTP = 'otp@kucet.ac.in';
      process.env.BREVO_SENDER_NAME_AUTH_OTP = 'KUCET Auth';

      expect(() => resolveBrevoCategoryConfig(EMAIL_CATEGORIES.AUTH_OTP)).toThrow(
        /Missing Brevo API key for category "AUTH_OTP". Please configure BREVO_API_KEY_AUTH_OTP/
      );
    });

    it('should throw explicit error when sender email is missing in strict mode', () => {
      process.env.BREVO_API_KEY_AUTH_OTP = 'key-otp';
      process.env.BREVO_SENDER_NAME_AUTH_OTP = 'KUCET Auth';

      expect(() => resolveBrevoCategoryConfig(EMAIL_CATEGORIES.AUTH_OTP)).toThrow(
        /Missing sender email for category "AUTH_OTP". Please configure BREVO_SENDER_EMAIL_AUTH_OTP/
      );
    });

    it('should throw explicit error when sender email format is invalid', () => {
      process.env.BREVO_API_KEY_AUTH_OTP = 'key-otp';
      process.env.BREVO_SENDER_EMAIL_AUTH_OTP = 'invalid-not-an-email';
      process.env.BREVO_SENDER_NAME_AUTH_OTP = 'KUCET Auth';

      expect(() => resolveBrevoCategoryConfig(EMAIL_CATEGORIES.AUTH_OTP)).toThrow(
        /Invalid sender email address format for category "AUTH_OTP"/
      );
    });

    it('should throw explicit error when sender display name is missing in strict mode', () => {
      process.env.BREVO_API_KEY_AUTH_OTP = 'key-otp';
      process.env.BREVO_SENDER_EMAIL_AUTH_OTP = 'otp@kucet.ac.in';

      expect(() => resolveBrevoCategoryConfig(EMAIL_CATEGORIES.AUTH_OTP)).toThrow(
        /Missing sender display name for category "AUTH_OTP". Please configure BREVO_SENDER_NAME_AUTH_OTP/
      );
    });

    it('should throw explicit error when reply-to format is invalid', () => {
      process.env.BREVO_API_KEY_AUTH_OTP = 'key-otp';
      process.env.BREVO_SENDER_EMAIL_AUTH_OTP = 'otp@kucet.ac.in';
      process.env.BREVO_SENDER_NAME_AUTH_OTP = 'KUCET Auth';
      process.env.BREVO_REPLY_TO_EMAIL_AUTH_OTP = 'not-an-email';

      expect(() => resolveBrevoCategoryConfig(EMAIL_CATEGORIES.AUTH_OTP)).toThrow(
        /Invalid reply-to email address format for category "AUTH_OTP"/
      );
    });

    it('should reject invalid categories', () => {
      expect(() => resolveBrevoCategoryConfig('UNKNOWN_CATEGORY')).toThrow(
        /Invalid or missing email category "UNKNOWN_CATEGORY"/
      );
    });

    it('should never substitute another category key or sender address', () => {
      // Configure ONLY ADMISSIONS
      process.env.BREVO_API_KEY_ADMISSIONS = 'adm-key';
      process.env.BREVO_SENDER_EMAIL_ADMISSIONS = 'adm@kucet.ac.in';
      process.env.BREVO_SENDER_NAME_ADMISSIONS = 'Admissions';

      // Requesting AUTH_OTP must fail and not use ADMISSIONS
      expect(() => resolveBrevoCategoryConfig(EMAIL_CATEGORIES.AUTH_OTP)).toThrow(
        /Missing Brevo API key for category "AUTH_OTP"/
      );
    });

    it('should not silently fall back to legacy variables when ENABLE_LEGACY_BREVO_KEY_FALLBACK is false', () => {
      process.env.BREVO_API_KEY = 'legacy-shared-key';
      process.env.EMAIL_USER = 'legacy-shared@kucet.ac.in';
      process.env.ENABLE_LEGACY_BREVO_KEY_FALLBACK = 'false';

      expect(() => resolveBrevoCategoryConfig(EMAIL_CATEGORIES.AUTH_OTP)).toThrow(
        /Missing Brevo API key for category "AUTH_OTP"/
      );
    });

    it('should allow legacy fallback when ENABLE_LEGACY_BREVO_KEY_FALLBACK is true', () => {
      process.env.BREVO_API_KEY = 'legacy-shared-key';
      process.env.EMAIL_USER = 'legacy-shared@kucet.ac.in';
      process.env.ENABLE_LEGACY_BREVO_KEY_FALLBACK = 'true';

      const config = resolveBrevoCategoryConfig(EMAIL_CATEGORIES.AUTH_OTP);
      expect(config.apiKey).toBe('legacy-shared-key');
      expect(config.senderEmail).toBe('legacy-shared@kucet.ac.in');
      expect(config.senderName).toBe(DEFAULT_SENDER_NAMES.AUTH_OTP);
      expect(config.isFallback).toBe(true);
    });
  });

  describe('BrevoEmailProvider with Categorized Sender Identity', () => {
    it('should dispatch Brevo request with category-specific sender email, name, and API key', async () => {
      process.env.BREVO_API_KEY_ADMISSIONS = 'adm-secret-key';
      process.env.BREVO_SENDER_EMAIL_ADMISSIONS = 'admissions@kucet.ac.in';
      process.env.BREVO_SENDER_NAME_ADMISSIONS = 'KUCET Admissions Office';

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: 'msg-adm-123' })
      });

      const provider = new BrevoEmailProvider();
      const result = await provider.send({
        to: 'applicant@example.com',
        subject: 'Admission Status Update',
        html: '<p>Welcome</p>',
        category: EMAIL_CATEGORIES.ADMISSIONS
      });

      expect(result.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://api.brevo.com/v3/smtp/email');
      expect(options.headers['api-key']).toBe('adm-secret-key');

      const body = JSON.parse(options.body);
      expect(body.sender).toEqual({
        email: 'admissions@kucet.ac.in',
        name: 'KUCET Admissions Office'
      });
      expect(body.to).toEqual([{ email: 'applicant@example.com' }]);
      expect(body.subject).toBe('Admission Status Update');

      // Circuit breaker check
      const breaker = getBreaker('BrevoEmail_ADMISSIONS');
      expect(breaker.state).toBe('CLOSED');
      expect(breaker.failureCount).toBe(0);
    });

    it('should attach replyTo address if configured in category', async () => {
      process.env.BREVO_API_KEY_AUTH_OTP = 'otp-key-456';
      process.env.BREVO_SENDER_EMAIL_AUTH_OTP = 'auth@kucet.ac.in';
      process.env.BREVO_SENDER_NAME_AUTH_OTP = 'KUCET Auth';
      process.env.BREVO_REPLY_TO_EMAIL_AUTH_OTP = 'support@kucet.ac.in';

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: 'msg-otp-456' })
      });

      const provider = new BrevoEmailProvider();
      const result = await provider.send({
        to: 'student@example.com',
        subject: 'Your OTP Code',
        html: '<p>123456</p>',
        category: EMAIL_CATEGORIES.AUTH_OTP
      });

      expect(result.success).toBe(true);
      const [, options] = fetchSpy.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.replyTo).toEqual({ email: 'support@kucet.ac.in' });
    });

    it('should return error when requested category has missing sender email or API key', async () => {
      // No env vars set for AUTH_OTP
      const provider = new BrevoEmailProvider();
      const result = await provider.send({
        to: 'applicant@example.com',
        subject: 'OTP',
        html: '<p>123456</p>',
        category: EMAIL_CATEGORIES.AUTH_OTP
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing Brevo API key for category "AUTH_OTP"');
    });

    it('should support uncategorized calls (e.g. excluded Cloudinary alert) via legacy key and EMAIL_USER', async () => {
      process.env.BREVO_API_KEY = 'legacy-key-for-uncategorized';
      process.env.EMAIL_USER = 'alerts@kucet.ac.in';

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: 'alert-msg' })
      });

      const provider = new BrevoEmailProvider('legacy-key-for-uncategorized', 'alerts@kucet.ac.in');
      const result = await provider.send({
        to: 'dev@kucet.ac.in',
        subject: 'Storage Warning',
        html: '<p>Storage limit</p>'
      });

      expect(result.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, options] = fetchSpy.mock.calls[0];
      expect(options.headers['api-key']).toBe('legacy-key-for-uncategorized');
      const body = JSON.parse(options.body);
      expect(body.sender).toEqual({
        email: 'alerts@kucet.ac.in',
        name: 'KUCET College Portal'
      });
    });
  });
});

