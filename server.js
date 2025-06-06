// server.js - Email server for Jacal using Resend
const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Initialize Resend with your API key
const resend = new Resend(process.env.REACT_APP_RESEND_API_KEY);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Jacal Email Service', 
    timestamp: new Date().toISOString(),
    resendConfigured: !!process.env.REACT_APP_RESEND_API_KEY
  });
});

// Send email endpoint
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, html, type = 'confirmation' } = req.body;

    // Validation
    if (!to || !subject || !html) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, subject, html' 
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ 
        error: 'Invalid email address' 
      });
    }

    console.log(`📧 Sending ${type} email to: ${to}`);
    console.log(`📧 Subject: ${subject}`);

    // Send email using Resend
    const result = await resend.emails.send({
      from: `${process.env.REACT_APP_FROM_NAME || 'Jacal'} <${process.env.REACT_APP_FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to: [to],
      subject: subject,
      html: html,
      text: `Please enable HTML to view this email properly. Visit: ${process.env.REACT_APP_WEBSITE_URL || 'https://jacal.io'}`
    });

    console.log('✅ Email sent successfully:', {
      id: result.data?.id,
      to: to,
      type: type
    });

    res.json({
      success: true,
      messageId: result.data?.id,
      to: to,
      type: type,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error sending email:', error);
    
    // Handle specific Resend errors
    if (error.name === 'ResendError') {
      return res.status(400).json({
        error: 'Email service error',
        details: error.message,
        type: 'resend_error'
      });
    }

    // Handle rate limiting
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again later.',
        type: 'rate_limit'
      });
    }

    // Generic error response
    res.status(500).json({
      error: 'Failed to send email',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      type: 'server_error'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available: [
      'GET /api/health',
      'POST /api/send-email'
    ]
  });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Jacal Email Server running on port ${port}`);
  console.log(`📧 Resend API configured: ${!!process.env.REACT_APP_RESEND_API_KEY ? '✅' : '❌'}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  if (!process.env.REACT_APP_RESEND_API_KEY) {
    console.warn('⚠️  REACT_APP_RESEND_API_KEY not found in environment');
  }
});

module.exports = app;