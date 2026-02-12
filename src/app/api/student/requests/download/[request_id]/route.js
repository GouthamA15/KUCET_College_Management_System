import crypto from 'crypto'; 
import QRCode from 'qrcode';
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { jwtVerify } from 'jose';
import { getBranchFromRoll, getResolvedCurrentAcademicYear } from '@/lib/rollNumber';
// React-PDF templates
import BonafideCertificatePDF from '@/pdf/templates/BonafideCertificatePDF';
import CustodianCertificatePDF from '@/pdf/templates/CustodianCertificatePDF';
import StudyConductCertificatePDF from '@/pdf/templates/StudyConductCertificatePDF';
import MigrationCertificatePDF from '@/pdf/templates/MigrationCertificatePDF';
// import CourseCompletionCertificatePDF from '@/pdf/templates/CourseCompletionCertificatePDF';
import IncomeTaxCertificatePDF from '@/pdf/templates/IncomeTaxCertificatePDF';

const JWT_SECRET = process.env.JWT_SECRET;

async function getStudentFromToken(request) {
    const token = request.cookies.get('student_auth')?.value;
    if (!token) {
        console.debug('[AUTH] No student_auth cookie present on request to', request.url);
        return null;
    }
    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
        console.debug('[AUTH] Decoded student token payload (safe):', { student_id: payload.student_id, roll_no: payload.roll_no, name: payload.name });
        let student_id = payload.student_id || null;
        const roll_no = payload.roll_no || null;
        // If token doesn't include student_id (older tokens), try to resolve it from roll_no
        if (!student_id && roll_no) {
            try {
                const rows = await query('SELECT id FROM students WHERE roll_no = ?', [roll_no]);
                if (rows && rows.length > 0) {
                    student_id = rows[0].id;
                    console.debug('[AUTH] Resolved student_id from roll_no:', student_id);
                } else {
                    console.warn('[AUTH] No student found for roll_no while resolving student_id:', roll_no);
                }
            } catch (e) {
                console.warn('[AUTH] Error resolving student_id from roll_no:', e && e.message ? e.message : e);
            }
        }
        return { student_id, roll_no };
    } catch (error) {
        console.warn('[AUTH] Failed to verify student token:', error && error.message ? error.message : error);
        return null;
    }
}

const certificateComponents = {
    'Bonafide Certificate': BonafideCertificatePDF,
    'Custodian Certificate': CustodianCertificatePDF,
    'Study Conduct Certificate': StudyConductCertificatePDF,
    'Migration Certificate': MigrationCertificatePDF,
    // 'Course Completion Certificate': CourseCompletionCertificatePDF,
    'Income Tax (IT) Certificate': IncomeTaxCertificatePDF,
};

