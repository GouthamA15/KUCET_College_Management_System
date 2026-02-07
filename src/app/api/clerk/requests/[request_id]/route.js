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

    const resolvedParams = await params;
    const { request_id } = resolvedParams;
    const body = await request.json();
    let { status } = body;
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
                'UPDATE student_requests SET status = ?, reject_reason = ?, completed_at = NOW() WHERE request_id = ?',
                [status, String(reject_reason).trim(), request_id]
            );
        } else if (status === 'APPROVED') {
            result = await query(
                'UPDATE student_requests SET status = ?, completed_at = NOW() WHERE request_id = ?',
                [status, request_id]
            );
        } else {
            // PENDING or other non-final state: don't set completed_at or reject_reason
            result = await query(
                'UPDATE student_requests SET status = ? WHERE request_id = ?',
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
