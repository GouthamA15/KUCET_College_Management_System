import { describe, it, expect } from 'vitest';
import { IDCardDataService } from '@/services/identity/IDCardDataService';

describe('IDCardDataService Reconciled Data Integrity & Queries', () => {
  it('retrieves exactly 425 total student records across all branches', async () => {
    const result = await IDCardDataService.getStudentRecords({
      branch: 'ALL',
      page: 1,
      limit: 10,
    });

    expect(result.students.length).toBe(10);
    expect(result.pagination.total).toBe(425);
    expect(result.stats.totalInScope).toBe(425);
    expect(result.stats.photosAvailable).toBe(424);
    expect(result.stats.photosMissing).toBe(1);
    expect(result.stats.phonesAvailable).toBe(425);
    expect(result.stats.addressesAvailable).toBe(362);
    expect(result.stats.addressesNeedsReview).toBe(63);
  });

  it('filters accurately by branch', async () => {
    // CSE has 66 students
    const cseResult = await IDCardDataService.getStudentRecords({ branch: 'CSE', limit: 150 });
    expect(cseResult.pagination.total).toBe(66);
    expect(cseResult.students.every(s => s.branch === 'CSE')).toBe(true);

    // CIVIL has 58 students
    const civilResult = await IDCardDataService.getStudentRecords({ branch: 'CIVIL', limit: 100 });
    expect(civilResult.pagination.total).toBe(58);
    expect(civilResult.students.every(s => s.branch === 'CIVIL')).toBe(true);

    // ECE has 61 students
    const eceResult = await IDCardDataService.getStudentRecords({ branch: 'ECE', limit: 100 });
    expect(eceResult.pagination.total).toBe(61);
  });

  it('filters accurately by missing photo status', async () => {
    const missingPhotos = await IDCardDataService.getStudentRecords({
      photoStatus: 'MISSING',
      limit: 50,
    });

    expect(missingPhotos.pagination.total).toBe(1);
    expect(missingPhotos.students[0].rollNo).toBe('26567T0902');
    expect(missingPhotos.students[0].studentName).toBe('AJMEERA AKSHAYA');
    expect(missingPhotos.students[0].branch).toBe('CSE');
  });

  it('searches accurately by roll number, student name, and mobile', async () => {
    // Search by roll number
    const byRoll = await IDCardDataService.getStudentRecords({ search: '26567T0001' });
    expect(byRoll.pagination.total).toBe(1);
    expect(byRoll.students[0].studentName).toBe('AGITHA AKHIL');

    // Search by phone
    const byPhone = await IDCardDataService.getStudentRecords({ search: '8985332851' });
    expect(byPhone.pagination.total).toBe(1);
    expect(byPhone.students[0].rollNo).toBe('26567T0001');

    // Search by partial name
    const byName = await IDCardDataService.getStudentRecords({ search: 'AKSHAYA' });
    expect(byName.pagination.total).toBeGreaterThanOrEqual(1);
    expect(byName.students.some(s => s.rollNo === '26567T0902')).toBe(true);
  });

  it('retrieves single student card record with QR code data URL', async () => {
    const card = await IDCardDataService.getStudentRecordByRollNo('26567T0001');
    expect(card).toBeDefined();
    expect(card.studentName).toBe('AGITHA AKHIL');
    expect(card.fatherName).toBe('AGITHA KUMARASWAMY');
    expect(card.branch).toBe('CIVIL');
    expect(card.studentPhone).toBe('8985332851');
    expect(card.studentAddress).toContain('506009');
    expect(card.qrUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('enforces departmental scoping in bulk student retrieval', async () => {
    const sampleRolls = ['26567T0001', '26567T0901']; // CIVIL and CSE

    // Unrestricted
    const all = await IDCardDataService.getStudentsForBulk(sampleRolls, null);
    expect(all.length).toBe(2);

    // Scoped to CIVIL only
    const civilOnly = await IDCardDataService.getStudentsForBulk(sampleRolls, ['CIVIL']);
    expect(civilOnly.length).toBe(1);
    expect(civilOnly[0].admissionNo).toBe('26567T0001');
  });
});
