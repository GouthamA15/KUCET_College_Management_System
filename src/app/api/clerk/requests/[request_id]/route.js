import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;

async function getClerkFromToken(request) {
    const token = request.cookies.get('clerk_auth')?.value;
    if (!token) {
        return null;
    }
    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
        return payload;
    } catch (error) {
        return null;
    }
}

export async function PUT(request, { params }) {
    const clerk = await getClerkFromToken(request);
    if (!clerk) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure token contains clerk DB id for auditability
    if (!clerk.id) {
        console.error('Attempted action without clerk.id in token payload');
        return NextResponse.json({ error: 'Clerk identity missing. Approval blocked.' }, { status: 500 });
    }

    const resolvedParams = await params;
    const { request_id } = resolvedParams;
    const body = await request.json();
    let { status, purpose } = body;
    const reject_reason = body.reject_reason;
    if (!status) {
        return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }
    status = String(status).toUpperCase();
    const allowed = ['APPROVED', 'REJECTED', 'PENDING'];
    if (!allowed.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    try {
                // First, verify the clerk is authorized to update this request
                const requests = await query('SELECT certificate_type FROM student_requests WHERE request_id = ?', [request_id]);
                if (requests.length === 0) {
                        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
                }

                const requestToUpdate = requests[0];
                // Map clerk roles to certificate types (must match mapping used in listing)
                const clerkToTypes = {
                    admission: [
                        'Bonafide Certificate',
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
                        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }

        // Now, update the status. Require non-empty reject_reason when rejecting.
        let result;
        if (status === 'REJECTED') {
            if (!reject_reason || String(reject_reason).trim().length === 0) {
                return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
            }
            result = await query(
                'UPDATE student_requests SET status = ?, reject_reason = ?, completed_at = NOW(), updated_at = NOW(), action_by_clerk_id = ?, action_by_role = ? WHERE request_id = ?',
                [status, String(reject_reason).trim(), clerk.id ?? null, clerk.role ?? null, request_id]
            );
        } else if (status === 'APPROVED') {
            result = await query(
                'UPDATE student_requests SET status = ?, purpose = ?, reject_reason = NULL, completed_at = NOW(), updated_at = NOW(), action_by_clerk_id = ?, action_by_role = ? WHERE request_id = ?',
                [status, purpose || null, clerk.id ?? null, clerk.role ?? null, request_id]
            );
        } else {
            // PENDING or other non-final state: don't set completed_at or reject_reason
            result = await query(
                'UPDATE student_requests SET status = ?, updated_at = NOW() WHERE request_id = ?',
                [status, request_id]
            );
        }

        if (result.affectedRows === 1) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
        }
    } catch (error) {
        console.error("Error updating request:", error);
        return NextResponse.json({ error: 'An error occurred while updating the request', details: error.message }, { status: 500 });
    }
}

export async function GET(request, { params }) {
    const clerk = await getClerkFromToken(request);
    if (!clerk) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { request_id } = resolvedParams;

    try {
        // Verify clerk can access this type of request
        const reqRows = await query('SELECT sr.request_id, sr.student_id, sr.certificate_type FROM student_requests sr WHERE sr.request_id = ?', [request_id]);
        if (reqRows.length === 0) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        const clerkToTypes = {
            admission: [
                'Bonafide Certificate',
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
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
            sr.payment_screenshot,
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
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }
        return NextResponse.json(rows[0]);
    } catch (error) {
        console.error('Error fetching request details:', error);
        return NextResponse.json({ error: 'Failed to fetch request details' }, { status: 500 });
    }
}
