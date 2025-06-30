// api/auth/signup.js - Complete Hostinger email implementation
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
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
    const { email, password, fullName, resend } = req.body || {};

    // Basic validation
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (resend) {
      return await handleResendVerification(req, res, email, fullName || '');
    }

    if (!password || !fullName) {
      return res.status(400).json({ error: 'Password and full name are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    if (fullName.trim().length < 2) {
      return res.status(400).json({ error: 'Full name must be at least 2 characters long' });
    }

    // Check if user already exists in auth.users (NOT pending_users)
    try {
      const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email);
      if (existingUser?.user) {
        return res.status(400).json({ error: 'An account with this email already exists. Please sign in instead.' });
      }
    } catch (adminError) {
      // This is expected for new users
    }

    // Check for existing pending user and rate limiting
    const { data: pendingUser } = await supabase
      .from('pending_users')
      .select('id, created_at')
      .eq('email', email.toLowerCase())
      .single();

    if (pendingUser) {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const createdAt = new Date(pendingUser.created_at);
      
      if (createdAt > twoMinutesAgo) {
        const secondsRemaining = Math.ceil((createdAt.getTime() + 120000 - Date.now()) / 1000);
        return res.status(429).json({ 
          error: `A verification email was recently sent. Please wait ${secondsRemaining} seconds before requesting another.`
        });
      }
      
      // Delete old pending user
      await supabase.from('pending_users').delete().eq('id', pendingUser.id);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Insert pending user
    const { data: newPendingUser, error: insertError } = await supabase
      .from('pending_users')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        full_name: fullName.trim(),
        verification_token: verificationToken,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating pending user:', insertError);
      if (insertError.code === '23505') {
        return res.status(400).json({ error: 'A signup with this email is already in progress' });
      }
      return res.status(500).json({ error: 'Failed to create account. Please try again.' });
    }

    // Create verification URL
    const host = req.headers.host || 'jacal.io';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const verificationUrl = `${baseUrl}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

    // Send verification email via Hostinger
    try {
      await sendHostingerEmail(email, verificationUrl, fullName);
    } catch (emailError) {
      console.error('Email send error:', emailError);
      // Clean up pending user if email fails
      await supabase.from('pending_users').delete().eq('id', newPendingUser.id);
      return res.status(500).json({ 
        error: 'Failed to send verification email. Please try again.' 
      });
    }

    return res.status(200).json({
      success: true,
      message: `Verification email sent to ${email}. Please check your inbox and click the verification link to activate your account.`,
      email: email
    });

  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ 
      error: 'An unexpected error occurred during signup. Please try again.' 
    });
  }
}

async function handleResendVerification(req, res, email, fullName) {
  try {
    const { data: pendingUser } = await supabase
      .from('pending_users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (!pendingUser) {
      return res.status(400).json({ error: 'No pending verification found for this email address' });
    }

    const newVerificationToken = generateVerificationToken();
    const newExpiresAt = new Date();
    newExpiresAt.setHours(newExpiresAt.getHours() + 24);

    const { error: updateError } = await supabase
      .from('pending_users')
      .update({
        verification_token: newVerificationToken,
        expires_at: newExpiresAt.toISOString()
      })
      .eq('id', pendingUser.id);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to resend verification email' });
    }

    const host = req.headers.host || 'jacal.io';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const verificationUrl = `${baseUrl}/auth/verify-email?token=${newVerificationToken}&email=${encodeURIComponent(email)}`;

    await sendHostingerEmail(email, verificationUrl, fullName || pendingUser.full_name);

    return res.status(200).json({
      success: true,
      message: 'Verification email resent successfully. Please check your inbox.'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({ error: 'Failed to resend verification email' });
  }
}

function generateVerificationToken() {
  const timestamp = Date.now().toString(36);
  const randomPart1 = Math.random().toString(36).substring(2, 15);
  const randomPart2 = Math.random().toString(36).substring(2, 15);
  return `jacal_${timestamp}_${randomPart1}_${randomPart2}`;
}

async function sendHostingerEmail(email, confirmationUrl, userName) {
  if (!process.env.HOSTINGER_EMAIL_USER || !process.env.HOSTINGER_EMAIL_PASSWORD) {
    throw new Error('Hostinger email credentials not configured');
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

  const safeName = userName ? userName.replace(/[<>]/g, '').trim() : '';
  
  const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to Jacal!</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 40px; text-align: center;">
      <h1 style="margin: 0; font-size: 2rem;">🧠 Welcome to Jacal!</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">Your intelligent learning journey starts here</p>
    </div>
    <div style="padding: 40px;">
      <h2 style="color: #4facfe; margin-top: 0;">Hi ${safeName || 'there'}! 👋</h2>
      <p style="color: #333; line-height: 1.6;">Thanks for joining Jacal! To start creating flashcards and begin your learning journey, please verify your email address:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${confirmationUrl}" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; display: inline-block; font-weight: 600;">
          ✅ Verify Email & Start Learning
        </a>
      </div>
      <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 16px; margin: 20px 0;">
        <strong style="color: #856404;">⏰ Important:</strong> This verification link expires in 24 hours for your security.
      </div>
      <p style="color: #666; margin-top: 30px;">Happy learning,<br><strong>The Jacal Team</strong> 🎓</p>
    </div>
    <div style="background: #2d3748; color: white; padding: 20px; text-align: center;">
      <p style="margin: 0;"><strong>🧠 Jacal Learning Platform</strong></p>
      <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.8;">📧 ${process.env.HOSTINGER_EMAIL_USER}</p>
    </div>
  </div>
</body>
</html>`;

  const result = await transporter.sendMail({
    from: `"Jacal Learning Platform" <${process.env.HOSTINGER_EMAIL_USER}>`,
    to: email,
    subject: '🎓 Welcome to Jacal! Verify your email to start learning',
    html: emailHtml
  });

  console.log('✅ Hostinger email sent successfully:', result.messageId);
  return result;
}