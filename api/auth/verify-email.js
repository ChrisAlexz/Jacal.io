// api/auth/verify-email.js - Email verification Vercel function
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // CORS headers
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
    console.log('📧 Email verification request received');
    const { token, email } = req.body;

    if (!token || !email) {
      return res.status(400).json({ error: 'Verification token and email are required' });
    }

    console.log('🔍 Looking for pending user with token...');

    // Find pending user by token and email
    const { data: pendingUser, error: findError } = await supabase
      .from('pending_users')
      .select('*')
      .eq('verification_token', token)
      .eq('email', email.toLowerCase())
      .single();

    if (findError || !pendingUser) {
      console.log('❌ Invalid or expired verification token');
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(pendingUser.expires_at);
    
    if (now > expiresAt) {
      console.log('⏰ Token has expired, cleaning up...');
      await supabase.from('pending_users').delete().eq('id', pendingUser.id);
      return res.status(400).json({ error: 'Verification token has expired. Please request a new verification email.' });
    }

    console.log('✅ Token valid, creating user account...');

    // Create user in auth.users using Supabase Admin API
    const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: pendingUser.email,
      password: generateRandomPassword(), // Temporary password - we'll update with hash
      email_confirm: true,
      user_metadata: {
        name: pendingUser.full_name,
        email_verified: true,
        picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(pendingUser.full_name)}&background=4facfe&color=fff&size=200`
      }
    });

    if (createUserError) {
      console.error('❌ Error creating user in auth.users:', createUserError);
      if (createUserError.message.includes('already registered')) {
        // User already exists, clean up pending user
        await supabase.from('pending_users').delete().eq('id', pendingUser.id);
        return res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
      }
      return res.status(500).json({ error: 'Failed to create user account. Please try again.' });
    }

    console.log('👤 User created in auth.users:', newUser.user.id);

    // Update the user's password hash directly in the database
    try {
      const { error: passwordUpdateError } = await supabase.rpc('update_user_password', {
        user_id: newUser.user.id,
        password_hash: pendingUser.password_hash
      });

      if (passwordUpdateError) {
        console.log('⚠️ Password hash update failed, user can reset password if needed');
      } else {
        console.log('🔐 Password hash updated successfully');
      }
    } catch (updateError) {
      console.log('⚠️ Password update error (user can reset password):', updateError.message);
    }

    // Clean up - delete pending user
    console.log('🧹 Cleaning up pending user...');
    await supabase.from('pending_users').delete().eq('id', pendingUser.id);

    console.log('🎉 Email verification complete');

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully! You can now sign in to your account.',
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        name: pendingUser.full_name
      }
    });

  } catch (error) {
    console.error('❌ Email verification error:', error);
    return res.status(500).json({ error: 'An error occurred during email verification. Please try again.' });
  }
}

function generateRandomPassword() {
  return Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12) + '!A1';
}