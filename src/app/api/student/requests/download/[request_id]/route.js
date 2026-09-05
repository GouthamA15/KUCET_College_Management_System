import logger from '@/lib/logger';
import crypto from 'crypto'; 
import QRCode from 'qrcode';
import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { students, studentPersonalDetails, studentRequests } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { apiError, getAuthUser } from '@/lib/api-utils';
import { getAssetUrl } from '@/lib/assets';
import fs from 'fs';
import { getBranchFromRoll } from '@/lib/rollNumber';
import { getCollegeAcademicYear, calculateYearAndSemesterAsync } from '@/lib/academic-utils';
import { getNow } from '@/lib/clock';
import { decrypt } from '@/lib/encryption';
import { _studentImages } from '@/db/schema';
import { resolveLocalFilePath } from '@/app/api/assets/view/[...path]/route';
import { InstitutionAssetService } from '@/services/institution/InstitutionAssetService';

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
            category: studentPersonalDetails.category,
            sub_caste: studentPersonalDetails.sub_caste,
            date_of_birth: students.date_of_birth,
            perm_house_no: studentPersonalDetails.perm_house_no,
            perm_street: studentPersonalDetails.perm_street,
            perm_apartment: studentPersonalDetails.perm_apartment,
            perm_city: studentPersonalDetails.perm_city,
            perm_state: studentPersonalDetails.perm_state,
            perm_pincode: studentPersonalDetails.perm_pincode,
            perm_country: studentPersonalDetails.perm_country,
        })
        .from(students)
        .leftJoin(studentPersonalDetails, eq(students.id, studentPersonalDetails.student_id))
        .where(eq(students.id, auth.student_id))
        .limit(1);
        
        if (studentInfo.length === 0) {
            return apiError('Student details not found', 404);
        }
        const student = studentInfo[0];
        const _mobile = decrypt(student.mobile) || 'N/A';
        
        const { getPermanentAddressFromDetails } = require('@/lib/address-utils');
        const _address = getPermanentAddressFromDetails(student) || 'N/A';

        const { yearOfStudy, semester: currentSemester } = await calculateYearAndSemesterAsync(student.roll_no);
        const currentAcademicYear = await getCollegeAcademicYear();
        
        const rollNo = student.roll_no || '';
        const isLateral = rollNo.toUpperCase().endsWith('L');
        const admissionYearShort = parseInt(rollNo.substring(0, 2), 10);
        const admissionYear = Number.isNaN(admissionYearShort) ? 2024 : 2000 + admissionYearShort;
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

        const approvedDate = certRequest.updated_at ? new Date(certRequest.updated_at) : await getNow();
        const formattedDate = `${String(approvedDate.getDate()).padStart(2, '0')}/${String(approvedDate.getMonth() + 1).padStart(2, '0')}/${approvedDate.getFullYear()}`;
        
        let formattedDob = 'N/A';
        if (student.date_of_birth) {
            const dob = new Date(student.date_of_birth);
            if (!Number.isNaN(dob.getTime())) {
                formattedDob = `${String(dob.getDate()).padStart(2, '0')}-${String(dob.getMonth() + 1).padStart(2, '0')}-${dob.getFullYear()}`;
            }
        }
        const course = String(getBranchFromRoll(student.roll_no) || '');

        const base64Cache = new Map();

        const getBase64Image = async (imagePath) => {
            if (!imagePath) return null;
            if (base64Cache.has(imagePath)) return base64Cache.get(imagePath);

            try {
                let imageBuffer = null;
                if (imagePath.startsWith('data:')) {
                    return imagePath;
                } else if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
                    try {
                        const response = await fetch(imagePath);
                        if (response.ok) {
                            const arrayBuffer = await response.arrayBuffer();
                            imageBuffer = Buffer.from(arrayBuffer);
                        }
                    } catch (_fetchErr) {
                        // ignore and try local fallback
                    }
                    if (!imageBuffer) {
                        const cleanUrlPath = imagePath.split('/upload/')[1] || imagePath;
                        const cleanPath = cleanUrlPath
                            .replace(/^v\d+\//, '')
                            .replace(/^kucet\//, '')
                            .replace(/^public\//, '')
                            .replace(/^\/+/, '');
                        const { filePath, stat } = resolveLocalFilePath(cleanPath);
                        if (stat && stat.isFile()) {
                            imageBuffer = await fs.promises.readFile(filePath);
                        }
                    }
                } else {
                    const cleanPath = imagePath
                        .replace('/api/assets/view/', '')
                        .replace(/^\/+/, '');
                    const { filePath } = resolveLocalFilePath(cleanPath);
                    if (fs.existsSync(filePath)) {
                        imageBuffer = await fs.promises.readFile(filePath);
                    }
                }
                if (!imageBuffer || imageBuffer.length < 4) return null;

                let mimeType = 'image/png';
                if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8) mimeType = 'image/jpeg';
                else if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) mimeType = 'image/png';

                const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
                base64Cache.set(imagePath, dataUrl);
                return dataUrl;
            } catch (_err) {
                return null;
            }
        };

        const logoUrl = await InstitutionAssetService.getAssetDataUrl('institution/logo') 
            || await getBase64Image(getAssetUrl('/assets/ku-logo.png'));
        const _collegeLogoUrl = await InstitutionAssetService.getAssetDataUrl('institution/college-logo') 
            || logoUrl;
        const signatureUrl = await InstitutionAssetService.getAssetDataUrl('principal/signature') 
            || await InstitutionAssetService.getAssetDataUrl('principal/signature-stamp');
        const stampUrl = await InstitutionAssetService.getAssetDataUrl('institution/seal');
        const stampSign = await InstitutionAssetService.getAssetDataUrl('principal/signature-stamp') 
            || signatureUrl;

        const formatDate = (d) => {
            if (!d) return '';
            const dt = new Date(d);
            if (Number.isNaN(dt.getTime())) return '';
            return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
        };

        const category = student.category || '';
        const subCaste = student.sub_caste || '';
        const casteDisplay = subCaste && subCaste !== category ? `${category} (${subCaste})` : category;

        const commonData = {
            certId, date: formattedDate, studentName: student.name,
            fatherName: student.father_name || 'N/A', admissionNo: student.roll_no,
            course, dob: formattedDob, category, subCaste, casteDisplay,
            academicYear: currentAcademicYear || certRequest.academic_year || '',
            logoUrl, signatureUrl, stampSign, stampUrl, qrUrl: qrBase64, batch: batchString
        };

        let data = { ...commonData };
        switch (certRequest.certificate_type) {
            case 'Bonafide Certificate': {
                const { formatPurpose } = require('@/lib/certificate-utils');
                data.year = yearWords[yearOfStudy - 1] || 'N/A';
                data.semester = semesterWords[currentSemester - 1] || 'N/A';
                data.attendancePercentage = attendanceValue || '';
                data.purpose = formatPurpose(certRequest.purpose) || 'General';
                break;
            }
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
        const { formatCertificateName } = require('@/lib/certificate-utils');
        const formattedCertName = formatCertificateName(certRequest.certificate_type, certRequest.purpose);
        const filename = `${formattedCertName.replace(/ /g, '_')}_${student.roll_no}.pdf`;
        headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

        return new NextResponse(pdfBuffer, { status: 200, headers });

    } catch (error) {
        const errorDetails = {
            name: error?.name || 'Error',
            message: error?.message || String(error),
            stack: error?.stack || null,
            cause: error?.cause || null,
        };
        logger.error({ err: error, details: errorDetails }, '[CERTIFICATE_GENERATION_EXCEPTION]');
        console.error('[CERTIFICATE_GENERATION_EXCEPTION] Full Stack Trace:', error);
        return apiError('An error occurred while generating the certificate.', 500, process.env.NODE_ENV === 'development' ? error.stack : error.message);
    }
}
