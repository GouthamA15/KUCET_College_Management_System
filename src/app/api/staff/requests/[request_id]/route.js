import logger from '@/lib/logger';
import { db } from '@/db';
import { studentRequests, students, staffAccounts, studentRequestImages } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser, logAudit } from '@/lib/api-utils';
import crypto from 'crypto';
import { parsePurpose, formatPurpose } from '@/lib/certificate-utils';

const roleToTypes = {
    hod: [
        'Bonafide Certificate', 'No Objection Certificate', 'Internship Certificate'
    ],
    admission: [
        'Bonafide Certificate', 'No Objection Certificate', 'Course Completion Certificate',
        'Transfer Certificate (TC)', 'Migration Certificate', 'Study Conduct Certificate',
    ],
    scholarship: ['Income Tax (IT) Certificate', 'Custodian Certificate'],
};

export async function PUT(request, { params }) {
    const url = new URL(request.url);
    const staffType = url.searchParams.get('staffType') || 'staff';
    const staff = await getAuthUser(staffType === 'hod' ? 'hod' : 'staff');
    
    if (!staff) return apiError('Unauthorized', 401);
    if (!staff.id) return apiError('Staff identity missing. Approval blocked.', 500);

    const isHodUser = Boolean(staff.is_hod || staff.is_principal || staff.role === 'hod');
    let effectiveRole = staff.role;
    if (isHodUser && (staff.role === 'faculty' || staff.role === 'hod')) {
        effectiveRole = 'hod';
    }

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
            status: studentRequests.status,
            hod_approval_status: studentRequests.hod_approval_status,
            certificate_format: studentRequests.certificate_format,
            study_year: studentRequests.study_year,
            study_semester: studentRequests.study_semester,
            academic_year: studentRequests.academic_year
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

        const allowedTypes = staff.role === 'admin'
            ? [...roleToTypes.admission, ...roleToTypes.scholarship, ...roleToTypes.hod]
            : (roleToTypes[effectiveRole] || []);
        if (!allowedTypes.includes(requestToUpdate.certificate_type)) return apiError('Forbidden', 403);

        // Branch isolation for HOD / Principal:
        // Institutional rule: Only the respective branch HOD can review Stage 1.
        // Administrators and Super Admins cannot substitute for the branch HOD.
        if (effectiveRole === 'hod') {
            const { getBranchFromRoll } = await import('@/lib/rollNumber');
            const studentBranch = getBranchFromRoll(requestToUpdate.roll_no);
            const authorizedBranches = staff.authorized_branches || (staff.branch ? [staff.branch] : []);
            if (authorizedBranches.length === 0 || !authorizedBranches.includes(studentBranch)) {
                return apiError(`Forbidden. You can only review requests for ${authorizedBranches.join(', ') || 'your assigned'} department.`, 403);
            }
        }

        const now = new Date();

        // 2-Stage Workflow for Bonafide and No Objection Certificates (NOC)
        const isTwoStageWorkflow = ['Bonafide Certificate', 'No Objection Certificate'].includes(requestToUpdate.certificate_type);

        if (isTwoStageWorkflow) {
            if (effectiveRole === 'admission') {
                if (requestToUpdate.hod_approval_status === 'PENDING') {
                    return apiError(`HOD endorsement is required before Admission Staff can review this ${requestToUpdate.certificate_type}.`, 400);
                }
                if (requestToUpdate.hod_approval_status === 'REJECTED') {
                    return apiError('This request was already rejected during HOD review.', 400);
                }
            } else if (effectiveRole === 'hod') {
                // Ensure HOD review hasn't already been performed
                if (requestToUpdate.hod_approval_status !== 'PENDING') {
                    return apiError('HOD review for this request has already been completed', 409);
                }

                // HOD Stage 1 Review
                if (status === 'APPROVED') {
                    const [stageResult] = await db.update(studentRequests)
                        .set({
                            hod_approval_status: 'APPROVED',
                            hod_staff_id: staff.id,
                            hod_approved_at: now,
                            updated_at: now
                        })
                        .where(and(
                            eq(studentRequests.request_id, requestIdNum),
                            eq(studentRequests.status, 'PENDING'),
                            eq(studentRequests.hod_approval_status, 'PENDING')
                        ));

                    if (stageResult.affectedRows === 1) {
                        await logAudit(request, {
                            userId: staff.id,
                            userType: 'STAFF',
                            action: 'HOD_APPROVE_CERTIFICATE_STAGE1',
                            targetId: requestIdNum,
                            targetType: 'certificate_request',
                            before: { hod_approval_status: requestToUpdate.hod_approval_status },
                            after: { hod_approval_status: 'APPROVED', hod_staff_id: staff.id }
                        });

                        try {
                            const { broadcastUpdate } = await import('@/lib/sse');
                            broadcastUpdate('REQUEST_UPDATED', {
                                student_id: requestToUpdate.student_id,
                                status: 'PENDING',
                                hod_approval_status: 'APPROVED',
                                request_id: requestIdNum,
                                certificate_type: requestToUpdate.certificate_type,
                                staffType: 'admission'
                            });
                        } catch (err) {
                            logger.warn({ err: err?.message }, '[SSE_BROADCAST_WARNING]');
                        }

                        return apiResponse({ 
                            success: true, 
                            message: `${requestToUpdate.certificate_type} endorsed by HOD. Forwarded to Admission Staff for final clearance.` 
                        });
                    }
                    return apiError('This request has already been processed', 409);
                } else if (status === 'REJECTED') {
                    if (!reject_reason || String(reject_reason).trim().length === 0) {
                        return apiError('Rejection reason is required', 400);
                    }
                    const [rejectResult] = await db.update(studentRequests)
                        .set({
                            status: 'REJECTED',
                            hod_approval_status: 'REJECTED',
                            hod_staff_id: staff.id,
                            hod_rejection_reason: String(reject_reason).trim(),
                            reject_reason: String(reject_reason).trim(),
                            completed_at: now,
                            updated_at: now,
                            action_by_staff_id: staff.id,
                            action_by_role: 'hod'
                        })
                        .where(and(
                            eq(studentRequests.request_id, requestIdNum),
                            eq(studentRequests.status, 'PENDING'),
                            eq(studentRequests.hod_approval_status, 'PENDING')
                        ));

                    if (rejectResult.affectedRows === 1) {
                        await logAudit(request, {
                            userId: staff.id,
                            userType: 'STAFF',
                            action: 'REJECT_CERTIFICATE',
                            targetId: requestIdNum,
                            targetType: 'certificate_request',
                            before: { status: requestToUpdate.status },
                            after: { status: 'REJECTED', reject_reason }
                        });

                        try {
                            const { broadcastUpdate } = await import('@/lib/sse');
                            broadcastUpdate('REQUEST_UPDATED', {
                                student_id: requestToUpdate.student_id,
                                status: 'REJECTED',
                                request_id: requestIdNum,
                                certificate_type: requestToUpdate.certificate_type
                            });
                        } catch (err) {
                            logger.warn({ err: err?.message }, '[SSE_BROADCAST_WARNING]');
                        }

                        return apiResponse({ success: true });
                    }
                    return apiError('This request has already been processed', 409);
                }
            }
        }

        // Standard or Final Approval / Rejection
        let generatedCertId = requestToUpdate.generated_certificate_id;
        if (status === 'APPROVED' && !generatedCertId) {
            const SECRET_SALT = process.env.CERTIFICATE_SECRET || 'fallback_salt';
            const hash = crypto.createHmac('sha256', SECRET_SALT)
                               .update(`${requestToUpdate.roll_no}-${requestToUpdate.certificate_type}-${requestIdNum}`)
                               .digest('hex');
            generatedCertId = `KUCET-${hash.substring(0, 8).toUpperCase()}`;
        }

        const updateData = { status, updated_at: now };

        if (status === 'REJECTED') {
            if (!reject_reason || String(reject_reason).trim().length === 0) return apiError('Rejection reason is required', 400);
            updateData.reject_reason = String(reject_reason).trim();
            updateData.completed_at = now;
            updateData.action_by_staff_id = staff.id;
            updateData.action_by_role = effectiveRole;
        } else if (status === 'APPROVED') {
            updateData.reject_reason = null;
            updateData.completed_at = now;
            updateData.action_by_staff_id = staff.id;
            updateData.action_by_role = effectiveRole;
            updateData.generated_certificate_id = generatedCertId;

            if (requestToUpdate.certificate_type === 'Bonafide Certificate') {
                if (requestToUpdate.certificate_format === 'PERCENTAGE') {
                    const { getBranchFromRoll } = await import('@/lib/rollNumber');
                    const branch = getBranchFromRoll(requestToUpdate.roll_no);
                    const { AttendanceCalculationService } = await import('@/services/academic/AttendanceCalculationService');
                    const attendanceResult = await AttendanceCalculationService.calculateCohortAttendance({
                        studentId: requestToUpdate.student_id,
                        branch,
                        semester: requestToUpdate.study_semester || 1,
                        academicYear: requestToUpdate.academic_year
                    });

                    if (!attendanceResult.success) {
                        return apiError(attendanceResult.blockReason || 'Failed to calculate attendance for this certificate.', 500);
                    }

                    if (!attendanceResult.canApprove) {
                        return apiError(attendanceResult.blockReason || 'Zero attendance sessions recorded in the portal for this cohort. Approval is blocked pending institutional policy confirmation.', 422);
                    }

                    updateData.generated_attendance = attendanceResult.generatedAttendance;
                } else if (requestToUpdate.certificate_format === 'ORDINARY') {
                    updateData.generated_attendance = 'N/A';
                }
            }
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
                userId: staff.id,
                userType: 'STAFF',
                action: status === 'APPROVED' ? 'APPROVE_CERTIFICATE' : 'REJECT_CERTIFICATE',
                targetId: requestIdNum,
                targetType: 'certificate_request',
                before: { status: requestToUpdate.status },
                after: { status: status, reject_reason: updateData.reject_reason, cert_id: updateData.generated_certificate_id }
            });

            if (status === 'APPROVED') {
                try {
                    const { EventBus, DOMAIN_EVENTS } = await import('@/lib/events/EventBus');
                    EventBus.publish(DOMAIN_EVENTS.CERTIFICATE_ISSUED, {
                        request_id: requestIdNum,
                        student_id: requestToUpdate.student_id,
                        roll_no: requestToUpdate.roll_no,
                        certificate_type: requestToUpdate.certificate_type,
                        certificate_id: updateData.generated_certificate_id,
                        issued_by: staff.id
                    });
                } catch (ebErr) {
                    logger.warn({ err: ebErr }, '[EventBus] Certificate issued publish failed');
                }
            }

            // REAL-TIME
            try {
                const { broadcastUpdate } = await import('@/lib/sse');
                broadcastUpdate('REQUEST_UPDATED', {
                    student_id: requestToUpdate.student_id,
                    status,
                    request_id: requestIdNum,
                    certificate_type: requestToUpdate.certificate_type
                });
            } catch (_e) { /* empty */ }
            return apiResponse({ success: true });
        } else {
            return apiError('This request has already been processed', 409);
        }
    } catch (error) {
        logger.error({ err: error, requestId: params?.request_id }, "Error updating request status");
        return apiError('Unable to update request status. Please try again.', 500);
    }
}

