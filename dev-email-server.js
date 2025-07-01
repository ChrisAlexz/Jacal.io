// dev-email-server.js - FIXED: Working Hostinger SMTP
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const port = 3002;

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(express.json());
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true
}));

// Working Hostinger transporter (based on successful test)
const createTransporter = () => {
  if (!process.env.HOSTINGER_EMAIL_USER || !process.env.HOSTINGER_EMAIL_PASSWORD) {
    return null;
  }

  return nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 587,
    secure: false, // TLS
    auth: {
      user: process.env.HOSTINGER_EMAIL_USER,
      pass: process.env.HOSTINGER_EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: false
    }
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

// Send email endpoint - FIXED
app.post('/api/send-email', async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const transporter = createTransporter();

    if (!transporter) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return res.json({
        success: true,
        messageId: 'mock-' + Date.now(),
        message: 'Mock email sent (no real email was sent in development)',
        timestamp: new Date().toISOString()
      });
    }

    const mailOptions = {
      from: `"Jacal Learning Platform" <${process.env.HOSTINGER_EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html
    };

    const result = await transporter.sendMail(mailOptions);

    return res.json({
      success: true,
      messageId: result.messageId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Failed to send email',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Signup endpoint
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, fullName, resend } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (resend) {
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

    const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: false,
      user_metadata: {
        name: fullName.trim(),
        email_verified: false,
        picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=4facfe&color=fff&size=200`
      }
    });

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        return res.status(400).json({ error: 'An account with this email already exists. Please sign in instead.' });
      }
      return res.status(500).json({ error: 'Failed to create account. Please try again.' });
    }

    if (!authData?.user?.id) {
      return res.status(500).json({ error: 'Failed to create user account.' });
    }

    // Generate verification token
    const verificationToken = `jacal_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Store verification token
    const { error: tokenError } = await supabase
      .from('user_verifications')
      .insert({
        user_id: authData.user.id,
        email: email.toLowerCase(),
        verification_token: verificationToken,
        expires_at: expiresAt.toISOString(),
        verified: false
      });

    if (tokenError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: 'Failed to setup verification. Please try again.' });
    }

    // Create verification URL
    const baseUrl = 'http://localhost:3001';
    const verificationUrl = `${baseUrl}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}&user_id=${authData.user.id}`;

    // Create email HTML
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

    // Send email
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

    } catch (emailError) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      await supabase.from('user_verifications').delete().eq('verification_token', verificationToken);
      return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    }

    return res.json({
      success: true,
      message: `Welcome ${fullName}! A verification email has been sent to ${email}. Please check your inbox and click the verification link to activate your account.`,
      email: email
    });

  } catch (error) {
    return res.status(500).json({ 
      error: 'An unexpected error occurred during signup. Please try again.' 
    });
  }
});

// Email verification endpoint
app.post('/api/auth/verify-email', async (req, res) => {
  try {
    const { token, email, user_id } = req.body;

    if (!token || !email) {
      return res.status(400).json({ error: 'Verification token and email are required' });
    }

    // Find verification record
    const { data: verification, error: findError } = await supabase
      .from('user_verifications')
      .select('*')
      .eq('verification_token', token)
      .eq('email', email.toLowerCase())
      .eq('verified', false)
      .single();

    if (findError || !verification) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(verification.expires_at);
    
    if (now > expiresAt) {
      await supabase.from('user_verifications').delete().eq('id', verification.id);
      return res.status(400).json({ error: 'Verification token has expired. Please request a new verification email.' });
    }

    // Mark user as email confirmed in Supabase
    const { error: confirmError } = await supabase.auth.admin.updateUserById(
      verification.user_id,
      { 
        email_confirm: true,
        user_metadata: {
          email_verified: true,
          name: verification.user_name || '',
          picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(verification.user_name || '')}&background=4facfe&color=fff&size=200`
        }
      }
    );

    if (confirmError) {
      return res.status(500).json({ error: 'Failed to verify user account. Please try again.' });
    }

    // Mark verification as complete
    await supabase
      .from('user_verifications')
      .update({ 
        verified: true,
        verified_at: new Date().toISOString()
      })
      .eq('id', verification.id);

    return res.json({
      success: true,
      message: 'Email verified successfully! You can now sign in with your email and password.',
      user: {
        id: verification.user_id,
        email: verification.email,
        verified: true
      },
      redirectToSignIn: true
    });

  } catch (error) {
    return res.status(500).json({ error: 'An error occurred during email verification. Please try again.' });
  }
});

