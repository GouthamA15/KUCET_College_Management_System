import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { formatDate } from '@/lib/date';
import { studentCreateSchema } from '@/lib/validations/student';

// Replicate public admission Zod schema from route.js
const bloodGroupSchema = z.preprocess(
  (v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (s === '' || s.toLowerCase() === 'not available' || s.toUpperCase() === 'UNKNOWN' || s.toLowerCase() === 'n/a') return null;
    return s;
  },
  z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).nullable().optional()
);

const admissionSubmissionSchema = z.object({
  name: z.string().trim().min(1),
  branch: z.string().trim().min(1),
  admission_year: z.string().trim().min(1),
  blood_group: bloodGroupSchema,
  dob: z.string().trim().min(1),
  aadhaar_no: z.string().transform(v => v.replace(/\D/g, '')).refine(v => v === '' || v.length === 12).nullable().optional(),
  legal_consent: z.literal(true),
});

describe('Issue A: Student Admission Blood Group Validation & Persistence Audits', () => {
  it('successfully validates "Not available" and converts to null for DB persistence', () => {
    const payload = {
      name: 'Test Student',
      branch: '18',
      admission_year: '2026-2030',
      blood_group: 'Not available',
      dob: '2005-06-15',
      aadhaar_no: '123456789012',
      legal_consent: true,
    };

    const result = admissionSubmissionSchema.safeParse(payload);
    expect(result.success).toBe(true);
    expect(result.data.blood_group).toBeNull();
  });

  it('validates each of the 8 canonical blood groups without modification', () => {
    const canonicalGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    for (const bg of canonicalGroups) {
      const res = bloodGroupSchema.safeParse(bg);
      expect(res.success).toBe(true);
      expect(res.data).toBe(bg);
    }
  });

  it('handles optional/empty/case-insensitive blood group representations as null', () => {
    const emptyCases = ['', '  ', null, undefined, 'not available', 'NOT AVAILABLE', 'UNKNOWN', 'unknown', 'N/A', 'n/a'];
    for (const c of emptyCases) {
      const res = bloodGroupSchema.safeParse(c);
      expect(res.success).toBe(true);
      expect(res.data).toBeNull();
    }
  });

  it('rejects invalid blood group values with validation failure', () => {
    const invalidCases = ['XYZ', 'C+', 'O*', 'Positive', '123', 'A_POS'];
    for (const inv of invalidCases) {
      const res = bloodGroupSchema.safeParse(inv);
      expect(res.success).toBe(false);
    }
  });

  it('validates staff studentCreateSchema with "Not available" converting to null', () => {
    const parsed = studentCreateSchema.shape.blood_group.safeParse('Not available');
    expect(parsed.success).toBe(true);
    expect(parsed.data).toBeNull();

    const validA = studentCreateSchema.shape.blood_group.safeParse('A+');
    expect(validA.success).toBe(true);
    expect(validA.data).toBe('A+');

    const invalid = studentCreateSchema.shape.blood_group.safeParse('INVALID');
    expect(invalid.success).toBe(false);
  });
});

