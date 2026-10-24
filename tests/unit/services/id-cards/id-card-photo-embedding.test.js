import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IDCardDataService } from '@/services/identity/IDCardDataService';
import { db } from '@/db';
import ExcelJS from 'exceljs';
import PizZip from 'pizzip';
import sharp from 'sharp';

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

describe('ID Card Photograph Embedding & Multi-Format Export Engine', () => {
  let samplePhotoBuffer;
  let samplePhotoDataUri;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Generate a valid 100x120 test JPEG image with sharp
    samplePhotoBuffer = await sharp({
      create: {
        width: 100,
        height: 120,
        channels: 3,
        background: { r: 11, g: 53, b: 120 },
      },
    })
      .jpeg()
      .toBuffer();

    samplePhotoDataUri = `data:image/jpeg;base64,${samplePhotoBuffer.toString('base64')}`;
  });

  const mockStudents = [
    {
      id: 1,
      roll_no: '26567T0901',
      admission_no: 'ADM-26-001',
      name: 'ADEPU SUCHARITHA',
      date_of_birth: '2005-04-12',
      gender: 'FEMALE',
      email: 'adepu@example.com',
      mobile: 'encrypted_9059084844',
      admission_date: '2026-08-01',
      student_status: 'ACTIVE',
      academic_status: 'ACTIVE',
      father_name: 'ADEPU RAMAKRISHNA',
      mother_name: 'LAKSHMI',
      blood_group: 'O+',
      perm_house_no: '16-1-559/2/A/1',
      perm_street: 'SRR Thota',
      perm_apartment: null,
      perm_city: 'Warangal',
      perm_state: 'Telangana',
      perm_pincode: '506002',
      perm_country: 'India',
      pfp: null, // will inject data URI in test
    },
    {
      id: 2,
      roll_no: '26567T0902',
      admission_no: 'ADM-26-002',
      name: 'AJMEERA AKSHAYA',
      date_of_birth: '2005-06-15',
      gender: 'FEMALE',
      email: 'akshaya@example.com',
      mobile: 'encrypted_9618327432',
      admission_date: '2026-08-01',
      student_status: 'ACTIVE',
      academic_status: 'ACTIVE',
      father_name: 'AJMEERA UGENDAR',
      mother_name: 'PADMA',
      blood_group: 'B+',
      perm_house_no: '5-8-127/501',
      perm_street: 'Kishanpura',
      perm_apartment: 'RVR Residency',
      perm_city: 'Hanamkonda',
      perm_state: 'Telangana',
      perm_pincode: '506001',
      perm_country: 'India',
      pfp: null, // missing photo
    },
  ];

  it('embeds actual image bytes in XLSX workbook and anchors image to student row', async () => {
    // Inject photo for first student
    const testRows = [
      { ...mockStudents[0], pfp: samplePhotoDataUri },
      { ...mockStudents[1], pfp: null },
    ];

    const chainable = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockImplementation(() => Promise.resolve(testRows)),
    };
    db.select.mockReturnValue(chainable);

    const exportResult = await IDCardDataService.exportBranchData({
      branch: 'CSE',
      format: 'xlsx',
    });

    expect(exportResult.buffer).toBeInstanceOf(Buffer);
    expect(exportResult.count).toBe(2);

    // Load generated workbook with ExcelJS
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(exportResult.buffer);
    const worksheet = workbook.getWorksheet('CSE ID Cards');
    expect(worksheet).toBeDefined();

    // Check row heights
    const row2 = worksheet.getRow(2);
    expect(row2.height).toBe(72);

    // Verify embedded media using workbook images
    const images = worksheet.getImages();
    expect(images.length).toBe(1); // exactly 1 photo embedded for the 1 available student
    expect(images[0].type).toBe('image');

    // Verify missing photo has placeholder text
    const missingPhotoCell = worksheet.getRow(3).getCell(4);
    expect(missingPhotoCell.value).toBe('PHOTO MISSING');
  });

  it('creates companion ZIP export containing CSV dataset and photograph files named by roll number', async () => {
    const testRows = [
      { ...mockStudents[0], pfp: samplePhotoDataUri },
      { ...mockStudents[1], pfp: null },
    ];

    const chainable = {
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockImplementation(() => Promise.resolve(testRows)),
    };
    db.select.mockReturnValue(chainable);

    const exportResult = await IDCardDataService.exportBranchData({
      branch: 'CSE',
      format: 'zip',
    });

    expect(exportResult.contentType).toBe('application/zip');
    expect(exportResult.filename).toContain('_PACKAGE.zip');

    // Unpack ZIP to inspect entries
    const zip = new PizZip(exportResult.buffer);
    const entries = Object.keys(zip.files);

    expect(entries.some((name) => name.endsWith('.csv'))).toBe(true);
    expect(entries).toContain('photographs/26567T0901.jpg');
    expect(entries).not.toContain('photographs/26567T0902.jpg'); // missing photo excluded from photo folder
  });
});
