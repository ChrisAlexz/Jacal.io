// server.js - Modified to use Hostinger SMTP instead of Resend
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer'); // NEW: Replace Resend with nodemailer
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// ====== KEEP YOUR EXISTING HTTP 431 ERROR FIX ======
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

// NEW: Create Hostinger SMTP transporter instead of Resend
const createHostingerTransporter = () => {
  return nodemailer.createTransporter({
    host: 'smtp.hostinger.com',
    port: 587,
    secure: false, // true for 465, false for other ports (587)
    auth: {
      user: process.env.HOSTINGER_EMAIL_USER || process.env.REACT_APP_FROM_EMAIL,
      pass: process.env.HOSTINGER_EMAIL_PASSWORD || process.env.HOSTINGER_PASSWORD
    },
    tls: {
      ciphers: 'SSLv3',
      rejectUnauthorized: false
    }
  });
};

// Health check endpoint - UPDATED for Hostinger
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Jacal Email Service with Hostinger SMTP', 
    timestamp: new Date().toISOString(),
    hostingerConfigured: !!(process.env.HOSTINGER_EMAIL_USER && process.env.HOSTINGER_EMAIL_PASSWORD),
    fromEmail: process.env.HOSTINGER_EMAIL_USER || process.env.REACT_APP_FROM_EMAIL || 'not configured',
    port: port
  });
});

// Send email endpoint - UPDATED to use Hostinger SMTP
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, html, type = 'confirmation' } = req.body;

    console.log('📧 === HOSTINGER EMAIL REQUEST DEBUG ===');
    console.log('📧 To:', to);
    console.log('📧 Subject:', subject);
    console.log('📧 Type:', type);
    console.log('📧 SMTP User:', process.env.HOSTINGER_EMAIL_USER || process.env.REACT_APP_FROM_EMAIL);
    console.log('📧 From Name Config:', process.env.FROM_NAME || process.env.REACT_APP_FROM_NAME);

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

    console.log(`📧 Sending ${type} email to: ${to} via Hostinger SMTP`);
    console.log(`📧 Subject: ${subject}`);

    // NEW: Create Hostinger transporter
    const transporter = createHostingerTransporter();

    // NEW: Verify SMTP connection
    try {
      await transporter.verify();
      console.log('✅ Hostinger SMTP connection verified');
    } catch (verifyError) {
      console.error('❌ SMTP connection verification failed:', verifyError);
      return res.status(500).json({
        error: 'SMTP server connection failed',
        details: verifyError.message,
        type: 'smtp_connection_error'
      });
    }

    // NEW: Prepare email data for Hostinger
    const fromEmail = process.env.HOSTINGER_EMAIL_USER || process.env.REACT_APP_FROM_EMAIL || 'support@jacal.io';
    const fromName = process.env.FROM_NAME || process.env.REACT_APP_FROM_NAME || 'Jacal Learning Platform';

    const emailData = {
      from: {
        name: fromName,
        address: fromEmail
      },
      to: to,
      subject: subject,
      html: html,
      text: `Please enable HTML to view this email properly. Visit: ${process.env.WEBSITE_URL || 'https://jacal.io'}`,
      headers: {
        'X-Mailer': 'Jacal-Hostinger-v1.0',
        'X-Email-Type': type
      }
    };

    console.log('📧 Email payload for Hostinger:', JSON.stringify(emailData, null, 2));

    // NEW: Send email using Hostinger SMTP
    console.log('📧 Sending via Hostinger SMTP...');
    const result = await transporter.sendMail(emailData);

    console.log('📧 Hostinger SMTP Response:', JSON.stringify(result, null, 2));

    console.log('✅ Email sent successfully via Hostinger:', {
      messageId: result.messageId,
      to: to,
      type: type,
      response: result.response
    });

    res.json({
      success: true,
      messageId: result.messageId,
      to: to,
      type: type,
      provider: 'hostinger-smtp',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ HOSTINGER SMTP ERROR DETAILS:', error);
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error stack:', error.stack);
    
    // Handle specific SMTP errors
    let errorMessage = 'Failed to send email';
    let statusCode = 500;
    let errorType = 'server_error';

    if (error.code === 'EAUTH') {
      errorMessage = 'SMTP authentication failed. Check Hostinger email credentials.';
      statusCode = 401;
      errorType = 'smtp_auth_error';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Could not connect to Hostinger SMTP server';
      statusCode = 503;
      errorType = 'smtp_connection_error';
    } else if (error.code === 'EMESSAGE') {
      errorMessage = 'Invalid email message format';
      statusCode = 400;
      errorType = 'smtp_message_error';
    } else if (error.responseCode === 550) {
      errorMessage = 'Email rejected by recipient server';
      statusCode = 400;
      errorType = 'smtp_rejection_error';
    }

    res.status(statusCode).json({
      error: errorMessage,
      details: error.message,
      type: errorType,
      code: error.code
    });
  }
});

