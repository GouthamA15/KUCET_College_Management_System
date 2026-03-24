import logger from '@/lib/logger';
import { db } from '@/db';
import { studentRequests, students, certificateVerifications } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { apiError, apiResponse } from '@/lib/api-utils';

export async function POST(request) {
    try {
        const body = await request.json();
        
        // Normalize inputs
        const certId = body.certId?.trim()?.toUpperCase() || null;
        const rollNo = body.rollNo?.trim()?.toUpperCase() || null;

        if (!certId || !rollNo) {
            return apiResponse({ valid: false, message: "Missing params" }, 400);
        }

        // Debug DB
        // console.log("DB_KEYS:", Object.keys(db));

        // 1. Check for the certificate by ID only first to be more robust
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
        .innerJoin(students, eq(studentRequests.student_id, students.id))
        .where(eq(studentRequests.generated_certificate_id, certId))
        .orderBy(asc(studentRequests.status));

        // 2. Find the exact match manually to handle potential DB-level spacing/casing
        const certData = results.find(r => 
            r.roll_no?.trim()?.toUpperCase() === rollNo
        );

        if (!certData) {
            logger.info(`[VERIFY_FAIL] No matching Roll No for Cert ID: "${certId}". Input Roll: "${rollNo}"`);
            // Log what we did find for debugging
            if (results.length > 0) {
                logger.info(`[VERIFY_DEBUG] Found ${results.length} records for this ID, but rolls were: ${results.map(r => `"${r.roll_no}"`).join(', ')}`);
            }
            return apiResponse({ valid: false });
        }
        
        if (certData.status !== 'APPROVED') {
            logger.info(`[VERIFY_FAIL] Record found but status is ${certData.status}. ID: "${certId}"`);
            return apiResponse({ valid: false });
        }

        // 3. LOG THE VERIFICATION 
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || 'Unknown Device';
        const deviceName = body.deviceName || null;
        const latitude = body.latitude || null;
        const longitude = body.longitude || null;

        // IP-based Location Lookup
        let locationName = 'Unknown Location';
        let finalLat = latitude ? String(latitude) : null;
        let finalLon = longitude ? String(longitude) : null;

        try {
            if (ip && ip !== '127.0.0.1' && ip !== '::1') {
                const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,city,regionName,country,lat,lon`);
                const geoData = await geoRes.json();
                if (geoData.status === 'success') {
                    locationName = `${geoData.city}, ${geoData.regionName}`;
                    // FALLBACK: If browser GPS was denied, use IP-based coordinates
                    if (!finalLat) finalLat = String(geoData.lat);
                    if (!finalLon) finalLon = String(geoData.lon);
                }
            }
        } catch (e) {
            logger.warn(`[VERIFY] IP Geolocation failed for ${ip}`);
        }

        try {
            await db.insert(certificateVerifications).values({
                request_id: certData.request_id,
                ip_address: ip,
                user_agent: userAgent,
                device_name: deviceName,
                location_name: locationName,
                latitude: finalLat,
                longitude: finalLon
            });
            logger.info(`[VERIFY] Logged scan for Request ID: ${certData.request_id}`);
        } catch (dbErr) {
            logger.error("[VERIFY] Logging to table failed:", dbErr.message);
        }

        // 4. Return success details to the frontend
        return apiResponse({
            valid: true,
        details: {
            name: certData.name,
            roll_no: certData.roll_no,
            cert_id: certData.generated_certificate_id,
            issue_date: (certData.completed_at && !isNaN(new Date(certData.completed_at).getTime())) 
                ? new Date(certData.completed_at).toLocaleDateString('en-GB') 
                : 'N/A',
            cert_type: certData.certificate_type,
            type: certData.certificate_type
            }
        });

    } catch (error) {
        console.error("DEBUG_VERIFY_ERROR:", error);
        logger.error("Critical Verification Error:", error);
        return apiError("Internal Server Error", 500, { valid: false });
    }
}
