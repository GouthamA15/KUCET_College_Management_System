import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { jwtVerify } from 'jose';
import { getBranchFromRoll, getCurrentAcademicYear } from '@/lib/rollNumber';
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

// using bundled Puppeteer; helper closes browser internally


export async function GET(request, { params }) {
    const auth = await getStudentFromToken(request);
    if (!auth || !auth.student_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Enforce verification: email present, verified, and password set
    try {
        const verRows = await query('SELECT email, is_email_verified, password_hash FROM students WHERE id = ?', [auth.student_id]);
        const ver = verRows && verRows[0];
        if (!ver || !ver.email || !ver.is_email_verified || !ver.password_hash) {
            return NextResponse.json({ error: 'Verification required: verify email and set password to download certificates.' }, { status: 403 });
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
        if (certRequest.certificate_type !== 'Bonafide Certificate' || certRequest.status !== 'APPROVED') {
            return NextResponse.json({ error: 'Certificate not available for download' }, { status: 403 });
        }

        // 2. Fetch student details
        const students = await query(
            `SELECT s.name, s.roll_no, sp.father_name 
             FROM students s 
             LEFT JOIN student_personal_details sp ON s.id = sp.student_id 
             WHERE s.id = ?`,
            [auth.student_id]
        );
        
        if (students.length === 0) {
            return NextResponse.json({ error: 'Student details not found' }, { status: 404 });
        }
        const student = students[0];

        // 3. Get HTML for the certificate by loading the template and injecting data
        const templatePath = path.join(process.cwd(), 'templates', 'bonafide.html');
        let htmlTemplate = await fs.readFile(templatePath, 'utf8');

        const today = new Date();
        const formattedDate = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

        const course = `B.Tech (${getBranchFromRoll(student.roll_no)})`;
        const data = {
            DATE: formattedDate,
            STUDENT_NAME: student.name,
            FATHER_NAME: student.father_name || 'N/A',
            ADMISSION_NO: student.roll_no,
            COURSE: course,
            YEAR: '',
            SEMESTER: '',
            ACADEMIC_YEAR: getCurrentAcademicYear(student.roll_no) || '',
            ATTENDANCE_PERCENTAGE: 'N/A',
        };

        // Replace placeholders in template (simple token replacement)
        let htmlContent = htmlTemplate;
        for (const [key, value] of Object.entries(data)) {
            const token = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            htmlContent = htmlContent.replace(token, String(value));
        }

        // Ensure logo uses absolute URL so Puppeteer can load it when rendering server-side
        const baseUrl = process.env.NODE_ENV === 'production' ? process.env.PUBLIC_URL || '' : `http://localhost:${process.env.PORT || 3000}`;
        htmlContent = htmlContent.replace(/src=["']Picture1.png["']/g, `src="${baseUrl}/assets/ku-logo.png"`);

        // 4. Generate PDF using shared helper which uses bundled puppeteer
        const pdfBuf = await htmlToPdfBuffer(htmlContent);

        // 5. Send the file as a response
        const headers = new Headers();
        headers.set('Content-Type', 'application/pdf');
        // Use student.roll_no when available
        const fileRoll = student.roll_no || auth.roll_no || 'student';
        if (!student.roll_no) console.warn('[CERT_DOWNLOAD] student.roll_no missing, falling back to token roll_no or generic');
        // RFC 5987 encoded filename to be safe with special chars
        const filename = `Bonafide_${fileRoll}.pdf`;
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