// NEW: Test SMTP connection endpoint
app.get('/api/email/test', async (req, res) => {
  try {
    const transporter = createHostingerTransporter();
    await transporter.verify();
    
    res.json({
      success: true,
      message: 'Hostinger SMTP connection successful',
      config: {
        host: 'smtp.hostinger.com',
        port: 587,
        user: process.env.HOSTINGER_EMAIL_USER || process.env.REACT_APP_FROM_EMAIL
      }
    });
  } catch (error) {
    console.error('SMTP test failed:', error);
    res.status(500).json({
      success: false,
      error: 'SMTP connection failed',
      details: error.message,
      code: error.code
    });
  }
});

// NEW: Send test email endpoint
app.post('/api/email/send-test', async (req, res) => {
  try {
    const { to } = req.body;
    
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({
        error: 'Valid recipient email address required'
      });
    }

    const transporter = createHostingerTransporter();
    
    const testMailOptions = {
      from: {
        name: 'Jacal Test',
        address: process.env.HOSTINGER_EMAIL_USER || process.env.REACT_APP_FROM_EMAIL
      },
      to: to,
      subject: '✅ Jacal Hostinger SMTP Test Email',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #4facfe;">🧠 Jacal Hostinger SMTP Test</h2>
          <p>This is a test email from the Jacal learning platform using Hostinger SMTP.</p>
          <p><strong>SMTP Configuration:</strong></p>
          <ul>
            <li>Provider: Hostinger</li>
            <li>Server: smtp.hostinger.com</li>
            <li>Port: 587 (TLS)</li>
            <li>User: ${process.env.HOSTINGER_EMAIL_USER || process.env.REACT_APP_FROM_EMAIL}</li>
            <li>Sent at: ${new Date().toISOString()}</li>
          </ul>
          <p>If you received this email, your Hostinger SMTP configuration is working correctly! 🎉</p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
          <p style="font-size: 12px; color: #666;">
            This is an automated test email from Jacal Learning Platform.
          </p>
        </div>
      `,
      text: 'Jacal Hostinger SMTP Test - If you received this email, your configuration is working correctly!'
    };

    const info = await transporter.sendMail(testMailOptions);
    
    res.json({
      success: true,
      messageId: info.messageId,
      message: 'Test email sent successfully via Hostinger SMTP'
    });

  } catch (error) {
    console.error('Test email failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test email',
      details: error.message,
      code: error.code
    });
  }
});

// Error handling middleware - KEEP YOUR EXISTING ONE
app.use((error, req, res, next) => {
  console.error('❌ Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler - UPDATED
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available: [
      'GET /api/health',
      'POST /api/send-email',
      'GET /api/email/test',
      'POST /api/email/send-test'
    ]
  });
});

// Start server - UPDATED logs
app.listen(port, () => {
  console.log(`🚀 Jacal Email Server running on port ${port}`);
  console.log(`📧 Email Provider: Hostinger SMTP`);
  console.log(`📧 SMTP Host: smtp.hostinger.com`);
  console.log(`📧 SMTP Port: 587 (TLS)`);
  console.log(`📧 SMTP User: ${process.env.HOSTINGER_EMAIL_USER || process.env.REACT_APP_FROM_EMAIL || 'NOT SET'}`);
  console.log(`📧 SMTP Password: ${process.env.HOSTINGER_EMAIL_PASSWORD || process.env.HOSTINGER_PASSWORD ? '✅ Configured' : '❌ NOT SET'}`);
  console.log(`📧 From Name: ${process.env.FROM_NAME || process.env.REACT_APP_FROM_NAME || 'NOT SET'}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  
  if (!process.env.HOSTINGER_EMAIL_USER && !process.env.REACT_APP_FROM_EMAIL) {
    console.warn('⚠️  HOSTINGER_EMAIL_USER not found in environment');
  }
  if (!process.env.HOSTINGER_EMAIL_PASSWORD && !process.env.HOSTINGER_PASSWORD) {
    console.warn('⚠️  HOSTINGER_EMAIL_PASSWORD not found in environment');
  }
});

module.exports = app;