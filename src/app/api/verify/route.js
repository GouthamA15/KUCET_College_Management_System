import { db } from '@/db';
import { studentRequests, students, certificateVerifications } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { apiError, apiResponse } from '@/lib/api-utils';

export async function POST(request) {
    try {
        const body = await request.json();
        
        const certId = body.certId || null;
        const rollNo = body.rollNo || null;

        if (!certId || !rollNo) {
            return apiResponse({ valid: false, message: "Missing params" }, 400);
        }

        // 1. Check for the certificate
        const results = await db.select({
            request_id: studentRequests.request_id,
            generated_certificate_id: studentRequests.generated_certificate_id,
            certificate_type: studentRequests.certificate_type,
            name: students.name,
            roll_no: students.roll_no,
            status: studentRequests.status,
            completed_at: studentRequests.completed_at
        })
        .from(studentRequests)
        .join(students, eq(studentRequests.student_id, students.id))
        .where(and(
            eq(studentRequests.generated_certificate_id, certId),
            eq(students.roll_no, rollNo)
        ))
        .limit(1);

        // 2. If no result found or not approved, return valid: false
        if (results.length === 0 || results[0].status !== 'APPROVED') {
            console.log(`[VERIFY] No valid record found for ID: ${certId}`);
            return apiResponse({ valid: false });
        }

        const certData = results[0];

        // 3. LOG THE VERIFICATION 
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || 'Unknown Device';

        try {
            await db.insert(certificateVerifications).values({
                request_id: certData.request_id,
                ip_address: ip,
                user_agent: userAgent
            });
            console.log(`[VERIFY] Logged scan for Request ID: ${certData.request_id}`);
        } catch (dbErr) {
            console.error("[VERIFY] Logging to table failed:", dbErr.message);
        }

        // 4. Return success details to the frontend
        return apiResponse({
            valid: true,
        details: {
            name: certData.name,
            roll_no: certData.roll_no,
            cert_id: certData.generated_certificate_id,
            issue_date: certData.completed_at ? new Date(certData.completed_at).toLocaleDateString('en-GB') : 'N/A',
            cert_type: certData.certificate_type,
            type: certData.certificate_type
            }
        });

    } catch (error) {
        console.error("Critical Verification Error:", error);
        return apiError("Internal Server Error", 500, { valid: false });
    }
}
