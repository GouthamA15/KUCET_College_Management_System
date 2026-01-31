import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { jwtVerify } from 'jose';
import { getBranchFromRoll, getAcademicYear } from '@/lib/rollNumber';
import { getBonafideTemplate } from '@/lib/bonafide-template';
import puppeteer from 'puppeteer-core';
import path from 'path';

const JWT_SECRET = process.env.JWT_SECRET;

async function getRollNumberFromToken(request) {
    const token = request.cookies.get('student_auth')?.value;
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
        return payload.roll_no;
    } catch (error) {
        return null;
    }
}

// Function to find a valid Chrome executable path
const findChromeExecutable = () => {
    const locations = [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ];
    for (const location of locations) {
        try {
            // Use synchronous stat to check for existence
            require('fs').statSync(location);
            return location;
        } catch (e) {
            // Silently ignore errors
        }
    }
    return null;
};


export async function GET(request, { params }) {
    const roll_number = await getRollNumberFromToken(request);
    if (!roll_number) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { request_id } = await params;
    let browser = null;

    try {
        // 1. Verify this request belongs to the logged-in student and is a completed bonafide
        const requests = await query(
            'SELECT * FROM student_requests WHERE request_id = ? AND roll_number = ?',
            [request_id, roll_number]
        );

        if (requests.length === 0) {
            return NextResponse.json({ error: 'Request not found or not authorized' }, { status: 404 });
        }

        const certRequest = requests[0];
        if (certRequest.certificate_type !== 'Bonafide Certificate' || certRequest.status !== 'Completed') {
            return NextResponse.json({ error: 'Certificate not available for download' }, { status: 403 });
        }

        // 2. Fetch student details
        const students = await query(
            `SELECT s.name, s.roll_no, sp.father_name 
             FROM students s 
             LEFT JOIN student_personal_details sp ON s.id = sp.student_id 
             WHERE s.roll_no = ?`,
            [roll_number]
        );
        
        if (students.length === 0) {
            return NextResponse.json({ error: 'Student details not found' }, { status: 404 });
        }
        const student = students[0];

        // 3. Get HTML for the certificate
        const data = {
            name: student.name,
            roll_no: student.roll_no,
            father_name: student.father_name || 'N/A',
            course: `B.Tech (${getBranchFromRoll(student.roll_no)})`,
            academic_year: getAcademicYear(student.roll_no),
        };
        const htmlContent = getBonafideTemplate(data);
        
        // 4. Launch headless browser and generate PDF
        const executablePath = findChromeExecutable();
        if (!executablePath) {
            throw new Error("Google Chrome not found. Please install Google Chrome to generate PDFs.");
        }

        browser = await puppeteer.launch({
            executablePath,
            headless: true,
        });

        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

        const pdfBuf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '0px',
                right: '0px',
                bottom: '0px',
                left: '0px',
            },
        });

        // 5. Send the file as a response
        const headers = new Headers();
        headers.set('Content-Type', 'application/pdf');
        headers.set('Content-Disposition', `attachment; filename="Bonafide_${student.roll_no}.pdf"`);

        return new NextResponse(pdfBuf, { status: 200, headers });

    } catch (error) {
        console.error("Error generating certificate:", error);
        return NextResponse.json({ error: 'An error occurred while generating the certificate.', details: error.message }, { status: 500 });
    } finally {
        if (browser !== null) {
            await browser.close();
        }
    }
}