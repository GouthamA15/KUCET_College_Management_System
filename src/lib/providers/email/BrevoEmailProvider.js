import EmailProvider from './EmailProvider';
import { getBreaker } from '@/lib/utils/CircuitBreaker';
import { resolveBrevoCategoryConfig, isValidEmailCategory } from '@/lib/email-categories';
import logger from '@/lib/logger';

function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return 'unknown';
  const [local, domain] = email.split('@');
  const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
  return `${visible}***@${domain}`;
}

export default class BrevoEmailProvider extends EmailProvider {
  constructor(defaultApiKey, senderEmail, senderName) {
    super();
    this.defaultApiKey = defaultApiKey;
    this.senderEmail = senderEmail || process.env.EMAIL_USER;
    this.senderName = senderName || 'KUCET College Portal';
  }

  /**
   * Send an email through Brevo using category-based API key and sender identity resolution.
   *
   * @param {Object} options
   * @param {string} options.to - Recipient email address
   * @param {string} options.subject - Email subject line
   * @param {string} options.html - HTML body
   * @param {string} [options.text] - Plain text body fallback
   * @param {string} [options.category] - Explicit email category from EMAIL_CATEGORIES
   * @param {string} [options.replyTo] - Optional override for reply-to address
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async send({ to, subject, html, text, category, replyTo }) {
    let resolvedApiKey;
    let senderEmail;
    let senderName;
    let resolvedReplyTo;
    let categoryName;
    let breakerName;

    try {
      if (category) {
        if (!isValidEmailCategory(category)) {
          return { success: false, message: `Invalid email category: ${category}` };
        }
        const config = resolveBrevoCategoryConfig(category);
        resolvedApiKey = config.apiKey;
        senderEmail = config.senderEmail;
        senderName = config.senderName;
        resolvedReplyTo = replyTo || config.replyToEmail;
        categoryName = category;
        breakerName = `BrevoEmail_${category}`;
      } else {
        // Fallback for uncategorized legacy calls (e.g. untouched Cloudinary alert)
        resolvedApiKey = this.defaultApiKey || process.env.BREVO_API_KEY;
        categoryName = 'UNCATEGORIZED';
        breakerName = 'BrevoEmail';
        senderEmail = this.senderEmail || process.env.EMAIL_USER;
        senderName = this.senderName || 'KUCET College Portal';
        resolvedReplyTo = replyTo;

        if (!resolvedApiKey) {
          logger.error('[EMAIL_ERROR] No category specified and default/legacy BREVO_API_KEY is missing.');
          return { success: false, message: 'Email service not configured.' };
        }
        if (!senderEmail) {
          logger.error({ category: categoryName }, '[EMAIL_ERROR] Sender email (EMAIL_USER) missing.');
          return { success: false, message: 'Sender email not configured.' };
        }
      }
    } catch (configError) {
      logger.error({ category, error: configError.message }, '[EMAIL_CONFIG_ERROR]');
      return { success: false, message: configError.message };
    }

    const breaker = getBreaker(breakerName);

    return await breaker.execute(async () => {
      try {
        const payload = {
          sender: { email: senderEmail, name: senderName },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text || undefined
        };

        if (resolvedReplyTo) {
          payload.replyTo = { email: resolvedReplyTo };
        }

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'api-key': resolvedApiKey,
            'content-type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok) {
          logger.info(
            { category: categoryName, to: maskEmail(to), sender: maskEmail(senderEmail), subject },
            '[EMAIL_SUCCESS] Message sent via Brevo API'
          );
          return { success: true, message: 'Email sent successfully.' };
        } else {
          logger.error(
            { category: categoryName, to: maskEmail(to), sender: maskEmail(senderEmail), status: response.status, data },
            '[EMAIL_FAILURE] Brevo API error'
          );
          return { success: false, message: data.message || 'Failed to send email via Brevo.' };
        }
      } catch (error) {
        logger.error(
          { category: categoryName, to: maskEmail(to), sender: maskEmail(senderEmail), error: error.message },
          '[EMAIL_EXCEPTION] Error calling Brevo API'
        );
        return { success: false, message: 'Internal error connecting to email service.' };
      }
    });
  }
}
