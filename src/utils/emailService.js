// src/utils/emailService.js - SIMPLE: No queue, just send
import { supabase } from '../supabase';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const emailService = {
  generateVerificationToken: () => {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    const randomPart2 = Math.random().toString(36).substring(2, 15);
    return `jacal_${timestamp}_${randomPart}_${randomPart2}`;
  },

  storeVerificationToken: async (userId, email, token, type) => {
    try {
      const expiresAt = new Date();
      
      if (type === 'password_reset') {
        expiresAt.setHours(expiresAt.getHours() + 1);
      } else {
        expiresAt.setHours(expiresAt.getHours() + 24);
      }

      const { error } = await supabase
        .from('email_verifications')
        .insert({
          user_id: userId,
          email: email,
          token: token,
          type: type,
          expires_at: expiresAt.toISOString(),
          used_at: null,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      return true;
    } catch (error) {
      throw error;
    }
  },

  verifyToken: async (token, type = 'email_confirmation') => {
    try {
      const { data, error } = await supabase
        .from('email_verifications')
        .select('*')
        .eq('token', token)
        .eq('type', type)
        .single();

      if (error || !data) {
        throw new Error('Invalid or expired verification token');
      }

      const now = new Date();
      const expiresAt = new Date(data.expires_at);
      
      if (now > expiresAt) {
        await supabase.from('email_verifications').delete().eq('token', token);
        throw new Error('Verification token has expired');
      }

      if (data.used_at) {
        throw new Error('Verification token has already been used');
      }

      await supabase
        .from('email_verifications')
        .update({ used_at: new Date().toISOString() })
        .eq('id', data.id);

      return data;
    } catch (error) {
      throw error;
    }
  },

  // SIMPLE: Just send the email, no queue BS
  sendConfirmationEmail: async (email, confirmationUrl, userName) => {
    try {
      if (!email || !confirmationUrl) {
        throw new Error('Missing required parameters');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }

      const safeName = userName ? userName.replace(/[<>]/g, '').trim() : '';
      const websiteUrl = process.env.REACT_APP_WEBSITE_URL || 'https://jacal.io';
      const supportEmail = process.env.REACT_APP_SUPPORT_EMAIL || 'support@jacal.io';
      
      const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Jacal!</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; line-height: 1.6; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.15); }
    .header { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 50px 30px; text-align: center; }
    .logo { width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 2.5rem; }
    .header h1 { font-size: 2rem; font-weight: 700; margin-bottom: 10px; }
    .header p { font-size: 1.1rem; opacity: 0.9; }
    .content { padding: 40px 30px; }
    .greeting { color: #2d3748; font-size: 1.8rem; font-weight: 700; margin-bottom: 20px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .intro { color: #4a5568; font-size: 1rem; line-height: 1.7; margin-bottom: 30px; }
    .cta-container { text-align: center; margin: 35px 0; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; text-decoration: none; padding: 18px 35px; border-radius: 12px; font-weight: 700; font-size: 1.1rem; box-shadow: 0 8px 25px rgba(79,172,254,0.3); }
    .warning { background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); border: 2px solid #ffc107; border-radius: 12px; padding: 20px; margin: 25px 0; text-align: center; color: #856404; font-weight: 600; }
    .features { background: #f8fafc; padding: 30px; border-radius: 15px; margin: 30px 0; }
    .features h3 { color: #2d3748; text-align: center; margin-bottom: 20px; font-size: 1.3rem; }
    .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 20px; }
    .feature-item { text-align: center; background: white; padding: 20px 10px; border-radius: 10px; }
    .feature-icon { font-size: 2rem; margin-bottom: 10px; display: block; }
    .feature-text { color: #4a5568; font-weight: 600; font-size: 0.9rem; }
    .backup-link { background: rgba(79,172,254,0.1); border: 1px solid rgba(79,172,254,0.3); border-radius: 8px; padding: 15px; margin: 20px 0; font-family: monospace; font-size: 0.8rem; color: #4facfe; word-break: break-all; }
    .footer { background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%); color: white; padding: 30px; text-align: center; }
    .footer a { color: #90cdf4; text-decoration: none; }
    @media (max-width: 600px) { .container { margin: 10px; } .header, .content { padding: 30px 20px; } .header h1 { font-size: 1.6rem; } .feature-grid { grid-template-columns: 1fr; } }
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
      <div class="features">
        <h3>🚀 What awaits you at Jacal</h3>
        <div class="feature-grid">
          <div class="feature-item">
            <span class="feature-icon">📚</span>
            <div class="feature-text">Smart Flashcards</div>
          </div>
          <div class="feature-item">
            <span class="feature-icon">🧠</span>
            <div class="feature-text">Spaced Repetition</div>
          </div>
          <div class="feature-item">
            <span class="feature-icon">📊</span>
            <div class="feature-text">Progress Tracking</div>
          </div>
          <div class="feature-item">
            <span class="feature-icon">⚡</span>
            <div class="feature-text">Speed Focus</div>
          </div>
        </div>
      </div>
      <p style="font-size: 0.9rem; color: #666; margin: 20px 0;"><strong>Button not working?</strong> Copy this link:</p>
      <div class="backup-link">${confirmationUrl}</div>
      <p style="text-align: center; color: #718096; font-style: italic; margin-top: 30px;">Happy learning,<br><strong>The Jacal Team</strong> 🎓</p>
    </div>
    <div class="footer">
      <p><strong>🧠 Jacal Learning Platform</strong></p>
      <p>📧 <a href="mailto:${supportEmail}">${supportEmail}</a> | 🌐 <a href="${websiteUrl}">${websiteUrl}</a></p>
      <p style="margin-top: 20px; font-size: 0.8rem; color: #a0aec0;">© 2025 Jacal. If you didn't create this account, safely ignore this email.</p>
    </div>
  </div>
</body>
</html>`;

      const response = await fetch(`${API_BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: email,
          subject: '🎓 Welcome to Jacal! Verify your email',
          html: emailHtml
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result;

    } catch (error) {
      throw error;
    }
  }
};

export default emailService;