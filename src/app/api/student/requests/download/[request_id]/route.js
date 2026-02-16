import crypto from 'crypto'; 
import QRCode from 'qrcode';
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import path from 'path';
import fs from 'fs';
import { getBatchFromRoll, getBranchFromRoll, getResolvedCurrentAcademicYear } from '@/lib/rollNumber';
import { calculateYearAndSemester } from '@/lib/academic-utils';
// React-PDF templates
import BonafideCertificatePDF from '@/pdf/templates/BonafideCertificatePDF';
import CustodianCertificatePDF from '@/pdf/templates/CustodianCertificatePDF';
import StudyConductCertificatePDF from '@/pdf/templates/StudyConductCertificatePDF';
import MigrationCertificatePDF from '@/pdf/templates/MigrationCertificatePDF';
import CourseCompletionCertificatePDF from '@/pdf/templates/CourseCompletionCertificatePDF';
import IncomeTaxCertificatePDF from '@/pdf/templates/IncomeTaxCertificatePDF';
import TransferCertificatePDF from '@/pdf/templates/TransferCertificatePDF';

const certificateComponents = {
    'Bonafide Certificate': BonafideCertificatePDF,
    'Custodian Certificate': CustodianCertificatePDF,
    'Study Conduct Certificate': StudyConductCertificatePDF,
    'Migration Certificate': MigrationCertificatePDF,
    'Course Completion Certificate': CourseCompletionCertificatePDF,
    'Income Tax (IT) Certificate': IncomeTaxCertificatePDF,
    'Transfer Certificate (TC)': TransferCertificatePDF,
};

