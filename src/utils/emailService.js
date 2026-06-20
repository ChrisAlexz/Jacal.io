// src/utils/emailService.js - SIMPLE: Just bypass Supabase emails entirely
import { logger } from './logger';
import { supabase } from '../supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Simple direct email sending - no queue, no complexity
async function sendEmailDirect(to, subject, html) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ to, subject, html })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send email');
    }

    return await response.json();
  } catch (error) {
    logger.error('Email send error:', error);
    throw error;
  }
}

export const emailService = {
  // Generate token
  generateVerificationToken: () => {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 15);
    return `jacal_${timestamp}_${randomPart}`;
  },

  // Store token in database
  storeVerificationToken: async (userId, email, token, type = 'email_confirmation') => {
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { error } = await supabase
        .from('email_verifications')
        .insert({
          user_id: userId,
          email: email,
          token: token,
          type: type,
          expires_at: expiresAt.toISOString()
        });

      if (error) throw error;
      return true;
    } catch (error) {
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
        throw new Error('Invalid verification token');
      }

      const now = new Date();
      const expiresAt = new Date(data.expires_at);
      
      if (now > expiresAt) {
        await supabase.from('email_verifications').delete().eq('token', token);
        throw new Error('Token expired');
      }

      if (data.used_at) {
        throw new Error('Token already used');
      }

      await supabase
        .from('email_verifications')
        .update({ used_at: new Date().toISOString() })
        .eq('token', token);

      return data;
    } catch (error) {
      throw error;
    }
  },

  // Send confirmation email - SIMPLE VERSION
  sendConfirmationEmail: async (email, confirmationUrl, userName) => {
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 30px; text-align: center; border-radius: 10px;">
        <h1>🧠 Welcome to Jacal!</h1>
        <p>Your intelligent learning journey starts here</p>
      </div>
      <div style="padding: 30px; background: #f9f9f9; margin-top: 20px; border-radius: 10px;">
        <h2>Hi ${userName || 'there'}! 👋</h2>
        <p>Thanks for joining Jacal! Click the button below to verify your email:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmationUrl}" style="background: #4facfe; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            ✅ Verify Email
          </a>
        </div>
        <p><strong>Link expires in 24 hours</strong></p>
        <p>Happy learning!<br>The Jacal Team</p>
      </div>
    </div>`;

    return sendEmailDirect(email, '🎓 Welcome to Jacal! Verify your email', html);
  }
};

export default emailService;