describe('Issue B & C: Excel Export Data Completeness, Formatting & Image Embedding Audits', () => {
  // Synthetic test records (using fake Aadhaar numbers)
  const syntheticStudents = [
    {
      roll_no: '26567T1801',
      admission_no: 'ADM-2026-001',
      name: 'Aileni Chaithanya',
      gender: 'FEMALE',
      date_of_birth: '2005-04-12',
      email: 'chaithanya@example.com',
      mobile: '9876543210',
      father_name: 'Aileni Brahmaiah',
      mother_name: 'Aileni Mamatha',
      nationality: 'Indian',
      religion: 'HINDU',
      category: 'OC',
      sub_caste: 'REDDY',
      area_status: 'LOCAL',
      mother_tongue: 'TELUGU',
      place_of_birth: 'Warangal',
      father_occupation: 'Agriculture',
      annual_income: '150000',
      aadhaar_no: '999988887777', // Synthetic test Aadhaar
      guardian_mobile: '9876543211',
      permanent_address: 'H.No 1-23, Warangal, Telangana',
      identification_marks: 'Mole on right cheek',
      seat_allotted_category: 'OC_GEN',
      blood_group: null, // "Not available" persisted as null
      fee_reimbursement: 'YES',
      qualifying_exam: 'TG EAPCET',
      ssc_marks: '9.8',
      inter_marks: '965',
      entrance_exam_rank: '4521',
      previous_college: 'Govt Junior College',
      photo: 'kucet/students/pfp/synthetic_photo_1.png',
      signature: 'kucet/students/signatures/synthetic_sig_1.png',
    },
    {
      roll_no: '26567T1802',
      admission_no: 'ADM-2026-002',
      name: 'Aleti Abhilash',
      gender: 'MALE',
      date_of_birth: '2005-08-25',
      email: 'abhilash@example.com',
      mobile: '9876543212',
      father_name: 'Aleti Yakaiah',
      mother_name: 'Aleti Saritha',
      nationality: 'Indian',
      religion: 'HINDU',
      category: 'BC-B',
      sub_caste: 'GOUD',
      area_status: 'LOCAL',
      mother_tongue: 'TELUGU',
      place_of_birth: 'Hanamkonda',
      father_occupation: 'Business',
      annual_income: '200000',
      aadhaar_no: '888877776666', // Synthetic test Aadhaar
      guardian_mobile: '9876543213',
      permanent_address: 'H.No 4-56, Hanamkonda, Telangana',
      identification_marks: 'Scar on left arm',
      seat_allotted_category: 'BC_B_GEN',
      blood_group: 'O+',
      fee_reimbursement: 'NO',
      qualifying_exam: 'TG EAPCET',
      ssc_marks: '9.5',
      inter_marks: '940',
      entrance_exam_rank: '6230',
      previous_college: 'Sri Chaitanya',
      photo: null, // No photograph
      signature: null,
    }
  ];

  // Helper function to build workbook matching export-students route logic
  async function generateTestWorkbook(students, isAuthorizedForFullAadhaar, syntheticImageBuffer = null) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Students', { views: [{ showGridLines: true }] });

    worksheet.columns = [
      { header: 'Roll Number', key: 'roll_no', width: 16 },
      { header: 'Admission Number', key: 'admission_no', width: 18 },
      { header: 'Batch', key: 'batch', width: 14 },
      { header: 'Full Name', key: 'name', width: 28 },
      { header: 'Gender', key: 'gender', width: 12 },
      { header: 'Date of Birth', key: 'date_of_birth', width: 16 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Mobile Number', key: 'mobile', width: 16 },
      { header: 'Father Name', key: 'father_name', width: 26 },
      { header: 'Mother Name', key: 'mother_name', width: 26 },
      { header: 'Nationality', key: 'nationality', width: 14 },
      { header: 'Religion', key: 'religion', width: 14 },
      { header: 'Category', key: 'category', width: 12 },
      { header: 'Sub-Caste', key: 'sub_caste', width: 16 },
      { header: 'Area Status', key: 'area_status', width: 14 },
      { header: 'Mother Tongue', key: 'mother_tongue', width: 16 },
      { header: 'Place of Birth', key: 'place_of_birth', width: 20 },
      { header: 'Father Occupation', key: 'father_occupation', width: 22 },
      { header: 'Annual Income', key: 'annual_income', width: 18 },
      { header: 'Aadhaar Number', key: 'aadhaar_no', width: 20 },
      { header: 'Guardian Mobile', key: 'guardian_mobile', width: 16 },
      { header: 'Permanent Address', key: 'permanent_address', width: 40 },
      { header: 'Identification Marks', key: 'identification_marks', width: 32 },
      { header: 'Seat Allotted Category', key: 'seat_allotted_category', width: 22 },
      { header: 'Blood Group', key: 'blood_group', width: 14 },
      { header: 'Fee Reimbursement', key: 'fee_reimbursement', width: 18 },
      { header: 'Qualifying Exam', key: 'qualifying_exam', width: 16 },
      { header: 'SSC Marks', key: 'ssc_marks', width: 14 },
      { header: 'Inter/Diploma Marks', key: 'inter_marks', width: 18 },
      { header: 'Entrance Exam Rank', key: 'entrance_exam_rank', width: 18 },
      { header: 'Previous College', key: 'previous_college', width: 30 },
      { header: 'Photo', key: 'photo', width: 16 },
      { header: 'Signature', key: 'signature', width: 20 }
    ];

    let rowIndex = 2;
    for (const s of students) {
      const formattedDob = s.date_of_birth ? formatDate(s.date_of_birth, 'N/A') : 'N/A';
      const plainAadhaar = s.aadhaar_no ? String(s.aadhaar_no).trim() : '';
      const finalAadhaar = isAuthorizedForFullAadhaar 
        ? plainAadhaar 
        : (plainAadhaar.length >= 4 ? `XXXX-XXXX-${plainAadhaar.slice(-4)}` : 'N/A');

      const bloodGroupDisplay = s.blood_group || 'Not available';

      const addedRow = worksheet.addRow({
        roll_no: s.roll_no,
        admission_no: s.admission_no,
        batch: '2026-2030',
        name: s.name,
        gender: s.gender,
        date_of_birth: formattedDob,
        email: s.email,
        mobile: s.mobile,
        father_name: s.father_name,
        mother_name: s.mother_name,
        nationality: s.nationality,
        religion: s.religion,
        category: s.category,
        sub_caste: s.sub_caste,
        area_status: s.area_status,
        mother_tongue: s.mother_tongue,
        place_of_birth: s.place_of_birth,
        father_occupation: s.father_occupation,
        annual_income: s.annual_income,
        aadhaar_no: finalAadhaar,
        guardian_mobile: s.guardian_mobile,
        permanent_address: s.permanent_address,
        identification_marks: s.identification_marks,
        seat_allotted_category: s.seat_allotted_category,
        blood_group: bloodGroupDisplay,
        fee_reimbursement: s.fee_reimbursement,
        qualifying_exam: s.qualifying_exam,
        ssc_marks: s.ssc_marks,
        inter_marks: s.inter_marks,
        entrance_exam_rank: s.entrance_exam_rank,
        previous_college: s.previous_college,
        photo: '',
        signature: ''
      });

      addedRow.height = 75;
      addedRow.getCell('aadhaar_no').numFmt = '@';
      addedRow.getCell('date_of_birth').numFmt = '@';

      if (s.photo && syntheticImageBuffer) {
        const imageId = workbook.addImage({
          buffer: syntheticImageBuffer,
          extension: 'png',
        });
        worksheet.addImage(imageId, {
          tl: { col: 31 + 0.15, row: (rowIndex - 1) + 0.08 },
          ext: { width: 66, height: 66 },
          editAs: 'oneCell'
        });
      } else {
        addedRow.getCell('photo').value = 'Photo unavailable';
      }

      rowIndex++;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return { buffer, workbook };
  }

  it('exports Date of Birth in DD-MM-YYYY format and not N/A or current date', async () => {
    const { buffer } = await generateTestWorkbook(syntheticStudents, true);
    const readWb = new ExcelJS.Workbook();
    await readWb.xlsx.load(buffer);
    const ws = readWb.getWorksheet('Students');

    // Row 2: 2005-04-12 -> 12-04-2005
    expect(ws.getCell('F2').value).toBe('12-04-2005');
    // Row 3: 2005-08-25 -> 25-08-2005
    expect(ws.getCell('F3').value).toBe('25-08-2005');
  });

  it('exports complete unmasked Aadhaar as text for authorized admission export', async () => {
    const { buffer } = await generateTestWorkbook(syntheticStudents, true);
    const readWb = new ExcelJS.Workbook();
    await readWb.xlsx.load(buffer);
    const ws = readWb.getWorksheet('Students');

    // Aadhaar column is Column 20 (T)
    const cellT2 = ws.getCell('T2');
    expect(cellT2.value).toBe('999988887777');
    expect(typeof cellT2.value).toBe('string');
    expect(cellT2.numFmt).toBe('@');

    const cellT3 = ws.getCell('T3');
    expect(cellT3.value).toBe('888877776666');
    expect(typeof cellT3.value).toBe('string');
    expect(cellT3.numFmt).toBe('@');
  });

  it('masks Aadhaar number for unauthorized / restricted roles', async () => {
    const { buffer } = await generateTestWorkbook(syntheticStudents, false);
    const readWb = new ExcelJS.Workbook();
    await readWb.xlsx.load(buffer);
    const ws = readWb.getWorksheet('Students');

    expect(ws.getCell('T2').value).toBe('XXXX-XXXX-7777');
    expect(ws.getCell('T3').value).toBe('XXXX-XXXX-6666');
  });

  it('embeds image in exact student row and sets "Photo unavailable" when missing', async () => {
    // 1x1 synthetic PNG buffer
    const fakePngBuffer = Buffer.from([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
      0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
      0x42, 0x60, 0x82
    ]);

    const { buffer } = await generateTestWorkbook(syntheticStudents, true, fakePngBuffer);
    const readWb = new ExcelJS.Workbook();
    await readWb.xlsx.load(buffer);
    const ws = readWb.getWorksheet('Students');

    // Only student 1 had a photo; student 2 had null photo
    const images = ws.getImages();
    expect(images.length).toBe(1);
    expect(images[0].range.tl.row).toBeCloseTo(1.08, 1); // Row 2 (0-indexed 1)
    expect(images[0].range.tl.col).toBeCloseTo(31.15, 1); // Column 32 (0-indexed 31)

    // Row 3 (student 2) has text 'Photo unavailable'
    expect(ws.getCell('AF3').value).toBe('Photo unavailable');
  });

  it('exports "Not available" when blood group is null or empty', async () => {
    const { buffer } = await generateTestWorkbook(syntheticStudents, true);
    const readWb = new ExcelJS.Workbook();
    await readWb.xlsx.load(buffer);
    const ws = readWb.getWorksheet('Students');

    // Column 25 (Y) is Blood Group
    expect(ws.getCell('Y2').value).toBe('Not available'); // Student 1 had null blood group
    expect(ws.getCell('Y3').value).toBe('O+'); // Student 2 had O+
  });
});
