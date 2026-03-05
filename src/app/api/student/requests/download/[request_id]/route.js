import crypto from 'crypto'; 
import QRCode from 'qrcode';
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import { getAssetUrl } from '@/lib/assets';
import path from 'path';
import fs from 'fs';
import { getBatchFromRoll, getBranchFromRoll, getResolvedCurrentAcademicYear } from '@/lib/rollNumber';
import { calculateYearAndSemesterAsync } from '@/lib/academic-utils';
import { getNow } from '@/lib/clock';
// React-PDF templates
import BonafideCertificatePDF from '@/pdf/templates/BonafideCertificatePDF';
import CustodianCertificatePDF from '@/pdf/templates/CustodianCertificatePDF';
import StudyConductCertificatePDF from '@/pdf/templates/StudyConductCertificatePDF';
import MigrationCertificatePDF from '@/pdf/templates/MigrationCertificatePDF';
import CourseCompletionCertificatePDF from '@/pdf/templates/CourseCompletionCertificatePDF';
import IncomeTaxCertificatePDF from '@/pdf/templates/IncomeTaxCertificatePDF';
import TransferCertificatePDF from '@/pdf/templates/TransferCertificatePDF';
import NoObjectionCertificatePDF from '@/pdf/templates/NoObjectionCertificatePDF';

