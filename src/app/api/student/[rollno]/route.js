import { query } from '@/lib/db';
import { computeAcademicYear } from '@/app/lib/academicYear';
import { getBranchFromRoll, getAdmissionTypeFromRoll } from '@/lib/rollNumber';
import { apiError, apiResponse, getAuthUser } from '@/lib/api-utils';

export async function GET(req, context) {
  // Check any valid auth
  const user = await getAuthUser();

  if (!user) {
    return apiError('Unauthorized', 401);
  }

  try {
    const params = await context.params;
    const { rollno } = params;

    const studentSql = `
      SELECT 
          s.*,
          pd.father_name, pd.mother_name, pd.nationality, pd.religion, pd.category, pd.sub_caste, 
          pd.area_status, pd.mother_tongue, pd.place_of_birth, pd.father_occupation, 
          pd.guardian_mobile, pd.annual_income, pd.aadhaar_no, pd.address, 
          pd.seat_allotted_category, pd.identification_marks, pd.blood_group
      FROM students s
      LEFT JOIN student_personal_details pd ON s.id = pd.student_id
      WHERE s.roll_no = ?
    `;
    const studentResult = await query(studentSql, [rollno]);

    if (studentResult.length === 0) {
      return apiError('Student not found', 404);
    }

    const studentData = studentResult[0];
    const studentId = studentData.id;
    
    const personalDetailsFields = ['father_name', 'mother_name', 'nationality', 'religion', 'category', 'sub_caste', 'area_status', 'mother_tongue', 'place_of_birth', 'father_occupation', 'guardian_mobile', 'annual_income', 'aadhaar_no', 'address', 'seat_allotted_category', 'identification_marks', 'blood_group'];
    const student = {};
    const personal_details = {};
    Object.keys(studentData).forEach(key => {
      if (personalDetailsFields.includes(key)) {
        personal_details[key] = studentData[key];
      } else {
        student[key] = studentData[key];
      }
    });
    student.personal_details = personal_details;

    const pfpResult = await query('SELECT 1 FROM student_images WHERE student_id = ?', [studentId]);
    if (pfpResult.length > 0) {
      student.pfp = `/api/student/image/${student.roll_no}`;
    } else {
      student.pfp = null;
    }
    
    delete student.has_pfp;

    student.course = getBranchFromRoll(student.roll_no);
    student.admission_type = getAdmissionTypeFromRoll(student.roll_no);

    const scholarshipSql = 'SELECT * FROM scholarship_sanctions WHERE student_id = ? ORDER BY sanction_date';
    let scholarship = await query(scholarshipSql, [studentId]);
    scholarship = scholarship.map(s => {
      const academic_year = s.academic_year || (s.year ? computeAcademicYear(student.roll_no, s.year) : null);
      return {
        ...s,
        academic_year,
        application_no: s.application_no ?? s.application_no,
        proceeding_no: s.proceeding_no ?? s.proceeding_no,
        sanctioned_amount: s.sanctioned_amount ?? s.amount_sanctioned ?? s.sanctioned_amount,
        sanction_date: s.sanction_date ?? s.date ?? s.sanction_date,
      };
    });

    const feesSql = 'SELECT * FROM student_fee_payments WHERE student_id = ? ORDER BY academic_year, transaction_date';
    const feesRaw = await query(feesSql, [studentId]);
    const fees = feesRaw.map(f => ({
      ...f,
      transaction_ref: f.transaction_ref_no ?? f.transaction_ref ?? f.transactionRef ?? null,
      date: f.transaction_date ?? f.date ?? null,
    }));

    let academics = [];
    try {
      academics = await query('SELECT * FROM student_academic_background WHERE student_id = ?', [studentId]);
    } catch (e) {
      console.warn('Could not fetch academics:', e.message || e);
    }

    try {
        const sigRows = await query('SELECT signature FROM student_signatures WHERE student_id = ?', [studentId]);
        if (sigRows.length > 0 && sigRows[0].signature) {
            student.signature = `data:image/png;base64,${sigRows[0].signature.toString('base64')}`;
        } else {
            student.signature = null;
        }
    } catch (e) {
        console.warn('Could not fetch signature:', e.message || e);
        student.signature = null;
    }

    return apiResponse({ student: student, scholarship, fees, academics });
  } catch (error) {
    console.error('Error fetching student profile data:', error);
    return apiError('Failed to fetch student profile data', 500, error.message);
  }
}
