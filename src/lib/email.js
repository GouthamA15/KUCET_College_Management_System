export const sendEmail = async (to, subject, html) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.EMAIL_USER;

  if (!apiKey || !senderEmail) {
    console.error('[EMAIL_ERROR] Brevo API key or Sender Email missing in environment.');
    return { success: false, message: 'Email service not configured.' };
  }

  // Brevo API uses standard HTTPS (Port 443), so it is never blocked by Render.
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: "KUCET College Portal" },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html
      })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('[EMAIL_SUCCESS] Message sent via Brevo API.');
      return { success: true, message: 'Email sent successfully.' };
    } else {
      console.error('[EMAIL_FAILURE] Brevo API error:', data);
      return { success: false, message: data.message || 'Failed to send email via Brevo.' };
    }
  } catch (error) {
    console.error('[EMAIL_EXCEPTION] Error calling Brevo API:', error);
    return { success: false, message: 'Internal error connecting to email service.' };
  }
};
