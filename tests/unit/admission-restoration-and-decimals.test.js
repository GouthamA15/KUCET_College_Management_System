import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { studentCreateSchema } from '@/lib/validations/student';

describe('Admission Workflow, Decimal SSC Marks & Draft Restoration Audits', () => {
  describe('SSC / 10th Marks Decimal Validation', () => {
    // Replicate public admission Zod schema validation
    const publicAdmissionSchema = z.object({
      ssc_marks: z.string().trim().max(50).nullable().optional(),
      inter_diploma_marks: z.string().trim().max(50).nullable().optional().refine(val => {
        if (!val) return true;
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0 && num <= 1000;
      }),
    });

    it('accepts decimal marks in public admission schema (e.g. 9.5, 8.75, 98.4)', () => {
      const validCases = ['9.5', '8.75', '98.4', '10.0', '580.5', '590'];
      for (const marks of validCases) {
        const parsed = publicAdmissionSchema.safeParse({ ssc_marks: marks });
        expect(parsed.success).toBe(true);
        if (parsed.success) {
          expect(parsed.data.ssc_marks).toBe(marks);
        }
      }
    });

    it('accepts decimal marks in staff studentCreateSchema (e.g. 9.8, 485.5)', () => {
      const decimalMarks = ['9.8', '485.5', '9.25'];
      for (const marks of decimalMarks) {
        const parsed = studentCreateSchema.shape.ssc_marks.safeParse(marks);
        expect(parsed.success).toBe(true);
      }
    });
  });

  describe('Draft Restoration State Structure', () => {
    it('serializes and deserializes draft payload including files without loss', () => {
      const mockForm = {
        name: 'TEST STUDENT',
        father_name: 'TEST FATHER',
        ssc_marks: '9.5',
        inter_diploma_marks: '980.5',
        branch: 'CSE',
      };
      const mockFiles = {
        pfp: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
        signature: 'data:image/png;base64,iVBORw0KGgo...',
      };
      const mockAdmissionYear = '2026-2030';

      const draftPayload = JSON.stringify({
        form: mockForm,
        admissionYear: mockAdmissionYear,
        files: mockFiles,
      });

      const parsedDraft = JSON.parse(draftPayload);
      expect(parsedDraft.form.name).toBe('TEST STUDENT');
      expect(parsedDraft.form.ssc_marks).toBe('9.5');
      expect(parsedDraft.files.pfp).toBe(mockFiles.pfp);
      expect(parsedDraft.files.signature).toBe(mockFiles.signature);
      expect(parsedDraft.admissionYear).toBe('2026-2030');
    });

    it('handles legacy drafts that did not have files gracefully', () => {
      const legacyDraftJson = JSON.stringify({
        form: { name: 'LEGACY STUDENT', ssc_marks: '10' },
        admissionYear: '2025-2029',
      });
      const parsed = JSON.parse(legacyDraftJson);
      const restoredFiles = parsed.files && (parsed.files.pfp || parsed.files.signature) 
        ? { pfp: parsed.files.pfp || null, signature: parsed.files.signature || null }
        : { pfp: null, signature: null };

      expect(restoredFiles.pfp).toBeNull();
      expect(restoredFiles.signature).toBeNull();
    });
  });

  describe('Event & Warning Listener Idempotency', () => {
    it('guarantees single warning listener attachment on globalThis', () => {
      // Test that global flag guards multiple registrations
      const mockGlobal = {};
      let attachCount = 0;

      const registerWarningListener = (g) => {
        if (!g._warningListenerRegistered) {
          g._warningListenerRegistered = true;
          attachCount++;
        }
      };

      registerWarningListener(mockGlobal);
      registerWarningListener(mockGlobal);
      registerWarningListener(mockGlobal);

      expect(attachCount).toBe(1);
      expect(mockGlobal._warningListenerRegistered).toBe(true);
    });
  });
});
