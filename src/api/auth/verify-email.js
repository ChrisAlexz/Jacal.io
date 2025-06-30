// api/auth/verify-email.js - Vercel serverless function for email verification
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, email } = req.body;

    if (!token || !email) {
      return res.status(400).json({ error: 'Verification token and email are required' });
    }

    // Find pending user by token and email
    const { data: pendingUser, error: findError } = await supabase
      .from('pending_users')
      .select('*')
      .eq('verification_token', token)
      .eq('email', email.toLowerCase())
      .single();

    if (findError || !pendingUser) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(pendingUser.expires_at);
    
    if (now > expiresAt) {
      // Delete expired pending user
      await supabase.from('pending_users').delete().eq('id', pendingUser.id);
      return res.status(400).json({ error: 'Verification token has expired. Please request a new verification email.' });
    }

    // Create user in auth.users using Supabase Admin API
    const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: pendingUser.email,
      password: generateRandomPassword(), // Temporary password
      email_confirm: true,
      user_metadata: {
        name: pendingUser.full_name,
        email_verified: true,
        picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(pendingUser.full_name)}&background=4facfe&color=fff&size=200`
      }
    });

    if (createUserError) {
      console.error('Error creating user in auth.users:', createUserError);
      if (createUserError.message.includes('already registered')) {
        // User already exists, clean up pending user
        await supabase.from('pending_users').delete().eq('id', pendingUser.id);
        return res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
      }
      return res.status(500).json({ error: 'Failed to create user account. Please try again.' });
    }

    // Update user with the actual password hash
    try {
      const { error: passwordUpdateError } = await supabase
        .from('auth.users')
        .update({ 
          encrypted_password: pendingUser.password_hash,
          updated_at: new Date().toISOString()
        })
        .eq('id', newUser.user.id);

      if (passwordUpdateError) {
        console.error('Failed to update password hash:', passwordUpdateError);
        // Continue anyway - user can reset password if needed
      }
    } catch (updateError) {
      console.error('Password update error:', updateError);
      // Continue anyway - user can reset password if needed
    }

    // Clean up - delete pending user
    await supabase.from('pending_users').delete().eq('id', pendingUser.id);

    res.status(200).json({
      success: true,
      message: 'Email verified successfully! You can now sign in to your account.',
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        name: pendingUser.full_name
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'An error occurred during email verification. Please try again.' });
  }
}

function generateRandomPassword() {
  return Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12) + '!A1';
}