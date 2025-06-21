// src/utils/emailService.js - Production-safe email service
import { supabase } from '../supabase';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const emailService = {
  // Generate a secure verification token
  generateVerificationToken: () => {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

  // Store verification token in database
  storeVerificationToken: async (userId, email, token, type) => {
    try {
      const { error } = await supabase
        .from('verification_tokens')
        .insert({
          user_id: userId,
          email: email,
          token: token,
          type: type,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
          used: false
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

  // Send confirmation email via our Express server
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
          <title>Welcome to Jacal - Verify Your Email</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0; 
              padding: 0; 
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 20px; 
            }
            .header { 
              background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); 
              color: white; 
              padding: 40px 20px; 
              text-align: center; 
              border-radius: 12px 12px 0 0; 
            }
            .content { 
              background: white; 
              padding: 40px 20px; 
              border-radius: 0 0 12px 12px; 
              box-shadow: 0 4px 20px rgba(0,0,0,0.1); 
            }
            .button { 
              display: inline-block; 
              background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); 
              color: white; 
              text-decoration: none; 
              padding: 16px 32px; 
              border-radius: 8px; 
              font-weight: 600; 
              margin: 20px 0; 
            }
            .footer { 
              text-align: center; 
              margin-top: 30px; 
              color: #666; 
              font-size: 14px; 
            }
            .link-text {
              word-break: break-all; 
              background: #f5f5f5; 
              padding: 10px; 
              border-radius: 4px; 
              font-size: 14px;
              border: 1px solid #ddd;
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
              <h2>Hi ${safeName || 'there'}! 👋</h2>
              <p>Thank you for joining Jacal! We're excited to help you master new skills with our intelligent flashcard system.</p>
              
              <p>To get started, please verify your email address by clicking the button below:</p>
              
              <div style="text-align: center;">
                <a href="${confirmationUrl}" class="button">
                  ✅ Verify My Email
                </a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <div class="link-text">
                ${confirmationUrl}
              </div>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
              
              <h3>🚀 What's Next?</h3>
              <ul>
                <li><strong>Create Your First Set:</strong> Start building your flashcard collection</li>
                <li><strong>Smart Study Mode:</strong> Let our algorithm optimize your learning</li>
                <li><strong>Track Progress:</strong> Watch your knowledge grow with detailed analytics</li>
              </ul>
              
              <p>If you didn't create an account with Jacal, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>This link will expire in 24 hours for security reasons.</p>
              <p>© 2025 Jacal Learning Platform. All rights reserved.</p>
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
          subject: `Welcome to Jacal! Please verify your email address`,
          html: emailHtml,
          type: 'confirmation'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error sending confirmation email');
      throw error;
    }
  },

  // Verify token
  verifyToken: async (token, type) => {
    try {
      if (!token || !type) {
        throw new Error('Missing token or type');
      }

      const { data, error } = await supabase
        .from('verification_tokens')
        .select('*')
        .eq('token', token)
        .eq('type', type)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) {
        throw new Error('Invalid or expired token');
      }

      // Mark token as used
      await supabase
        .from('verification_tokens')
        .update({ used: true })
        .eq('id', data.id);

      return data;
    } catch (error) {
      console.error('Error verifying token');
      throw error;
    }
  }
};

export default emailService;