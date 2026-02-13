import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 20000, // 20 seconds
  greetingTimeout: 20000,
  socketTimeout: 30000,
});

// Default images to attach as CID so they render inside email clients reliably.
const defaultCidImages = [
  { filename: 'ku-college-logo.png', cid: 'ku_logo@kucet', relPath: ['public', 'assets', 'ku-college-logo.png'] },
  { filename: 'college-campus.jpg', cid: 'campus@kucet', relPath: ['public', 'assets', 'college-campus.jpg'] },
  { filename: 'kakatiya-kala-thoranam.png', cid: 'thoranam@kucet', relPath: ['public', 'assets', 'kakatiya-kala-thoranam.png'] },
];

export const sendEmail = async (to, subject, html) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('Email credentials not set in environment variables.');
    return { success: false, message: 'Email service not configured.' };
  }

  // Build attachments list by checking files exist
  const attachments = [];
  for (const img of defaultCidImages) {
    try {
      const imgPath = path.join(process.cwd(), ...img.relPath);
      if (fs.existsSync(imgPath)) {
        attachments.push({ filename: img.filename, path: imgPath, cid: img.cid });
      }
    } catch (err) {
      // ignore missing images; continue without failing
      console.warn(`CID image not attached: ${img.filename}`, err);
    }
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    html,
    attachments: attachments.length ? attachments : undefined,
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true, message: 'Email sent successfully.' };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, message: 'Failed to send email.' };
  }
};
