import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import unzipper from 'unzipper';
import { BulkIdCardService, sanitizeForFilename } from '@/services/admission/id-card/BulkIdCardService';
import { IDCardDataService } from '@/services/identity/IDCardDataService';
import { IDCardAuthorizationService } from '@/services/identity/IDCardAuthorizationService';
import * as academicUtils from '@/lib/academic-utils';

// Mock DB
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue({}),
    })),
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
  decrypt: vi.fn((val) => {
    if (!val) return null;
    if (val.startsWith('encrypted_')) return val.replace('encrypted_', '');
    return val;
  }),
}));

vi.mock('@/services/institution/InstitutionAssetService', () => ({
  InstitutionAssetService: {
    getAssetDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,mocklogo'),
  },
}));

vi.mock('@/app/api/staff/id-cards/[rollno]/pdf/route', () => ({
  resolvePdfImageDataUrl: vi.fn().mockResolvedValue('data:image/jpeg;base64,mockphoto'),
}));

// Synthetic test database records
const syntheticStudents = [
  {
    id: 1,
    roll_no: '26567T0901', // CSE Regular Finalized (Has Photo)
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
    father_name: 'RAVI',
    mother_name: 'SARITHA',
    blood_group: 'A+',
    perm_house_no: '7-8-9',
    perm_street: 'Subedari',
    perm_apartment: null,
    perm_city: 'Warangal',
    perm_state: 'Telangana',
    perm_pincode: '506001',
    perm_country: 'India',
    pfp: 'kucet/students/pfp/akhil.webp',
  },
  {
    id: 4,
    roll_no: '26567T1801', // IT Regular Finalized
    admission_no: 'ADM-26-004',
    name: 'PRIYA SHARMA',
    date_of_birth: '2005-09-10',
    gender: 'FEMALE',
    email: 'priya@example.com',
    mobile: 'encrypted_9123456780',
    admission_date: '2026-08-01',
    student_status: 'ACTIVE',
    academic_status: 'ACTIVE',
    father_name: 'MOHAN',
    mother_name: 'SUNITA',
    blood_group: 'AB+',
    perm_house_no: '10-1-2',
    perm_street: 'Balasamudram',
    perm_apartment: null,
    perm_city: 'Hanamkonda',
    perm_state: 'Telangana',
    perm_pincode: '506001',
    perm_country: 'India',
    pfp: 'kucet/students/pfp/priya.webp',
  },
  {
    id: 5,
    roll_no: 'INVALID_ROLL', // Invalid Roll -> Excluded
    admission_no: 'ADM-26-005',
    name: 'DRAFT STUDENT',
    student_status: 'ACTIVE',
    academic_status: 'ACTIVE',
    father_name: 'NONE',
    pfp: null,
  },
  {
    id: 6,
    roll_no: '26567T0903',
    admission_no: 'ADM-26-006',
    name: 'DROPPED STUDENT',
    student_status: 'DROPPED', // Inactive -> Excluded
    academic_status: 'DROPPED',
    father_name: 'RAMESH',
    pfp: null,
  },
];

