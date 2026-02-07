import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request) {
    try {
        const body = await request.json();
        
        // Use 'null' as fallback to avoid the MySQL "undefined" crash
        const certId = body.certId || null;
        const rollNo = body.rollNo || null;

        if (!certId || !rollNo) {
            return NextResponse.json({ valid: false, message: "Missing params" }, { status: 400 });
        }

        // 1. Check for the certificate
        const results = await query(
    `SELECT sr.request_id, sr.generated_certificate_id, sr.certificate_type, 
            s.name, s.roll_no, sr.status, sr.completed_at
     FROM student_requests sr
     JOIN students s ON sr.student_id = s.id
     WHERE sr.generated_certificate_id = ? AND s.roll_no = ?`,
    [certId, rollNo]
);

        // 2. If no result found or not approved, return valid: false
        if (!results || results.length === 0 || results[0].status !== 'APPROVED') {
            console.log(`[VERIFY] No valid record found for ID: ${certId}`);
            return NextResponse.json({ valid: false });
        }

        const certData = results[0];

        // 3. LOG THE VERIFICATION 
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || 'Unknown Device';

        // We wrap this in a try/catch so even if logging fails, the user sees "Valid"
        try {
            await query(
                `INSERT INTO certificate_verifications (request_id, ip_address, user_agent) 
                 VALUES (?, ?, ?)`,
                [certData.request_id, ip, userAgent]
            );
            console.log(`[VERIFY] Logged scan for Request ID: ${certData.request_id}`);
        } catch (dbErr) {
            console.error("[VERIFY] Logging to table failed:", dbErr.message);
        }

        // 4. Return success details to the frontend
        return NextResponse.json({
            valid: true,
        details: {
            name: certData.name,
            roll_no: certData.roll_no,
            cert_id: certData.generated_certificate_id,
            issue_date: certData.completed_at ? new Date(certData.completed_at).toLocaleDateString('en-GB') : 'N/A', // New field
            type: certData.certificate_type
            }
        });

    } catch (error) {
        console.error("Critical Verification Error:", error);
        return NextResponse.json({ valid: false, error: "Internal Server Error" }, { status: 500 });
    }
}