import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    try {
      const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email);
      if (existingUser.user) {
        return res.status(400).json({ error: 'An account with this email already exists. Please sign in instead.' });
      }
    } catch (adminError) {
      console.error('Admin API error:', adminError);
    }

    const { data: pendingUser, error: pendingError } = await supabase
      .from('pending_users')
      .select('id, created_at')
      .eq('email', email)
      .single();

    if (pendingUser && !pendingError) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const createdAt = new Date(pendingUser.created_at);
      
      if (createdAt > tenMinutesAgo) {
        return res.status(400).json({ 
          error: 'A verification email was recently sent to this address. Please check your email or wait 10 minutes before trying again.' 
        });
      }
      
      await supabase.from('pending_users').delete().eq('id', pendingUser.id);
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const verificationToken = generateVerificationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

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

    const host = req.headers.host || 'jacal.io';
    const baseUrl = host.includes('localhost') 
      ? 'http://localhost:3001' 
      : `https://${host}`;
    const verificationUrl = `${baseUrl}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;

    try {
      await sendVerificationEmail(email, verificationUrl, fullName);
    } catch (emailError) {
      console.error('Verification email send error:', emailError);
      await supabase.from('pending_users').delete().eq('id', newPendingUser.id);
      return res.status(500).json({ 
        error: 'Failed to send verification email. Please try again or contact support if the problem persists.' 
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
    const { data: pendingUser, error: findError } = await supabase
      .from('pending_users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (findError || !pendingUser) {
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
      console.error('Error updating pending user token:', updateError);
      return res.status(500).json({ error: 'Failed to resend verification email' });
    }

    const host = req.headers.host || 'jacal.io';
    const baseUrl = host.includes('localhost') 
      ? 'http://localhost:3001' 
      : `https://${host}`;
    const verificationUrl = `${baseUrl}/auth/verify-email?token=${newVerificationToken}&email=${encodeURIComponent(email)}`;

    await sendVerificationEmail(email, verificationUrl, fullName || pendingUser.full_name);

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

async function sendVerificationEmail(email, confirmationUrl, userName) {
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
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Jacal!</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; margin: 0; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.15); }
    .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 50px 30px; text-align: center; }
    .logo { width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 2.5rem; }
    .header h1 { font-size: 2rem; font-weight: 700; margin-bottom: 10px; }
    .content { padding: 40px 30px; }
    .greeting { color: #2d3748; font-size: 1.8rem; font-weight: 700; margin-bottom: 20px; }
    .intro { color: #4a5568; font-size: 1rem; line-height: 1.7; margin-bottom: 30px; }
    .cta-container { text-align: center; margin: 35px 0; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; text-decoration: none; padding: 18px 35px; border-radius: 12px; font-weight: 700; font-size: 1.1rem; }
    .warning { background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); border: 2px solid #ffc107; border-radius: 12px; padding: 20px; margin: 25px 0; text-align: center; color: #856404; font-weight: 600; }
    .footer { background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%); color: white; padding: 30px; text-align: center; }
    .footer a { color: #90cdf4; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🧠</div>
      <h1>Welcome to Jacal!</h1>
      <p>Your intelligent learning journey starts here</p>
    </div>
    <div class="content">
      <h2 class="greeting">Hi ${safeName || 'there'}! 👋</h2>
      <p class="intro">🎉 <strong>Congratulations!</strong> You've joined thousands of students revolutionizing their learning with <strong>Jacal</strong>. We're thrilled to welcome you!</p>
      <p class="intro">To start creating flashcards, please verify your email address:</p>
      <div class="cta-container">
        <a href="${confirmationUrl}" class="cta-button">✅ Verify Email & Start Learning</a>
      </div>
      <div class="warning">⏰ <strong>Security Notice:</strong> This verification link expires in 24 hours.</div>
      <p style="text-align: center; color: #718096; font-style: italic; margin-top: 30px;">Happy learning,<br><strong>The Jacal Team</strong> 🎓</p>
    </div>
    <div class="footer">
      <p><strong>🧠 Jacal Learning Platform</strong></p>
      <p>📧 <a href="mailto:${process.env.HOSTINGER_EMAIL_USER}">${process.env.HOSTINGER_EMAIL_USER}</a></p>
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"Jacal Learning Platform" <${process.env.HOSTINGER_EMAIL_USER}>`,
    to: email,
    subject: '🎓 Welcome to Jacal! Verify your email to start learning',
    html: emailHtml
  });
}