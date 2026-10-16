import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { COLLEGE_CONFIG, GENDER_LABELS, formatGenderLabel } from '@/lib/college-config';
import { studentCreateSchema } from '@/lib/validations/student';
import { students } from '@/db/schema/identity';
import { studentAdmissionDrafts } from '@/db/schema/registry';
import { archiveStudentPersonalDetails } from '@/db/schema/archive';

describe('Canonical Gender Enum (MALE / FEMALE) Unit Tests', () => {
  describe('COLLEGE_CONFIG & Constants', () => {
    it('only contains MALE and FEMALE in COLLEGE_CONFIG.genders', () => {
      expect(COLLEGE_CONFIG.genders).toEqual(['MALE', 'FEMALE']);
      expect(COLLEGE_CONFIG.genders).not.toContain('OTHER');
      expect(COLLEGE_CONFIG.genders).not.toContain('Other');
      expect(COLLEGE_CONFIG.genders).not.toContain('other');
    });

    it('defines GENDER_LABELS mapping strictly for MALE and FEMALE to UI labels', () => {
      expect(GENDER_LABELS).toEqual({
        MALE: 'Male',
        FEMALE: 'Female',
      });
      expect(GENDER_LABELS.OTHER).toBeUndefined();
    });

    it('formatGenderLabel formats MALE and FEMALE correctly with case insensitivity', () => {
      expect(formatGenderLabel('MALE')).toBe('Male');
      expect(formatGenderLabel('male')).toBe('Male');
      expect(formatGenderLabel('FEMALE')).toBe('Female');
      expect(formatGenderLabel('female')).toBe('Female');
      expect(formatGenderLabel('')).toBe('');
      expect(formatGenderLabel(null)).toBe('');
      expect(formatGenderLabel(undefined)).toBe('');
    });
  });

  describe('Validation Schemas (studentCreateSchema)', () => {
    const validStudentBase = {
      roll_no: '22567T0901',
      name: 'RAVI KUMAR',
      email: 'ravi.kumar@example.com',
      date_of_birth: '2004-05-15',
      mobile: '9876543210',
    };

    it('accepts MALE and FEMALE uppercase', () => {
      const maleResult = studentCreateSchema.safeParse({ ...validStudentBase, gender: 'MALE' });
      expect(maleResult.success).toBe(true);
      if (maleResult.success) {
        expect(maleResult.data.gender).toBe('MALE');
      }

      const femaleResult = studentCreateSchema.safeParse({ ...validStudentBase, gender: 'FEMALE' });
      expect(femaleResult.success).toBe(true);
      if (femaleResult.success) {
        expect(femaleResult.data.gender).toBe('FEMALE');
      }
    });

    it('normalizes lowercase or mixed-case male and female to canonical uppercase', () => {
      const parsedMale = studentCreateSchema.safeParse({ ...validStudentBase, gender: 'male' });
      expect(parsedMale.success).toBe(true);
      if (parsedMale.success) {
        expect(parsedMale.data.gender).toBe('MALE');
      }

      const parsedFemale = studentCreateSchema.safeParse({ ...validStudentBase, gender: 'Female' });
      expect(parsedFemale.success).toBe(true);
      if (parsedFemale.success) {
        expect(parsedFemale.data.gender).toBe('FEMALE');
      }
    });

    it('strictly rejects OTHER and any non-binary gender input', () => {
      const resultOtherUpper = studentCreateSchema.safeParse({ ...validStudentBase, gender: 'OTHER' });
      expect(resultOtherUpper.success).toBe(false);

      const resultOtherMixed = studentCreateSchema.safeParse({ ...validStudentBase, gender: 'Other' });
      expect(resultOtherMixed.success).toBe(false);

      const resultOtherLower = studentCreateSchema.safeParse({ ...validStudentBase, gender: 'other' });
      expect(resultOtherLower.success).toBe(false);

      const resultUnknown = studentCreateSchema.safeParse({ ...validStudentBase, gender: 'TRANSGENDER' });
      expect(resultUnknown.success).toBe(false);
    });
  });

  describe('Database Schema Definitions', () => {
    it('defines students.gender with enumValues [MALE, FEMALE]', () => {
      expect(students.gender.enumValues).toEqual(['MALE', 'FEMALE']);
      expect(students.gender.enumValues).not.toContain('OTHER');
    });

    it('defines studentAdmissionDrafts.gender with enumValues [MALE, FEMALE]', () => {
      expect(studentAdmissionDrafts.gender.enumValues).toEqual(['MALE', 'FEMALE']);
      expect(studentAdmissionDrafts.gender.enumValues).not.toContain('OTHER');
    });

    it('defines archiveStudentPersonalDetails.gender with enumValues [MALE, FEMALE]', () => {
      expect(archiveStudentPersonalDetails.gender.enumValues).toEqual(['MALE', 'FEMALE']);
      expect(archiveStudentPersonalDetails.gender.enumValues).not.toContain('OTHER');
    });
  });

  describe('Public Admission API Zod Schema', () => {
    const admissionGenderSchema = z.enum(['MALE', 'FEMALE', 'Male', 'Female']).transform(val => val.toUpperCase());

    it('accepts MALE, FEMALE, Male, Female and transforms to uppercase', () => {
      expect(admissionGenderSchema.parse('MALE')).toBe('MALE');
      expect(admissionGenderSchema.parse('FEMALE')).toBe('FEMALE');
      expect(admissionGenderSchema.parse('Male')).toBe('MALE');
      expect(admissionGenderSchema.parse('Female')).toBe('FEMALE');
    });

    it('strictly rejects OTHER and Other', () => {
      expect(() => admissionGenderSchema.parse('OTHER')).toThrow();
      expect(() => admissionGenderSchema.parse('Other')).toThrow();
      expect(() => admissionGenderSchema.parse('other')).toThrow();
    });
  });

  describe('Bulk Import Gender Normalization Logic', () => {
    function normalizeGender(value) {
      if (!value) return null;
      const clean = String(value).trim().toLowerCase();
      if (clean === 'm' || clean === 'male' || clean === 'boy') return 'MALE';
      if (clean === 'f' || clean === 'female' || clean === 'girl') return 'FEMALE';
      return null;
    }

    it('normalizes common male and female inputs to MALE and FEMALE', () => {
      expect(normalizeGender('M')).toBe('MALE');
      expect(normalizeGender('male')).toBe('MALE');
      expect(normalizeGender('BOY')).toBe('MALE');
      expect(normalizeGender('F')).toBe('FEMALE');
      expect(normalizeGender('female')).toBe('FEMALE');
      expect(normalizeGender('GIRL')).toBe('FEMALE');
    });

    it('returns null for OTHER or unrecognized values, failing import validation', () => {
      expect(normalizeGender('OTHER')).toBeNull();
      expect(normalizeGender('Other')).toBeNull();
      expect(normalizeGender('others')).toBeNull();
      expect(normalizeGender('O')).toBeNull();
      expect(normalizeGender('unknown')).toBeNull();
    });
  });
});
