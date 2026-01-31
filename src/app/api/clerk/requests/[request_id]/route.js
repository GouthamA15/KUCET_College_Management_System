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
    const { status } = await request.json();

    if (!status) {
        return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    try {
        // First, verify the clerk is authorized to update this request
        const requests = await query('SELECT clerk_type FROM student_requests WHERE request_id = ?', [request_id]);
        if (requests.length === 0) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        const requestToUpdate = requests[0];
        if (requestToUpdate.clerk_type !== clerk.role) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Now, update the status
        const result = await query(
            'UPDATE student_requests SET status = ?, completed_at = NOW() WHERE request_id = ?',
            [status, request_id]
        );

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