export async function GET(request, { params }) {
    const url = new URL(request.url);
    const staffType = url.searchParams.get('staffType') || 'staff';
    const staff = await getAuthUser(staffType === 'hod' ? 'hod' : 'staff');

    if (!staff) return apiError('Unauthorized', 401);

    const isHodUser = Boolean(staff.is_hod || staff.role === 'hod');
    let effectiveRole = staff.role;
    if (isHodUser && (staff.role === 'faculty' || staff.role === 'hod')) {
        effectiveRole = 'hod';
    }

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
            hod_approval_status: studentRequests.hod_approval_status,
            hod_staff_id: studentRequests.hod_staff_id,
            hod_approved_at: studentRequests.hod_approved_at,
            hod_rejection_reason: studentRequests.hod_rejection_reason,
            payment_amount: studentRequests.payment_amount,
            transaction_id: studentRequests.transaction_id,
            payment_screenshot: studentRequestImages.payment_screenshot,
            purpose: studentRequests.purpose,
            academic_year: studentRequests.academic_year,
            created_at: studentRequests.created_at,
            updated_at: studentRequests.updated_at,
            completed_at: studentRequests.completed_at,
            reject_reason: studentRequests.reject_reason,
            action_by_staff_id: studentRequests.action_by_staff_id,
            action_by_role: studentRequests.action_by_role,
            action_by_staff_name: staffAccounts.name
        })
        .from(studentRequests)
        .innerJoin(students, eq(studentRequests.student_id, students.id))
        .leftJoin(staffAccounts, eq(studentRequests.action_by_staff_id, staffAccounts.id))
        .leftJoin(studentRequestImages, eq(studentRequests.request_id, studentRequestImages.request_id))
        .where(eq(studentRequests.request_id, requestIdNum))
        .limit(1);

        if (rows.length === 0) return apiError('Request not found', 404);
        
        const allowedTypes = staff.role === 'admin'
            ? [...roleToTypes.admission, ...roleToTypes.scholarship, ...roleToTypes.hod]
            : (roleToTypes[effectiveRole] || []);
        if (!allowedTypes.includes(rows[0].certificate_type)) return apiError('Forbidden', 403);

        const parsed = parsePurpose(rows[0].purpose);
        const mappedRequest = {
            ...rows[0],
            purpose_type: parsed.purpose_type,
            purpose_custom: parsed.purpose_custom,
            purpose: formatPurpose(rows[0].purpose) || rows[0].purpose
        };

        return apiResponse(mappedRequest);
    } catch (error) {
        logger.error('Error fetching request details:', error);
        return apiError('Failed to fetch request details', 500);
    }
}

