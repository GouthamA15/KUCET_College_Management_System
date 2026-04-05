import logger from '@/lib/logger';
import { apiResponse, apiError } from "@/lib/api-utils";
import { v2 as cloudinary } from "cloudinary";
import { sendInstitutionalEmail } from "@/lib/email";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * GET /api/public/system/storage-alert
 * Automated check for Cloudinary storage limits.
 */
export async function GET(request) {
  // Hardcoded list of developer emails
  const developerEmails = [
    "sunnysunnit@gmail.com",
    "testersybau67@gmail.com",
    "uzair.mdf@gmail.com"
  ];

  const ALERT_THRESHOLD_GB = 20;

  try {
    // Fetch Cloudinary Usage
    const usageData = await cloudinary.api.usage();
    const storage = usageData.storage || {};
    
    const usageBytes = storage.usage || 0;
    const limitBytes = storage.limit || (25 * 1024 * 1024 * 1024);
    
    const usageGB = usageBytes / (1024 * 1024 * 1024);
    const limitGB = limitBytes / (1024 * 1024 * 1024);
    const percent = (usageBytes / limitBytes) * 100;

    logger.info(`[STORAGE_CHECK] Current Usage: ${usageGB.toFixed(2)} GB (${percent.toFixed(1)}%)`);

    // Trigger Alert if threshold reached (20GB)
    if (usageGB >= ALERT_THRESHOLD_GB) {
      // Send email to each developer
      const emailPromises = developerEmails.map(email => 
        sendInstitutionalEmail({
          to: email,
          subject: "⚠️ URGENT: Cloudinary Storage Limit Warning",
          title: "Storage Threshold Reached",
          bodyHtml: `
            <p>This is an automated system alert for your Cloudinary storage.</p>
            <p style="color: #b91c1c; font-weight: bold;">Your Cloudinary storage usage has exceeded the ${ALERT_THRESHOLD_GB}GB threshold.</p>
            <p>Current usage is <strong>${usageGB.toFixed(2)} GB</strong> which is <strong>${percent.toFixed(1)}%</strong> of your total limit.</p>
            <p>Please log in to your Cloudinary dashboard to manage your assets or consider upgrading your plan to prevent service interruption.</p>
          `,
          infoRows: [
            { label: "Current Usage", value: `${usageGB.toFixed(2)} GB` },
            { label: "Total Limit", value: `${limitGB.toFixed(2)} GB` },
            { label: "Alert Threshold", value: `${ALERT_THRESHOLD_GB}.00 GB` }
          ],
          action: {
            label: "View Cloudinary Dashboard",
            url: "https://cloudinary.com/console"
          }
        })
      );

      await Promise.all(emailPromises);

      return apiResponse({ 
        alert_sent: true, 
        usage: `${usageGB.toFixed(2)} GB`,
        message: `Storage threshold exceeded. Alert email sent to ${developerEmails.length} developers.`
      });
    }

    return apiResponse({ 
      alert_sent: false, 
      usage: `${usageGB.toFixed(2)} GB`,
      message: `Storage usage is within safe limits (Threshold: ${ALERT_THRESHOLD_GB}GB).` 
    });

  } catch (error) {
    logger.error("[STORAGE_CHECK_ERROR]", error);
    return apiError("Internal Server Error", 500);
  }
}
