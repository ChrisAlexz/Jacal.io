// api/auth/signup.js - UNIFIED: Single verification system, no conflicts
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { applyCors, generateSecureToken, rateLimit, clientIp } from '../_lib/security.js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).json({ message: 'CORS OK' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Throttle account-creation/email abuse.
  if (!rateLimit(`signup:${clientIp(req)}`, { max: 5, windowMs: 60_000 })) {
    return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
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

    // Check if user already exists in auth.users
    try {
      const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email);
      if (existingUser?.user) {
        return res.status(400).json({ error: 'An account with this email already exists. Please sign in instead.' });
      }
    } catch (adminError) {
      // Expected for new users
    }

    // UNIFIED: Use Supabase's built-in signup with custom redirect
    const host = req.headers.host || 'jacal.io';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    console.log('🚀 Creating user with Supabase signup...');

    // Create user with Supabase but with custom email confirmation
    const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: false, // We'll send our own confirmation email
      user_metadata: {
        name: fullName.trim(),
        email_verified: false,
        picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=4facfe&color=fff&size=200`
      }
    });

    if (signUpError) {
      console.error('Supabase signup error:', signUpError);
      if (signUpError.message.includes('already registered')) {
        return res.status(400).json({ error: 'An account with this email already exists. Please sign in instead.' });
      }
      return res.status(500).json({ error: 'Failed to create account. Please try again.' });
    }

    if (!authData?.user?.id) {
      return res.status(500).json({ error: 'Failed to create user account.' });
    }

    console.log('✅ User created in Supabase:', authData.user.id);

    // Generate custom verification token and store it
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Store verification token in a simple table
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
      console.error('Error storing verification token:', tokenError);
      // Clean up user if token storage fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: 'Failed to setup verification. Please try again.' });
    }

    // Create verification URL
    const verificationUrl = `${baseUrl}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}&user_id=${authData.user.id}`;

    // Send our beautiful custom email
    try {
      await sendHostingerEmail(email, verificationUrl, fullName);
    } catch (emailError) {
      console.error('Email send error:', emailError);
      // Clean up user and token if email fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      await supabase.from('user_verifications').delete().eq('verification_token', verificationToken);
      return res.status(500).json({ 
        error: 'Failed to send verification email. Please try again.' 
      });
    }

    return res.status(200).json({
      success: true,
      message: `Account created! A verification email has been sent to ${email}. Please check your inbox and click the verification link to activate your account.`,
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
    // Find existing verification
    const { data: verification } = await supabase
      .from('user_verifications')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('verified', false)
      .single();

    if (!verification) {
      return res.status(400).json({ error: 'No pending verification found for this email address' });
    }

    // Generate new token
    const newVerificationToken = generateVerificationToken();
    const newExpiresAt = new Date();
    newExpiresAt.setHours(newExpiresAt.getHours() + 24);

    const { error: updateError } = await supabase
      .from('user_verifications')
      .update({
        verification_token: newVerificationToken,
        expires_at: newExpiresAt.toISOString()
      })
      .eq('id', verification.id);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to resend verification email' });
    }

    const host = req.headers.host || 'jacal.io';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    const verificationUrl = `${baseUrl}/auth/verify-email?token=${newVerificationToken}&email=${encodeURIComponent(email)}&user_id=${verification.user_id}`;

    await sendHostingerEmail(email, verificationUrl, fullName);

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
  return generateSecureToken('jacal');
}

async function sendHostingerEmail(email, confirmationUrl, userName) {
  if (!process.env.HOSTINGER_EMAIL_USER || !process.env.HOSTINGER_EMAIL_PASSWORD) {
    throw new Error('Hostinger email credentials not configured');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 587,
    secure: false, // STARTTLS on 587
    auth: {
      user: process.env.HOSTINGER_EMAIL_USER,
      pass: process.env.HOSTINGER_EMAIL_PASSWORD
    },
    requireTLS: true
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