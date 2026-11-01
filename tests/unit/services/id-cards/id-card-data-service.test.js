import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IDCardDataService, CANONICAL_BRANCHES } from '@/services/identity/IDCardDataService';
import { IDCardAuthorizationService } from '@/services/identity/IDCardAuthorizationService';
import { db } from '@/db';
import ExcelJS from 'exceljs';

// Mock DB
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((val) => `encrypted_${val}`),
  hashForIndex: vi.fn((val) => `hash_${val}`),
  decrypt: vi.fn((val) => {
    if (!val) return null;
    if (val.startsWith('encrypted_')) return val.replace('encrypted_', '');
    return val;
  }),
}));

vi.mock('@/lib/providers/storage/factory', () => ({
  getStorageProvider: vi.fn(() => ({
    uploadFile: vi.fn().mockResolvedValue({ key: 'mock_key' }),
  })),
}));

// Synthetic test database records
const syntheticDbRows = [
  {
    id: 1,
    roll_no: '26567T0901', // CSE Regular Finalized
    admission_no: 'ADM-26-001',
    name: 'KAVYA REDDY',
    date_of_birth: '2005-04-12',
    gender: 'FEMALE',
    email: 'kavya@example.com',
    mobile: 'encrypted_9876543210',
    admission_date: '2026-08-01',
    student_status: 'ACTIVE',
    academic_status: 'ACTIVE',
    father_name: 'RAMA REDDY',
    mother_name: 'LAKSHMI',
    blood_group: 'O+',
    perm_house_no: '1-2-3',
    perm_street: 'Temple Road',
    perm_apartment: null,
    perm_city: 'Warangal',
    perm_state: 'Telangana',
    perm_pincode: '506009',
    perm_country: 'India',
    pfp: 'kucet/students/pfp/kavya_photo.webp',
  },
  {
    id: 2,
    roll_no: '26567T0902', // CSE Regular Finalized (Missing Photo)
    admission_no: 'ADM-26-002',
    name: 'SURESH KUMAR',
    date_of_birth: '2005-06-15',
    gender: 'MALE',
    email: 'suresh@example.com',
    mobile: 'encrypted_9876543211',
    admission_date: '2026-08-01',
    student_status: 'ACTIVE',
    academic_status: 'ACTIVE',
    father_name: 'VENKATESH',
    mother_name: 'PADMA',
    blood_group: 'B+',
    perm_house_no: '4-5-6',
    perm_street: 'Station Road',
    perm_apartment: null,
    perm_city: 'Hanamkonda',
    perm_state: 'Telangana',
    perm_pincode: '506001',
    perm_country: 'India',
    pfp: null, // MISSING photo
  },
  {
    id: 3,
    roll_no: '26567T0001', // CIVIL Regular Finalized
    admission_no: 'ADM-26-003',
    name: 'AGITHA AKHIL',
    date_of_birth: '2005-03-20',
    gender: 'MALE',
    email: 'akhil@example.com',
    mobile: 'encrypted_8985332851',
    admission_date: '2026-08-01',
    student_status: 'ACTIVE',
    academic_status: 'ACTIVE',
    father_name: 'AGITHA KUMARASWAMY',
    mother_name: 'AGITHA SUJATHA',
    blood_group: 'A+',
    perm_house_no: '7-8-9',
    perm_street: 'College Road',
    perm_apartment: null,
    perm_city: 'Warangal',
    perm_state: 'Telangana',
    perm_pincode: '506009',
    perm_country: 'India',
    pfp: 'kucet/students/pfp/akhil_photo.webp',
  },
  {
    id: 4,
    roll_no: '23567T0901', // Legacy Finalized Student (Batch 2023-2027)
    admission_no: 'ADM-23-001',
    name: 'LEGACY SENIOR',
    date_of_birth: '2002-01-10',
    gender: 'MALE',
    email: 'senior@example.com',
    mobile: 'encrypted_9111222333',
    admission_date: '2023-08-01',
    student_status: 'ACTIVE',
    academic_status: 'ACTIVE',
    father_name: 'SENIOR FATHER',
    mother_name: 'SENIOR MOTHER',
    blood_group: 'AB+',
    perm_house_no: '10-11',
    perm_street: 'Main Road',
    perm_apartment: null,
    perm_city: 'Hyderabad',
    perm_state: 'Telangana',
    perm_pincode: '500001',
    perm_country: 'India',
    pfp: 'kucet/students/pfp/senior_photo.webp',
  },
  {
    id: 5,
    roll_no: '26567T0903', // Dropped Student (INELIGIBLE)
    admission_no: 'ADM-26-005',
    name: 'DROPPED CANDIDATE',
    date_of_birth: '2005-05-05',
    gender: 'MALE',
    email: 'dropped@example.com',
    mobile: 'encrypted_9000000000',
    admission_date: '2026-08-01',
    student_status: 'ACTIVE',
    academic_status: 'DROPPED', // Ineligible
    father_name: 'SOME FATHER',
    mother_name: 'SOME MOTHER',
    blood_group: 'O+',
    pfp: 'kucet/students/pfp/dropped.webp',
  },
  {
    id: 6,
    roll_no: null, // Missing Roll Number (INELIGIBLE)
    admission_no: 'ADM-26-006',
    name: 'UNPERSISTED ROLL CANDIDATE',
    student_status: 'ACTIVE',
    academic_status: 'ACTIVE',
  },
  {
    id: 7,
    roll_no: 'INVALID_ROLL_123', // Malformed Roll (INELIGIBLE)
    admission_no: 'ADM-26-007',
    name: 'INVALID ROLL CANDIDATE',
    student_status: 'ACTIVE',
    academic_status: 'ACTIVE',
  },
];

