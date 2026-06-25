import EmailProvider from './EmailProvider';
import { getBreaker } from '@/lib/utils/CircuitBreaker';

export default class BrevoEmailProvider extends EmailProvider {
  constructor(apiKey, senderEmail) {
    super();
    this.apiKey = apiKey;
    this.senderEmail = senderEmail;
    this.breaker = getBreaker('BrevoEmail');
  }

  async send({ to, subject, html, text }) {
    return await this.breaker.execute(async () => {
      if (!this.apiKey || !this.senderEmail) {
        console.error('[EMAIL_ERROR] Brevo API key or Sender Email missing.');
        return { success: false, message: 'Email service not configured.' };
      }

      try {
        const payload = {
          sender: { email: this.senderEmail, name: 'KUCET College Portal' },
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text || undefined
        };

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'api-key': this.apiKey,
            'content-type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
          console.info('[EMAIL_SUCCESS] Message sent via Brevo API.');
          return { success: true, message: 'Email sent successfully.' };
        } else {
          console.error('[EMAIL_FAILURE] Brevo API error:', data);
          return { success: false, message: data.message || 'Failed to send email via Brevo.' };
        }
      } catch (error) {
        console.error('[EMAIL_EXCEPTION] Error calling Brevo API:', error);
        return { success: false, message: 'Internal error connecting to email service.' };
      }
    });
  }
}
