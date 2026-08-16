import { describe, it, expect, afterEach } from 'vitest';
import {
  getEmailLogoUrl,
  getBaseUrl,
  buildInstitutionalEmailHtml,
  buildInstitutionalEmailText
} from '@/lib/email';

describe('Institutional Email Pipeline & Logo Delivery', () => {
  const originalEnv = process.env.NEXT_PUBLIC_BASE_URL;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_BASE_URL = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_BASE_URL;
    }
  });

  describe('getEmailLogoUrl', () => {
    it('should resolve to the configured production HTTPS base URL', () => {
      process.env.NEXT_PUBLIC_BASE_URL = 'https://login.kucet.in';
      const logoUrl = getEmailLogoUrl();
      expect(logoUrl).toBe('https://login.kucet.in/assets/ku-college-logo.png');
    });

    it('should resolve to a staging HTTPS base URL without trailing slashes', () => {
      process.env.NEXT_PUBLIC_BASE_URL = 'https://kucet-staging.onrender.com///';
      const logoUrl = getEmailLogoUrl();
      expect(logoUrl).toBe('https://kucet-staging.onrender.com/assets/ku-college-logo.png');
    });

    it('should fallback to canonical production URL when NEXT_PUBLIC_BASE_URL is localhost', () => {
      process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
      const logoUrl = getEmailLogoUrl();
      expect(logoUrl).toBe('https://login.kucet.in/assets/ku-college-logo.png');
    });

    it('should fallback to canonical production URL when NEXT_PUBLIC_BASE_URL is 127.0.0.1', () => {
      process.env.NEXT_PUBLIC_BASE_URL = 'http://127.0.0.1:3000';
      const logoUrl = getEmailLogoUrl();
      expect(logoUrl).toBe('https://login.kucet.in/assets/ku-college-logo.png');
    });

    it('should fallback to canonical production URL when NEXT_PUBLIC_BASE_URL is a Tailscale URL', () => {
      process.env.NEXT_PUBLIC_BASE_URL = 'https://kucet-dev-hp-pro.tailf6b4a7.ts.net';
      const logoUrl = getEmailLogoUrl();
      expect(logoUrl).toBe('https://login.kucet.in/assets/ku-college-logo.png');
    });

    it('should fallback to canonical production URL when NEXT_PUBLIC_BASE_URL is undefined or empty', () => {
      delete process.env.NEXT_PUBLIC_BASE_URL;
      const logoUrl = getEmailLogoUrl();
      expect(logoUrl).toBe('https://login.kucet.in/assets/ku-college-logo.png');
    });
  });

  describe('getBaseUrl', () => {
    it('should return configured NEXT_PUBLIC_BASE_URL', () => {
      process.env.NEXT_PUBLIC_BASE_URL = 'https://login.kucet.in';
      expect(getBaseUrl()).toBe('https://login.kucet.in');
    });

    it('should return empty string when NEXT_PUBLIC_BASE_URL is not set', () => {
      delete process.env.NEXT_PUBLIC_BASE_URL;
      expect(getBaseUrl()).toBe('');
    });
  });

  describe('buildInstitutionalEmailHtml', () => {
    it('should generate valid HTML containing the resolved college logo and institutional header', () => {
      process.env.NEXT_PUBLIC_BASE_URL = 'https://login.kucet.in';
      const html = buildInstitutionalEmailHtml({
        title: 'Welcome to KUCET Portal',
        bodyHtml: '<p>Your account has been approved.</p>',
        action: {
          url: 'https://login.kucet.in/login',
          label: 'Access Portal',
          expiresIn: '24 hours'
        },
        infoRows: [
          { label: 'Role', value: 'Faculty' },
          { label: 'Department', value: 'CSE' }
        ]
      });

      expect(html).toContain('https://login.kucet.in/assets/ku-college-logo.png');
      expect(html).toContain('alt="KUCET Logo"');
      expect(html).toContain('KAKATIYA UNIVERSITY COLLEGE OF ENGINEERING & TECHNOLOGY');
      expect(html).toContain('Welcome to KUCET Portal');
      expect(html).toContain('Your account has been approved.');
      expect(html).toContain('Access Portal');
      expect(html).toContain('Faculty');
      expect(html).toContain('CSE');
    });
  });

  describe('buildInstitutionalEmailText', () => {
    it('should generate structured plain-text fallback', () => {
      const text = buildInstitutionalEmailText({
        title: 'Account Alert',
        bodyText: 'Security verification code is 123456.',
        action: {
          url: 'https://login.kucet.in/verify',
          label: 'Verify Account'
        },
        infoRows: [
          { label: 'IP', value: '192.168.1.1' }
        ]
      });

      expect(text).toContain('KAKATIYA UNIVERSITY COLLEGE OF ENGINEERING & TECHNOLOGY');
      expect(text).toContain('Account Alert');
      expect(text).toContain('Security verification code is 123456.');
      expect(text).toContain('IP: 192.168.1.1');
      expect(text).toContain('Verify Account: https://login.kucet.in/verify');
    });
  });
});
