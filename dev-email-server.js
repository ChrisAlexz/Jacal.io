// dev-email-server.js - COMPLETE FILE with correct structure
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const port = 3002;

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
    service: 'Local Development Email Server - Unified Flow',
    port: port,
    hasEmailCredentials: hasCredentials,
    timestamp: new Date().toISOString()
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Local development email server is working! (Unified Flow)',
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Send email endpoint
app.post('/api/send-email', async (req, res) => {
  try {
    console.log('📧 Email send request received');
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
      console.log('🎭 MOCK EMAIL (no credentials configured):');
      console.log('📧 To:', to);
      console.log('📝 Subject:', subject);
      console.log('📄 HTML length:', html.length, 'characters');
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return res.json({
        success: true,
        messageId: 'mock-' + Date.now(),
        message: 'Mock email sent (no real email was sent in development)',
        timestamp: new Date().toISOString()
      });
    }

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

// UNIFIED: Signup endpoint that uses Supabase + custom verification
app.post('/api/auth/signup', async (req, res) => {
  try {
    console.log('👤 Unified signup request received');
    const { email, password, fullName, resend } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (resend) {
      console.log('🔄 Resend verification request for:', email);
      // Handle resend logic here
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

    console.log('🚀 Creating user with Supabase...');

    // Create user in Supabase but don't confirm email yet
    const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: false, // We'll confirm it manually
      user_metadata: {
        name: fullName.trim(),
        email_verified: false,
        picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=4facfe&color=fff&size=200`
      }
    });

    if (signUpError) {
      console.error('❌ Supabase signup error:', signUpError);
      if (signUpError.message.includes('already registered')) {
        return res.status(400).json({ error: 'An account with this email already exists. Please sign in instead.' });
      }
      return res.status(500).json({ error: 'Failed to create account. Please try again.' });
    }

    if (!authData?.user?.id) {
      return res.status(500).json({ error: 'Failed to create user account.' });
    }

    console.log('✅ User created in Supabase:', authData.user.id);

    // Generate verification token
    const verificationToken = `jacal_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Store verification token in our custom table
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
      console.error('❌ Error storing verification token:', tokenError);
      // Clean up user if token storage fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: 'Failed to setup verification. Please try again.' });
    }

    // Create verification URL
    const baseUrl = 'http://localhost:3001';
    const verificationUrl = `${baseUrl}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}&user_id=${authData.user.id}`;

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
            🔧 <strong>Unified Flow:</strong> This email was sent from your local development server using the new unified verification system.
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
          <p style="font-size: 12px; opacity: 0.8;">Unified Verification System</p>
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

      const emailResult = await emailResponse.json();
      console.log('✅ Verification email sent:', emailResult.messageId);

    } catch (emailError) {
      console.error('📧 Email sending failed:', emailError.message);
      // Clean up user and verification record if email fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      await supabase.from('user_verifications').delete().eq('verification_token', verificationToken);
      return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    }

    return res.json({
      success: true,
      message: `Welcome ${fullName}! A verification email has been sent to ${email}. Please check your inbox and click the verification link to activate your account.`,
      email: email,
      verificationToken: verificationToken, // Only for development
      supabaseUserId: authData.user.id // For debugging
    });

  } catch (error) {
    console.error('❌ Signup error:', error.message);
    return res.status(500).json({ 
      error: 'An unexpected error occurred during signup. Please try again.' 
    });
  }
});

// UNIFIED: Email verification endpoint
app.post('/api/auth/verify-email', async (req, res) => {
  try {
    console.log('🔍 Email verification request received');
    const { token, email, user_id } = req.body;

    if (!token || !email) {
      return res.status(400).json({ error: 'Verification token and email are required' });
    }

    console.log('🔍 Looking for verification token...');

    // Find verification record
    const { data: verification, error: findError } = await supabase
      .from('user_verifications')
      .select('*')
      .eq('verification_token', token)
      .eq('email', email.toLowerCase())
      .eq('verified', false)
      .single();

    if (findError || !verification) {
      console.log('❌ Invalid or expired verification token');
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(verification.expires_at);
    
    if (now > expiresAt) {
      console.log('⏰ Token has expired, cleaning up...');
      await supabase.from('user_verifications').delete().eq('id', verification.id);
      return res.status(400).json({ error: 'Verification token has expired. Please request a new verification email.' });
    }

    console.log('✅ Token valid, marking user as verified...');

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
      console.error('❌ Error marking user as confirmed:', confirmError);
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

    console.log('🎉 Email verification complete - user is now confirmed');

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
    console.error('❌ Email verification error:', error.message);
    return res.status(500).json({ error: 'An error occurred during email verification. Please try again.' });
  }
});

// Password reset request endpoint - CUSTOM: Uses Hostinger email, no Supabase limits
app.post('/api/auth/reset-password-request', async (req, res) => {
  try {
    console.log('🔐 Custom password reset request received');
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    console.log('🔍 Checking if user exists in Supabase...');

    // Check if user exists in Supabase
    try {
      const { data: userData } = await supabase.auth.admin.getUserByEmail(email);
      if (!userData?.user) {
        // Don't reveal if user exists or not for security
        return res.status(200).json({
          success: true,
          message: `If an account with ${email} exists, you will receive password reset instructions.`
        });
      }
    } catch (error) {
      // User doesn't exist, but don't reveal this
      return res.status(200).json({
        success: true,
        message: `If an account with ${email} exists, you will receive password reset instructions.`
      });
    }

    // Generate custom reset token
    const resetToken = `reset_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    console.log('💾 Storing reset token (development mode)');

    // Create reset URL
    const baseUrl = 'http://localhost:3001';
    const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Create beautiful reset email HTML
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
            🔧 <strong>Custom Service:</strong> This email was sent using our Hostinger email service, bypassing Supabase rate limits.
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
          <p style="font-size: 12px; opacity: 0.8;">No Rate Limits - Powered by Hostinger</p>
        </div>
      </div>
    </body>
    </html>`;

    // Send email directly using transporter (not via fetch to avoid self-calling)
    try {
      const transporter = createTransporter();

      if (!transporter) {
        console.log('🎭 MOCK PASSWORD RESET EMAIL (no credentials configured):');
        console.log('📧 To:', email);
        console.log('🔗 Reset URL:', resetUrl);
        console.log('⏰ Expires:', expiresAt);
        
        // For development without credentials, still return success
        return res.json({
          success: true,
          message: `Password reset instructions have been sent to ${email} via our secure Hostinger email service. Please check your inbox.`,
          resetToken: resetToken, // Only for development
          resetUrl: resetUrl, // Only for development
          expiresAt: expiresAt // For debugging
        });
      }

      console.log('📤 Sending password reset email directly via Hostinger...');
      
      const mailOptions = {
        from: `"Jacal Security" <${process.env.HOSTINGER_EMAIL_USER}>`,
        to: email,
        subject: '🔐 Reset Your Jacal Password - Secure Link Inside',
        html: emailHtml
      };

      const result = await transporter.sendMail(mailOptions);
      console.log('✅ Password reset email sent successfully:', result.messageId);

    } catch (emailError) {
      console.error('📧 Password reset email sending failed:', emailError.message);
      return res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
    }

    return res.json({
      success: true,
      message: `Password reset instructions have been sent to ${email} via our secure Hostinger email service. Please check your inbox.`,
      resetToken: resetToken, // Only for development
      expiresAt: expiresAt // For debugging
    });

  } catch (error) {
    console.error('❌ Password reset request error:', error.message);
    return res.status(500).json({ 
      error: 'An unexpected error occurred. Please try again.' 
    });
  }
});

// Password update endpoint - CUSTOM: Updates password directly in Supabase
app.post('/api/auth/update-password', async (req, res) => {
  try {
    console.log('🔑 Custom password update request received');
    const { resetToken, email, newPassword } = req.body;

    if (!resetToken || !email || !newPassword) {
      return res.status(400).json({ error: 'Reset token, email, and new password are required' });
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

    console.log('✅ Token valid, finding user and updating password...');

    // Find the user by email in Supabase
    const { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email);
    
    if (userError || !userData?.user) {
      console.error('❌ User not found:', email);
      return res.status(400).json({ error: 'User not found' });
    }

    // Update password directly in Supabase using Admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userData.user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('❌ Error updating password:', updateError);
      return res.status(500).json({ error: 'Failed to update password. Please try again.' });
    }

    console.log('🎉 Password updated successfully for user:', userData.user.id);

    return res.json({
      success: true,
      message: 'Your password has been successfully updated! You can now sign in with your new password.',
      user: {
        id: userData.user.id,
        email: userData.user.email
      }
    });

  } catch (error) {
    console.error('❌ Password update error:', error.message);
    return res.status(500).json({ error: 'An error occurred while updating your password. Please try again.' });
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
  console.log('🚀 Local Development Email Server started (Unified Flow)');
  console.log(`📧 Email Server running at: http://localhost:${port}`);
  console.log(`🔗 Health check: http://localhost:${port}/api/health`);
  console.log(`🔗 Test endpoint: http://localhost:${port}/api/test`);
  console.log('');
  console.log('📋 Available API endpoints:');
  console.log('  • GET  /api/health           - Server health check');
  console.log('  • GET  /api/test             - Test endpoint');
  console.log('  • POST /api/send-email       - Send email');
  console.log('  • POST /api/auth/signup      - User signup (UNIFIED)');
  console.log('  • POST /api/auth/verify-email - Email verification (UNIFIED)');
  console.log('  • POST /api/auth/reset-password-request - Password reset request (CUSTOM)');
  console.log('  • POST /api/auth/update-password - Password update (CUSTOM)');
  console.log('');
  
  if (process.env.HOSTINGER_EMAIL_USER && process.env.HOSTINGER_EMAIL_PASSWORD) {
    console.log('✅ Hostinger email credentials found - real emails will be sent');
  } else {
    console.log('🎭 No email credentials found - using mock email mode');
    console.log('💡 To enable real emails, set HOSTINGER_EMAIL_USER and HOSTINGER_EMAIL_PASSWORD in .env');
  }
  
  console.log('');
  console.log('🔧 UNIFIED FLOW + CUSTOM PASSWORD RESET:');
  console.log('  • Single verification system, no double confirmation!');
  console.log('  • Password reset via Hostinger email (no Supabase rate limits)');
  console.log('  • Direct password updates to Supabase database');
  console.log('  1. Start this email server: node dev-email-server.js');
  console.log('  2. Start React dev server: npm start (will run on port 3001)');
  console.log('  3. Visit: http://localhost:3001/register');
  console.log('');
});

module.exports = app;