import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks
const mockGetAuthUser = vi.fn();
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();

vi.mock('@/lib/api-utils', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getAuthUser: (...args) => mockGetAuthUser(...args),
  };
});

vi.mock('@/db', () => ({
  db: {
    select: (...args) => mockDbSelect(...args),
    insert: (...args) => mockDbInsert(...args),
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    runWithContext: vi.fn((_ctx, cb) => cb()),
  },
}));

describe('KUCET Admission Bridge — API Endpoint Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/staff/admission/bridge/students/[rollno]', () => {
    it('should reject unauthenticated requests with 401 Unauthorized', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const { GET } = await import('@/app/api/staff/admission/bridge/students/[rollno]/route');
      const req = new Request('http://localhost:3000/api/staff/admission/bridge/students/26567T0332');
      const res = await GET(req, { params: Promise.resolve({ rollno: '26567T0332' }) });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Unauthorized');
    });

    it('should reject unauthorized staff roles (e.g., faculty, student) with 403 Forbidden', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 10, role: 'faculty' });

      const { GET } = await import('@/app/api/staff/admission/bridge/students/[rollno]/route');
      const req = new Request('http://localhost:3000/api/staff/admission/bridge/students/26567T0332');
      const res = await GET(req, { params: Promise.resolve({ rollno: '26567T0332' }) });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Forbidden');
    });

    it('should return 400 when invalid roll number format is requested', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 1, role: 'admission' });

      const { GET } = await import('@/app/api/staff/admission/bridge/students/[rollno]/route');
      const req = new Request('http://localhost:3000/api/staff/admission/bridge/students/INVALID_ROLL');
      const res = await GET(req, { params: Promise.resolve({ rollno: 'INVALID_ROLL' }) });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Invalid');
    });

    it('should return 404 when student does not exist in database', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 1, role: 'admission' });

      const queryMock = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]), // Empty DB response
      };
      mockDbSelect.mockReturnValue(queryMock);

      const { GET } = await import('@/app/api/staff/admission/bridge/students/[rollno]/route');
      const req = new Request('http://localhost:3000/api/staff/admission/bridge/students/26567T0332');
      const res = await GET(req, { params: Promise.resolve({ rollno: '26567T0332' }) });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain('not found');
    });

    it('should successfully return minimal academic details with data minimization for admission clerk', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 1, role: 'admission', email: 'admission@kucet.ac.in' });

      const studentDbRow = {
        id: 101,
        roll_no: '26567T0332',
        name: 'KOLA SRIKANTH',
        admission_no: '0332',
        admission_date: new Date('2026-07-25'),
        student_status: 'ACTIVE',
        qualifying_exam: 'TG EAPCET',
        pfp: 'kucet/students/pfp/abc1234.webp',
        signature: 'kucet/students/signatures/def5678.webp',
      };

      const queryMock = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([studentDbRow]),
      };
      mockDbSelect.mockReturnValue(queryMock);

      const insertMock = {
        values: vi.fn().mockResolvedValue([{ insertId: 1 }]),
      };
      mockDbInsert.mockReturnValue(insertMock);

      const { GET } = await import('@/app/api/staff/admission/bridge/students/[rollno]/route');
      const req = new Request('http://localhost:3000/api/staff/admission/bridge/students/26567T0332');
      const res = await GET(req, { params: Promise.resolve({ rollno: '26567T0332' }) });

      expect(res.status).toBe(200);
      const d = await res.json();

      expect(d.rollNo).toBe('26567T0332');
      expect(d.name).toBe('KOLA SRIKANTH');
      expect(d.admissionNo).toBe('0332');
      expect(d.admissionType).toBe('Regular');
      expect(d.course).toBe('B.TECH');
      expect(d.portalBranch).toBe('MECHANICAL');
      expect(d.scheme).toBe('2013'); // Institutionally confirmed scheme
      expect(d.previousStudying).toBe('Inter');
      expect(d.formattedAdmissionDate).toBe('25-Jul-26');
      expect(d.hallTicketNumber).toBe('26567T0332');
      expect(d.photo.expectedFilename).toBe('0332.jpg');
      expect(d.signature.expectedFilename).toBe('0332(1).jpg');

      // DATA MINIMIZATION ASSERTIONS: Ensure sensitive PII is NEVER present
      expect(d.aadhaar_no).toBeUndefined();
      expect(d.aadhaar).toBeUndefined();
      expect(d.apaar_id).toBeUndefined();
      expect(d.mobile).toBeUndefined();
      expect(d.guardian_mobile).toBeUndefined();
      expect(d.father_name).toBeUndefined();
      expect(d.mother_name).toBeUndefined();
      expect(d.permanent_address).toBeUndefined();
      expect(d.contact_address).toBeUndefined();
      expect(d.annual_income).toBeUndefined();
      expect(d.religion).toBeUndefined();
      expect(d.caste).toBeUndefined();
      expect(d.fees).toBeUndefined();
      expect(d.scholarship).toBeUndefined();
      expect(d.email).toBeUndefined();

      // Phase 2 Primary Details assertions
      expect(d.primaryDetails).toBeDefined();
      expect(d.primaryDetails.fullName).toBe('KOLA SRIKANTH');
      expect(d.primaryDetails.useSameAddressForPermanent).toBe(true);
      expect(d.primaryDetails.email).toBeUndefined(); // Email strictly excluded
    });

    it('should return complete Phase 2 Primary Details with decrypted values and income mapping', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 1, role: 'admission_clerk' });

      const fullStudentRow = {
        id: 105,
        roll_no: '26567T0925',
        name: 'SURESH REDDY',
        admission_no: '0925',
        admission_date: new Date('2026-07-28'),
        student_status: 'ACTIVE',
        date_of_birth: '2008-04-15',
        gender: 'MALE',
        mobile: '9876543210', // Plaintext for mock decrypt
        qualifying_exam: 'TG EAPCET',
        pfp: 'kucet/students/pfp/pic.webp',
        signature: 'kucet/students/signatures/sig.webp',
        father_name: 'RAMA RAO REDDY',
        mother_name: 'SARASWATHI REDDY',
        nationality: 'Indian',
        religion: 'Hindu',
        category: 'OC',
        sub_caste: 'Reddy',
        area_status: 'Local',
        mother_tongue: 'Telugu',
        place_of_birth: 'Warangal',
        father_occupation: 'Agriculture',
        annual_income: '₹0–₹1,00,000',
        aadhaar_no: '123456789012', // Plaintext for mock decrypt
        curr_house_no: '4-55',
        curr_street: 'Temple Road',
        curr_city: 'Kazipet',
        curr_state: 'Telangana',
        curr_pincode: '506003',
        curr_country: 'India',
        blood_group: 'O+',
      };

      const queryMock = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([fullStudentRow]),
      };
      mockDbSelect.mockReturnValue(queryMock);

      const capturedAuditValues = [];
      const insertMock = {
        values: vi.fn((vals) => {
          capturedAuditValues.push(vals);
          return Promise.resolve([{ insertId: 5 }]);
        }),
      };
      mockDbInsert.mockReturnValue(insertMock);

      const { GET } = await import('@/app/api/staff/admission/bridge/students/[rollno]/route');
      const req = new Request('http://localhost:3000/api/staff/admission/bridge/students/26567T0925');
      const res = await GET(req, { params: Promise.resolve({ rollno: '26567T0925' }) });

      expect(res.status).toBe(200);
      const d = await res.json();

      const pd = d.primaryDetails;
      expect(pd).toBeDefined();
      expect(pd.fullName).toBe('SURESH REDDY');
      expect(pd.fatherName).toBe('RAMA RAO REDDY');
      expect(pd.motherName).toBe('SARASWATHI REDDY');
      expect(pd.dateOfBirth).toBe('15-04-2008');
      expect(pd.dobComponents.day).toBe('15');
      expect(pd.dobComponents.month).toBe('4');
      expect(pd.dobComponents.year).toBe('2008');
      expect(pd.dobComponents.monthName).toBe('April');
      expect(pd.gender).toBe('Male');
      expect(pd.bloodGroup).toBe('O+');
      expect(pd.location).toBe('Local');
      expect(pd.nationality).toBe('Indian');
      expect(pd.socialStatus).toBe('OC');
      expect(pd.subCaste).toBe('Reddy');
      expect(pd.fatherOccupation).toBe('Agriculture');
      expect(pd.currentAddress).toBe('4-55, Temple Road, Kazipet, Telangana, 506003');
      expect(pd.useSameAddressForPermanent).toBe(true);

      // Income mapping verified: ₹0–₹1,00,000 -> 50000
      expect(pd.portalIncome).toBe('50000');
      expect(pd.incomeStatus).toBe('VERIFIED');

      // Aadhaar and contact decrypted
      expect(pd.aadhaarNumber).toBe('123456789012');
      expect(pd.contactNumber).toBe('9876543210');

      // Email is excluded completely
      expect(pd.email).toBeUndefined();
      expect(d.email).toBeUndefined();

      // AUDIT PRIVACY VERIFICATION: Confirm Aadhaar & contact are NEVER in audit log
      expect(capturedAuditValues.length).toBeGreaterThan(0);
      const auditPayload = capturedAuditValues[0].payload_after;
      expect(auditPayload.aadhaar_no).toBeUndefined();
      expect(auditPayload.aadhaarNumber).toBeUndefined();
      expect(auditPayload.mobile).toBeUndefined();
      expect(auditPayload.contactNumber).toBeUndefined();
    });

    it('should correctly map CSD branch to DATA SCIENCE and lateral admission numbers with L suffix', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 2, role: 'admin' });

      const lateralCsdStudent = {
        id: 102,
        roll_no: '265673065L',
        name: 'PRIYA DATA SCIENTIST',
        admission_no: '3065L',
        admission_date: new Date('2026-08-10'),
        student_status: 'ACTIVE',
        qualifying_exam: 'TG ECET',
        pfp: 'kucet/students/pfp/csd.webp',
        signature: 'kucet/students/signatures/csd.webp',
      };

      const queryMock = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([lateralCsdStudent]),
      };
      mockDbSelect.mockReturnValue(queryMock);

      const insertMock = { values: vi.fn().mockResolvedValue([{ insertId: 2 }]) };
      mockDbInsert.mockReturnValue(insertMock);

      const { GET } = await import('@/app/api/staff/admission/bridge/students/[rollno]/route');
      const req = new Request('http://localhost:3000/api/staff/admission/bridge/students/265673065L');
      const res = await GET(req, { params: Promise.resolve({ rollno: '265673065L' }) });

      expect(res.status).toBe(200);
      const d = await res.json();

      expect(d.portalBranch).toBe('DATA SCIENCE'); // Confirmed CSD mapping
      expect(d.admissionNo).toBe('3065L');
      expect(d.admissionType).toBe('Lateral');
      expect(d.previousStudying).toBe('Diploma'); // Confirmed TG ECET mapping
      expect(d.photo.expectedFilename).toBe('3065L.jpg');
      expect(d.signature.expectedFilename).toBe('3065L(1).jpg');
    });

    it('should report warnings when photo or signature is missing', async () => {
      mockGetAuthUser.mockResolvedValue({ id: 1, role: 'admission_clerk' });

      const studentWithoutMedia = {
        id: 103,
        roll_no: '26567T0901',
        name: 'NO MEDIA STUDENT',
        admission_no: '0901',
        admission_date: null, // missing date
        student_status: 'ACTIVE',
        qualifying_exam: 'TG EAPCET',
        pfp: null, // missing photo
        signature: null, // missing signature
      };

      const queryMock = {
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([studentWithoutMedia]),
      };
      mockDbSelect.mockReturnValue(queryMock);

      const insertMock = { values: vi.fn().mockResolvedValue([{ insertId: 3 }]) };
      mockDbInsert.mockReturnValue(insertMock);

      const { GET } = await import('@/app/api/staff/admission/bridge/students/[rollno]/route');
      const req = new Request('http://localhost:3000/api/staff/admission/bridge/students/26567T0901');
      const res = await GET(req, { params: Promise.resolve({ rollno: '26567T0901' }) });

      expect(res.status).toBe(200);
      const d = await res.json();
      expect(d.photo.available).toBe(false);
      expect(d.signature.available).toBe(false);

      const warningCodes = d.warnings.map(w => w.code);
      expect(warningCodes).toContain('MISSING_PHOTO');
      expect(warningCodes).toContain('MISSING_SIGNATURE');
      expect(warningCodes).toContain('MISSING_ADMISSION_DATE');
    });
  });
});
