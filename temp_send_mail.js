import { sendEmail } from './src/lib/email.js';

const recipient = 'sunnysunnit@gmail.com';
const subject = 'Test Email from Gemini CLI';
const htmlContent = `
  <h1>Hello from Gemini CLI!</h1>
  <p>This is a test email sent from the KUCET College Management System.</p>
  <p>If you received this, the email functionality is working correctly.</p>
`;

sendEmail(recipient, subject, htmlContent)
  .then(response => {
    if (response.success) {
      console.log('Email sent successfully:', response.message);
    } else {
      console.error('Failed to send email:', response.message);
    }
  })
  .catch(error => {
    console.error('An unexpected error occurred:', error);
  });
