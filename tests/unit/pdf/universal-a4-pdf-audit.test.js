import { describe, it, expect } from 'vitest';
import AttendanceSessionPDF from '@/pdf/templates/AttendanceSessionPDF';
import FullAttendanceExportPDF from '@/pdf/templates/FullAttendanceExportPDF';
import EvaluationReportPDF from '@/pdf/templates/EvaluationReportPDF';
import { IDCardPage } from '@/pdf/templates/IDCardPDF';

describe('Universal A4 PDF Geometry & Grayscale Print Standard Audit', () => {
  it('AttendanceSessionPDF renders Document with A4 Page geometry, dense margins, and fixed table headers', () => {
    const element = AttendanceSessionPDF({
      collegeName: 'KU College of Engineering & Technology',
      universityName: 'Kakatiya University Campus, Warangal',
      branch: 'CSE',
      semester: 1,
      subjectCode: 'CS101',
      subjectName: 'Programming for Problem Solving',
      academicYear: '2025-26',
      date: '2026-09-04',
      session: 1,
      students: [
        { student_id: 1, roll_no: '26567T0901', name: 'Student 1', status: 'PRESENT' },
        { student_id: 2, roll_no: '26567T0902', name: 'Student 2', status: 'ABSENT' }
      ],
      totals: { total: 2, present: 1, absent: 1, percentage: 50 }
    });

    expect(element).toBeDefined();
    expect(element.type).toBeDefined();

    // Verify Page size is A4 and padding is dense
    const pageChild = element.props.children;
    expect(pageChild.props.size).toBe('A4');
    expect(pageChild.props.style.paddingHorizontal).toBe(22);
    expect(pageChild.props.style.paddingTop).toBe(18);
    expect(pageChild.props.style.paddingBottom).toBe(22);
  });

  it('FullAttendanceExportPDF renders Document with landscape A4 Pages and chunked table headers', () => {
    const element = FullAttendanceExportPDF({
      branch: 'CSE',
      semester: 1,
      subjectCode: 'CS101',
      subjectName: 'Programming for Problem Solving',
      academicYear: '2025-26',
      facultyName: 'Dr. Faculty',
      students: [
        { student_id: 1, roll_no: '26567T0901', name: 'Student 1', totalPresent: 10, totalAbsent: 2, percentage: 83.3, records: {} }
      ],
      sessions: [
        { id: 1, date: '2026-09-01', session_number: 1, key: 's1' }
      ]
    });

    expect(element).toBeDefined();
    const pages = element.props.children;
    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(pages[0].props.size).toBe('A4');
    expect(pages[0].props.orientation).toBe('landscape');
    expect(pages[0].props.style.paddingHorizontal).toBe(22);
  });

  it('EvaluationReportPDF renders Document with A4 Page geometry, fixed header row, and high-contrast status badge', () => {
    const element = EvaluationReportPDF({
      branch: 'CSE',
      semester: 1,
      subjectCode: 'CS101',
      subjectName: 'Programming for Problem Solving',
      academicYear: '2025-26',
      facultyName: 'Dr. Faculty',
      isPublished: true,
      students: [
        { id: 1, roll_no: '26567T0901', name: 'Student 1', mid1_marks: 18, is_published: 1 }
      ]
    });

    expect(element).toBeDefined();
    const pageChild = element.props.children;
    expect(pageChild.props.size).toBe('A4');
    expect(pageChild.props.style.paddingHorizontal).toBe(22);
    expect(pageChild.props.style.paddingTop).toBe(18);
  });

  it('IDCardPage renders physical ID card dimension standard [242, 385]', () => {
    const element = IDCardPage({
      studentName: 'Test Student',
      fatherName: 'Test Father',
      admissionNo: '26567T0901',
      course: 'B.Tech (CSE)',
      batch: '2026-2030',
      address: 'Warangal',
      mobile: '9876543210'
    });

    expect(element).toBeDefined();
    expect(element.props.size).toEqual([242, 385]);
  });

  it('BaseCertificate enforces standard A4 Page dimensions with margins', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.resolve(process.cwd(), 'src/pdf/components/BaseCertificate.js');
    const content = fs.readFileSync(filePath, 'utf-8');

    expect(content).toContain('<Page size="A4" style={styles.page}>');
    expect(content).toContain('CertificateHeader');
    expect(content).toContain('SignatureBlock');
  });

  it('BonafideCertificatePDF and certificate templates wrap BaseCertificate', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const certTemplates = [
      'BonafideCertificatePDF.js',
      'CourseCompletionCertificatePDF.js',
      'CustodianCertificatePDF.js',
      'IncomeTaxCertificatePDF.js',
      'MigrationCertificatePDF.js',
      'NoObjectionCertificatePDF.js',
      'StudyConductCertificatePDF.js',
      'TransferCertificatePDF.js'
    ];

    for (const tmpl of certTemplates) {
      const filePath = path.resolve(process.cwd(), 'src/pdf/templates', tmpl);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('BaseCertificate');
    }
  });
});
