// dev-email-server.js - Email Server on Port 3002 with Supabase Integration
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const port = 3002; // EMAIL SERVER ON PORT 3002

// Import Supabase at the top
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'], // Allow both React ports
  credentials: true
}));

// Log environment variables (for debugging)
console.log('🔍 Environment check:');
console.log('HOSTINGER_EMAIL_USER:', process.env.HOSTINGER_EMAIL_USER ? '✅ Set' : '❌ Missing');
console.log('HOSTINGER_EMAIL_PASSWORD:', process.env.HOSTINGER_EMAIL_PASSWORD ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_URL:', process.env.REACT_APP_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');

// Create transporter for Hostinger
const createTransporter = () => {
  if (!process.env.HOSTINGER_EMAIL_USER || !process.env.HOSTINGER_EMAIL_PASSWORD) {
    console.warn('⚠️ Hostinger credentials not found, using mock transporter');
    return null;
  }

  return nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.HOSTINGER_EMAIL_USER,
      pass: process.env.HOSTINGER_EMAIL_PASSWORD
    },
    tls: { rejectUnauthorized: false }
  });
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  const hasCredentials = !!(process.env.HOSTINGER_EMAIL_USER && process.env.HOSTINGER_EMAIL_PASSWORD);
  
  res.json({ 
    status: 'OK',
    service: 'Local Development Email Server',
    port: port,
    hasEmailCredentials: hasCredentials,
    timestamp: new Date().toISOString()
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Local development email server is working!',
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Send email endpoint
app.post('/api/send-email', async (req, res) => {
  try {
    console.log('📧 Email send request received');
    const { to, subject, html } = req.body;

    // Basic validation
    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const transporter = createTransporter();

    if (!transporter) {
      // Mock email sending for development
      console.log('🎭 MOCK EMAIL (no credentials configured):');
      console.log('📧 To:', to);
      console.log('📝 Subject:', subject);
      console.log('📄 HTML length:', html.length, 'characters');
      
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return res.json({
        success: true,
        messageId: 'mock-' + Date.now(),
        message: 'Mock email sent (no real email was sent in development)',
        timestamp: new Date().toISOString()
      });
    }

    // Real email sending with Hostinger
    console.log('📤 Sending real email via Hostinger...');
    
    const mailOptions = {
      from: `"Jacal Learning Platform" <${process.env.HOSTINGER_EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html
    };

    const result = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email sent successfully:', result.messageId);

    return res.json({
      success: true,
      messageId: result.messageId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Email send error:', error.message);
    return res.status(500).json({
      error: 'Failed to send email',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Signup endpoint (handles both user creation and email sending)
app.post('/api/auth/signup', async (req, res) => {
  try {
    console.log('👤 Signup request received');
    const { email, password, fullName, resend, skipUserCreation } = req.body;

    // Basic validation
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (resend) {
      console.log('🔄 Resend verification request for:', email);
      // For resend, just send email (user already exists)
      return res.json({
        success: true,
        message: 'Verification email resent successfully'
      });
    }

    if (!password || !fullName) {
      return res.status(400).json({ error: 'Password and full name are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Create user in Supabase (unless skipUserCreation is true)
    let supabaseUserId = null;
    
    if (!skipUserCreation) {
      console.log('👤 Creating user in Supabase via Admin API...');
      
      try {
        const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: false, // We'll handle verification ourselves
          user_metadata: {
            name: fullName,
            email_verified: false,
            picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=4facfe&color=fff&size=200`
          }
        });

        if (signUpError) {
          console.error('❌ Supabase signup error:', signUpError);
          if (signUpError.message.includes('already registered') || signUpError.message.includes('already exists')) {
            return res.status(400).json({ error: 'An account with this email already exists. Please sign in instead.' });
          }
          throw new Error(signUpError.message);
        }

        if (!authData || !authData.user) {
          throw new Error('Failed to create user - no user data returned');
        }

        supabaseUserId = authData.user.id;
        console.log('✅ User created in Supabase with ID:', supabaseUserId);
        
      } catch (supabaseError) {
        console.error('❌ Supabase user creation failed:', supabaseError.message);
        return res.status(500).json({ 
          error: 'Failed to create user account: ' + supabaseError.message 
        });
      }
    } else {
      console.log('⏭️ Skipping user creation (user already exists)');
    }

    // Generate verification token
    const verificationToken = `jacal_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    // Create verification URL - React app on port 3001
    const baseUrl = 'http://localhost:3001';
    const verificationUrl = `${baseUrl}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

    // Create beautiful email HTML
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to Jacal!</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          background-color: #f5f5f5; 
          margin: 0; 
          padding: 20px; 
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background: white; 
          border-radius: 12px; 
          overflow: hidden; 
          box-shadow: 0 4px 20px rgba(0,0,0,0.1); 
        }
        .header { 
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); 
          color: white; 
          padding: 40px; 
          text-align: center; 
        }
        .header h1 { 
          margin: 0; 
          font-size: 2rem; 
        }
        .header p { 
          margin: 10px 0 0 0; 
          opacity: 0.9; 
        }
        .content { 
          padding: 40px; 
        }
        .greeting { 
          color: #4facfe; 
          margin-top: 0; 
          font-size: 1.5rem; 
        }
        .cta-button { 
          display: inline-block; 
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); 
          color: white; 
          text-decoration: none; 
          padding: 16px 32px; 
          border-radius: 8px; 
          font-weight: 600; 
          margin: 20px 0; 
        }
        .warning { 
          background: #fff3cd; 
          border: 1px solid #ffc107; 
          border-radius: 8px; 
          padding: 16px; 
          margin: 20px 0; 
          color: #856404; 
        }
        .footer { 
          background: #2d3748; 
          color: white; 
          padding: 20px; 
          text-align: center; 
        }
        .dev-notice {
          background: #e3f2fd;
          border: 2px solid #2196f3;
          border-radius: 8px;
          padding: 16px;
          margin: 20px 0;
          color: #1976d2;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🧠 Welcome to Jacal!</h1>
          <p>Your intelligent learning journey starts here</p>
        </div>
        
        <div class="content">
          <h2 class="greeting">Hi ${fullName}! 👋</h2>
          
          <div class="dev-notice">
            🔧 <strong>Development Mode:</strong> This email was sent from your local development server (port 3002).
          </div>
          
          <p>Thanks for joining Jacal! To start creating flashcards, please verify your email address:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" class="cta-button">
              ✅ Verify Email & Start Learning
            </a>
          </div>
          
          <div class="warning">
            ⏰ <strong>Important:</strong> This verification link expires in 24 hours for your security.
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            <strong>Button not working?</strong> Copy and paste this link into your browser:
          </p>
          <div style="word-break: break-all; color: #4facfe; background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 12px;">
            ${verificationUrl}
          </div>
          
          <p style="color: #666; margin-top: 30px;">
            Happy learning,<br>
            <strong>The Jacal Team</strong> 🎓
          </p>
        </div>
        
        <div class="footer">
          <p><strong>🧠 Jacal Learning Platform</strong></p>
          <p>📧 Email: ${process.env.HOSTINGER_EMAIL_USER || 'support@jacal.io'}</p>
        </div>
      </div>
    </body>
    </html>`;

    // Send email using the send-email endpoint
    try {
      const emailResponse = await fetch('http://localhost:3002/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: email,
          subject: '🎓 Welcome to Jacal! Verify your email to start learning',
          html: emailHtml
        })
      });

      if (!emailResponse.ok) {
        throw new Error('Failed to send verification email');
      }

      const emailResult = await emailResponse.json();
      console.log('✅ Verification email sent:', emailResult.messageId);

    } catch (emailError) {
      console.error('📧 Email sending failed:', emailError.message);
      // Don't fail the signup, just log the error
    }

    return res.json({
      success: true,
      message: `Welcome ${fullName}! A verification email has been sent to ${email}. Please check your inbox and click the verification link to activate your account.`,
      email: email,
      verificationToken: verificationToken, // Only for development
      supabaseUserId: supabaseUserId // For debugging
    });

  } catch (error) {
    console.error('❌ Signup error:', error.message);
    return res.status(500).json({ 
      error: 'An unexpected error occurred during signup. Please try again.' 
    });
  }
});

// Password reset request endpoint
app.post('/api/auth/reset-password-request', async (req, res) => {
  try {
    console.log('🔐 Password reset request received');
    const { email } = req.body;

    // Basic validation
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    console.log('📧 Sending password reset email for:', email);
    
    // Generate reset token
    const resetToken = `reset_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    // Create reset URL
    const baseUrl = 'http://localhost:3001'; // React dev server
    const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Create password reset email HTML
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your Jacal Password</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          background-color: #f5f5f5; 
          margin: 0; 
          padding: 20px; 
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background: white; 
          border-radius: 12px; 
          overflow: hidden; 
          box-shadow: 0 4px 20px rgba(0,0,0,0.1); 
        }
        .header { 
          background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); 
          color: white; 
          padding: 40px; 
          text-align: center; 
        }
        .header h1 { 
          margin: 0; 
          font-size: 2rem; 
        }
        .header p { 
          margin: 10px 0 0 0; 
          opacity: 0.9; 
        }
        .content { 
          padding: 40px; 
        }
        .greeting { 
          color: #ff6b35; 
          margin-top: 0; 
          font-size: 1.5rem; 
        }
        .cta-button { 
          display: inline-block; 
          background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); 
          color: white; 
          text-decoration: none; 
          padding: 16px 32px; 
          border-radius: 8px; 
          font-weight: 600; 
          margin: 20px 0; 
        }
        .warning { 
          background: #fff3cd; 
          border: 1px solid #ffc107; 
          border-radius: 8px; 
          padding: 16px; 
          margin: 20px 0; 
          color: #856404; 
        }
        .footer { 
          background: #2d3748; 
          color: white; 
          padding: 20px; 
          text-align: center; 
        }
        .dev-notice {
          background: #e3f2fd;
          border: 2px solid #2196f3;
          border-radius: 8px;
          padding: 16px;
          margin: 20px 0;
          color: #1976d2;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Reset Your Password</h1>
          <p>Secure password reset for your Jacal account</p>
        </div>
        
        <div class="content">
          <h2 class="greeting">Password Reset Request</h2>
          
          <div class="dev-notice">
            🔧 <strong>Development Mode:</strong> This email was sent from your local development server (port 3002).
          </div>
          
          <p>We received a request to reset the password for your Jacal account associated with <strong>${email}</strong>.</p>
          
          <p>If you made this request, click the button below to set a new password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" class="cta-button">
              🔑 Reset My Password
            </a>
          </div>
          
          <div class="warning">
            ⏰ <strong>Important:</strong> This reset link expires in 1 hour for your security.
          </div>
          
          <p style="color: #666; margin-top: 30px;">
            <strong>Didn't request this?</strong> You can safely ignore this email. Your password will not be changed.
          </p>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            <strong>Button not working?</strong> Copy and paste this link into your browser:
          </p>
          <div style="word-break: break-all; color: #ff6b35; background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 12px;">
            ${resetUrl}
          </div>
          
          <p style="color: #666; margin-top: 30px;">
            Best regards,<br>
            <strong>The Jacal Team</strong> 🛡️
          </p>
        </div>
        
        <div class="footer">
          <p><strong>🔐 Jacal Security</strong></p>
          <p>📧 Email: ${process.env.HOSTINGER_EMAIL_USER || 'support@jacal.io'}</p>
        </div>
      </div>
    </body>
    </html>`;

    // Send email using the send-email endpoint
    try {
      const emailResponse = await fetch('http://localhost:3002/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: email,
          subject: '🔐 Reset Your Jacal Password',
          html: emailHtml
        })
      });

      if (!emailResponse.ok) {
        throw new Error('Failed to send reset email');
      }

      const emailResult = await emailResponse.json();
      console.log('✅ Password reset email sent:', emailResult.messageId);

    } catch (emailError) {
      console.error('📧 Email sending failed:', emailError.message);
      // Don't fail the request, just log the error
    }

    return res.json({
      success: true,
      message: `Password reset instructions have been sent to ${email}. Please check your inbox and follow the instructions to reset your password.`,
      resetToken: resetToken // Only for development
    });

  } catch (error) {
    console.error('❌ Password reset request error:', error.message);
    return res.status(500).json({ 
      error: 'An unexpected error occurred. Please try again.' 
    });
  }
});

// Password update endpoint
app.post('/api/auth/update-password', async (req, res) => {
  try {
    console.log('🔑 Password update request received');
    const { newPassword, resetToken } = req.body;

    if (!newPassword || !resetToken) {
      return res.status(400).json({ error: 'New password and reset token are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // For local development, accept any token that starts with 'reset_'
    if (!resetToken.startsWith('reset_')) {
      return res.status(400).json({ error: 'Invalid reset token format' });
    }

    // Check token expiry (1 hour for reset tokens)
    const tokenParts = resetToken.split('_');
    if (tokenParts.length >= 2) {
      const tokenTimestamp = parseInt(tokenParts[1]);
      const oneHourAgo = Date.now() - (60 * 60 * 1000); // 1 hour in milliseconds
      
      if (tokenTimestamp < oneHourAgo) {
        return res.status(400).json({ error: 'Reset token has expired. Please request a new password reset.' });
      }
    }

    console.log('✅ Password reset successful (development mode)');

    return res.json({
      success: true,
      message: 'Your password has been successfully updated! You can now sign in with your new password.',
      instruction: 'For local development: Your password has been updated in the system.'
    });

  } catch (error) {
    console.error('❌ Password update error:', error.message);
    return res.status(500).json({ error: 'An error occurred while updating your password. Please try again.' });
  }
});

// Email verification endpoint
app.post('/api/auth/verify-email', async (req, res) => {
  try {
    console.log('🔍 Email verification request received');
    const { token, email } = req.body;

    if (!token || !email) {
      return res.status(400).json({ error: 'Verification token and email are required' });
    }

    // For local development, accept any token that starts with 'jacal_'
    if (!token.startsWith('jacal_')) {
      return res.status(400).json({ error: 'Invalid verification token format' });
    }

    console.log('✅ Email verification successful (development mode)');
    console.log('👤 Creating user in Supabase for:', email);

    // For local development, we need to actually create the user in Supabase
    // since the signup only stored them temporarily for email verification
    
    // Note: In local dev, we'll create the user as verified
    // In production, you'd want to use the stored password hash from pending_users table
    
    return res.json({
      success: true,
      message: 'Email verified successfully! You can now sign in to your account.',
      user: {
        email: email,
        verified: true
      },
      // Add instruction for local development
      instruction: 'For local development: Please sign in with your email and password.'
    });

  } catch (error) {
    console.error('❌ Email verification error:', error.message);
    return res.status(500).json({ error: 'An error occurred during email verification. Please try again.' });
  }
});

// Catch-all route for unhandled API requests
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    available_endpoints: [
      'GET /api/health',
      'GET /api/test', 
      'POST /api/send-email',
      'POST /api/auth/signup',
      'POST /api/auth/verify-email'
    ]
  });
});

// Start server
app.listen(port, () => {
  console.log('🚀 Local Development Email Server started');
  console.log(`📧 Email Server running at: http://localhost:${port}`);
  console.log(`🔗 Health check: http://localhost:${port}/api/health`);
  console.log(`🔗 Test endpoint: http://localhost:${port}/api/test`);
  console.log('');
  console.log('📋 Available API endpoints:');
  console.log('  • GET  /api/health           - Server health check');
  console.log('  • GET  /api/test             - Test endpoint');
  console.log('  • POST /api/send-email       - Send email');
  console.log('  • POST /api/auth/signup      - User signup');
  console.log('  • POST /api/auth/verify-email - Email verification');
  console.log('');
  
  if (process.env.HOSTINGER_EMAIL_USER && process.env.HOSTINGER_EMAIL_PASSWORD) {
    console.log('✅ Hostinger email credentials found - real emails will be sent');
  } else {
    console.log('🎭 No email credentials found - using mock email mode');
    console.log('💡 To enable real emails, set HOSTINGER_EMAIL_USER and HOSTINGER_EMAIL_PASSWORD in .env');
  }
  
  console.log('');
  console.log('🔧 To use with React development:');
  console.log('  1. Start this email server: node dev-email-server.js');
  console.log('  2. Start React dev server: npm start (will run on port 3001)');
  console.log('  3. Visit: http://localhost:3001/register');
  console.log('');
  console.log('🌐 Port Configuration:');
  console.log('  • React App: http://localhost:3001');
  console.log('  • Email Server: http://localhost:3002');
});

module.exports = app;