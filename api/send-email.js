import nodemailer from 'nodemailer';
import { applyCors, safeEqual } from './_lib/security.js';

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // This is a generic send-arbitrary-HTML relay. Left open it lets anyone send
  // mail from our domain (phishing/spam). Require a server-side shared secret so
  // it can only be invoked by trusted backend callers, never directly from a browser.
  const expected = process.env.INTERNAL_EMAIL_SECRET;
  const provided = req.headers['x-internal-secret'];
  if (!expected || !safeEqual(String(provided || ''), expected)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.hostinger.com',
      port: 587,
      secure: false, // STARTTLS on 587
      requireTLS: true,
      auth: {
        user: process.env.HOSTINGER_EMAIL_USER,
        pass: process.env.HOSTINGER_EMAIL_PASSWORD
      }
    });

    const mailOptions = {
      from: `"Jacal Learning Platform" <${process.env.HOSTINGER_EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html
    };

    const result = await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      messageId: result.messageId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Email send error:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