const certificateComponents = {
    'Bonafide Certificate': BonafideCertificatePDF,
    'Custodian Certificate': CustodianCertificatePDF,
    'Study Conduct Certificate': StudyConductCertificatePDF,
    'Migration Certificate': MigrationCertificatePDF,
    'Course Completion Certificate': CourseCompletionCertificatePDF,
    'Income Tax (IT) Certificate': IncomeTaxCertificatePDF,
    'Transfer Certificate (TC)': TransferCertificatePDF,
    'No Objection Certificate': NoObjectionCertificatePDF,
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
        const { yearOfStudy, semester: currentSemester } = await calculateYearAndSemesterAsync(student.roll_no, collegeInfo);
        
        const rollNo = student.roll_no;
        const isLateral = rollNo.toUpperCase().endsWith('L');
        const admissionYearShort = parseInt(rollNo.substring(0, 2));
        const admissionYear = 2000 + admissionYearShort;

        // If lateral, they join in 2nd year, so their "Batch" actually started 1 year prior
        const batchStart = isLateral ? admissionYear - 1 : admissionYear;
        const batchEnd = batchStart + 4; 
        const batchString = `${batchStart}-${batchEnd}`;
        
        const today = await getNow();

        const yearWords = ["I (FIRST)", "II (SECOND)", "III (THIRD)", "IV (FOURTH)"];
        const semesterWords = ["I (FIRST)", "II (SECOND)", "III (THIRD)", "IV (FOURTH)", "V (FIFTH)", "VI (SIXTH)", "VII (SEVENTH)", "VIII (EIGHTH)"];
        // 4. SECURITY: Generate Certificate ID & QR URL
        const SECRET_SALT = process.env.CERTIFICATE_SECRET || "fallback_salt";
        let certId = certRequest.generated_certificate_id;
        if (!certId) {
            const hash = crypto.createHmac('sha256', SECRET_SALT)
                               .update(`${student.roll_no}-${certRequest.certificate_type}`)
                               .digest('hex');
            certId = `KUCET-${hash.substring(0, 8).toUpperCase()}`;
            // persist only if not already set (older records)
            await query(
                'UPDATE student_requests SET generated_certificate_id = ? WHERE request_id = ?',
                [certId, request_id]
            );
        }

        // Attendance Values are only assigned in Bonafide
        const isBonafide = certRequest.certificate_type === 'Bonafide Certificate';
        let attendanceValue = certRequest.generated_attendance;
        // Do not generate mock attendance; use only data from DB.
        if (!isBonafide) {
            attendanceValue = null;
        }

        // Persist cert ID and attendance (bonafide only)
        await query(
            'UPDATE student_requests SET generated_attendance = ? WHERE request_id = ?',
            [attendanceValue, request_id]
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

        
        
        // Helper to load image as base64 from Cloudinary or local file
        // Images are now served from Cloudinary, but we convert them to base64 for PDF embedding
        const getBase64Image = async (imagePath) => {
            try {
                let imageBuffer;
                
                // If it's already a data URL or HTTP URL, fetch it
                if (imagePath.startsWith('data:') || imagePath.startsWith('http')) {
                    const response = await fetch(imagePath);
                    if (!response.ok) {
                        console.warn(`[CERT_DOWNLOAD] Failed to fetch image from URL: ${imagePath}`);
                        return null;
                    }
                    imageBuffer = await response.buffer();
                } else {
                    // Fallback to local file for backwards compatibility
                    if (!fs.existsSync(imagePath)) {
                        console.warn(`[CERT_DOWNLOAD] Image file not found: ${imagePath}`);
                        return null;
                    }
                    imageBuffer = fs.readFileSync(imagePath);
                }
                
                if (!imageBuffer || imageBuffer.length < 4) {
                    console.warn(`[CERT_DOWNLOAD] Image is too small or empty: ${imagePath}`);
                    return null;
                }

                let mimeType = null;
                // JPEG SOI: 0xFF 0xD8
                if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8) {
                    mimeType = 'image/jpeg';
                // PNG signature: 0x89 0x50 0x4E 0x47
                } else if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47) {
                    mimeType = 'image/png';
                // GIF: 'GIF8'
                } else if (imageBuffer.slice(0,4).toString('ascii') === 'GIF8') {
                    mimeType = 'image/gif';
                // WEBP: 'RIFF' .... 'WEBP'
                } else if (imageBuffer.slice(0,4).toString('ascii') === 'RIFF' && imageBuffer.slice(8,12).toString('ascii') === 'WEBP') {
                    mimeType = 'image/webp';
                }

                if (!mimeType) {
                    // Try to guess from extension
                    const ext = imagePath.split('.').pop().toLowerCase();
                    if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
                    else if (ext === 'png') mimeType = 'image/png';
                    else if (ext === 'gif') mimeType = 'image/gif';
                    else if (ext === 'webp') mimeType = 'image/webp';
                    else mimeType = 'application/octet-stream';
                    console.warn(`[CERT_DOWNLOAD] Unknown image signature for ${imagePath}, guessing ${mimeType}`);
                }

                return `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
            } catch (err) {
                console.error(`[CERT_DOWNLOAD] Error loading image: ${imagePath}`, err);
                return null;
            }
        };

        const publicDir = path.join(process.cwd(), 'public');
        const logoUrl = await getBase64Image(getAssetUrl('/assets/ku-logo.png'));
        const signatureUrl = await getBase64Image(getAssetUrl('/assets/principal-sign.png'));
        // Try multiple common variants for stamp image
        const stampCandidates = [
            getAssetUrl('/assets/principal-signStamp.jpg'),
            getAssetUrl('/assets/principal-signStamp.png'),
            getAssetUrl('/assets/principal-sign-stamp.jpg'),
            getAssetUrl('/assets/principal-sign-stamp.png'),
            getAssetUrl('/assets/principal-signstamp.jpg'),
            getAssetUrl('/assets/principal-signstamp.png'),
        ];
        let stampSign = null;
        for (const url of stampCandidates) {
            stampSign = await getBase64Image(url);
            if (stampSign) break;
        }
        // As last resort, use the signature image so the PDF still shows a mark
        if (!stampSign) {
            console.warn('[CERT_DOWNLOAD] stampSign not found; falling back to signature');
            stampSign = signatureUrl;
        }
        const stampUrl = await getBase64Image(getAssetUrl('/assets/ku-college-seal.png'));

        const formatDate = (d) => {
            if (!d) return '';
            const dt = new Date(d);
            if (Number.isNaN(dt.getTime())) return '';
            const dd = String(dt.getDate()).padStart(2, '0');
            const mm = String(dt.getMonth() + 1).padStart(2, '0');
            const yyyy = dt.getFullYear();
            return `${dd}/${mm}/${yyyy}`;
        };

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
                data = {
                    ...data,
                    year: yearWords[yearOfStudy - 1] || 'N/A',
                    semester: semesterWords[currentSemester - 1] || 'N/A',
                    hallTicket: student.roll_no,
                };
                break;
            case 'No Objection Certificate':
                data = {
                    ...data,
                    year: yearWords[yearOfStudy - 1] || 'N/A',
                    semester: semesterWords[currentSemester - 1] || 'N/A',
                    purpose: certRequest.purpose || '',
                    fromDate: formatDate(certRequest.from_date),
                    toDate: formatDate(certRequest.to_date),
                };
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