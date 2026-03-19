import { query } from '@/lib/db';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';
import crypto from 'crypto';

export async function PUT(request, { params }) {
    const clerk = await getAuthUser('clerk');
    if (!clerk) {
        return apiError('Unauthorized', 401);
    }

    // Ensure token contains clerk DB id for auditability
    if (!clerk.id) {
        console.error('Attempted action without clerk.id in token payload');
        return apiError('Clerk identity missing. Approval blocked.', 500);
    }

    const resolvedParams = await params;
    const { request_id } = resolvedParams;
    const body = await request.json();
    let { status, purpose } = body;
    const reject_reason = body.reject_reason;
    if (!status) {
        return apiError('Status is required', 400);
    }
    status = String(status).toUpperCase();
    const allowed = ['APPROVED', 'REJECTED', 'PENDING'];
    if (!allowed.includes(status)) {
        return apiError('Invalid status', 400);
    }

        try {
            // First, verify the clerk is authorized to update this request
            const requests = await query(
                'SELECT sr.certificate_type, sr.generated_certificate_id, sr.student_id, s.roll_no FROM student_requests sr JOIN students s ON sr.student_id = s.id WHERE sr.request_id = ?',
                [request_id]
            );
            if (requests.length === 0) {
                return apiError('Request not found', 404);
            }

            const requestToUpdate = requests[0];
                // Map clerk roles to certificate types (must match mapping used in listing)
                const clerkToTypes = {
                    admission: [
                        'Bonafide Certificate',
                        'No Objection Certificate',
                        'Course Completion Certificate',
                        'Transfer Certificate (TC)',
                        'Migration Certificate',
                        'Study Conduct Certificate',
                    ],
                    scholarship: [
                        'Income Tax (IT) Certificate',
                        'Custodian Certificate',
                    ],
                };
                const allowedTypes = clerkToTypes[clerk.role] || [];
                if (!allowedTypes.includes(requestToUpdate.certificate_type)) {
                        return apiError('Forbidden', 403);
                }

        // Prepare (or reuse) certificate ID when approving
        let generatedCertId = requestToUpdate.generated_certificate_id;
        if (status === 'APPROVED' && !generatedCertId) {
            const SECRET_SALT = process.env.CERTIFICATE_SECRET || 'fallback_salt';
            const hash = crypto.createHmac('sha256', SECRET_SALT)
                               .update(`${requestToUpdate.roll_no}-${requestToUpdate.certificate_type}`)
                               .digest('hex');
            generatedCertId = `KUCET-${hash.substring(0, 8).toUpperCase()}`;
        }

        // Now, update the status. Require non-empty reject_reason when rejecting.
        let result;
        if (status === 'REJECTED') {
            if (!reject_reason || String(reject_reason).trim().length === 0) {
                return apiError('Rejection reason is required', 400);
            }
            result = await query(
                'UPDATE student_requests SET status = ?, reject_reason = ?, completed_at = NOW(), updated_at = NOW(), action_by_clerk_id = ?, action_by_role = ? WHERE request_id = ?',
                [status, String(reject_reason).trim(), clerk.id ?? null, clerk.role ?? null, request_id]
            );
        } else if (status === 'APPROVED') {
            // Freeze purpose / date range as stored on the request; do not overwrite purpose from body.
            result = await query(
                'UPDATE student_requests SET status = ?, reject_reason = NULL, completed_at = NOW(), updated_at = NOW(), action_by_clerk_id = ?, action_by_role = ?, generated_certificate_id = COALESCE(generated_certificate_id, ?) WHERE request_id = ?',
                [status, clerk.id ?? null, clerk.role ?? null, generatedCertId || null, request_id]
            );
        } else {
            // PENDING or other non-final state: don't set completed_at or reject_reason
            result = await query(
                'UPDATE student_requests SET status = ?, updated_at = NOW() WHERE request_id = ?',
                [status, request_id]
            );
        }

        if (result.affectedRows === 1) {
            // REAL-TIME: Broadcast to students
            try {
                const { broadcastUpdate } = await import('@/lib/sse');
                broadcastUpdate('REQUEST_UPDATED', {
                    student_id: requestToUpdate.student_id,
                    status,
                    request_id,
                    certificate_type: requestToUpdate.certificate_type
                });
            } catch (e) {
                console.error('SSE Broadcast error:', e);
            }

            return apiResponse({ success: true });
        } else {
            return apiError('Failed to update request', 500);
        }
    } catch (error) {
        console.error("Error updating request:", error);
        return apiError('An error occurred while updating the request', 500, error.message);
    }
}

export async function GET(request, { params }) {
    const clerk = await getAuthUser('clerk');
    if (!clerk) {
        return apiError('Unauthorized', 401);
    }

    const resolvedParams = await params;
    const { request_id } = resolvedParams;

    try {
        // Verify clerk can access this type of request
        const reqRows = await query('SELECT sr.request_id, sr.student_id, sr.certificate_type FROM student_requests sr WHERE sr.request_id = ?', [request_id]);
        if (reqRows.length === 0) {
            return apiError('Request not found', 404);
        }

        const clerkToTypes = {
            admission: [
                'Bonafide Certificate',
                'No Objection Certificate',
                'Course Completion Certificate',
                'Transfer Certificate (TC)',
                'Migration Certificate',
                'Study Conduct Certificate',
            ],
            scholarship: [
                'Income Tax (IT) Certificate',
                'Custodian Certificate',
            ],
        };
        const allowedTypes = clerkToTypes[clerk.role] || [];
        if (!allowedTypes.includes(reqRows[0].certificate_type)) {
            return apiError('Forbidden', 403);
        }

        // Return full request details joined with student
        const sql = `SELECT
            sr.request_id,
            s.roll_no AS roll_number,
            s.name AS student_name,
            sr.certificate_type,
            sr.status,
            sr.payment_amount,
            sr.transaction_id,
            sr.purpose,
            sr.academic_year,
            sr.created_at,
            sr.updated_at,
            sr.completed_at,
            sr.reject_reason,
            sr.action_by_clerk_id,
            sr.action_by_role,
            c.name AS action_by_clerk_name
        FROM student_requests sr
        JOIN students s ON sr.student_id = s.id
        LEFT JOIN clerks c ON sr.action_by_clerk_id = c.id
        WHERE sr.request_id = ?`;

        const rows = await query(sql, [request_id]);
        if (!rows || rows.length === 0) {
            return apiError('Request not found', 404);
        }
        // Return the request object directly to match frontend expectations
        return apiResponse(rows[0]);
    } catch (error) {
        console.error('Error fetching request details:', error);
        return apiError('Failed to fetch request details', 500);
    }
}
