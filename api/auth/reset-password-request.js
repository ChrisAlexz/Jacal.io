// api/auth/reset-password-request.js - FIXED: Clean email sending
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ message: 'CORS OK' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    const resetToken = generateResetToken();
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
    const host = req.headers.host || 'jacal.io';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Send email via Hostinger
    try {
      await sendHostingerResetEmail(email, resetUrl);
    } catch (emailError) {
      await supabase.from('password_resets').delete().eq('reset_token', resetToken);
      return res.status(500).json({ 
        error: 'Failed to send reset email. Please try again.' 
      });
    }

    return res.status(200).json({
      success: true,
      message: `Password reset instructions have been sent to ${email}. Please check your inbox.`
    });

  } catch (error) {
    return res.status(500).json({ 
      error: 'An error occurred. Please try again.' 
    });
  }
}

function generateResetToken() {
  const timestamp = Date.now().toString(36);
  const randomPart1 = Math.random().toString(36).substring(2, 15);
  const randomPart2 = Math.random().toString(36).substring(2, 15);
  return `reset_${timestamp}_${randomPart1}_${randomPart2}`;
}

async function sendHostingerResetEmail(email, resetUrl) {
  if (!process.env.HOSTINGER_EMAIL_USER || !process.env.HOSTINGER_EMAIL_PASSWORD) {
    throw new Error('Email credentials not configured');
  }

  const transporter = nodemailer.createTransporter({
    host: 'smtp.hostinger.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.HOSTINGER_EMAIL_USER,
      pass: process.env.HOSTINGER_EMAIL_PASSWORD
    },
    tls: { rejectUnauthorized: false }
  });

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
      <div style="background: #f8f9fa; border-left: 4px solid #6c757d; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #6c757d;"><strong>Didn't request this?</strong> You can safely ignore this email. Your password will not be changed.</p>
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
    <div style="background: #2d3748; color: white; padding: 20px; text-align: center;">
      <p style="margin: 0;"><strong>🔐 Jacal Security</strong></p>
      <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">📧 ${process.env.HOSTINGER_EMAIL_USER}</p>
    </div>
  </div>
</body>
</html>`;

  const result = await transporter.sendMail({
    from: `"Jacal Security" <${process.env.HOSTINGER_EMAIL_USER}>`,
    to: email,
    subject: '🔐 Reset Your Jacal Password - Secure Link Inside',
    html: emailHtml
  });

  return result;
}