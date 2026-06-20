// api/auth/verify-email.js - UNIFIED: Mark user as confirmed in Supabase
import { createClient } from '@supabase/supabase-js';
import { applyCors, rateLimit, clientIp } from '../_lib/security.js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Throttle token-guessing attempts.
  if (!rateLimit(`verify:${clientIp(req)}`, { max: 20, windowMs: 60_000 })) {
    return res.status(429).json({ error: 'Too many requests. Please try again in a minute.' });
  }

  try {
    console.log('📧 Email verification request received');
    const { token, email, user_id } = req.body;

    if (!token || !email) {
      return res.status(400).json({ error: 'Verification token and email are required' });
    }

    console.log('🔍 Looking for verification token...');

    // Find verification record
    const { data: verification, error: findError } = await supabase
      .from('user_verifications')
      .select('*')
      .eq('verification_token', token)
      .eq('email', email.toLowerCase())
      .eq('verified', false)
      .single();

    if (findError || !verification) {
      console.log('❌ Invalid or expired verification token');
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Check if token has expired
    const now = new Date();
    const expiresAt = new Date(verification.expires_at);
    
    if (now > expiresAt) {
      console.log('⏰ Token has expired, cleaning up...');
      await supabase.from('user_verifications').delete().eq('id', verification.id);
      return res.status(400).json({ error: 'Verification token has expired. Please request a new verification email.' });
    }

    console.log('✅ Token valid, marking user as verified...');

    // UNIFIED: Mark user as email confirmed in Supabase auth.users
    const { error: confirmError } = await supabase.auth.admin.updateUserById(
      verification.user_id,
      { 
        email_confirm: true,
        user_metadata: {
          email_verified: true,
          name: verification.user_name || '',
          picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(verification.user_name || '')}&background=4facfe&color=fff&size=200`
        }
      }
    );

    if (confirmError) {
      console.error('❌ Error marking user as confirmed:', confirmError);
      return res.status(500).json({ error: 'Failed to verify user account. Please try again.' });
    }

    // Mark verification as complete
    const { error: updateError } = await supabase
      .from('user_verifications')
      .update({ 
        verified: true,
        verified_at: new Date().toISOString()
      })
      .eq('id', verification.id);

    if (updateError) {
      console.error('❌ Error updating verification record:', updateError);
      // Don't fail the request since the user is already confirmed
    }

    console.log('🎉 Email verification complete - user is now confirmed in Supabase');

    // Generate a sign-in link for auto login
    try {
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
        options: {
          redirectTo: `${getBaseUrl(req)}/auth/callback?verified=true`
        }
      });

      if (linkError || !linkData?.properties?.action_link) {
        console.log('⚠️ Failed to generate magic link, user will sign in manually');
        
        return res.status(200).json({
          success: true,
          message: 'Email verified successfully! You can now sign in with your email and password.',
          user: {
            id: verification.user_id,
            email: verification.email,
            verified: true
          },
          redirectToSignIn: true
        });
      }

      // Return magic link for auto sign-in
      return res.status(200).json({
        success: true,
        message: 'Email verified successfully! Signing you in...',
        user: {
          id: verification.user_id,
          email: verification.email,
          verified: true
        },
        magicLink: linkData.properties.action_link,
        autoSignIn: true
      });

    } catch (linkGenError) {
      console.log('⚠️ Magic link generation failed, manual sign-in required');
      
      return res.status(200).json({
        success: true,
        message: 'Email verified successfully! You can now sign in with your email and password.',
        user: {
          id: verification.user_id,
          email: verification.email,
          verified: true
        },
        redirectToSignIn: true
      });
    }

  } catch (error) {
    console.error('❌ Email verification error:', error);
    return res.status(500).json({ error: 'An error occurred during email verification. Please try again.' });
  }
}

function getBaseUrl(req) {
  const host = req.headers.host || 'jacal.io';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}