// using bundled Puppeteer; helper closes browser internally
export async function GET(request, { params }) {
    const auth = await getStudentFromToken(request);
    if (!auth || !auth.student_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Enforce verification: email present, verified, and password set
    try {
        const verRows = await query('SELECT email, is_email_verified, password_hash FROM students WHERE id = ?', [auth.student_id]);
        const ver = verRows && verRows[0];
        if (!ver || !ver.email) {
            return NextResponse.json({ error: 'Verification required: email address not found.' }, { status: 403 });
        }
        if (!ver.is_email_verified) {
            return NextResponse.json({ error: 'Verification required: email not verified.' }, { status: 403 });
        }
        if (!ver.password_hash) {
            return NextResponse.json({ error: 'Verification required: password not set.' }, { status: 403 });
        }
    } catch (e) {
        return NextResponse.json({ error: 'Unable to validate verification status.' }, { status: 500 });
    }

    const { request_id } = await params;

    let qrBase64 = ''

    try {
        // 1. Verify this request belongs to the logged-in student and is a completed bonafide
        const requests = await query(
            'SELECT * FROM student_requests WHERE request_id = ? AND student_id = ?',
            [request_id, auth.student_id]
        );

        if (requests.length === 0) {
            return NextResponse.json({ error: 'Request not found or not authorized' }, { status: 404 });
        }

        const certRequest = requests[0];
        const Template = certificateComponents[certRequest.certificate_type];

        if (!Template || certRequest.status !== 'APPROVED') {
            return NextResponse.json({ error: 'Certificate not available for download' }, { status: 403 });
        }

        // 2. Fetch student details
        const students = await query(
            `SELECT s.name, s.roll_no, sp.father_name, s.date_of_birth 
             FROM students s 
             LEFT JOIN student_personal_details sp ON s.id = sp.student_id 
             WHERE s.id = ?`,
            [auth.student_id]
        );
        
        if (students.length === 0) {
            return NextResponse.json({ error: 'Student details not found' }, { status: 404 });
        }
        const student = students[0];

        // CALCULATE YEAR AND SEMESTER ---
        const rollNo = student.roll_no;
        const admissionYearShort = parseInt(rollNo.substring(0, 2)); // e.g., "22" from "22K4..."
        const admissionYear = 2000 + admissionYearShort;
        const isLateral = rollNo.toUpperCase().endsWith('L');

        // If lateral, they join in 2nd year, so their "Batch" actually started 1 year prior
        // Example: 24K4...L joins in 2024, but their batch is 2023-2027
        const batchStart = isLateral ? admissionYear - 1 : admissionYear;
        const batchEnd = batchStart + 4; 
        const batchString = `${batchStart}-${batchEnd}`;

        const durationYears = isLateral ? 3 : 4;
        const durationString = `${durationYears} Years`;
        
        const today = new Date();
        const currentYearDate = today.getFullYear();
        const currentMonth = today.getMonth() + 1; // 1-12

        // Calculate Year of Study (1, 2, 3, or 4)
        // Academic sessions usually start around July/August
        let yearOfStudy = currentYearDate - admissionYear;
        if (currentMonth >= 7) {
            yearOfStudy += 1;
        }
        
        // Clamp year between 1 and 4
        yearOfStudy = Math.max(1, Math.min(4, yearOfStudy));

        // Calculate Semester (1-8)
        // Odd semesters: July - Dec | Even semesters: Jan - June
        const isEvenSemester = currentMonth >= 1 && currentMonth <= 6;
        const currentSemester = isEvenSemester ? (yearOfStudy * 2) : (yearOfStudy * 2 - 1);

        const yearWords = ["I (FIRST)", "II (SECOND)", "III (THIRD)", "IV (FOURTH)"];
        const semesterWords = ["I (FIRST)", "II (SECOND)", "III (THIRD)", "IV (FOURTH)", "V (FIFTH)", "VI (SIXTH)", "VII (SEVENTH)", "VIII (EIGHTH)"];
        // 4. SECURITY: Generate Certificate ID & QR URL
        const SECRET_SALT = process.env.CERTIFICATE_SECRET || "fallback_salt";
        const hash = crypto.createHmac('sha256', SECRET_SALT)
                           .update(`${student.roll_no}-${certRequest.certificate_type}`)
                           .digest('hex');
        const certId = `KUCET-${hash.substring(0, 8).toUpperCase()}`;

        // Attendance Values are only assigned in Bonafide
        const isBonafide = certRequest.certificate_type === 'Bonafide Certificate';
        let attendanceValue = certRequest.generated_attendance;
        // Do not generate mock attendance; use only data from DB.
        if (!isBonafide) {
            attendanceValue = null;
        }

        // Persist cert ID and attendance (bonafide only)
        await query(
            'UPDATE student_requests SET generated_certificate_id = ?, generated_attendance = ? WHERE request_id = ?',
            [certId, attendanceValue, request_id]
        );

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://10.163.82.43:${process.env.PORT || 3000}`;
        const verificationUrl = `${baseUrl}/verify?id=${certId}&roll=${rollNo}`;

        if(verificationUrl) {
            qrBase64 = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 150 });
        }


        const formattedDate = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
        const dob = new Date(student.date_of_birth);
        const formattedDob = `${dob.getDate()}-${dob.getMonth() + 1}-${dob.getFullYear()}`;
        const course = String(getBranchFromRoll(student.roll_no) || '');

       
        const logoUrl = `${baseUrl}/assets/ku-logo.png`;
        const signatureUrl = `${baseUrl}/assets/principal-sign.png`;
        const stampSign = `${baseUrl}/assets/principal-signStamp.jpg`;
        const stampUrl = `${baseUrl}/assets/ku-college-seal.png`;

        const commonData = {
            certId,
            date: formattedDate,
            studentName: student.name,
            fatherName: student.father_name || 'N/A',
            admissionNo: student.roll_no,
            course,
            dob: formattedDob,
            academicYear: getResolvedCurrentAcademicYear(student.roll_no) || certRequest.academic_year || '',
            logoUrl,
            signatureUrl,
            stampSign,
            stampUrl,
            qrUrl: qrBase64,
        };

        // Extend data per certificate type
        let data = { ...commonData };
        switch (certRequest.certificate_type) {
            case 'Bonafide Certificate':
                data = {
                    ...data,
                    year: yearWords[yearOfStudy - 1] || 'N/A',
                    semester: semesterWords[currentSemester - 1] || 'N/A',
                    attendancePercentage: attendanceValue || '',
                };
                break;
            case 'Course Completion Certificate':
                data = {
                    ...data,
                    batch: batchString,
                    aggCgpa: 'N/A',
                    year: today.getFullYear(),
                };
                break;
            case 'Income Tax (IT) Certificate':
                data = {
                    ...data,
                    feeAmount: certRequest.payment_amount || 'N/A',
                };
                break;
            case 'Migration Certificate':
                data = {
                    ...data,
                    reason: 'N/A',
                };
                break;
            case 'Study Conduct Certificate':
                data = {
                    ...data,
                    conduct: 'Good',
                };
                break;
            case 'Custodian Certificate':
                // No extra fields beyond common
                break;
            default:
                // fallthrough, use common
                break;
        }

        // 4. Generate PDF using React-PDF
        const pdfBuffer = await pdf(<Template {...data} />).toBuffer();

        // 5. Send the file as a response
        const headers = new Headers();
        headers.set('Content-Type', 'application/pdf');
        // Use student.roll_no when available
        const fileRoll = student.roll_no || auth.roll_no || 'student';
        if (!student.roll_no) console.warn('[CERT_DOWNLOAD] student.roll_no missing, falling back to token roll_no or generic');
        // RFC 5987 encoded filename to be safe with special chars
        const filename = `${certRequest.certificate_type.replace(/ /g, '_')}_${fileRoll}.pdf`;
        const encoded = encodeURIComponent(filename);
        headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);

        return new NextResponse(pdfBuffer, { status: 200, headers });

    } catch (error) {
        console.error("Error generating certificate:", error);
        return NextResponse.json({ error: 'An error occurred while generating the certificate.', details: error.message }, { status: 500 });
    } finally {
        // nothing to clean up
    }
}