// using bundled Puppeteer; helper closes browser internally
export async function GET(request, { params }) {
    const auth = await getAuthUser('student');
    if (!auth || !auth.student_id) return apiError('Unauthorized', 401);

    // Enforce verification: email present, verified, and password set
    try {
        const verRows = await query('SELECT email, is_email_verified, password_hash FROM students WHERE id = ?', [auth.student_id]);
        const ver = verRows && verRows[0];
        if (!ver || !ver.email) {
            return apiError('Verification required: email address not found.', 403);
        }
        if (!ver.is_email_verified) {
            return apiError('Verification required: email not verified.', 403);
        }
        if (!ver.password_hash) {
            return apiError('Verification required: password not set.', 403);
        }
    } catch (e) {
        return apiError('Unable to validate verification status.', 500);
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
            return apiError('Request not found or not authorized', 404);
        }

        const certRequest = requests[0];
        const Template = certificateComponents[certRequest.certificate_type];

        if (!Template || certRequest.status !== 'APPROVED') {
            return apiError('Certificate not available for download', 403);
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
            return apiError('Student details not found', 404);
        }
        const student = students[0];

        // Fetch college info for semester calculation
        const collegeInfoRows = await query('SELECT * FROM college_info WHERE id = 1');
        const collegeInfo = collegeInfoRows[0] || {};

        // CALCULATE YEAR AND SEMESTER ---
        const { yearOfStudy, semester: currentSemester } = calculateYearAndSemester(student.roll_no, collegeInfo);
        
        const rollNo = student.roll_no;
        const isLateral = rollNo.toUpperCase().endsWith('L');
        const admissionYearShort = parseInt(rollNo.substring(0, 2));
        const admissionYear = 2000 + admissionYearShort;

        // If lateral, they join in 2nd year, so their "Batch" actually started 1 year prior
        const batchStart = isLateral ? admissionYear - 1 : admissionYear;
        const batchEnd = batchStart + 4; 
        const batchString = `${batchStart}-${batchEnd}`;
        
        const today = new Date();

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

        
        
        // Helper to load image as base64 to avoid react-pdf fetching issues
        // Detect MIME from file signature (magic bytes) to avoid "SOI not found" when extension is wrong.
        const getBase64Image = (filePath) => {
            try {
                if (!fs.existsSync(filePath)) {
                    console.warn(`[CERT_DOWNLOAD] Image file not found: ${filePath}`);
                    return null;
                }
                const fileBuffer = fs.readFileSync(filePath);
                if (!fileBuffer || fileBuffer.length < 4) {
                    console.warn(`[CERT_DOWNLOAD] Image file is too small or empty: ${filePath}`);
                    return null;
                }

                let mimeType = null;
                // JPEG SOI: 0xFF 0xD8
                if (fileBuffer[0] === 0xFF && fileBuffer[1] === 0xD8) {
                    mimeType = 'image/jpeg';
                // PNG signature: 0x89 0x50 0x4E 0x47
                } else if (fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x4E && fileBuffer[3] === 0x47) {
                    mimeType = 'image/png';
                // GIF: 'GIF8'
                } else if (fileBuffer.slice(0,4).toString('ascii') === 'GIF8') {
                    mimeType = 'image/gif';
                // WEBP: 'RIFF' .... 'WEBP'
                } else if (fileBuffer.slice(0,4).toString('ascii') === 'RIFF' && fileBuffer.slice(8,12).toString('ascii') === 'WEBP') {
                    mimeType = 'image/webp';
                }

                if (!mimeType) {
                    // Fallback to extension-based guess when signature not recognized
                    const ext = path.extname(filePath).toLowerCase().replace('.', '');
                    if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
                    else if (ext === 'png') mimeType = 'image/png';
                    else if (ext === 'gif') mimeType = 'image/gif';
                    else if (ext === 'webp') mimeType = 'image/webp';
                    else mimeType = 'application/octet-stream';
                    console.warn(`[CERT_DOWNLOAD] Unknown image signature for ${filePath}, falling back to extension (${ext}) => ${mimeType}`);
                }

                return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
            } catch (err) {
                console.error(`[CERT_DOWNLOAD] Error reading image file: ${filePath}`, err);
                return null;
            }
        };

        const publicDir = path.join(process.cwd(), 'public');
        const logoUrl = getBase64Image(path.join(publicDir, 'assets', 'ku-logo.png'));
        const signatureUrl = getBase64Image(path.join(publicDir, 'assets', 'principal-sign.png'));
        // Try multiple common variants for stamp image (jpg/png, different case/sep)
        const stampCandidates = [
            path.join(publicDir, 'assets', 'principal-signStamp.jpg'),
            path.join(publicDir, 'assets', 'principal-signStamp.png'),
            path.join(publicDir, 'assets', 'principal-sign-stamp.jpg'),
            path.join(publicDir, 'assets', 'principal-sign-stamp.png'),
            path.join(publicDir, 'assets', 'principal-signstamp.jpg'),
            path.join(publicDir, 'assets', 'principal-signstamp.png'),
        ];
        let stampSign = null;
        for (const p of stampCandidates) {
            stampSign = getBase64Image(p);
            if (stampSign) break;
        }
        // As last resort, use the signature image so the PDF still shows a mark
        if (!stampSign) {
            console.warn('[CERT_DOWNLOAD] stampSign not found in assets; falling back to principal-sign.png');
            stampSign = signatureUrl;
        }
        const stampUrl = getBase64Image(path.join(publicDir, 'assets', 'ku-college-seal.png'));

        const commonData = {
            certId,
            date: formattedDate,
            studentName: student.name,
            fatherName: student.father_name || 'N/A',
            admissionNo: student.roll_no,
            course,
            dob: formattedDob,
            academicYear: getResolvedCurrentAcademicYear(student.roll_no, collegeInfo) || certRequest.academic_year || '',
            logoUrl,
            signatureUrl,
            stampSign,
            stampUrl,
            qrUrl: qrBase64,
            batch: batchString
        };

        // Extend data per certificate type
        let data = { ...commonData };
        switch (certRequest.certificate_type) {
            case 'Bonafide Certificate':
                    data = {
                        ...data,
                        year: yearWords[yearOfStudy - 1] || 'N/A',
                        semester: semesterWords[currentSemester - 1] || 'N/A',
                        attendancePercentage: (attendanceValue !== null && attendanceValue !== undefined) ? attendanceValue : '',
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
            case 'Transfer Certificate (TC)':
                data = {
                    ...data,
                    batch: batchString,
                    conduct: 'Good',
                    reason: 'Completion of Course',
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
                    conduct: 'Satisfactory',
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
        return apiError('An error occurred while generating the certificate.', 500, error.message);
    } finally {
        // nothing to clean up
    }
}