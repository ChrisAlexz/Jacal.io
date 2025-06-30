// src/api/emailService.js - Jacal Custom Email Service with Resend
import { supabase } from '../supabase';

// Email Configuration
const EMAIL_CONFIG = {
  FROM_EMAIL: process.env.REACT_APP_FROM_EMAIL || 'noreply@jacal.io',
  FROM_NAME: process.env.REACT_APP_FROM_NAME || 'Jacal Learning Platform',
  WEBSITE_NAME: 'Jacal',
  WEBSITE_URL: process.env.REACT_APP_WEBSITE_URL || 'https://jacal.io',
  SUPPORT_EMAIL: process.env.REACT_APP_SUPPORT_EMAIL || 'support@jacal.io',
  RESEND_API_KEY: process.env.REACT_APP_RESEND_API_KEY,
  RESEND_API_URL: 'https://api.resend.com/emails'
};

// Beautiful Jacal-branded email templates
const EMAIL_TEMPLATES = {
  emailConfirmation: (confirmationUrl, userEmail, userName) => ({
    subject: '🎓 Welcome to Jacal! Verify your email to start learning',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Jacal!</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          
          body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; padding: 0; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            line-height: 1.6; min-height: 100vh;
          }
          .container { 
            max-width: 600px; margin: 40px auto; background: white; 
            border-radius: 20px; overflow: hidden; 
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); 
            color: white; padding: 50px 40px; text-align: center; position: relative;
          }
          .header::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="75" cy="75" r="1" fill="rgba(255,255,255,0.05)"/><circle cx="50" cy="10" r="0.5" fill="rgba(255,255,255,0.1)"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
            opacity: 0.5;
          }
          .logo-container {
            position: relative; z-index: 2;
            background: rgba(255,255,255,0.15); 
            width: 100px; height: 100px; border-radius: 50%; 
            margin: 0 auto 30px auto; display: flex; 
            align-items: center; justify-content: center;
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255,255,255,0.2);
          }
          .logo { font-size: 48px; }
          .header h1 { position: relative; z-index: 2; margin: 0; font-size: 32px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header p { position: relative; z-index: 2; margin: 15px 0 0 0; opacity: 0.95; font-size: 18px; font-weight: 500; }
          
          .content { padding: 50px 40px; color: #2d3748; }
          .greeting { color: #4facfe; margin-top: 0; font-size: 28px; font-weight: 700; }
          .intro { font-size: 18px; color: #4a5568; margin-bottom: 25px; line-height: 1.7; }
          
          .cta-container { text-align: center; margin: 40px 0; }
          .cta-button { 
            display: inline-block; 
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); 
            color: white; text-decoration: none; 
            padding: 20px 40px; border-radius: 15px; 
            font-weight: 700; font-size: 18px;
            box-shadow: 0 8px 25px rgba(79, 172, 254, 0.4);
            transition: all 0.3s ease;
            border: none; cursor: pointer;
          }
          .cta-button:hover { transform: translateY(-2px); box-shadow: 0 12px 35px rgba(79, 172, 254, 0.5); }
          
          .features { 
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); 
            padding: 30px; border-radius: 15px; margin: 35px 0;
            border: 1px solid #e2e8f0;
          }
          .features h3 { color: #2d3748; margin: 0 0 25px 0; font-size: 22px; font-weight: 700; text-align: center; }
          .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; }
          .feature-item { text-align: center; }
          .feature-icon { font-size: 32px; margin-bottom: 12px; display: block; }
          .feature-text { color: #4a5568; font-weight: 600; font-size: 14px; line-height: 1.4; }
          
          .tip-box { 
            background: linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%); 
            padding: 25px; border-radius: 12px; 
            border-left: 5px solid #4facfe; margin: 30px 0;
          }
          .tip-box strong { color: #0066cc; }
          
          .warning { 
            background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); 
            border: 2px solid #ffc107; border-radius: 12px; 
            padding: 20px; margin: 25px 0; color: #856404; 
            font-weight: 600; text-align: center;
          }
          
          .link-backup { 
            word-break: break-all; color: #4facfe; 
            background: #f8fafc; padding: 15px; 
            border-radius: 10px; font-size: 14px; 
            margin: 20px 0; border-left: 4px solid #4facfe; 
            font-family: 'Monaco', 'Menlo', monospace;
          }
          
          .footer { 
            background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%); 
            color: white; padding: 40px; text-align: center; 
          }
          .footer a { color: #90cdf4; text-decoration: none; }
          .footer-logo { font-size: 24px; margin-bottom: 15px; }
          
          .social-links { margin: 25px 0; }
          .social-links a { 
            color: #90cdf4; text-decoration: none; 
            margin: 0 15px; font-weight: 500;
          }
          
          @media (max-width: 600px) {
            .container { margin: 20px; }
            .header, .content, .footer { padding: 30px 25px; }
            .header h1 { font-size: 26px; }
            .greeting { font-size: 24px; }
            .feature-grid { grid-template-columns: 1fr; gap: 15px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-container">
              <span class="logo">🧠</span>
            </div>
            <h1>Welcome to Jacal!</h1>
            <p>Master any subject with intelligent flashcards</p>
          </div>
          
          <div class="content">
            <h2 class="greeting">Hi ${userName || 'there'}! 👋</h2>
            
            <p class="intro">
              🎉 <strong>Congratulations!</strong> You've just joined thousands of students who are revolutionizing their learning with <strong>Jacal</strong>. 
              We're excited to help you master any subject with our intelligent flashcard system.
            </p>
            
            <p style="font-size: 16px; color: #4a5568;">
              To unlock your full learning potential and start creating flashcards, please verify your email address:
            </p>
            
            <div class="cta-container">
              <a href="${confirmationUrl}" class="cta-button">
                ✅ Verify Email & Start Learning
              </a>
            </div>
            
            <div class="warning">
              ⏰ <strong>Important:</strong> This verification link expires in 24 hours for your security.
            </div>
            
            <div class="features">
              <h3>🚀 What awaits you at Jacal:</h3>
              <div class="feature-grid">
                <div class="feature-item">
                  <span class="feature-icon">📚</span>
                  <div class="feature-text">Smart Flashcard Creation</div>
                </div>
                <div class="feature-item">
                  <span class="feature-icon">🧠</span>
                  <div class="feature-text">Spaced Repetition Learning</div>
                </div>
                <div class="feature-item">
                  <span class="feature-icon">📊</span>
                  <div class="feature-text">Progress Tracking</div>
                </div>
                <div class="feature-item">
                  <span class="feature-icon">⚡</span>
                  <div class="feature-text">Speed Focus Mode</div>
                </div>
              </div>
            </div>
            
            <div class="tip-box">
              💡 <strong>Pro Tip:</strong> Start with 5-10 flashcards on a topic you're currently studying. 
              Consistency beats cramming every time! Our spaced repetition algorithm will help you remember more with less effort.
            </div>
            
            <p style="font-size: 14px; color: #718096; margin-top: 30px;">
              <strong>Button not working?</strong> Copy and paste this link into your browser:
            </p>
            <div class="link-backup">${confirmationUrl}</div>
            
            <p style="font-size: 16px; margin-top: 40px; color: #4a5568;">
              Questions? Just reply to this email - our team at Jacal loves helping students succeed! 🌟
            </p>
            
            <p style="color: #718096; font-style: italic; margin-top: 35px; text-align: center;">
              Happy learning,<br>
              <strong>The Jacal Team</strong> 🎓
            </p>
          </div>
          
          <div class="footer">
            <div class="footer-logo">🧠 Jacal</div>
            <p style="margin: 15px 0;">
              <strong>Need help?</strong> We're here for you!
            </p>
            <p style="margin: 10px 0;">
              📧 Email: <a href="mailto:${EMAIL_CONFIG.SUPPORT_EMAIL}">${EMAIL_CONFIG.SUPPORT_EMAIL}</a>
            </p>
            <p style="margin: 10px 0;">
              🌐 Website: <a href="${EMAIL_CONFIG.WEBSITE_URL}">${EMAIL_CONFIG.WEBSITE_URL}</a>
            </p>
            
            <div class="social-links">
              <a href="${EMAIL_CONFIG.WEBSITE_URL}">Visit Jacal</a>
              <a href="${EMAIL_CONFIG.WEBSITE_URL}/about">About Us</a>
              <a href="${EMAIL_CONFIG.WEBSITE_URL}/support">Support</a>
            </div>
            
            <p style="margin: 25px 0 10px 0; color: #a0aec0; font-size: 12px;">
              © 2024 Jacal Learning Platform. Empowering learners worldwide.<br>
              If you didn't create this account, you can safely ignore this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  })
};

// Email Service Class
class JacalEmailService {
  constructor() {
    this.apiKey = EMAIL_CONFIG.RESEND_API_KEY;
    this.apiUrl = EMAIL_CONFIG.RESEND_API_URL;
  }

  // Check if service is configured
  isConfigured() {
    return !!this.apiKey;
  }

  // Send email directly via Resend API
  async sendEmail(to, template, type = 'confirmation') {
    if (!this.isConfigured()) {
      console.warn('Resend API key not configured');
      throw new Error('Resend API key not configured');
    }

    try {
      console.log('📧 Sending Jacal email via Resend:', { to, type, subject: template.subject });

      const emailData = {
        from: `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_EMAIL}>`,
        to: [to],
        subject: template.subject,
        html: template.html
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Resend API error:', response.status, errorText);
        throw new Error(`Resend API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Jacal email sent successfully:', result.id);
      return result;
    } catch (error) {
      console.error('❌ Jacal email service error:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  async sendConfirmationEmail(userEmail, confirmationUrl, userName = '') {
    const template = EMAIL_TEMPLATES.emailConfirmation(confirmationUrl, userEmail, userName);
    return this.sendEmail(userEmail, template, 'confirmation');
  }

  // Generate secure token for email verification
  generateVerificationToken() {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    const randomPart2 = Math.random().toString(36).substring(2, 15);
    return `jacal_${timestamp}_${randomPart}_${randomPart2}`;
  }

  // Store verification token in database
  async storeVerificationToken(userId, email, token, type = 'email_confirmation') {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours for email verification

      const { data, error } = await supabase
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
        console.error('Error storing verification token:', error);
        throw new Error(`Failed to store verification token: ${error.message}`);
      }

      console.log('✅ Jacal verification token stored successfully');
      return token;
    } catch (error) {
      console.error('Store verification token error:', error);
      throw error;
    }
  }

  // Verify token
  async verifyToken(token, type = 'email_confirmation') {
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

      // Check if token is expired
      const now = new Date();
      const expiresAt = new Date(data.expires_at);
      
      if (now > expiresAt) {
        // Delete expired token
        await supabase
          .from('email_verifications')
          .delete()
          .eq('token', token);
        
        throw new Error('Verification token has expired');
      }

      // Check if token was already used
      if (data.used_at) {
        throw new Error('Verification token has already been used');
      }

      // Mark token as used
      await supabase
        .from('email_verifications')
        .update({ used_at: new Date().toISOString() })
        .eq('id', data.id);

      console.log('✅ Jacal token verified successfully');
      return data;
    } catch (error) {
      console.error('Verify token error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const emailService = new JacalEmailService();