// src/api/emailService.js - Email service using Resend
import { supabase } from '../supabase';

// Email Configuration
const EMAIL_CONFIG = {
  FROM_EMAIL: process.env.REACT_APP_FROM_EMAIL || 'jacal.io.service@gmail.com',
  FROM_NAME: process.env.REACT_APP_FROM_NAME || 'Jacal Learning Platform',
  WEBSITE_NAME: 'Jacal',
  WEBSITE_URL: process.env.REACT_APP_WEBSITE_URL || 'https://jacal.io',
  SUPPORT_EMAIL: process.env.REACT_APP_SUPPORT_EMAIL || 'jacal.io.service@gmail.com',
  API_BASE: process.env.REACT_APP_API_BASE || 'http://localhost:3001'
};

// Beautiful email templates
const EMAIL_TEMPLATES = {
  emailConfirmation: (confirmationUrl, userEmail, userName) => ({
    subject: '🎓 Welcome to Jacal! Please confirm your email',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Jacal!</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; padding: 0; background-color: #f5f5f5; line-height: 1.6;
          }
          .container { 
            max-width: 600px; margin: 20px auto; background: white; 
            border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); 
            color: white; padding: 40px 30px; text-align: center; 
          }
          .content { padding: 40px 30px; color: #333; }
          .button { 
            display: inline-block; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); 
            color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; 
            font-weight: 600; margin: 20px 0; box-shadow: 0 4px 15px rgba(79, 172, 254, 0.3);
          }
          .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 14px; }
          .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .link-backup { word-break: break-all; color: #4facfe; background: #f8f9fa; padding: 12px; border-radius: 8px; font-size: 14px; margin: 15px 0; border-left: 4px solid #4facfe; }
          .features { background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 24px; border-radius: 12px; margin: 25px 0; border: 1px solid #e9ecef; }
          .features ul { margin: 0; padding-left: 20px; }
          .features li { margin: 10px 0; color: #555; font-weight: 500; }
          .warning { background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 16px; margin: 20px 0; color: #856404; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎓 ${EMAIL_CONFIG.WEBSITE_NAME}</div>
            <h1 style="margin: 0; font-size: 28px;">Welcome to the future of learning!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Master any subject with intelligent flashcards</p>
          </div>
          
          <div class="content">
            <h2 style="color: #4facfe; margin-top: 0; font-size: 24px;">Hi ${userName || 'there'}! 👋</h2>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              🎉 <strong>Congratulations!</strong> You've just joined thousands of students who are revolutionizing their learning with ${EMAIL_CONFIG.WEBSITE_NAME}.
            </p>
            
            <p style="font-size: 16px;">
              To unlock your full learning potential, please confirm your email address:
            </p>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${confirmationUrl}" class="button">✅ Confirm Email & Start Learning</a>
            </div>
            
            <p style="font-size: 14px; color: #666;">If the button doesn't work, copy and paste this link:</p>
            <div class="link-backup">${confirmationUrl}</div>
            
            <div class="warning">
              ⏰ <strong>Important:</strong> This verification link expires in 24 hours for your security.
            </div>
            
            <div class="features">
              <h3 style="color: #4facfe; margin-top: 0; font-size: 20px;">🚀 What awaits you:</h3>
              <ul>
                <li>📝 <strong>Smart Flashcards:</strong> Create Basic, Cloze, and Image Occlusion cards</li>
                <li>🧠 <strong>Spaced Repetition:</strong> AI-powered review scheduling for maximum retention</li>
                <li>⚡ <strong>Speed Focus Mode:</strong> Test your knowledge under time pressure</li>
                <li>📊 <strong>Progress Tracking:</strong> Watch your learning streak grow</li>
                <li>🎯 <strong>Personalized Study:</strong> Adaptive difficulty based on your performance</li>
              </ul>
            </div>
            
            <p style="background: #e8f4fd; padding: 16px; border-radius: 8px; border-left: 4px solid #4facfe; margin: 25px 0;">
              💡 <strong>Pro Tip:</strong> Start with 5-10 flashcards on a topic you're studying. Consistency beats cramming every time!
            </p>
            
            <p style="font-size: 16px; margin-top: 30px;">
              Questions? Just reply to this email - our team loves helping students succeed! 🌟
            </p>
            
            <p style="color: #666; font-style: italic; margin-top: 30px;">
              Happy learning,<br>
              <strong>The ${EMAIL_CONFIG.WEBSITE_NAME} Team</strong> 🎓
            </p>
          </div>
          
          <div class="footer">
            <p style="margin: 20px 0 10px 0;"><strong>📧 Need assistance?</strong></p>
            <p style="margin: 0;">Reply to this email or contact us at ${EMAIL_CONFIG.SUPPORT_EMAIL}</p>
            
            <p style="margin: 20px 0 0 0; color: #999; font-size: 12px;">
              © 2025 ${EMAIL_CONFIG.WEBSITE_NAME}. Empowering learners worldwide.<br>
              If you didn't create this account, you can safely ignore this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  passwordReset: (resetUrl, userEmail, userName) => ({
    subject: '🔐 Reset your Jacal password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - Jacal</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; line-height: 1.6; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; padding: 40px 30px; text-align: center; }
          .content { padding: 40px 30px; color: #333; }
          .button { display: inline-block; background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 600; margin: 20px 0; box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3); }
          .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 14px; }
          .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .warning { background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 20px; margin: 25px 0; color: #856404; }
          .link-backup { word-break: break-all; color: #ff6b35; background: #f8f9fa; padding: 12px; border-radius: 8px; font-size: 14px; margin: 15px 0; border-left: 4px solid #ff6b35; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🔐 ${EMAIL_CONFIG.WEBSITE_NAME}</div>
            <h1 style="margin: 0; font-size: 24px;">Password Reset Request</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Secure your learning journey</p>
          </div>
          <div class="content">
            <h2 style="color: #ff6b35; margin-top: 0;">Hi ${userName || 'there'}! 👋</h2>
            
            <p style="font-size: 16px;">
              We received a request to reset the password for your ${EMAIL_CONFIG.WEBSITE_NAME} account: <strong>${userEmail}</strong>
            </p>
            
            <p style="font-size: 16px;">
              If you made this request, click the button below to create a new password:
            </p>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${resetUrl}" class="button">🔐 Reset My Password</a>
            </div>
            
            <p style="font-size: 14px; color: #666;">If the button doesn't work, copy and paste this link:</p>
            <div class="link-backup">${resetUrl}</div>
            
            <div class="warning">
              <h4 style="margin-top: 0; color: #856404;">⚠️ Security Notice:</h4>
              <ul style="margin: 10px 0; padding-left: 20px;">
                <li>This link expires in <strong>1 hour</strong> for your security</li>
                <li>If you didn't request this reset, your account is still secure</li>
                <li>No changes have been made to your account</li>
                <li>You can safely ignore this email if you didn't request it</li>
              </ul>
            </div>
            
            <p style="font-size: 16px; margin-top: 30px;">
              Questions about account security? Reply to this email - we're here to help! 🛡️
            </p>
          </div>
          <div class="footer">
            <p><strong>🆘 Need immediate help?</strong></p>
            <p>Contact our support team: ${EMAIL_CONFIG.SUPPORT_EMAIL}</p>
            <p style="margin-top: 20px; color: #999; font-size: 12px;">
              © 2025 ${EMAIL_CONFIG.WEBSITE_NAME}. Keeping your learning secure.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  })
};

// Email Service Class
class ResendEmailService {
  constructor() {
    this.apiBase = EMAIL_CONFIG.API_BASE;
  }

  // Send email via our server API
  async sendEmail(to, template, type = 'confirmation') {
    try {
      console.log('📧 Sending email via Resend API:', { to, type, subject: template.subject });

      const response = await fetch(`${this.apiBase}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to,
          subject: template.subject,
          html: template.html,
          type
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      const result = await response.json();
      console.log('✅ Email sent successfully via Resend:', result);
      return result;
    } catch (error) {
      console.error('❌ Resend email service error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async sendConfirmationEmail(userEmail, confirmationUrl, userName = '') {
    const template = EMAIL_TEMPLATES.emailConfirmation(confirmationUrl, userEmail, userName);
    return this.sendEmail(userEmail, template, 'confirmation');
  }

  async sendPasswordResetEmail(userEmail, resetUrl, userName = '') {
    const template = EMAIL_TEMPLATES.passwordReset(resetUrl, userEmail, userName);
    return this.sendEmail(userEmail, template, 'password_reset');
  }

  // Generate secure token for email verification
  generateVerificationToken() {
    return btoa(Math.random().toString(36).substr(2, 9) + Date.now().toString(36));
  }

  // Store verification token in database
  async storeVerificationToken(userId, email, token, type = 'email_confirmation') {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (type === 'password_reset' ? 1 : 24));

    const { error } = await supabase
      .from('email_verifications')
      .insert({
        user_id: userId,
        email: email,
        token: token,
        type: type,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

    if (error) {
      throw new Error(`Failed to store verification token: ${error.message}`);
    }

    return token;
  }

  // Verify token
  async verifyToken(token, type = 'email_confirmation') {
    const { data, error } = await supabase
      .from('email_verifications')
      .select('*')
      .eq('token', token)
      .eq('type', type)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      throw new Error('Invalid or expired token');
    }

    // Mark token as used
    await supabase
      .from('email_verifications')
      .update({ used_at: new Date().toISOString() })
      .eq('id', data.id);

    return data;
  }
}

// Export singleton instance
export const emailService = new ResendEmailService();