// server.js - SIMPLE: Just send emails, keep everything else the same
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Hostinger SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 587,
    secure: false, // STARTTLS on 587
    requireTLS: true,
    auth: {
      user: process.env.HOSTINGER_EMAIL_USER,
      pass: process.env.HOSTINGER_EMAIL_PASSWORD
    }
  });
};

// Require a server-side shared secret so this arbitrary-HTML relay cannot be
// abused as an open mail relay for phishing/spam.
const requireInternalSecret = (req, res, next) => {
  const expected = process.env.INTERNAL_EMAIL_SECRET;
  const provided = req.headers['x-internal-secret'];
  if (!expected || provided !== expected) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    service: 'Simple Email Service',
    smtp: !!process.env.HOSTINGER_EMAIL_PASSWORD
  });
});

// Send email - ONLY endpoint you need
app.post('/api/send-email', requireInternalSecret, async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const transporter = createTransporter();
    
    const result = await transporter.sendMail({
      from: `"Jacal" <${process.env.HOSTINGER_EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html
    });

    res.json({ success: true, messageId: result.messageId });

  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.listen(port, () => {
  console.log(`📧 Simple email server running on port ${port}`);
  console.log(`SMTP configured: ${!!process.env.HOSTINGER_EMAIL_PASSWORD}`);
});

module.exports = app;