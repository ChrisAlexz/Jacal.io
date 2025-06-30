// src/utils/emailService.js - Fixed version for Hostinger SMTP
import { supabase } from '../supabase';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const emailService = {
  // Generate a secure verification token
  generateVerificationToken: () => {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    const randomPart2 = Math.random().toString(36).substring(2, 15);
    return `jacal_${timestamp}_${randomPart}_${randomPart2}`;
  },

  // Check if email service is configured
  isConfigured: () => {
    return !!(process.env.REACT_APP_FROM_EMAIL && API_BASE_URL);
  },

  // Store verification token in database
  storeVerificationToken: async (userId, email, token, type) => {
    try {
      const expiresAt = new Date();
      
      // Set expiration time based on token type
      if (type === 'password_reset') {
        expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour for password reset
      } else {
        expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours for email verification
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

      if (error) {
        console.error('Error storing verification token');
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in storeVerificationToken');
      throw error;
    }
  },

  // Verify token
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

      return data;
    } catch (error) {
      console.error('Verify token error');
      throw error;
    }
  },

  // Send confirmation email via Hostinger SMTP
  sendConfirmationEmail: async (email, confirmationUrl, userName) => {
    try {
      // Validate inputs
      if (!email || !confirmationUrl) {
        throw new Error('Missing required parameters');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }

      // Sanitize userName
      const safeName = userName ? userName.replace(/[<>]/g, '').trim() : '';
      
      const emailHtml = `
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
            .logo-container {
              background: rgba(255,255,255,0.15); 
              width: 100px; height: 100px; border-radius: 50%; 
              margin: 0 auto 30px auto; display: flex; 
              align-items: center; justify-content: center;
              backdrop-filter: blur(10px);
              border: 2px solid rgba(255,255,255,0.2);
            }
            .logo { font-size: 48px; }
            .header h1 { margin: 0; font-size: 32px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header p { margin: 15px 0 0 0; opacity: 0.95; font-size: 18px; font-weight: 500; }
            
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
            }
            
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
              <h2 class="greeting">Hi ${safeName || 'there'}! 👋</h2>
              
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
              <div style="font-size: 24px; margin-bottom: 15px;">🧠 Jacal</div>
              <p style="margin: 15px 0;">
                <strong>Need help?</strong> We're here for you!
              </p>
              <p style="margin: 10px 0;">
                📧 Email: <a href="mailto:${process.env.REACT_APP_SUPPORT_EMAIL || 'support@jacal.io'}">${process.env.REACT_APP_SUPPORT_EMAIL || 'support@jacal.io'}</a>
              </p>
              <p style="margin: 10px 0;">
                🌐 Website: <a href="${process.env.REACT_APP_WEBSITE_URL || 'https://jacal.io'}">${process.env.REACT_APP_WEBSITE_URL || 'https://jacal.io'}</a>
              </p>
              
              <p style="margin: 25px 0 10px 0; color: #a0aec0; font-size: 12px;">
                © 2024 Jacal Learning Platform. Empowering learners worldwide.<br>
                If you didn't create this account, you can safely ignore this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const response = await fetch(`${API_BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email,
          subject: `🎓 Welcome to Jacal! Verify your email to start learning`,
          html: emailHtml,
          type: 'confirmation',
          from: {
            name: process.env.REACT_APP_FROM_NAME || 'Jacal Learning Platform',
            address: process.env.REACT_APP_FROM_EMAIL || 'support@jacal.io'
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Hostinger confirmation email sent successfully');
      return result;
    } catch (error) {
      console.error('Error sending confirmation email');
      throw error;
    }
  },

  // Send password reset email via Hostinger SMTP
  sendPasswordResetEmail: async (email, resetUrl, userName) => {
    try {
      if (!email || !resetUrl) {
        throw new Error('Missing required parameters');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }

      const safeName = userName ? userName.replace(/[<>]/g, '').trim() : '';
      
      const resetEmailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Jacal Password</title>
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
              background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); 
              color: white; padding: 50px 40px; text-align: center;
            }
            .logo-container {
              background: rgba(255,255,255,0.15); 
              width: 100px; height: 100px; border-radius: 50%; 
              margin: 0 auto 30px auto; display: flex; 
              align-items: center; justify-content: center;
              backdrop-filter: blur(10px);
              border: 2px solid rgba(255,255,255,0.2);
            }
            .logo { font-size: 48px; }
            .header h1 { margin: 0; font-size: 32px; font-weight: 700; }
            .header p { margin: 15px 0 0 0; opacity: 0.95; font-size: 18px; font-weight: 500; }
            
            .content { padding: 50px 40px; color: #2d3748; }
            .greeting { color: #ff6b35; margin-top: 0; font-size: 28px; font-weight: 700; }
            
            .cta-container { text-align: center; margin: 40px 0; }
            .cta-button { 
              display: inline-block; 
              background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); 
              color: white; text-decoration: none; 
              padding: 20px 40px; border-radius: 15px; 
              font-weight: 700; font-size: 18px;
              box-shadow: 0 8px 25px rgba(255, 107, 53, 0.4);
            }
            
            .security-notice { 
              background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); 
              border: 2px solid #ffc107; border-radius: 12px; 
              padding: 20px; margin: 25px 0; color: #856404; 
              font-weight: 600; text-align: center;
            }
            
            .link-backup { 
              word-break: break-all; color: #ff6b35; 
              background: #f8fafc; padding: 15px; 
              border-radius: 10px; font-size: 14px; 
              margin: 20px 0; border-left: 4px solid #ff6b35; 
              font-family: 'Monaco', 'Menlo', monospace;
            }
            
            .footer { 
              background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%); 
              color: white; padding: 40px; text-align: center; 
            }
            .footer a { color: #90cdf4; text-decoration: none; }
            
            @media (max-width: 600px) {
              .container { margin: 20px; }
              .header, .content, .footer { padding: 30px 25px; }
              .header h1 { font-size: 26px; }
              .greeting { font-size: 24px; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo-container">
                <span class="logo">🔒</span>
              </div>
              <h1>Password Reset Request</h1>
              <p>Secure your Jacal account</p>
            </div>
            
            <div class="content">
              <h2 class="greeting">Hi ${safeName || 'there'}! 👋</h2>
              
              <p style="font-size: 18px; color: #4a5568; margin-bottom: 25px; line-height: 1.7;">
                We received a request to reset the password for your Jacal account associated with <strong>${email}</strong>.
              </p>
              
              <p style="font-size: 16px; color: #4a5568;">
                Click the button below to create a new password:
              </p>
              
              <div class="cta-container">
                <a href="${resetUrl}" class="cta-button">
                  🔒 Reset My Password
                </a>
              </div>
              
              <div class="security-notice">
                ⏰ <strong>Security Notice:</strong> This password reset link expires in 1 hour for your security. 
                If you didn't request this reset, please ignore this email.
              </div>
              
              <p style="font-size: 14px; color: #718096; margin-top: 30px;">
                <strong>Button not working?</strong> Copy and paste this link into your browser:
              </p>
              <div class="link-backup">${resetUrl}</div>
              
              <p style="font-size: 16px; margin-top: 40px; color: #4a5568;">
                If you didn't request this password reset, please contact our support team immediately.
              </p>
              
              <p style="color: #718096; font-style: italic; margin-top: 35px; text-align: center;">
                Stay secure,<br>
                <strong>The Jacal Security Team</strong> 🛡️
              </p>
            </div>
            
            <div class="footer">
              <p style="margin: 15px 0;">
                📧 Email: <a href="mailto:${process.env.REACT_APP_SUPPORT_EMAIL || 'support@jacal.io'}">${process.env.REACT_APP_SUPPORT_EMAIL || 'support@jacal.io'}</a>
              </p>
              <p style="margin: 10px 0;">
                🌐 Website: <a href="${process.env.REACT_APP_WEBSITE_URL || 'https://jacal.io'}">${process.env.REACT_APP_WEBSITE_URL || 'https://jacal.io'}</a>
              </p>
              
              <p style="margin: 25px 0 10px 0; color: #a0aec0; font-size: 12px;">
                © 2024 Jacal Learning Platform. Empowering learners worldwide.<br>
                This email was sent from a secure, monitored system.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const response = await fetch(`${API_BASE_URL}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: email,
          subject: `🔒 Reset Your Jacal Password`,
          html: resetEmailHtml,
          type: 'password_reset',
          from: {
            name: process.env.REACT_APP_FROM_NAME || 'Jacal Learning Platform',
            address: process.env.REACT_APP_FROM_EMAIL || 'support@jacal.io'
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Hostinger password reset email sent successfully');
      return result;
    } catch (error) {
      console.error('Error sending password reset email');
      throw error;
    }
  },

  // Test email functionality
  testEmailService: async (testEmail) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/email/send-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: testEmail
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error testing email service');
      throw error;
    }
  },

  // Check SMTP connection
  checkConnection: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/email/test`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error checking SMTP connection');
      throw error;
    }
  }
};

export default emailService;