describe('BulkIdCardService — Core Logic & ZIP Generation Pipeline', () => {
  const coordinatorUser = {
    id: 101,
    role: 'faculty',
    is_first_year_coordinator: true,
    branch: 'CSE',
  };

  const admissionUser = {
    id: 201,
    role: 'admission',
    name: 'Admission Officer',
  };

  const regularFacultyUser = {
    id: 301,
    role: 'faculty',
    branch: 'ECE',
  };

  const adminUser = {
    id: 1,
    role: 'admin',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock IDCardDataService authoritative base query
    vi.spyOn(IDCardDataService, 'getAuthoritativeBaseQuery').mockReturnValue({
      orderBy: vi.fn().mockResolvedValue(syntheticStudents),
    });

    // Mock academic session & first year checks
    vi.spyOn(academicUtils, 'getCurrentCalendarSession').mockResolvedValue({
      academicYear: '2026-27',
      semester: 1,
      isCurrent: true,
    });

    vi.spyOn(academicUtils, 'getCollegeAcademicYear').mockResolvedValue('2026-27');

    vi.spyOn(IDCardDataService, 'isStudentFirstYear').mockImplementation(async (rollNo) => {
      // Synthetic: all 26567T* rolls are 1st year
      return String(rollNo).startsWith('26');
    });
  });

  describe('1. sanitizeForFilename', () => {
    it('removes spaces and special characters', () => {
      expect(sanitizeForFilename('Kavya Reddy')).toBe('KAVYA_REDDY');
      expect(sanitizeForFilename('Akhil Bhukya (IT)')).toBe('AKHIL_BHUKYA_IT');
    });

    it('prevents directory traversal attacks', () => {
      expect(sanitizeForFilename('../../etc/passwd')).toBe('ETC_PASSWD');
      expect(sanitizeForFilename('..\\..\\windows')).toBe('WINDOWS');
    });

    it('handles empty or null gracefully', () => {
      expect(sanitizeForFilename(null)).toBe('STUDENT');
      expect(sanitizeForFilename('')).toBe('STUDENT');
    });
  });

  describe('2. resolveUserScope', () => {
    it('allows full institutional scope for Admission Staff and Admin', () => {
      const scope = BulkIdCardService.resolveUserScope(admissionUser, { requestedBranch: 'ALL' });
      expect(scope.effectiveBranch).toBe('ALL');
      expect(scope.isFirstYearRestricted).toBe(false);

      const adminScope = BulkIdCardService.resolveUserScope(adminUser, { requestedBranch: 'ALL' });
      expect(adminScope.effectiveBranch).toBe('ALL');
    });

    it('allows First-Year Coordinator to access all 7 branches for First Year', () => {
      const scope = BulkIdCardService.resolveUserScope(coordinatorUser, {
        requestedBranch: 'ALL',
        requestedLevel: 'FIRST_YEAR',
      });
      expect(scope.effectiveBranch).toBe('ALL');
      expect(scope.effectiveLevel).toBe('FIRST_YEAR');
      expect(scope.isFirstYearRestricted).toBe(true);
    });

    it('throws 403 when user is not authorized for requested branch', () => {
      vi.spyOn(IDCardAuthorizationService, 'isBranchAllowed').mockReturnValueOnce(false);
      expect(() => {
        BulkIdCardService.resolveUserScope(admissionUser, { requestedBranch: 'CIVIL' });
      }).toThrow(/Forbidden: You do not have permission for branch CIVIL/);
    });

    it('denies First-Year Coordinator from accessing Second Year (403)', () => {
      expect(() => {
        BulkIdCardService.resolveUserScope(coordinatorUser, {
          requestedBranch: 'ALL',
          requestedLevel: 'SECOND_YEAR',
        });
      }).toThrow(/First Year Coordinator access is strictly restricted/);
    });

    it('denies regular faculty without coordinator privileges (403)', () => {
      expect(() => {
        BulkIdCardService.resolveUserScope(regularFacultyUser, { requestedBranch: 'ALL' });
      }).toThrow(/Forbidden/);
    });

    it('denies unauthenticated requests (401)', () => {
      expect(() => {
        BulkIdCardService.resolveUserScope(null);
      }).toThrow(/Unauthorized/);
    });
  });

  describe('3. getBulkPreview', () => {
    it('computes accurate counts for All Branches', async () => {
      const preview = await BulkIdCardService.getBulkPreview({
        user: admissionUser,
        branch: 'ALL',
        academicLevel: 'FIRST_YEAR',
      });

      expect(preview.totalEligible).toBe(4); // 2 CSE + 1 CIVIL + 1 IT (excluding invalid & dropped)
      expect(preview.photosAvailable).toBe(3); // Kavya, Akhil, Priya
      expect(preview.photosMissing).toBe(1); // Suresh
      expect(preview.academicLevel).toBe('FIRST_YEAR');
      expect(preview.expectedPdfs).toBe(4);

      // Verify canonical branch breakdown
      const cseBranch = preview.branches.find((b) => b.branch === 'CSE');
      expect(cseBranch).toBeDefined();
      expect(cseBranch.totalEligible).toBe(2);
      expect(cseBranch.photosAvailable).toBe(1);
      expect(cseBranch.photosMissing).toBe(1);
    });

    it('computes accurate counts for a single selected branch (e.g. CSE)', async () => {
      const preview = await BulkIdCardService.getBulkPreview({
        user: admissionUser,
        branch: 'CSE',
        academicLevel: 'FIRST_YEAR',
      });

      expect(preview.totalEligible).toBe(2);
      expect(preview.photosAvailable).toBe(1);
      expect(preview.photosMissing).toBe(1);
      expect(preview.selectedBranch).toBe('CSE');
    });
  });

  describe('4. generateBulkZip & Package Structure', () => {
    it('generates a valid ZIP containing individual PDFs organized by branch for All Branches', async () => {
      const result = await BulkIdCardService.generateBulkZip({
        user: coordinatorUser,
        branch: 'ALL',
        academicLevel: 'FIRST_YEAR',
      });

      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(result.totalEligible).toBe(4);
      expect(result.generatedCount).toBe(4);
      expect(result.zipFilename).toContain('KUCET_ID_Cards_All_Branches_First_Year');

      // Verify file exists on disk
      const job = BulkIdCardService.getJob(result.jobId, coordinatorUser);
      expect(job).not.toBeNull();
      expect(fs.existsSync(job.filePath)).toBe(true);

      // Unzip and inspect contents
      const archiveBuffer = fs.readFileSync(job.filePath);
      const directory = await unzipper.Open.buffer(archiveBuffer);

      const filenames = directory.files.map((f) => f.path);

      // Verify individual PDF filenames and branch directory organization
      expect(filenames).toContain('CSE/26567T0901_KAVYA_REDDY_ID_CARD.pdf');
      expect(filenames).toContain('CSE/26567T0902_SURESH_KUMAR_ID_CARD.pdf');
      expect(filenames).toContain('CIVIL/26567T0001_AGITHA_AKHIL_ID_CARD.pdf');
      expect(filenames).toContain('IT/26567T1801_PRIYA_SHARMA_ID_CARD.pdf');

      // Verify README.txt is included
      expect(filenames).toContain('README.txt');

      const readmeFile = directory.files.find((f) => f.path === 'README.txt');
      const readmeContent = (await readmeFile.buffer()).toString('utf8');
      expect(readmeContent).toContain('KU COLLEGE OF ENGINEERING & TECHNOLOGY (KUCET)');
      expect(readmeContent).toContain('BULK STUDENT IDENTITY CARD ARCHIVE');
      expect(readmeContent).toContain('Total Individual PDFs Generated   : 4');

      // Cleanup
      BulkIdCardService.cleanupJob(result.jobId);
    });

    it('generates a valid ZIP directly for a single branch (CSE)', async () => {
      const result = await BulkIdCardService.generateBulkZip({
        user: admissionUser,
        branch: 'CSE',
        academicLevel: 'FIRST_YEAR',
      });

      expect(result.success).toBe(true);
      expect(result.generatedCount).toBe(2);
      expect(result.zipFilename).toContain('KUCET_ID_Cards_CSE_First_Year');

      const job = BulkIdCardService.getJob(result.jobId, admissionUser);
      const archiveBuffer = fs.readFileSync(job.filePath);
      const directory = await unzipper.Open.buffer(archiveBuffer);

      const filenames = directory.files.map((f) => f.path);
      expect(filenames).toContain('26567T0901_KAVYA_REDDY_ID_CARD.pdf');
      expect(filenames).toContain('26567T0902_SURESH_KUMAR_ID_CARD.pdf');
      expect(filenames).toContain('README.txt');

      BulkIdCardService.cleanupJob(result.jobId);
    });

    it('handles student records with missing photographs gracefully without crashing', async () => {
      const result = await BulkIdCardService.generateBulkZip({
        user: coordinatorUser,
        branch: 'CSE',
        academicLevel: 'FIRST_YEAR',
      });

      // Suresh (26567T0902) has no photo, should be flagged in notices but still generated with NO PHOTO
      expect(result.generatedCount).toBe(2);
      const missingPhotoNotice = result.exclusions.find((ex) => ex.rollNo === '26567T0902');
      expect(missingPhotoNotice).toBeDefined();
      expect(missingPhotoNotice.reason).toContain('photograph not found');

      BulkIdCardService.cleanupJob(result.jobId);
    });
  });

  describe('5. getJob Ownership and Cleanup', () => {
    it('prevents unauthorized users from downloading another user’s generated package', async () => {
      const result = await BulkIdCardService.generateBulkZip({
        user: coordinatorUser, // generated by coordinator
        branch: 'CSE',
      });

      const otherUser = { id: 999, role: 'staff' };

      expect(() => {
        BulkIdCardService.getJob(result.jobId, otherUser);
      }).toThrow(/Forbidden/);

      // Super admin is allowed
      const adminJob = BulkIdCardService.getJob(result.jobId, adminUser);
      expect(adminJob).not.toBeNull();

      BulkIdCardService.cleanupJob(result.jobId);
    });

    it('cleans up temporary files when cleanupJob is called', async () => {
      const result = await BulkIdCardService.generateBulkZip({
        user: admissionUser,
        branch: 'CSE',
      });

      const job = BulkIdCardService.getJob(result.jobId, admissionUser);
      const filePath = job.filePath;
      expect(fs.existsSync(filePath)).toBe(true);

      BulkIdCardService.cleanupJob(result.jobId);

      expect(fs.existsSync(filePath)).toBe(false);
      expect(BulkIdCardService.getJob(result.jobId, admissionUser)).toBeNull();
    });
  });
});
