import { getAssetUrl } from '@/lib/assets';

// Shared institutional email template generator
// Generates both HTML and plain-text versions for transactional emails.

const PRIMARY_COLOR = '#0b3578';
const BACKGROUND_COLOR = '#f3f4f6';
const TEXT_COLOR = '#111827';
const MUTED_COLOR = '#6b7280';
const BORDER_COLOR = '#e5e7eb';

// Derive base URL from environment for all links
export const getBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!envUrl) {
    console.error('[EMAIL_CONFIG] NEXT_PUBLIC_BASE_URL is not set.');
  }
  return envUrl || '';
};

// Build the unified institutional HTML template
export const buildInstitutionalEmailHtml = ({
  title,
  bodyHtml,
  action,
  infoRows
}) => {
  const baseUrl = getBaseUrl() || 'https://kucet-dev-hp-pro-tower-280-g9-pci-desktop-pc.tailf6b4a7.ts.net';
  const assetPath = getAssetUrl('assets/ku-logo.png');
  const logoUrl = assetPath.startsWith('http') ? assetPath : `${baseUrl.replace(/\/$/, '')}${assetPath}`;
  
  // Build structured information rows if provided
  const infoRowsHtml = Array.isArray(infoRows) && infoRows.length > 0
    ? `
          <tr>
            <td style="padding: 8px 0 4px 0; font-size: 14px; color: ${TEXT_COLOR};">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse: collapse;">
                ${infoRows.map(row => `
                <tr>
                  <td width="40%" style="padding: 4px 0; font-weight: 600; font-size: 14px; color: ${TEXT_COLOR};">${row.label}</td>
                  <td width="60%" style="padding: 4px 0; font-size: 14px; color: ${TEXT_COLOR};">${row.value}</td>
                </tr>`).join('')}
              </table>
            </td>
          </tr>`
    : '';

  // Optional call-to-action button
  const actionHtml = action && action.url && action.label
    ? `
          <tr>
            <td align="center" style="padding: 16px 0 4px 0;">
              <a href="${action.url}"
                 style="background: ${PRIMARY_COLOR}; color: #ffffff; padding: 12px 24px; border-radius: 4px; text-decoration: none; display: inline-block; font-weight: 500; font-size: 14px;">
                ${action.label}
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top: 4px; font-size: 12px; color: ${MUTED_COLOR};">
              This link will expire in ${action.expiresIn || '15 minutes'}.
            </td>
          </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0; padding:0; background:${BACKGROUND_COLOR}; font-family: Arial, sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BACKGROUND_COLOR}; padding:40px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; background:#ffffff; border:1px solid ${BORDER_COLOR}; border-radius:6px;">
            <tr>
              <td style="padding:32px;">
                <!-- Header -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                  <tr>
                    <td align="center" style="padding-bottom: 16px;">
                      <img src="${logoUrl}" alt="KUCET Logo" style="max-height:64px; display:block; margin:0 auto;" />
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size: 14px; font-weight: 700; letter-spacing: 0.06em; color: ${TEXT_COLOR}; text-transform: uppercase;">
                      KAKATIYA UNIVERSITY COLLEGE OF ENGINEERING & TECHNOLOGY
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="font-size: 13px; color: ${MUTED_COLOR}; padding-top: 4px;">
                      Kakatiya University College of Engineering & Technology
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:16px; border-bottom:1px solid ${BORDER_COLOR};"></td>
                  </tr>
                </table>

                <!-- Title -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-top: 24px;">
                  <tr>
                    <td align="center" style="font-size:20px; font-weight:600; color:${PRIMARY_COLOR};">
                      ${title}
                    </td>
                  </tr>
                </table>

                <!-- Body -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-top: 20px;">
                  <tr>
                    <td style="font-size:14px; color:${TEXT_COLOR}; line-height:1.6; text-align:left;">
                      ${bodyHtml}
                    </td>
                  </tr>
                  ${infoRowsHtml}
                  ${actionHtml}
                </table>

                <!-- Security notice & footer -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-top: 24px;">
                  <tr>
                    <td style="border-top:1px solid ${BORDER_COLOR}; padding-top: 16px; font-size:13px; color:${TEXT_COLOR}; line-height:1.6;">
                      If you did not initiate this request, please ignore this email or contact the administration immediately.
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-top: 16px; font-size:12px; color:${MUTED_COLOR}; line-height:1.6;">
                      KUCET College Portal<br />
                      Warangal, Telangana<br />
                      Email: support@kucet.ac.in<br />
                      Website: ${getBaseUrl() || 'https://yourdomain.com'}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
};

// Build plain-text fallback version
export const buildInstitutionalEmailText = ({
  title,
  bodyText,
  action,
  infoRows
}) => {
  const lines = [];
  lines.push('KAKATIYA UNIVERSITY COLLEGE OF ENGINEERING & TECHNOLOGY');
  lines.push('Kakatiya University College of Engineering & Technology');
  lines.push('');
  lines.push(title);
  lines.push('');
  if (bodyText) {
    lines.push(bodyText.trim());
    lines.push('');
  }
  if (Array.isArray(infoRows) && infoRows.length > 0) {
    infoRows.forEach(row => {
      lines.push(`${row.label}: ${row.value}`);
    });
    lines.push('');
  }
  if (action && action.url && action.label) {
    lines.push(`${action.label}: ${action.url}`);
    lines.push(action.expiresNote || 'This link will expire in 15 minutes.');
    lines.push('');
  }
  lines.push('If you did not initiate this request, please ignore this email or contact the administration immediately.');
  lines.push('');
  lines.push('KUCET College Portal');
  lines.push('Warangal, Telangana');
  lines.push('Email: support@kucet.ac.in');
  lines.push(`Website: ${getBaseUrl() || 'https://yourdomain.com'}`);
  return lines.join('\n');
};

// Low-level email sender (Uses configured provider)
export const sendEmail = async (to, subject, html, text) => {
  try {
    const { email } = await import('./providers');
    return await email.send({ to, subject, html, text });
  } catch (error) {
    console.error('[EMAIL_EXCEPTION] Error calling email provider:', error);
    return { success: false, message: 'Internal error connecting to email service.' };
  }
};

// High-level helper for transactional emails using the institutional template
export const sendInstitutionalEmail = async ({
  to,
  subject,
  title,
  bodyHtml,
  bodyText,
  action,
  infoRows
}) => {
  const html = buildInstitutionalEmailHtml({ title, bodyHtml, action, infoRows });
  const text = buildInstitutionalEmailText({ title, bodyText: bodyText || bodyHtml.replace(/<[^>]+>/g, ' '), action, infoRows });
  return sendEmail(to, subject, html, text);
};