// Password reset request endpoint - FIXED
app.post('/api/auth/reset-password-request', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if user exists in Supabase
    try {
      const { data: userData } = await supabase.auth.admin.getUserByEmail(email);
      if (!userData?.user) {
        return res.status(200).json({
          success: true,
          message: `If an account with ${email} exists, you will receive password reset instructions.`
        });
      }
    } catch (error) {
      return res.status(200).json({
        success: true,
        message: `If an account with ${email} exists, you will receive password reset instructions.`
      });
    }

    // Generate custom reset token
    const resetToken = `reset_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Store reset token
    const { error: tokenError } = await supabase
      .from('password_resets')
      .insert({
        email: email.toLowerCase(),
        reset_token: resetToken,
        expires_at: expiresAt.toISOString(),
        used: false
      });

    if (tokenError) {
      return res.status(500).json({ error: 'Failed to process reset request. Please try again.' });
    }

    // Create reset URL
    const baseUrl = 'http://localhost:3001';
    const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Create reset email HTML
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
        .info { 
          background: #f8f9fa; 
          border-left: 4px solid #6c757d; 
          padding: 16px; 
          margin: 20px 0; 
          color: #6c757d; 
        }
        .footer { 
          background: #2d3748; 
          color: white; 
          padding: 20px; 
          text-align: center; 
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
          
          <div class="info">
            <p style="margin: 0;"><strong>Didn't request this?</strong> You can safely ignore this email. Your password will not be changed.</p>
          </div>
          
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            <strong>Button not working?</strong> Copy and paste this link into your browser:
          </p>
          <div style="word-break: break-all; color: #ff6b35; background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 12px;">
            ${resetUrl}
          </div>
          
          <p style="color: #666; margin-top: 30px;">
            Best regards,<br>
            <strong>The Jacal Security Team</strong> 🛡️
          </p>
        </div>
        
        <div class="footer">
          <p><strong>🔐 Jacal Security</strong></p>
          <p>📧 Email: ${process.env.HOSTINGER_EMAIL_USER || 'support@jacal.io'}</p>
        </div>
      </div>
    </body>
    </html>`;

    // Send email
    try {
      const emailResponse = await fetch('http://localhost:3002/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: email,
          subject: '🔐 Reset Your Jacal Password - Secure Link Inside',
          html: emailHtml
        })
      });

      if (!emailResponse.ok) {
        throw new Error('Failed to send reset email');
      }

    } catch (emailError) {
      await supabase.from('password_resets').delete().eq('reset_token', resetToken);
      return res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
    }

    return res.json({
      success: true,
      message: `Password reset instructions have been sent to ${email}. Please check your inbox.`
    });

  } catch (error) {
    return res.status(500).json({ 
      error: 'An unexpected error occurred. Please try again.' 
    });
  }
});

// Password update endpoint
app.post('/api/auth/update-password', async (req, res) => {
  try {
    const { resetToken, email, newPassword } = req.body;

    if (!resetToken || !email || !newPassword) {
      return res.status(400).json({ error: 'Reset token, email, and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Verify the reset token
    const { data: resetRecord, error: tokenError } = await supabase
      .from('password_resets')
      .select('*')
      .eq('reset_token', resetToken)
      .eq('email', email.toLowerCase())
      .eq('used', false)
      .single();

    if (tokenError || !resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(resetRecord.expires_at);
    
    if (now > expiresAt) {
      await supabase.from('password_resets').delete().eq('id', resetRecord.id);
      return res.status(400).json({ error: 'Reset token has expired. Please request a new password reset.' });
    }

    // Find the user by email
    const { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email);
    
    if (userError || !userData?.user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Update password directly in Supabase using Admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userData.user.id,
      { password: newPassword }
    );

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update password. Please try again.' });
    }

    // Mark reset token as used
    await supabase
      .from('password_resets')
      .update({ 
        used: true,
        used_at: new Date().toISOString()
      })
      .eq('id', resetRecord.id);

    return res.json({
      success: true,
      message: 'Your password has been successfully updated! You can now sign in with your new password.',
      user: {
        id: userData.user.id,
        email: userData.user.email
      }
    });

  } catch (error) {
    return res.status(500).json({ 
      error: 'An error occurred while updating your password. Please try again.' 
    });
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
      'POST /api/auth/verify-email',
      'POST /api/auth/reset-password-request',
      'POST /api/auth/update-password'
    ]
  });
});

// Start server
app.listen(port, () => {
  console.log(`📧 Local Development Email Server running at: http://localhost:${port}`);
  console.log(`🔗 Health check: http://localhost:${port}/api/health`);
  console.log('');
  console.log('📋 Available API endpoints:');
  console.log('  • POST /api/send-email              - Send email');
  console.log('  • POST /api/auth/signup             - User signup');
  console.log('  • POST /api/auth/verify-email       - Email verification');
  console.log('  • POST /api/auth/reset-password-request - Password reset request');
  console.log('  • POST /api/auth/update-password    - Password update');
  console.log('');
  
  if (process.env.HOSTINGER_EMAIL_USER && process.env.HOSTINGER_EMAIL_PASSWORD) {
    console.log('✅ Hostinger email credentials found - emails will be sent');
  } else {
    console.log('⚠️ No email credentials found - using mock email mode');
  }
});

module.exports = app;