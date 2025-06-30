// server.js - SIMPLE: Just send emails, no queue BS
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Basic middleware
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Simple Hostinger SMTP setup
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: 'smtp.hostinger.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.HOSTINGER_EMAIL_USER || process.env.REACT_APP_FROM_EMAIL,
      pass: process.env.HOSTINGER_EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    },
    requireTLS: true
  });
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    service: 'Simple Email Service - NO QUEUE',
    user: process.env.HOSTINGER_EMAIL_USER || 'not set',
    hasPassword: !!process.env.HOSTINGER_EMAIL_PASSWORD
  });
});

// Send email - SIMPLE AND DIRECT
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Jacal Learning Platform" <${process.env.HOSTINGER_EMAIL_USER || process.env.REACT_APP_FROM_EMAIL}>`,
      to: to,
      subject: subject,
      html: html
    };

    const result = await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      messageId: result.messageId,
      to: to,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to send email',
      details: error.message
    });
  }
});

// Test endpoint
app.post('/api/email/send-test', async (req, res) => {
  try {
    const { to } = req.body;
    
    if (!to) {
      return res.status(400).json({ error: 'Email address required' });
    }

    const transporter = createTransporter();
    
    const result = await transporter.sendMail({
      from: `"Jacal Test" <${process.env.HOSTINGER_EMAIL_USER}>`,
      to: to,
      subject: 'Test Email',
      html: '<h1>Test successful!</h1><p>Your Hostinger SMTP is working.</p>'
    });

    res.json({
      success: true,
      messageId: result.messageId
    });

  } catch (error) {
    res.status(500).json({
      error: 'Test failed',
      details: error.message
    });
  }
});

// SMTP connection test
app.get('/api/email/test', async (req, res) => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    res.json({ success: true, message: 'SMTP connection works' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`SMTP User: ${process.env.HOSTINGER_EMAIL_USER || 'NOT SET'}`);
  console.log(`SMTP Pass: ${process.env.HOSTINGER_EMAIL_PASSWORD ? 'SET' : 'NOT SET'}`);
});

module.exports = app;