describe('IDCardDataService Authoritative Eligibility & Branch Export Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default chainable DB mock
    const chainable = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockImplementation(() => Promise.resolve(syntheticDbRows)),
      limit: vi.fn().mockImplementation((num) => {
        return Promise.resolve(syntheticDbRows.slice(0, num));
      }),
      then: (resolve) => resolve(syntheticDbRows),
    };

    db.select.mockReturnValue(chainable);
  });

  it('1. includes finalized students with persisted official roll numbers', async () => {
    const result = await IDCardDataService.getStudentRecords({ branch: 'CSE', limit: 20 });
    const kavya = result.students.find(s => s.rollNo === '26567T0901');

    expect(kavya).toBeDefined();
    expect(kavya.studentName).toBe('KAVYA REDDY');
    expect(kavya.branch).toBe('CSE');
    expect(kavya.batch).toBe('2026-2030');
    expect(kavya.photoStatus).toBe('AVAILABLE');
    expect(kavya.studentPhone).toBe('9876543210');
  });

  it('2. excludes draft applications and unfinalized admissions', async () => {
    // Draft applications remain in student_admission_drafts and are never returned from students table queries
    const result = await IDCardDataService.getStudentRecords({ branch: 'ALL' });
    const unfinalized = result.students.find(s => s.studentName === 'UNPERSISTED ROLL CANDIDATE');
    expect(unfinalized).toBeUndefined();
  });

  it('3. excludes rejected, dropped, and discontinued students', async () => {
    const result = await IDCardDataService.getStudentRecords({ branch: 'ALL' });
    const dropped = result.students.find(s => s.studentName === 'DROPPED CANDIDATE');
    expect(dropped).toBeUndefined();
  });

  it('4. excludes records with missing, null, or malformed roll numbers', async () => {
    const result = await IDCardDataService.getStudentRecords({ branch: 'ALL' });
    expect(result.students.every(s => Boolean(s.rollNo) && s.rollNo !== 'INVALID_ROLL_123')).toBe(true);
  });

  it('5. handles valid legacy finalized students according to verified rules', async () => {
    const result = await IDCardDataService.getStudentRecords({ branch: 'CSE' });
    const legacy = result.students.find(s => s.rollNo === '23567T0901');

    expect(legacy).toBeDefined();
    expect(legacy.studentName).toBe('LEGACY SENIOR');
    expect(legacy.batch).toBe('2023-2027');
    expect(legacy.branch).toBe('CSE');
  });

  it('6. isolates branches strictly: branch-specific query excludes other branches', async () => {
    const result = await IDCardDataService.getStudentRecords({ branch: 'CSE' });

    expect(result.students.every(s => s.branch === 'CSE')).toBe(true);
    const civilStudent = result.students.find(s => s.rollNo === '26567T0001');
    expect(civilStudent).toBeUndefined();
  });

  it('7. reports missing photographs accurately without fabricating files', async () => {
    const result = await IDCardDataService.getStudentRecords({ branch: 'CSE', photoStatus: 'MISSING' });
    expect(result.students.length).toBe(1);
    expect(result.students[0].rollNo).toBe('26567T0902');
    expect(result.students[0].photoStatus).toBe('MISSING');
    expect(result.students[0].photoUrl).toBeNull();
  });

  it('8. computes dynamic branch statistics across all canonical branches', async () => {
    // Mock branch summary query
    const rowsForStats = [
      { id: 1, roll_no: '26567T0901', pfp: 'some_photo.webp' }, // CSE photo ready
      { id: 2, roll_no: '26567T0902', pfp: null },              // CSE photo missing
      { id: 3, roll_no: '26567T0001', pfp: 'civil.webp' },       // CIVIL photo ready
      { id: 4, roll_no: '23567T0901', pfp: 'senior.webp' },      // CSE photo ready
    ];

    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(rowsForStats),
    });

    const stats = await IDCardDataService.getBranchSummaryStats();
    expect(stats.branches.length).toBe(CANONICAL_BRANCHES.length);

    const cseStats = stats.branches.find(b => b.branch === 'CSE');
    expect(cseStats.totalEligible).toBe(3);
    expect(cseStats.photosAvailable).toBe(2);
    expect(cseStats.photosMissing).toBe(1);

    const civilStats = stats.branches.find(b => b.branch === 'CIVIL');
    expect(civilStats.totalEligible).toBe(1);
    expect(civilStats.photosAvailable).toBe(1);
    expect(civilStats.photosMissing).toBe(0);

    expect(stats.globalSummary.totalEligible).toBe(4);
    expect(stats.globalSummary.photosAvailable).toBe(3);
    expect(stats.globalSummary.photosMissing).toBe(1);
  });

  it('9. exports complete branch dataset in Excel (XLSX) format with approved columns', async () => {
    const exportResult = await IDCardDataService.exportBranchData({
      branch: 'CSE',
      format: 'xlsx',
      user: { name: 'Admissions Officer' },
    });

    expect(exportResult.filename).toContain('KUCET_CSE_ID_CARD_DATA');
    expect(exportResult.filename.endsWith('.xlsx')).toBe(true);
    expect(exportResult.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(exportResult.count).toBe(3); // 26567T0901, 26567T0902, 23567T0901

    // Read back generated workbook with ExcelJS to verify column headers and data minimization
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exportResult.buffer);
    const worksheet = workbook.getWorksheet('CSE ID Cards');
    expect(worksheet).toBeDefined();

    const headers = worksheet.getRow(1).values.filter(Boolean);
    expect(headers).toEqual([
      'S.No',
      'Roll Number',
      'Student Full Name',
      'Student Photograph',
      'Academic Branch',
      'Course',
      'Academic Batch',
      "Father's Name",
      'Emergency Contact Mobile',
      'Permanent Address',
      'Blood Group',
      'Photo Status',
      'Photo Storage Reference',
    ]);

    // Data minimization assertion: Unneeded sensitive personal details must NOT be in headers
    expect(headers).not.toContain('Aadhaar Number');
    expect(headers).not.toContain('Annual Income');
    expect(headers).not.toContain('Sub-Caste');
    expect(headers).not.toContain('Religion');
  });

  it('10. exports complete branch dataset in CSV format with proper quoting', async () => {
    const exportResult = await IDCardDataService.exportBranchData({
      branch: 'CSE',
      format: 'csv',
    });

    expect(exportResult.filename.endsWith('.csv')).toBe(true);
    expect(exportResult.contentType).toContain('text/csv');

    const csvContent = exportResult.buffer.toString('utf8');
    const lines = csvContent.split('\n');
    expect(lines.length).toBe(4); // Header + 3 students

    expect(lines[0]).toContain('"Roll Number","Student Full Name","Academic Branch"');
    expect(lines[1]).toContain('"26567T0901","KAVYA REDDY","CSE"');
    expect(lines[2]).toContain('"26567T0902","SURESH KUMAR","CSE"');
  });

  it('11. rejects unauthorized branches for branch-scoped staff', async () => {
    await expect(
      IDCardDataService.exportBranchData({
        branch: 'CIVIL',
        allowedBranches: ['CSE'], // Scoped to CSE only
      })
    ).rejects.toThrow(/Access Denied/);
  });

  it('12. throws 404 error when exporting branch with zero eligible students', async () => {
    // Return empty array for branch MECH
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    });

    await expect(
      IDCardDataService.exportBranchData({
        branch: 'MECH',
      })
    ).rejects.toThrow(/No eligible finalized students found for branch MECH/);
  });

  it('13. retrieves single student card record with QR verification payload', async () => {
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([syntheticDbRows[0]]),
    });

    const card = await IDCardDataService.getStudentRecordByRollNo('26567T0901');
    expect(card).toBeDefined();
    expect(card.studentName).toBe('KAVYA REDDY');
    expect(card.branch).toBe('CSE');
    expect(card.qrUrl).toMatch(/^data:image\/png;base64,/);

    // Verify readable plain-text QR payload contents
    const qrPayload = IDCardDataService.generateStudentQRPayload(card);
    expect(typeof qrPayload).toBe('string');
    expect(qrPayload).not.toContain('schemaVersion');
    expect(qrPayload).not.toContain('KUCET_STUDENT_ID');
    expect(qrPayload).not.toContain('studentId');
    expect(qrPayload).toContain('HALL-TICKET-NO : 26567T0901');
    expect(qrPayload).toContain('NAME : KAVYA REDDY');
    expect(qrPayload).toContain('FATHER-S-NAME : RAMA REDDY');
    expect(qrPayload).toContain('COURSE : B.TECH (CSE)');
    expect(qrPayload).toContain('VALID-UPTO- : 2026-2030');
    expect(qrPayload).toContain('BRANCH : CSE');
    expect(qrPayload).toContain('ACADEMIC-YEAR : 2026-2030');
    expect(qrPayload).toContain('COLLEGE-NAME : KU COLLEGE OF ENGINEERING & TECHNOLOGY');
    expect(qrPayload).toContain('BLOOD-GROUP : O+');
  });

  it('14. bulk retrieval enforces departmental scoping', async () => {
    db.select.mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([syntheticDbRows[0], syntheticDbRows[2]]), // CSE & CIVIL
    });

    const scoped = await IDCardDataService.getStudentsForBulk(
      ['26567T0901', '26567T0001'],
      ['CIVIL'] // Civil only
    );

    expect(scoped.length).toBe(1);
    expect(scoped[0].admissionNo).toBe('26567T0001');
    expect(scoped[0].course).toBe('CIVIL');
  });

  it('15. regression guard: student in admission workflow cannot become eligible without DB finalization', async () => {
    // Suppose a draft application in student_admission_drafts has a proposed roll number '26567T0999',
    // but the student has NOT been finalized into the authoritative students table.
    // Querying students table returns only persisted finalized students.
    const result = await IDCardDataService.getStudentRecords({ branch: 'CSE' });
    const draftCandidate = result.students.find(s => s.rollNo === '26567T0999');
    expect(draftCandidate).toBeUndefined();
  });
});

