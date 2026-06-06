import logger from '@/lib/logger';
import { db } from '@/db';
import { studentRequests, students, clerks } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser, logAudit } from '@/lib/api-utils';
import { getNow } from '@/lib/clock';
import crypto from 'crypto';

const clerkToTypes = {
    admission: [
        'Bonafide Certificate', 'No Objection Certificate', 'Course Completion Certificate',
        'Transfer Certificate (TC)', 'Migration Certificate', 'Study Conduct Certificate',
    ],
    scholarship: ['Income Tax (IT) Certificate', 'Custodian Certificate'],
};

export async function PUT(request, { params }) {
    const clerk = await getAuthUser('clerk');
    if (!clerk) return apiError('Unauthorized', 401);
    if (!clerk.id) return apiError('Clerk identity missing. Approval blocked.', 500);

    const resolvedParams = await params;
    const { request_id } = resolvedParams;
    const requestIdNum = parseInt(request_id);

    const body = await request.json();
    let { status } = body;
    const reject_reason = body.reject_reason;
    if (!status) return apiError('Status is required', 400);
    
    status = String(status).toUpperCase();
    if (!['APPROVED', 'REJECTED'].includes(status)) return apiError('Invalid status', 400);

    try {
        const rows = await db.select({
            certificate_type: studentRequests.certificate_type,
            generated_certificate_id: studentRequests.generated_certificate_id,
            student_id: studentRequests.student_id,
            roll_no: students.roll_no,
            status: studentRequests.status
        })
        .from(studentRequests)
        .innerJoin(students, eq(studentRequests.student_id, students.id))
        .where(eq(studentRequests.request_id, requestIdNum))
        .limit(1);

        if (rows.length === 0) return apiError('Request not found', 404);
        const requestToUpdate = rows[0];
        if (requestToUpdate.status !== 'PENDING') {
            return apiError('This request has already been processed', 409);
        }

        const allowedTypes = clerkToTypes[clerk.role] || [];
        if (!allowedTypes.includes(requestToUpdate.certificate_type)) return apiError('Forbidden', 403);

        let generatedCertId = requestToUpdate.generated_certificate_id;
        if (status === 'APPROVED' && !generatedCertId) {
            const SECRET_SALT = process.env.CERTIFICATE_SECRET || 'fallback_salt';
            const hash = crypto.createHmac('sha256', SECRET_SALT)
                               .update(`${requestToUpdate.roll_no}-${requestToUpdate.certificate_type}-${requestIdNum}`)
                               .digest('hex');
            generatedCertId = `KUCET-${hash.substring(0, 8).toUpperCase()}`;
        }

        const now = getNow();
        const updateData = { status, updated_at: now };

        if (status === 'REJECTED') {
            if (!reject_reason || String(reject_reason).trim().length === 0) return apiError('Rejection reason is required', 400);
            updateData.reject_reason = String(reject_reason).trim();
            updateData.completed_at = now;
            updateData.action_by_clerk_id = clerk.id;
            updateData.action_by_role = clerk.role;
        } else if (status === 'APPROVED') {
            updateData.reject_reason = null;
            updateData.completed_at = now;
            updateData.action_by_clerk_id = clerk.id;
            updateData.action_by_role = clerk.role;
            updateData.generated_certificate_id = generatedCertId;
        }

        const [result] = await db.update(studentRequests)
            .set(updateData)
            .where(and(
                eq(studentRequests.request_id, requestIdNum),
                eq(studentRequests.status, 'PENDING')
            ));

        if (result.affectedRows === 1) {
            // Audit Log
            await logAudit(request, {
                userId: clerk.id,
                userType: 'clerk',
                action: status === 'APPROVED' ? 'APPROVE_CERTIFICATE' : 'REJECT_CERTIFICATE',
                targetId: requestIdNum,
                targetType: 'certificate_request',
                before: { status: requestToUpdate.status },
                after: { status: status, reject_reason: updateData.reject_reason, cert_id: updateData.generated_certificate_id }
            });

            // REAL-TIME
            try {
                const { broadcastUpdate } = await import('@/lib/sse');
                broadcastUpdate('REQUEST_UPDATED', {
                    student_id: requestToUpdate.student_id,
                    status,
                    request_id: requestIdNum,
                    certificate_type: requestToUpdate.certificate_type
                });
            } catch (e) {}
            return apiResponse({ success: true });
        } else {
            return apiError('This request has already been processed', 409);
        }
    } catch (error) {
        logger.error("Error updating request:", error);
        return apiError('An error occurred while updating the request', 500, error.message);
    }
}

export async function GET(request, { params }) {
    const clerk = await getAuthUser('clerk');
    if (!clerk) return apiError('Unauthorized', 401);

    const resolvedParams = await params;
    const { request_id } = resolvedParams;
    const requestIdNum = parseInt(request_id);

    try {
        const rows = await db.select({
            request_id: studentRequests.request_id,
            roll_number: students.roll_no,
            student_name: students.name,
            certificate_type: studentRequests.certificate_type,
            status: studentRequests.status,
            payment_amount: studentRequests.payment_amount,
            transaction_id: studentRequests.transaction_id,
            payment_screenshot: studentRequests.payment_screenshot,
            purpose: studentRequests.purpose,
            academic_year: studentRequests.academic_year,
            created_at: studentRequests.created_at,
            updated_at: studentRequests.updated_at,
            completed_at: studentRequests.completed_at,
            reject_reason: studentRequests.reject_reason,
            action_by_clerk_id: studentRequests.action_by_clerk_id,
            action_by_role: studentRequests.action_by_role,
            action_by_clerk_name: clerks.name
        })
        .from(studentRequests)
        .innerJoin(students, eq(studentRequests.student_id, students.id))
        .leftJoin(clerks, eq(studentRequests.action_by_clerk_id, clerks.id))
        .where(eq(studentRequests.request_id, requestIdNum))
        .limit(1);

        if (rows.length === 0) return apiError('Request not found', 404);
        
        const allowedTypes = clerkToTypes[clerk.role] || [];
        if (!allowedTypes.includes(rows[0].certificate_type)) return apiError('Forbidden', 403);

        return apiResponse(rows[0]);
    } catch (error) {
        logger.error('Error fetching request details:', error);
        return apiError('Failed to fetch request details', 500);
    }
}
