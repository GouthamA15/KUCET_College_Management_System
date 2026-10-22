import { describe, it, expect } from 'vitest';
import path from 'path';

const SYLLABUS_DIR = '/run/media/admino/New Volume/User/Desktop/syllabus_backup';
const BRANCHES = ['civil', 'csd', 'cse', 'ece', 'eee', 'it', 'mech'];

describe('Comprehensive B.Tech Syllabus Integrity & Academic Verification', () => {
  it('should import all 7 branch aggregators and verify exported syllabus object', async () => {
    for (const b of BRANCHES) {
      const mod = await import(path.join(SYLLABUS_DIR, `${b}.js`));
      const expName = `${b}Syllabus`;
      expect(mod[expName]).toBeDefined();
      expect(typeof mod[expName]).toBe('object');
      for (let s = 1; s <= 8; s++) {
        expect(mod[expName][String(s)]).toBeDefined();
        expect(Array.isArray(mod[expName][String(s)])).toBe(true);
      }
    }
  });

  it('should verify all 56 semester modules have valid structure, codes, and units', async () => {
    let totalRegular = 0;
    let totalGroups = 0;
    let totalVariants = 0;

    for (const b of BRANCHES) {
      for (let s = 1; s <= 8; s++) {
        const mod = await import(path.join(SYLLABUS_DIR, b, `sem${s}.js`));
        const semKey = `semester${s}`;
        const entries = mod[semKey];
        expect(Array.isArray(entries)).toBe(true);
        expect(entries.length).toBeGreaterThan(0);

        const seenCodes = new Set();
        for (const item of entries) {
          expect(item.code).toBeTruthy();
          expect(item.title).toBeTruthy();
          expect(seenCodes.has(item.code)).toBe(false);
          seenCodes.add(item.code);

          if (item.isGroup) {
            totalGroups++;
            expect(Array.isArray(item.variants)).toBe(true);
            expect(item.variants.length).toBeGreaterThan(0);
            const variantCodes = new Set();
            for (const v of item.variants) {
              expect(v.code).toBeTruthy();
              expect(v.title).toBeTruthy();
              expect(variantCodes.has(v.code)).toBe(false);
              variantCodes.add(v.code);
              expect(Array.isArray(v.units)).toBe(true);
              expect(v.units.length).toBeGreaterThan(0);
              for (const u of v.units) {
                expect(u.name).toBeTruthy();
                expect(Array.isArray(u.topics)).toBe(true);
              }
              totalVariants++;
            }
          } else {
            totalRegular++;
            expect(Array.isArray(item.units)).toBe(true);
            expect(item.units.length).toBeGreaterThan(0);
            for (const u of item.units) {
              expect(u.name).toBeTruthy();
              expect(Array.isArray(u.topics)).toBe(true);
            }
          }
        }
      }
    }

    expect(totalRegular).toBe(349);
    expect(totalGroups).toBe(78);
    expect(totalVariants).toBe(207);
  });

  describe('Specific Branch Reconciliation Invariants', () => {
    it('CIVIL: Sem 1 has ESC104, Sem 3 has Surveying and FM labs', async () => {
      const sem1 = (await import(path.join(SYLLABUS_DIR, 'civil/sem1.js'))).semester1;
      expect(sem1.some(s => s.code === 'ESC104' && s.title.includes('Engineering Mechanics'))).toBe(true);
      expect(sem1.length).toBe(7);

      const sem3 = (await import(path.join(SYLLABUS_DIR, 'civil/sem3.js'))).semester3;
      expect(sem3.some(s => s.code === 'ES 351CE' && s.title.toLowerCase().includes('surveying'))).toBe(true);
      expect(sem3.some(s => s.code === 'PC 351CE' && s.title.toLowerCase().includes('fluid mechanics'))).toBe(true);
      expect(sem3.length).toBe(9);
    });

    it('IT: Sem 6 has PW3210IT Mini-project, Sem 7 has standardized PE-III* through PE-VI* groups', async () => {
      const sem6 = (await import(path.join(SYLLABUS_DIR, 'it/sem6.js'))).semester6;
      expect(sem6.some(s => s.code === 'PW3210IT' && s.title.toLowerCase().includes('mini-project'))).toBe(true);
      expect(sem6.length).toBe(8);

      const sem7 = (await import(path.join(SYLLABUS_DIR, 'it/sem7.js'))).semester7;
      const codes = sem7.map(s => s.code);
      expect(codes).toContain('PE-III*');
      expect(codes).toContain('PE-IV*');
      expect(codes).toContain('PE-V*');
      expect(codes).toContain('PE-VI*');
      expect(codes).not.toContain('PEC IV*');
      expect(codes).not.toContain('PEC V*');
      expect(codes).not.toContain('PEC VI*');
      expect(sem7.length).toBe(7);
    });

    it('CSD: Sem 1 has ESC104, Sem 7 & 8 follow approved CSE 4th-year scheme', async () => {
      const sem1 = (await import(path.join(SYLLABUS_DIR, 'csd/sem1.js'))).semester1;
      expect(sem1.some(s => s.code === 'ESC104')).toBe(true);
      expect(sem1.length).toBe(7);

      const sem7 = (await import(path.join(SYLLABUS_DIR, 'csd/sem7.js'))).semester7;
      expect(sem7.some(s => s.code === 'PE-III*')).toBe(true);
      expect(sem7.some(s => s.code === 'PW4108CS')).toBe(true);

      const sem8 = (await import(path.join(SYLLABUS_DIR, 'csd/sem8.js'))).semester8;
      expect(sem8.some(s => s.code === 'PW4205CS')).toBe(true);
      expect(sem8.some(s => s.code === 'MC')).toBe(true);
    });

    it('CSE: Sem 6 has PW3210CS, Sem 7 has PW4108CS, Sem 8 has PW4205CS', async () => {
      const sem6 = (await import(path.join(SYLLABUS_DIR, 'cse/sem6.js'))).semester6;
      expect(sem6.some(s => s.code === 'PW3210CS')).toBe(true);

      const sem7 = (await import(path.join(SYLLABUS_DIR, 'cse/sem7.js'))).semester7;
      expect(sem7.some(s => s.code === 'PW4108CS')).toBe(true);

      const sem8 = (await import(path.join(SYLLABUS_DIR, 'cse/sem8.js'))).semester8;
      expect(sem8.some(s => s.code === 'PW4205CS')).toBe(true);
    });

    it('MECH: Sem 1 has ESC104, Sem 3 has ME-215L, ME-216L, ESC-106L', async () => {
      const sem1 = (await import(path.join(SYLLABUS_DIR, 'mech/sem1.js'))).semester1;
      expect(sem1.some(s => s.code === 'ESC104')).toBe(true);

      const sem3 = (await import(path.join(SYLLABUS_DIR, 'mech/sem3.js'))).semester3;
      expect(sem3.some(s => s.code === 'ME-215L')).toBe(true);
      expect(sem3.some(s => s.code === 'ME-216L')).toBe(true);
      expect(sem3.some(s => s.code === 'ESC-106L')).toBe(true);
      expect(sem3.length).toBe(10);
    });

    it('EEE: Sem 3 has BSC105 & MC210, Sem 6 has PW3213 Summer Internship', async () => {
      const sem3 = (await import(path.join(SYLLABUS_DIR, 'eee/sem3.js'))).semester3;
      expect(sem3.some(s => s.code === 'BSC105')).toBe(true);
      expect(sem3.some(s => s.code === 'MC210')).toBe(true);

      const sem6 = (await import(path.join(SYLLABUS_DIR, 'eee/sem6.js'))).semester6;
      expect(sem6.some(s => s.code === 'PW3213')).toBe(true);
    });
  });
});
