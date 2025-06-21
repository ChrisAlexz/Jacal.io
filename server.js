// Add these lines to the TOP of your server.js file, right after the imports

const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// ====== ADD THESE LINES TO FIX HTTP 431 ERROR ======

// Increase header size limits to prevent 431 errors
app.use((req, res, next) => {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
});

// Increase limits to prevent 431 Request Header Fields Too Large
app.use(express.json({ 
  limit: '2mb',
  parameterLimit: 20000,
  extended: true
}));

app.use(express.urlencoded({ 
  limit: '2mb', 
  extended: true,
  parameterLimit: 20000
}));

// CORS with increased header limits
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 200
}));
const resend = new Resend(process.env.RESEND_API_KEY);

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
    resendConfigured: !!process.env.RESEND_API_KEY,
    fromEmail: process.env.FROM_EMAIL || 'not configured',
    port: port
  });
});

// Send email endpoint with enhanced debugging
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, html, type = 'confirmation' } = req.body;

    console.log('📧 === EMAIL REQUEST DEBUG ===');
    console.log('📧 To:', to);
    console.log('📧 Subject:', subject);
    console.log('📧 Type:', type);
    console.log('📧 From Email Config:', process.env.FROM_EMAIL);
    console.log('📧 From Name Config:', process.env.FROM_NAME);

    // Validation
    if (!to || !subject || !html) {
      console.log('❌ Validation failed - missing fields');
      return res.status(400).json({ 
        error: 'Missing required fields: to, subject, html' 
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      console.log('❌ Invalid email format:', to);
      return res.status(400).json({ 
        error: 'Invalid email address' 
      });
    }

    console.log(`📧 Sending ${type} email to: ${to}`);
    console.log(`📧 Subject: ${subject}`);

    // Prepare email data
    const emailData = {
      from: 'Jacal Learning Platform <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      html: html,
      text: `Please enable HTML to view this email properly. Visit: ${process.env.WEBSITE_URL || 'https://jacal.io'}`
    };

    console.log('📧 Email payload:', JSON.stringify(emailData, null, 2));

    // Send email using Resend
    console.log('📧 Calling Resend API...');
    const result = await resend.emails.send(emailData);

    console.log('📧 Resend API Response:', JSON.stringify(result, null, 2));

    if (result.error) {
      console.error('❌ Resend API returned error:', result.error);
      return res.status(400).json({
        error: 'Email service error',
        details: result.error.message || result.error,
        type: 'resend_error'
      });
    }

    console.log('✅ Email sent successfully:', {
      id: result.data?.id || result.id,
      to: to,
      type: type
    });

    res.json({
      success: true,
      messageId: result.data?.id || result.id,
      to: to,
      type: type,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ FULL ERROR DETAILS:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    
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
      details: error.message,
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
  console.log(`📧 Resend API configured: ${!!process.env.RESEND_API_KEY ? '✅' : '❌'}`);
  console.log(`📧 From Email: ${process.env.FROM_EMAIL || 'NOT SET'}`);
  console.log(`📧 From Name: ${process.env.FROM_NAME || 'NOT SET'}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️  RESEND_API_KEY not found in environment');
  }
});

module.exports = app;