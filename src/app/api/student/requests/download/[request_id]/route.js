import crypto from 'crypto'; 
import QRCode from 'qrcode';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { jwtVerify } from 'jose';
import { getBranchFromRoll, getResolvedCurrentAcademicYear } from '@/lib/rollNumber';
// template file used from templates/bonafide.html
import { htmlToPdfBuffer } from '@/lib/pdf-generator';
import path from 'path';
import fs from 'fs/promises';

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

const certificateTemplates = {
  'Bonafide Certificate': 'bonafide.html',
  'Custodian Certificate': 'custodian.html',
  'Study Conduct Certificate': 'study-conduct.html',
  'Migration Certificate': 'migration.html',
  'Transfer Certificate (TC)': 'transfer.html',
  'Income Tax (IT) Certificate': 'income_tax.html',
  'Course Completion Certificate': 'course_completion.html',
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
        const templateName = certificateTemplates[certRequest.certificate_type];

        if (!templateName || certRequest.status !== 'APPROVED') {
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

        // --- NEW LOGIC: CALCULATE YEAR AND SEMESTER ---
        const rollNo = student.roll_no;
        const admissionYearShort = parseInt(rollNo.substring(0, 2)); // e.g., "22" from "22K4..."
        const admissionYear = 2000 + admissionYearShort;
        
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
        // Other types will leave 'generated_attendance' column NULL
        const isBonafide = certRequest.certificate_type === 'Bonafide Certificate';
        let attendanceValue = certRequest.generated_attendance;

        // Only run this logic for Bonafide certificates
        if (isBonafide && !attendanceValue) {
            const randomPercent = Math.floor(Math.random() * (95 - 80 + 1)) + 80;
            attendanceValue = `${randomPercent}%`;
        } else if (!isBonafide) {
            attendanceValue = null; // Ensure it stays null for other types
        }

        // Update database (this saves the Cert ID for all, but attendance only for Bonafide)
        await query(
            'UPDATE student_requests SET generated_certificate_id = ?, generated_attendance = ? WHERE request_id = ?',
            [certId, attendanceValue, request_id]
        );

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://10.163.82.43:${process.env.PORT || 3000}`;
        const verificationUrl = `${baseUrl}/verify?id=${certId}&roll=${rollNo}`;
        const qrBase64 = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 150 });

        

        
        const formattedDate = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
        const dob = new Date(student.date_of_birth);
        const formattedDob = `${dob.getDate()}-${dob.getMonth() + 1}-${dob.getFullYear()}`;

        const course = ` ${getBranchFromRoll(student.roll_no)}`;
        const data = {
            DATE: formattedDate,
            STUDENT_NAME: student.name,
            FATHER_NAME: student.father_name || 'N/A',
            ADMISSION_NO: student.roll_no,
            COURSE: course,
            YEAR: yearWords[yearOfStudy - 1] || 'N/A',
            SEMESTER: semesterWords[currentSemester - 1] || 'N/A',
            ACADEMIC_YEAR: getResolvedCurrentAcademicYear(student.roll_no) || '',
            ATTENDANCE_PERCENTAGE: attendanceValue || '',
            DOB: formattedDob,
            CERT_ID: certId,
            QR_CODE: qrBase64
        };


        // 3. Get HTML for the certificate by loading the template and injecting data
        const templatePath = path.join(process.cwd(), 'templates', templateName);
        let htmlTemplate = await fs.readFile(templatePath, 'utf8');

        // Replace placeholders in template (simple token replacement)
        let htmlContent = htmlTemplate;
        for (const [key, value] of Object.entries(data)) {
            const token = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            htmlContent = htmlContent.replace(token, String(value));


        
        }

        // Ensure images are available to Puppeteer: inline local asset files as data URIs.
        // We perform async reads for each img src that references an assets path, and replace with a data URI.
        const inlineImageRegex = /src=["']([^"']*assets\/[^"]+)["']/g;
        const seen = new Map();
        // Collect matches first because we'll perform async reads
        const matches = Array.from(htmlContent.matchAll(inlineImageRegex));
        for (const m of matches) {
            const full = m[0];
            const srcPath = m[1];
            if (seen.has(full)) continue;
            try {
                let p = srcPath;
                if (p.startsWith(baseUrl)) p = p.slice(baseUrl.length);
                p = p.replace(/^\/?public\//, '').replace(/^\//, '');
                const rel = p.includes('assets/') ? p : `assets/${p}`;
                const filePath = path.join(process.cwd(), 'public', rel.replace(/^\//, ''));
                const buffer = await fs.readFile(filePath);
                const ext = path.extname(filePath).toLowerCase().replace('.', '');
                const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : `image/${ext}`;
                const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;
                seen.set(full, dataUri);
                htmlContent = htmlContent.split(full).join(`src="${dataUri}"`);
            } catch (e) {
                const fallback = `src="${baseUrl}/${srcPath.replace(/^\//, '')}"`;
                seen.set(full, fallback);
                htmlContent = htmlContent.split(full).join(fallback);
            }
        }

        // Also handle common template image filenames (in case templates reference them without assets/ path)
        const knownNames = ['Picture1.png', 'ku-logo.png', 'ku-college-seal.png', 'principal-sign.png'];
        for (const name of knownNames) {
            const regex = new RegExp(`src=["'](?:\\/?public\\/?assets\\/${name}|\\/?assets\\/${name}|${name})["']`, 'g');
            if (!regex.test(htmlContent)) continue;
            const filePath = path.join(process.cwd(), 'public', 'assets', name);
            try {
                const buffer = await fs.readFile(filePath);
                const ext = path.extname(filePath).toLowerCase().replace('.', '');
                const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : `image/${ext}`;
                const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;
                htmlContent = htmlContent.replace(regex, `src="${dataUri}"`);
            } catch (e) {
                htmlContent = htmlContent.replace(regex, `src="${baseUrl}/assets/${name}"`);
            }
        }

        // 4. Generate PDF using shared helper which uses bundled puppeteer
        const pdfBuf = await htmlToPdfBuffer(htmlContent);

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

        return new NextResponse(pdfBuf, { status: 200, headers });

    } catch (error) {
        console.error("Error generating certificate:", error);
        return NextResponse.json({ error: 'An error occurred while generating the certificate.', details: error.message }, { status: 500 });
    } finally {
        // nothing to clean up here; browser lifecycle is handled in pdf-generator
    }
}