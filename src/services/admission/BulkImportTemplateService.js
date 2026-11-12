import ExcelJS from 'exceljs';

/**
 * Service for generating the official KUCET Bulk Student Import Excel Template.
 * Includes the dedicated 'Blood Group' column along with all canonical student fields,
 * styled headers (Kakatiya Navy), and realistic sample rows.
 */
export class BulkImportTemplateService {
  /**
   * Generates the ExcelJS Workbook instance for bulk student import.
   * @returns {Promise<ExcelJS.Workbook>}
   */
  static async generateWorkbook() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KUCET College Management System';
    workbook.lastModifiedBy = 'KUCET Admissions';
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet('Student Import Template', {
      views: [{ showGridLines: true }],
    });

    worksheet.columns = [
      { header: 'Roll Number', key: 'roll_no', width: 16 },
      { header: 'Candidate Name', key: 'name', width: 28 },
      { header: 'Gender', key: 'gender', width: 12 },
      { header: 'Date of Birth', key: 'date_of_birth', width: 16 },
      { header: 'Father Name', key: 'father_name', width: 26 },
      { header: 'Category', key: 'category', width: 14 },
      { header: 'Permanent Address', key: 'permanent_address', width: 40 },
      { header: 'Contact Address', key: 'contact_address', width: 40 },
      { header: 'Mobile', key: 'mobile', width: 16 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Blood Group', key: 'blood_group', width: 14 },
      { header: 'Mother Name', key: 'mother_name', width: 26 },
      { header: 'Aadhaar No', key: 'aadhaar_no', width: 18 },
      { header: 'Nationality', key: 'nationality', width: 14 },
      { header: 'Religion', key: 'religion', width: 14 },
      { header: 'Sub Caste', key: 'sub_caste', width: 16 },
      { header: 'Area Status', key: 'area_status', width: 14 },
      { header: 'Place of Birth', key: 'place_of_birth', width: 18 },
      { header: 'Father Occupation', key: 'father_occupation', width: 20 },
      { header: 'Annual Income', key: 'annual_income', width: 16 },
      { header: 'Identification Marks', key: 'identification_marks', width: 30 },
      { header: 'Medium of Instruction', key: 'medium_of_instruction', width: 22 },
      { header: 'Ranks', key: 'ranks', width: 14 },
      { header: 'Qualifying Exam', key: 'qualifying_exam', width: 18 },
      { header: 'Previous College', key: 'previous_college', width: 28 },
    ];

    // Header Row Formatting (Kakatiya Navy #0B3578)
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0B3578' },
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 11,
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF0B3578' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });

    // Sample Row 1: Fully populated record with valid blood group ('O+')
    const sample1 = worksheet.addRow({
      roll_no: '26567T0901',
      name: 'KAVYA REDDY',
      gender: 'FEMALE',
      date_of_birth: '2005-04-12',
      father_name: 'RAMA REDDY',
      category: 'OC',
      permanent_address: 'H.No 1-2-3, Vidyaranyapuri, Warangal',
      contact_address: 'H.No 1-2-3, Vidyaranyapuri, Warangal',
      mobile: '9876543210',
      email: 'kavya.reddy@example.com',
      blood_group: 'O+',
      mother_name: 'LAKSHMI',
      aadhaar_no: '999988887777',
      nationality: 'Indian',
      religion: 'HINDU',
      sub_caste: 'REDDY',
      area_status: 'Local',
      place_of_birth: 'Warangal',
      father_occupation: 'Business',
      annual_income: '150000',
      identification_marks: 'Mole on right cheek',
      medium_of_instruction: 'English',
      ranks: '4521',
      qualifying_exam: 'TG EAPCET',
      previous_college: 'Govt Junior College',
    });
    sample1.height = 22;

    // Sample Row 2: Record with empty optional fields (Blood Group empty)
    const sample2 = worksheet.addRow({
      roll_no: '26567T0902',
      name: 'SURESH KUMAR',
      gender: 'MALE',
      date_of_birth: '2005-06-15',
      father_name: 'VENKATESH',
      category: 'BC-B',
      permanent_address: 'H.No 4-5-6, Subedari, Hanamkonda',
      contact_address: 'H.No 4-5-6, Subedari, Hanamkonda',
      mobile: '9876543211',
      email: 'suresh.kumar@example.com',
      blood_group: '', // Empty blood group allowed
      mother_name: 'PADMA',
      aadhaar_no: '888877776666',
      nationality: 'Indian',
      religion: 'HINDU',
      sub_caste: 'GOUD',
      area_status: 'Local',
      place_of_birth: 'Hanamkonda',
      father_occupation: 'Agriculture',
      annual_income: '120000',
      identification_marks: 'Scar on left arm',
      medium_of_instruction: 'English',
      ranks: '6230',
      qualifying_exam: 'TG EAPCET',
      previous_college: 'Sri Chaitanya',
    });
    sample2.height = 22;

    [sample1, sample2].forEach((row) => {
      row.eachCell((cell, colNumber) => {
        cell.font = { size: 10, color: { argb: 'FF1E293B' } };
        cell.alignment = {
          vertical: 'middle',
          horizontal: [1, 3, 4, 6, 9, 11, 13, 14, 15, 17, 20, 23].includes(colNumber) ? 'center' : 'left',
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });
    });

    return workbook;
  }

  /**
   * Generates binary Buffer of the template XLSX file.
   * @returns {Promise<Buffer>}
   */
  static async generateTemplateBuffer() {
    const workbook = await this.generateWorkbook();
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
