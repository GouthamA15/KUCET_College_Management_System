import logger from '@/lib/logger';
import crypto from 'crypto'; 
import QRCode from 'qrcode';
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { students, studentPersonalDetails, studentRequests, collegeInfo as collegeInfoTable } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { apiError, getAuthUser } from '@/lib/api-utils';
import { getAssetUrl } from '@/lib/assets';
import path from 'path';
import fs from 'fs';
import { getBranchFromRoll } from '@/lib/rollNumber';
import { calculateYearAndSemesterAsync } from '@/lib/academic-utils';
import { getNow } from '@/lib/clock';
import { getResolvedCurrentAcademicYear } from '@/lib/rollNumber';
import { decrypt } from '@/lib/encryption';
import { studentImages } from '@/db/schema';

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

export async function GET(request, context) {
    const auth = await getAuthUser('student');
    if (!auth || !auth.student_id) return apiError('Unauthorized', 401);

    try {
        const params = await context.params;
        const { request_id } = params;
        const requestIdNum = parseInt(request_id);

        const studentUser = await db.query.students.findFirst({
            columns: { email: true, is_email_verified: true, password_hash: true },
            where: eq(students.id, auth.student_id)
        });

        if (!studentUser || !studentUser.email || !studentUser.is_email_verified || !studentUser.password_hash) {
            return apiError('Verification required', 403);
        }

        // 1. Verify this request belongs to the logged-in student
        const certRequest = await db.query.studentRequests.findFirst({
            where: and(
                eq(studentRequests.request_id, requestIdNum),
                eq(studentRequests.student_id, auth.student_id)
            )
        });

        if (!certRequest) {
            return apiError('Request not found or not authorized', 404);
        }

        const Template = certificateComponents[certRequest.certificate_type];
        if (!Template || certRequest.status !== 'APPROVED') {
            return apiError('Certificate not available for download', 403);
        }

        // 2. Fetch student details
        const studentInfo = await db.select({
            name: students.name,
            roll_no: students.roll_no,
            mobile: students.mobile,
            father_name: studentPersonalDetails.father_name,
            date_of_birth: students.date_of_birth,
            address: studentPersonalDetails.address
        })
        .from(students)
        .leftJoin(studentPersonalDetails, eq(students.id, studentPersonalDetails.student_id))
        .where(eq(students.id, auth.student_id))
        .limit(1);
        
        if (studentInfo.length === 0) {
            return apiError('Student details not found', 404);
        }
        const student = studentInfo[0];
        const mobile = decrypt(student.mobile) || 'N/A';
        const address = student.address || 'N/A';

        // Fetch college info
        const collegeRows = await db.select().from(collegeInfoTable).where(eq(collegeInfoTable.id, 1));
        const collegeInfo = collegeRows[0] || {};

        const { yearOfStudy, semester: currentSemester } = await calculateYearAndSemesterAsync(student.roll_no, collegeInfo);
        
        const rollNo = student.roll_no;
        const isLateral = rollNo.toUpperCase().endsWith('L');
        const admissionYearShort = parseInt(rollNo.substring(0, 2));
        const admissionYear = 2000 + admissionYearShort;
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
                               .update(`${student.roll_no}-${certRequest.certificate_type}-${requestIdNum}`)
                               .digest('hex');
            certId = `KUCET-${hash.substring(0, 8).toUpperCase()}`;
            await db.update(studentRequests)
                .set({ generated_certificate_id: certId })
                .where(eq(studentRequests.request_id, requestIdNum));
        }

        const isBonafide = certRequest.certificate_type === 'Bonafide Certificate';
        let attendanceValue = isBonafide ? certRequest.generated_attendance : null;

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        const verificationUrl = `${baseUrl}/verify?id=${certId?.trim()}&roll=${rollNo?.trim()}`;
        const qrBase64 = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 150 });

        const formattedDate = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
        const dob = new Date(student.date_of_birth);
        const formattedDob = `${dob.getDate()}-${dob.getMonth() + 1}-${dob.getFullYear()}`;
        const course = String(getBranchFromRoll(student.roll_no) || '');

        const getBase64Image = async (imagePath) => {
            try {
                let imageBuffer;
                if (imagePath.startsWith('data:') || imagePath.startsWith('http')) {
                    const response = await fetch(imagePath);
                    if (!response.ok) return null;
                    const arrayBuffer = await response.arrayBuffer();
                    imageBuffer = Buffer.from(arrayBuffer);
                } else {
                    const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
                    
                    // 1. Try repository static folder
                    let fullPath = path.join(process.cwd(), 'public', cleanPath);
                    
                    if (!fs.existsSync(fullPath)) {
                        // 2. Try storage volume (strip 'assets/' prefix if it's there as institutional assets are often in root of volume)
                        const STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || '/app/public/uploads';
                        const volumePath = cleanPath.startsWith('assets/') ? cleanPath.substring(7) : cleanPath;
                        fullPath = path.resolve(STORAGE_PATH, volumePath);
                        
                        if (!fs.existsSync(fullPath)) {
                            // 3. Try with 'assets/' prefix in storage volume
                            fullPath = path.resolve(STORAGE_PATH, cleanPath);
                            if (!fs.existsSync(fullPath)) return null;
                        }
                    }
                    imageBuffer = fs.readFileSync(fullPath);
                }
                if (!imageBuffer || imageBuffer.length < 4) return null;

                let mimeType = 'image/png';
                const hex = imageBuffer.toString('hex', 0, 4).toUpperCase();
                if (hex.startsWith('FFD8FF')) mimeType = 'image/jpeg';
                else if (hex.startsWith('89504E47')) mimeType = 'image/png';
                else if (imageBuffer.toString('ascii', 0, 3) === 'GIF') mimeType = 'image/gif';
                else if (imageBuffer.toString('ascii', 0, 4) === 'RIFF') mimeType = 'image/webp';

                return `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
            } catch (err) {
                return null;
            }
        };

        const logoUrl = await getBase64Image(getAssetUrl('/assets/ku-logo.png'));
        const collegeLogoUrl = await getBase64Image(getAssetUrl('/assets/ku-college-logo.png')) || logoUrl;
        const signatureUrl = await getBase64Image(getAssetUrl('/assets/principal-sign.png'));
        const stampUrl = await getBase64Image(getAssetUrl('/assets/ku-college-seal.png'));
        // Try both dash and CamelCase versions for the stamp sign
        const stampSign = await getBase64Image(getAssetUrl('/assets/principal-signStamp.png')) || 
                          await getBase64Image(getAssetUrl('/assets/principal-sign-stamp.png')) || 
                          signatureUrl;

        const formatDate = (d) => {
            if (!d) return '';
            const dt = new Date(d);
            if (Number.isNaN(dt.getTime())) return '';
            return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
        };

        const commonData = {
            certId, date: formattedDate, studentName: student.name,
            fatherName: student.father_name || 'N/A', admissionNo: student.roll_no,
            course, dob: formattedDob,
            academicYear: getResolvedCurrentAcademicYear(student.roll_no, collegeInfo) || certRequest.academic_year || '',
            logoUrl, signatureUrl, stampSign, stampUrl, qrUrl: qrBase64, batch: batchString
        };

        let data = { ...commonData };
        switch (certRequest.certificate_type) {
            case 'Bonafide Certificate':
                data.year = yearWords[yearOfStudy - 1] || 'N/A';
                data.semester = semesterWords[currentSemester - 1] || 'N/A';
                data.attendancePercentage = attendanceValue || '';
                break;
            case 'Course Completion Certificate':
                data.aggCgpa = 'N/A';
                data.completionYear = today.getFullYear();
                break;
            case 'Income Tax (IT) Certificate':
                data.year = yearWords[yearOfStudy - 1] || 'N/A';
                data.semester = semesterWords[currentSemester - 1] || 'N/A';
                data.feeAmount = '35,000/- (Rupees Thirty-five Thousand only)';
                data.purpose = certRequest.purpose || '';
                break;
            case 'Transfer Certificate (TC)':
                data.conduct = 'Good';
                data.reason = 'Completion of Course';
                break;
            case 'Migration Certificate':
                data.reason = 'N/A';
                break;
            case 'Study Conduct Certificate':
                data.conduct = 'Satisfactory';
                break;
            case 'Custodian Certificate':
                data.year = yearWords[yearOfStudy - 1] || 'N/A';
                data.semester = semesterWords[currentSemester - 1] || 'N/A';
                data.hallTicket = student.roll_no;
                break;
            case 'No Objection Certificate':
                data.year = yearWords[yearOfStudy - 1] || 'N/A';
                data.semester = semesterWords[currentSemester - 1] || 'N/A';
                data.purpose = certRequest.purpose || '';
                data.fromDate = formatDate(certRequest.from_date);
                data.toDate = formatDate(certRequest.to_date);
                break;
        }

        const pdfBuffer = await pdf(<Template {...data} />).toBuffer();
        const headers = new Headers();
        headers.set('Content-Type', 'application/pdf');
        const filename = `${certRequest.certificate_type.replace(/ /g, '_')}_${student.roll_no}.pdf`;
        headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

        return new NextResponse(pdfBuffer, { status: 200, headers });

    } catch (error) {
        logger.error("Error generating certificate:", error);
        return apiError('An error occurred while generating the certificate.', 500, error.message);
    }
}
