import { db } from '@/db';
import { certificateVerifications, studentRequests, students } from '@/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { apiResponse, apiError, getAuthUser } from '@/lib/api-utils';

export async function GET(request) {
    try {
        const user = await getAuthUser('admin');
        if (!user) {
            return apiError("Unauthorized", 401);
        }

        // 1. Get location-based aggregation for heatmap
        const locationStats = await db.select({
            location: certificateVerifications.location_name,
            count: sql`count(*)`,
            latitude: certificateVerifications.latitude,
            longitude: certificateVerifications.longitude
        })
        .from(certificateVerifications)
        .groupBy(certificateVerifications.location_name, certificateVerifications.latitude, certificateVerifications.longitude)
        .orderBy(desc(sql`count(*)`))
        .limit(50);

        // 2. Get most verified certificates (potential suspicious activity)
        const topVerifiedCerts = await db.select({
            request_id: certificateVerifications.request_id,
            cert_id: studentRequests.generated_certificate_id,
            student_name: students.name,
            roll_no: students.roll_no,
            count: sql`count(*)`
        })
        .from(certificateVerifications)
        .innerJoin(studentRequests, eq(certificateVerifications.request_id, studentRequests.request_id))
        .innerJoin(students, eq(studentRequests.student_id, students.id))
        .groupBy(certificateVerifications.request_id, studentRequests.generated_certificate_id, students.name, students.roll_no)
        .orderBy(desc(sql`count(*)`))
        .limit(20);

        // 3. Recent verification list
        const recentVerifications = await db.select({
            id: certificateVerifications.id,
            cert_id: studentRequests.generated_certificate_id,
            student_name: students.name,
            verification_date: certificateVerifications.verification_date,
            location: certificateVerifications.location_name,
            ip: certificateVerifications.ip_address,
            device: certificateVerifications.device_name
        })
        .from(certificateVerifications)
        .innerJoin(studentRequests, eq(certificateVerifications.request_id, studentRequests.request_id))
        .innerJoin(students, eq(studentRequests.student_id, students.id))
        .orderBy(desc(certificateVerifications.verification_date))
        .limit(100);

        return apiResponse({
            locationStats,
            topVerifiedCerts,
            recentVerifications
        });

    } catch (error) {
        console.error("[VERIFY_STATS_ERROR]", error);
        return apiError("Internal Server Error", 500);
    }
}
