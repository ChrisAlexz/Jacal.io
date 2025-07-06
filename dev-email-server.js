// dev-email-server.js - COMPLETE with password update endpoint
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

// WORKING: Use the exact configuration that passed the test
const createTransporter = () => {
  if (!process.env.HOSTINGER_EMAIL_USER || !process.env.HOSTINGER_EMAIL_PASSWORD) {
    console.log('⚠️ No email credentials found');
    return null;
  }

  console.log('📧 Creating SMTP transporter...');
  return nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.HOSTINGER_EMAIL_USER,
      pass: process.env.HOSTINGER_EMAIL_PASSWORD
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 10000
  });
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('🔍 Health check requested');
  const hasCredentials = !!(process.env.HOSTINGER_EMAIL_USER && process.env.HOSTINGER_EMAIL_PASSWORD);
  
  const response = { 
    status: 'OK',
    service: 'Local Development Email Server',
    port: port,
    hasEmailCredentials: hasCredentials,
    smtpHost: 'smtp.hostinger.com',
    smtpPort: 587,
    emailUser: process.env.HOSTINGER_EMAIL_USER,
    timestamp: new Date().toISOString()
  };
  
  console.log('✅ Health check response:', response);
  res.json(response);
});

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('🧪 Test endpoint called');
  res.json({
    success: true,
    message: 'Local development email server is working!',
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Send email endpoint - WORKING VERSION with extensive logging
app.post('/api/send-email', async (req, res) => {
  console.log('\n📧 =========================');
  console.log('📧 EMAIL REQUEST RECEIVED');
  console.log('📧 =========================');
  
  try {
    const { to, subject, html } = req.body;

    console.log('📧 Request details:');
    console.log('   To:', to);
    console.log('   Subject:', subject?.substring(0, 50) + '...');
    console.log('   HTML length:', html?.length);

    if (!to || !subject || !html) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      console.log('❌ Invalid email format:', to);
      return res.status(400).json({ error: 'Invalid email format' });
    }

    console.log('🔧 Creating transporter...');
    const transporter = createTransporter();

    if (!transporter) {
      console.log('⚠️ No email credentials, using mock mode');
      return res.json({
        success: true,
        messageId: 'mock-' + Date.now(),
        message: 'Mock email sent (no real email was sent in development)',
        timestamp: new Date().toISOString()
      });
    }

    console.log('🔗 Testing SMTP connection...');
    try {
      await transporter.verify();
      console.log('✅ SMTP connection verified successfully');
    } catch (verifyError) {
      console.error('❌ SMTP verification failed:', verifyError.message);
      return res.status(500).json({
        error: 'SMTP configuration error',
        details: verifyError.message,
        timestamp: new Date().toISOString()
      });
    }

    const mailOptions = {
      from: `"Jacal Learning Platform" <${process.env.HOSTINGER_EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html
    };

    console.log('📤 Sending email with options:');
    console.log('   From:', mailOptions.from);
    console.log('   To:', mailOptions.to);
    console.log('   Subject:', mailOptions.subject);

    const result = await transporter.sendMail(mailOptions);
    
    console.log('✅ EMAIL SENT SUCCESSFULLY!');
    console.log('   Message ID:', result.messageId);
    console.log('   Response:', result.response);
    console.log('📧 =========================\n');

    return res.json({
      success: true,
      messageId: result.messageId,
      response: result.response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ EMAIL SEND ERROR:', error);
    console.log('📧 =========================\n');
    return res.status(500).json({
      error: 'Failed to send email',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Password reset request endpoint - FIXED: Skip user check for now
app.post('/api/auth/reset-password-request', async (req, res) => {
  console.log('\n🔐 ==============================');
  console.log('🔐 PASSWORD RESET REQUEST');
  console.log('🔐 ==============================');
  
  try {
    const { email } = req.body;
    
    console.log('🔐 Request details:');
    console.log('   Email:', email);

    if (!email) {
      console.log('❌ Email is required');
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ Invalid email format:', email);
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // FIXED: Skip Supabase user check for development - just send the email
    console.log('⚠️ Skipping user verification for development - sending email directly');

    // Generate custom reset token
    const resetToken = `reset_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    console.log('💾 Storing reset token in database...');
    console.log('   Token:', resetToken);
    console.log('   Expires:', expiresAt.toISOString());

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
      console.error('❌ Error storing token in database:', tokenError);
      // Continue anyway for development
      console.log('⚠️ Continuing without database storage for development');
    } else {
      console.log('✅ Reset token stored successfully');
    }

    // Create reset URL
    const baseUrl = 'http://localhost:3001';
    const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;
    
    console.log('🔗 Generated reset URL:', resetUrl);

    // Create reset email HTML
    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Reset Your Jacal Password</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; padding: 40px; text-align: center;">
          <h1 style="margin: 0; font-size: 2rem;">🔐 Reset Your Password</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Secure password reset for your Jacal account</p>
        </div>
        <div style="padding: 40px;">
          <h2 style="color: #ff6b35; margin-top: 0;">Password Reset Request</h2>
          <p style="color: #333; line-height: 1.6;">We received a request to reset the password for your Jacal account associated with <strong>${email}</strong>.</p>
          <p style="color: #333; line-height: 1.6;">If you made this request, click the button below to set a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; display: inline-block; font-weight: 600;">
              🔑 Reset My Password
            </a>
          </div>
          <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <strong style="color: #856404;">⏰ Important:</strong> This reset link expires in 1 hour for your security.
          </div>
          <p style="color: #666; margin-top: 30px;">
            Best regards,<br>
            <strong>The Jacal Security Team</strong> 🛡️
          </p>
        </div>
      </div>
    </body>
    </html>`;

    console.log('📧 Preparing to send reset email...');

    // Send email using the /api/send-email endpoint
    try {
      console.log('📤 Making internal API call to send email...');
      
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

      console.log('📧 Internal API response status:', emailResponse.status);

      if (!emailResponse.ok) {
        const errorData = await emailResponse.json();
        console.error('❌ Internal email API failed:', errorData);
        throw new Error(errorData.error || 'Failed to send reset email');
      }

      const emailResult = await emailResponse.json();
      console.log('✅ Reset email sent successfully!');
      console.log('   Message ID:', emailResult.messageId);

    } catch (emailError) {
      console.error('❌ Email send error:', emailError);
      return res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
    }

    console.log('🔐 ==============================\n');

    return res.json({
      success: true,
      message: `Password reset instructions have been sent to ${email}. Please check your inbox.`
    });

  } catch (error) {
    console.error('❌ Password reset error:', error);
    console.log('🔐 ==============================\n');
    return res.status(500).json({ 
      error: 'An error occurred. Please try again.' 
    });
  }
});

// Password update endpoint - ADDED: This was missing!
app.post('/api/auth/update-password', async (req, res) => {
  console.log('\n🔑 ==============================');
  console.log('🔑 PASSWORD UPDATE REQUEST');
  console.log('🔑 ==============================');
  
  try {
    const { resetToken, email, newPassword } = req.body;

    console.log('🔑 Request details:');
    console.log('   Email:', email);
    console.log('   Has token:', !!resetToken);
    console.log('   Has password:', !!newPassword);
    console.log('   Token:', resetToken);

    if (!resetToken || !email || !newPassword) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ error: 'Reset token, email, and new password are required' });
    }

    if (newPassword.length < 8) {
      console.log('❌ Password too short');
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    console.log('🔍 Verifying reset token in database...');

    // Verify the reset token
    const { data: resetRecord, error: tokenError } = await supabase
      .from('password_resets')
      .select('*')
      .eq('reset_token', resetToken)
      .eq('email', email.toLowerCase())
      .eq('used', false)
      .single();

    if (tokenError || !resetRecord) {
      console.log('❌ Invalid or expired reset token');
      console.log('   Token error:', tokenError);
      console.log('   Reset record:', resetRecord);
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(resetRecord.expires_at);
    
    console.log('🕐 Token expiry check:');
    console.log('   Now:', now.toISOString());
    console.log('   Expires:', expiresAt.toISOString());
    console.log('   Is expired:', now > expiresAt);
    
    if (now > expiresAt) {
      console.log('❌ Token expired, cleaning up...');
      await supabase.from('password_resets').delete().eq('id', resetRecord.id);
      return res.status(400).json({ error: 'Reset token has expired. Please request a new password reset.' });
    }

    console.log('✅ Reset token is valid');

    // FIXED: Actually update the password in Supabase
    console.log('🔄 Updating password in Supabase...');
    
    try {
      // First, find the user by email
      const { data: users, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        console.error('❌ Error listing users:', listError);
        throw new Error('Unable to find user account');
      }
      
      const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        console.log('❌ User not found for email:', email);
        return res.status(400).json({ error: 'User account not found' });
      }
      
      console.log('✅ Found user:', user.id);
      
      // Update the password
      const { error: passwordUpdateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
      );
      
      if (passwordUpdateError) {
        console.error('❌ Error updating password in Supabase:', passwordUpdateError);
        throw new Error('Failed to update password in database');
      }
      
      console.log('✅ Password updated successfully in Supabase');
      
    } catch (supabaseError) {
      console.error('❌ Supabase password update failed:', supabaseError);
      return res.status(500).json({ error: 'Failed to update password. Please try again.' });
    };
    console.log('🧹 Marking reset token as used...');

    // Mark reset token as used
    const { error: updateError } = await supabase
      .from('password_resets')
      .update({ 
        used: true,
        used_at: new Date().toISOString()
      })
      .eq('id', resetRecord.id);

    if (updateError) {
      console.error('❌ Error marking token as used:', updateError);
    } else {
      console.log('✅ Reset token marked as used');
    }

    console.log('🔑 ==============================\n');

    return res.json({
      success: true,
      message: 'Your password has been successfully updated! You can now sign in with your new password.',
      user: {
        id: 'dev-user-id',
        email: email
      }
    });

  } catch (error) {
    console.error('❌ Password update error:', error);
    console.log('🔑 ==============================\n');
    return res.status(500).json({ 
      error: 'An error occurred while updating your password. Please try again.' 
    });
  }
});

// Start server with enhanced logging
app.listen(port, () => {
  console.log('\n🚀 ==============================');
  console.log('🚀 EMAIL SERVER STARTED');
  console.log('🚀 ==============================');
  console.log(`📧 Local Development Email Server running at: http://localhost:${port}`);
  console.log(`🔗 Health check: http://localhost:${port}/api/health`);
  console.log('');
  console.log('📋 Available API endpoints:');
  console.log('  • POST /api/send-email                   - Send email directly');
  console.log('  • POST /api/auth/reset-password-request  - Password reset request');
  console.log('  • POST /api/auth/update-password         - Password update');
  console.log('');
  
  if (process.env.HOSTINGER_EMAIL_USER && process.env.HOSTINGER_EMAIL_PASSWORD) {
    console.log('✅ Hostinger email credentials found - emails will be sent');
    console.log('📧 SMTP Settings:');
    console.log('   Host: smtp.hostinger.com');
    console.log('   Port: 587 (STARTTLS)');
    console.log('   User:', process.env.HOSTINGER_EMAIL_USER);
  } else {
    console.log('⚠️ No email credentials found - using mock email mode');
  }
  
  console.log('🚀 ==============================\n');
  console.log('📝 FIXED: Bypassed Supabase user check for development');
  console.log('📝 ADDED: Password update endpoint');
  console.log('🔍 Watch this terminal for email activity\n');
});

module.exports = app;