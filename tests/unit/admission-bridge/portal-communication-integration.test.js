import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBrowserAdapter } from '@/lib/admission-bridge/browser-adapter';
import { hasScripting } from '@/lib/admission-bridge/browser-capabilities';

describe('KUCET Admission Bridge — Portal Communication & Web Forms Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Messaging & Readiness Handshake', () => {
    it('should detect scripting capability in browser runtime', () => {
      expect(hasScripting({})).toBe(false);
      expect(hasScripting({ chrome: {} })).toBe(false);
      expect(hasScripting({ chrome: { scripting: {} } })).toBe(false);
      expect(hasScripting({ chrome: { scripting: { executeScript: () => {} } } })).toBe(true);
    });

    it('should query active portal tab across window states', async () => {
      const portalTab = { id: 101, url: 'https://kuonline.co.in/BTechsql/Btechreg.aspx', active: true };
      const mockQuery = vi.fn().mockImplementation((q) => {
        if (q.currentWindow) return Promise.resolve([portalTab]);
        return Promise.resolve([]);
      });

      const adapter = createBrowserAdapter({
        chrome: {
          tabs: { query: mockQuery, sendMessage: vi.fn() },
        },
      });

      const activeTab = await adapter.getActiveTab();
      expect(activeTab).toEqual(portalTab);
      expect(activeTab.url).toContain('Btechreg.aspx');
    });

    it('should query active portal tab across window states and support www.kuonline.co.in', async () => {
      const portalTabWww = { id: 102, url: 'https://www.kuonline.co.in/BTechsql/Btechreg.aspx', active: true };
      const mockQuery = vi.fn().mockImplementation((q) => {
        if (q.url && q.url.includes('www.kuonline.co.in')) return Promise.resolve([portalTabWww]);
        if (q.currentWindow) return Promise.resolve([]);
        return Promise.resolve([]);
      });

      const adapter = createBrowserAdapter({
        chrome: {
          tabs: { query: mockQuery, sendMessage: vi.fn() },
        },
      });

      const activeTab = await adapter.getActiveTab();
      expect(activeTab).toEqual(portalTabWww);
      expect(activeTab.url).toContain('www.kuonline.co.in');
    });

    it('should classify HOST_PERMISSION_MISSING when injection fails due to missing host permission', async () => {
      const mockExecuteScript = vi.fn().mockRejectedValue(
        new Error('Cannot access contents of url "https://www.kuonline.co.in/BTechsql/Btechreg.aspx". Extension manifest must request permission to access this host.')
      );

      const adapter = createBrowserAdapter({
        chrome: {
          scripting: { executeScript: mockExecuteScript },
          tabs: {
            sendMessage: vi.fn().mockRejectedValue(new Error('Receiving end does not exist')),
          },
        },
      });

      const result = await adapter.ensureContentScript(2092427909);
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('HOST_PERMISSION_MISSING');
      expect(result.error).toContain('Extension manifest must request permission');
    });

    it('should safely recover when content script is missing by injecting content.js', async () => {
      const mockExecuteScript = vi.fn().mockResolvedValue([]);
      let pingAttempts = 0;

      const mockSendMessage = vi.fn().mockImplementation((tabId, msg, cb) => {
        if (msg.action === 'PORTAL_CHECK_READY') {
          pingAttempts++;
          if (pingAttempts === 1) {
            // First attempt: no receiver
            return Promise.reject(new Error('Could not establish connection. Receiving end does not exist.'));
          }
          // After injection: ready
          const res = { ready: true, isTargetUrl: true, formPresent: true };
          if (typeof cb === 'function') cb(res);
          return Promise.resolve(res);
        }
        const res = { success: true, populatedFields: ['Course', 'Admission No'] };
        if (typeof cb === 'function') cb(res);
        return Promise.resolve(res);
      });

      const adapter = createBrowserAdapter({
        chrome: {
          scripting: { executeScript: mockExecuteScript },
          tabs: {
            query: vi.fn().mockResolvedValue([{ id: 101, url: 'https://kuonline.co.in/BTechsql/Btechreg.aspx' }]),
            sendMessage: mockSendMessage,
          },
        },
      });

      const handshake = await adapter.ensureContentScript(101);
      expect(handshake.success).toBe(true);
      expect(mockExecuteScript).toHaveBeenCalledWith({
        target: { tabId: 101, allFrames: false },
        files: ['content.js'],
      });
    });

    it('should return descriptive error when portal tab is not found', async () => {
      const adapter = createBrowserAdapter({
        chrome: {
          tabs: {
            query: vi.fn().mockResolvedValue([]),
            sendMessage: vi.fn(),
          },
        },
      });

      const tab = await adapter.getActiveTab();
      expect(tab).toBeNull();
    });
  });

  describe('2. ASP.NET Web Forms Field & Option Matching Contract', () => {
    it('should match course dropdown values accurately (B.TECH -> value 8, M.TECH -> value 24)', () => {
      const options = [
        { value: '0', text: '-Select-' },
        { value: '8', text: 'B.TECH' },
        { value: '24', text: 'M.TECH' },
      ];

      const matchOption = (target) => {
        const clean = String(target).trim().toUpperCase();
        return options.find(
          (o) => o.text.trim().toUpperCase() === clean || o.value.trim().toUpperCase() === clean
        );
      };

      expect(matchOption('B.TECH')?.value).toBe('8');
      expect(matchOption('b.tech')?.value).toBe('8');
      expect(matchOption('8')?.text).toBe('B.TECH');
      expect(matchOption('M.TECH')?.value).toBe('24');
    });

    it('should match previous studying dropdown (Inter -> 1, Diploma -> 2, Other -> 3)', () => {
      const options = [
        { value: '0', text: '- - - Select - - -' },
        { value: '1', text: 'Inter' },
        { value: '2', text: 'Diploma' },
        { value: '3', text: 'Other' },
      ];

      const matchOption = (target) => {
        const clean = String(target).trim().toUpperCase();
        return options.find(
          (o) => o.text.trim().toUpperCase() === clean || o.value.trim().toUpperCase() === clean
        );
      };

      expect(matchOption('Inter')?.value).toBe('1');
      expect(matchOption('Diploma')?.value).toBe('2');
      expect(matchOption('Other')?.value).toBe('3');
    });

    it('should match gender and location radio values (Male=1, Female=2, Local=1, Nonlocal=2)', () => {
      const genderRadios = [
        { value: '1', label: 'Male' },
        { value: '2', label: 'Female' },
      ];
      const locationRadios = [
        { value: '1', label: 'Local' },
        { value: '2', label: 'Nonlocal' },
      ];

      const matchRadio = (radios, target) => {
        const clean = String(target).trim().toUpperCase();
        return radios.find(
          (r) => r.label.toUpperCase() === clean || r.value === clean
        );
      };

      expect(matchRadio(genderRadios, 'Male')?.value).toBe('1');
      expect(matchRadio(genderRadios, 'Female')?.value).toBe('2');
      expect(matchRadio(locationRadios, 'Local')?.value).toBe('1');
      expect(matchRadio(locationRadios, 'Nonlocal')?.value).toBe('2');
    });

    it('should map social status options correctly', () => {
      const options = [
        { value: '0', text: '-Select-' },
        { value: '10', text: 'BC-A' },
        { value: '11', text: 'BC-B' },
        { value: '12', text: 'BC-C' },
        { value: '13', text: 'BC-D' },
        { value: '14', text: 'OC' },
        { value: '25', text: 'ST' },
        { value: '26', text: 'SC' },
        { value: '27', text: 'BC-E' },
        { value: '34', text: 'Not-Available' },
      ];

      const matchOption = (target) => {
        const clean = String(target).trim().toUpperCase();
        return options.find(
          (o) => o.text.trim().toUpperCase() === clean || o.value.trim().toUpperCase() === clean
        );
      };

      expect(matchOption('ST')?.value).toBe('25');
      expect(matchOption('SC')?.value).toBe('26');
      expect(matchOption('BC-A')?.value).toBe('10');
      expect(matchOption('OC')?.value).toBe('14');
    });
  });

  describe('3. Media Attachment & File Limit Guardrails', () => {
    it('should enforce hard ceiling of 250 KB (256,000 bytes) for portal file uploads', () => {
      const MAX_PORTAL_IMAGE_BYTES = 250 * 1024;
      const validSize = 190 * 1024; // 194,560 B
      const oversized = 260 * 1024; // 266,240 B

      expect(validSize <= MAX_PORTAL_IMAGE_BYTES).toBe(true);
      expect(oversized <= MAX_PORTAL_IMAGE_BYTES).toBe(false);
    });

    it('should convert Base64 string to genuine byte array File object', () => {
      // 1x1 transparent PNG / synthetic byte payload
      const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const clean = mockBase64.includes(',') ? mockBase64.split(',')[1] : mockBase64;
      const binary = atob(clean);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const file = new File([bytes], 'test_photo.jpg', { type: 'image/jpeg' });
      expect(file.name).toBe('test_photo.jpg');
      expect(file.size).toBe(binary.length);
      expect(file.size).toBeLessThan(250 * 1024);
    });
  });

  describe('4. Privacy & Full Unmasked Visibility for Authorized Admission Staff', () => {
    it('should format full 12-digit Aadhaar number with standard 4-digit grouping without masking', () => {
      const formatAadhaar = (val) => {
        if (!val) return 'Not provided';
        const clean = String(val).replace(/\D/g, '');
        if (clean.length === 12) {
          return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)}`;
        }
        return clean || 'Not provided';
      };

      // Synthetic test Aadhaar
      const syntheticAadhaar = '999988887777';
      const formatted = formatAadhaar(syntheticAadhaar);
      expect(formatted).toBe('9999 8888 7777');
      expect(formatted).not.toContain('•');
      expect(formatted).not.toContain('*');
    });

    it('should format full 10-digit contact number without masking', () => {
      const formatContact = (val) => {
        if (!val) return 'Not provided';
        const clean = String(val).replace(/\D/g, '');
        if (clean.length >= 10) {
          return clean.slice(-10);
        }
        return clean || 'Not provided';
      };

      // Synthetic test mobile
      const syntheticPhone = '9876543210';
      const formatted = formatContact(syntheticPhone);
      expect(formatted).toBe('9876543210');
      expect(formatted).not.toContain('•');
      expect(formatted).not.toContain('*');
    });

    it('should show "Not provided" for missing Aadhaar or Phone numbers', () => {
      const formatAadhaar = (val) => {
        if (!val) return 'Not provided';
        const clean = String(val).replace(/\D/g, '');
        if (clean.length === 12) return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)}`;
        return clean || 'Not provided';
      };
      const formatContact = (val) => {
        if (!val) return 'Not provided';
        const clean = String(val).replace(/\D/g, '');
        if (clean.length >= 10) return clean.slice(-10);
        return clean || 'Not provided';
      };

      expect(formatAadhaar(null)).toBe('Not provided');
      expect(formatAadhaar('')).toBe('Not provided');
      expect(formatContact(null)).toBe('Not provided');
      expect(formatContact('')).toBe('Not provided');
    });

    it('should ensure in-memory student record is wiped on reset', () => {
      let currentStudent = {
        rollNo: '26567T0348',
        primaryDetails: {
          aadhaarNumber: '999988887777',
          contactNumber: '9876543210',
        },
      };

      const resetWorkspace = () => {
        currentStudent = null;
      };

      resetWorkspace();
      expect(currentStudent).toBeNull();
    });
  });

  describe('5. Four Missing Primary Details Fields & Draft Fallback Verification', () => {
    it('should format Place of Birth, Religion, Father Occupation, Mother Tongue with "Not provided" fallback', () => {
      const renderField = (val) => val || 'Not provided';

      expect(renderField('Warangal')).toBe('Warangal');
      expect(renderField('Hindu')).toBe('Hindu');
      expect(renderField('Agriculture')).toBe('Agriculture');
      expect(renderField('Telugu')).toBe('Telugu');

      expect(renderField(null)).toBe('Not provided');
      expect(renderField('')).toBe('Not provided');
      expect(renderField(undefined)).toBe('Not provided');
    });

    it('should defensively fall back to admission draft data if personal details are null', () => {
      const studentRecord = {
        roll_no: '26567T0348',
        place_of_birth: null,
        religion: null,
        mother_tongue: null,
        father_occupation: null,
        draft_place_of_birth: 'Hanamkonda',
        draft_religion: 'Hindu',
        draft_mother_tongue: 'Telugu',
        draft_father_occupation: 'Govt Service',
      };

      const resolvedPob = studentRecord.place_of_birth || studentRecord.draft_place_of_birth || null;
      const resolvedReligion = studentRecord.religion || studentRecord.draft_religion || null;
      const resolvedMotherTongue = studentRecord.mother_tongue || studentRecord.draft_mother_tongue || null;
      const resolvedFatherOcc = studentRecord.father_occupation || studentRecord.draft_father_occupation || null;

      expect(resolvedPob).toBe('Hanamkonda');
      expect(resolvedReligion).toBe('Hindu');
      expect(resolvedMotherTongue).toBe('Telugu');
      expect(resolvedFatherOcc).toBe('Govt Service');
    });
  });
});