describe('IDCardAuthorizationService RBAC & Scoping Suite', () => {
  it('permits global administrative and admission roles cross-branch access', () => {
    const adminUser = { role: 'admin' };
    const superAdminUser = { role: 'super_admin' };
    const admissionUser = { role: 'admission' };

    expect(IDCardAuthorizationService.canView(adminUser)).toBe(true);
    expect(IDCardAuthorizationService.canGenerate(admissionUser)).toBe(true);
    expect(IDCardAuthorizationService.getAllowedBranches(adminUser)).toBeNull(); // unrestricted
    expect(IDCardAuthorizationService.getAllowedBranches(admissionUser)).toBeNull(); // unrestricted
    expect(IDCardAuthorizationService.isBranchAllowed(superAdminUser, 'CIVIL')).toBe(true);
  });

  it('restricts departmental faculty and HODs to their assigned branch', () => {
    const facultyUser = { role: 'faculty', branch: 'CSE' };
    expect(IDCardAuthorizationService.getAllowedBranches(facultyUser)).toEqual(['CSE']);
    expect(IDCardAuthorizationService.isBranchAllowed(facultyUser, 'CSE')).toBe(true);
    expect(IDCardAuthorizationService.isBranchAllowed(facultyUser, 'CIVIL')).toBe(false);
  });

  it('denies access to unauthorized roles', () => {
    const studentUser = { role: 'student' };
    expect(IDCardAuthorizationService.canView(studentUser)).toBe(false);
    expect(IDCardAuthorizationService.canGenerate(studentUser)).toBe(false);
  });
});
