import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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

    const transporter = nodemailer.createTransporter({
      host: 'smtp.hostinger.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.HOSTINGER_EMAIL_USER,
        pass: process.env.HOSTINGER_EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
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
    return res.status(500).json({
      error: 'Failed to send email',
      details: error.message
    });
  }
}