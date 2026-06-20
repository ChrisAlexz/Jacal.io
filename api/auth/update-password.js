// api/auth/update-password.js - CUSTOM: Update password directly in Supabase
import { createClient } from '@supabase/supabase-js';
import { applyCors, rateLimit, clientIp } from '../_lib/security.js';

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

  // Throttle reset-token brute-force attempts.
  if (!rateLimit(`update-pw:${clientIp(req)}`, { max: 10, windowMs: 60_000 })) {
    return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
  }

  try {
    const { resetToken, email, newPassword } = req.body;

    if (!resetToken || !email || !newPassword) {
      return res.status(400).json({ error: 'Reset token, email, and new password are required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    console.log('🔑 Processing password update with custom token...');

    // Verify the reset token
    const { data: resetRecord, error: tokenError } = await supabase
      .from('password_resets')
      .select('*')
      .eq('reset_token', resetToken)
      .eq('email', email.toLowerCase())
      .eq('used', false)
      .single();

    if (tokenError || !resetRecord) {
      console.log('❌ Invalid or expired reset token');
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(resetRecord.expires_at);
    
    if (now > expiresAt) {
      console.log('⏰ Token has expired, cleaning up...');
      await supabase.from('password_resets').delete().eq('id', resetRecord.id);
      return res.status(400).json({ error: 'Reset token has expired. Please request a new password reset.' });
    }

    console.log('✅ Token valid, finding user and updating password...');

    // Find the user by email
    const { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email);
    
    if (userError || !userData?.user) {
      console.error('❌ User not found:', email);
      return res.status(400).json({ error: 'User not found' });
    }

    // Update password directly in Supabase using Admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userData.user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('❌ Error updating password:', updateError);
      return res.status(500).json({ error: 'Failed to update password. Please try again.' });
    }

    // Mark reset token as used
    const { error: markUsedError } = await supabase
      .from('password_resets')
      .update({ 
        used: true,
        used_at: new Date().toISOString()
      })
      .eq('id', resetRecord.id);

    if (markUsedError) {
      console.error('❌ Error marking token as used:', markUsedError);
      // Don't fail the request since password was updated successfully
    }

    console.log('🎉 Password updated successfully for user:', userData.user.id);

    return res.status(200).json({
      success: true,
      message: 'Your password has been successfully updated! You can now sign in with your new password.',
      user: {
        id: userData.user.id,
        email: userData.user.email
      }
    });

  } catch (error) {
    console.error('❌ Password update error:', error);
    return res.status(500).json({ 
      error: 'An error occurred while updating your password. Please try again.' 
    });
  }
}