import logger from '@/lib/logger';
import { db } from '@/db';
import { studentRequests, students, certificateVerifications } from '@/db/schema';
import { eq, _and, asc } from 'drizzle-orm';
import { apiError, apiResponse } from '@/lib/api-utils';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request) {
    try {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
        
        // 0. RATE LIMITING (5 requests per minute per IP)
        const rl = await checkRateLimit(`verify_cert_${ip}`, 5, 60);
        if (!rl.success) {
            logger.warn(`[VERIFY_BLOCKED] Rate limit exceeded for IP: ${ip}`);
            return apiResponse({ valid: false, message: "Too many attempts. Please try again later." }, 429);
        }

        const body = await request.json();
        
        // Normalize inputs
        const certId = body.certId?.trim()?.toUpperCase() || null;
        const rollNo = body.rollNo?.trim()?.toUpperCase() || null;

        if (!certId || !rollNo) {
            return apiResponse({ valid: false, message: "Missing params" }, 400);
        }

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
            return apiResponse({ valid: false });
        }
        
        if (certData.status !== 'APPROVED') {
            logger.info(`[VERIFY_FAIL] Record found but status is ${certData.status}. ID: "${certId}"`);
            return apiResponse({ valid: false });
        }

        // 3. LOG THE VERIFICATION 
        const userAgent = request.headers.get('user-agent') || 'Unknown Device';
        const deviceName = body.deviceName || null;
        const latitude = body.latitude || null;
        const longitude = body.longitude || null;

        // IP-based Location Lookup (Multi-tier Fail-over)
        let locationName = 'Unknown Location';
        let finalLat = latitude ? String(latitude) : null;
        let finalLon = longitude ? String(longitude) : null;

        /**
         * Multi-tier Geolocation Strategy:
         * 1. Primary: ipapi.co (HTTPS, 1000/day limit)
         * 2. Fallback: ip-api.com (HTTP, 45/min limit)
         * 3. Silence: If all fail, use 'Unknown Location' and don't crash.
         */
        const fetchGeoData = async (clientIp) => {
            if (!clientIp || clientIp === '127.0.0.1' || clientIp === '::1') return null;

            try {
                // Tier 1: Primary (HTTPS)
                const res = await fetch(`https://ipapi.co/${clientIp}/json/`, { timeout: 3000 });
                const data = await res.json();
                if (!data.error) return {
                    location: `${data.city}, ${data.region}`,
                    lat: String(data.latitude),
                    lon: String(data.longitude)
                };
            } catch (e1) {
                logger.warn(`[GEOLOCATION_T1_FAIL] ${clientIp}: ${e1.message}`);
                try {
                    // Tier 2: Fallback (HTTP)
                    const res2 = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,city,regionName,lat,lon`, { timeout: 3000 });
                    const data2 = await res2.json();
                    if (data2.status === 'success') return {
                        location: `${data2.city}, ${data2.regionName}`,
                        lat: String(data2.lat),
                        lon: String(data2.lon)
                    };
                } catch (e2) {
                    logger.warn(`[GEOLOCATION_T2_FAIL] ${clientIp}: ${e2.message}`);
                }
            }
            return null;
        };

        try {
            const geo = await fetchGeoData(ip);
            if (geo) {
                locationName = geo.location;
                if (!finalLat) finalLat = geo.lat;
                if (!finalLon) finalLon = geo.lon;
            }
        } catch (globalGeoErr) {
            // Absolute silence on geolocation crash to prevent app failure
            logger.error("[GEOLOCATION_CRITICAL_ERROR]", globalGeoErr.message);
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
        logger.error("Critical Verification Error:", error);
        return apiError("Internal Server Error", 500, { valid: false });
    }
}
