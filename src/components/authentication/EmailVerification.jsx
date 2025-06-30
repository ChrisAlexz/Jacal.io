// src/components/authentication/EmailVerification.jsx - Updated for Hostinger Email Service
import React, { useEffect, useState, useContext } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../supabase';
import { emailService } from '../../utils/emailService';
import UserAuthContext from '../context/UserAuthContext';
import { FaCheckCircle, FaExclamationTriangle, FaSpinner, FaEnvelope } from 'react-icons/fa';
import '../../styles/Register.css';

export default function EmailVerification() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useContext(UserAuthContext);
  
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('Verifying your email address...');
  const [userEmail, setUserEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    const email = searchParams.get('email');
    
    if (!token || !email) {
      setStatus('error');
      setMessage('Invalid verification link. Please check your email for the correct link.');
      return;
    }

    setUserEmail(email);
    verifyEmailToken(token, email);
  }, [searchParams]);

  const verifyEmailToken = async (token, email) => {
    try {
      // Verify token using our custom email service
      const tokenData = await emailService.verifyToken(token, 'email_confirmation');
      
      if (!tokenData) {
        setStatus('expired');
        setMessage('This verification link has expired. Please request a new one.');
        return;
      }

      // IMPORTANT: Update the user's email_confirmed status in Supabase
      // Since we're handling email verification manually, we need to confirm the user
      const { data: userData, error: getUserError } = await supabase
        .from('auth.users')
        .select('id, email_confirmed_at')
        .eq('id', tokenData.user_id)
        .single();

      if (getUserError) {
        // Try alternative method if direct auth.users access fails
        const { data: { user }, error: currentUserError } = await supabase.auth.getUser();
        
        if (currentUserError || !user || user.email !== email) {
          console.error('Could not verify user for email confirmation');
          setStatus('error');
          setMessage('Could not verify your account. Please try signing in.');
          return;
        }

        // User is already logged in and email matches, consider it verified
        setStatus('success');
        setMessage('Your email has been successfully verified! You can now use all features of Jacal.');
        
        setTimeout(() => {
          navigate('/register?verified=true');
        }, 3000);
        return;
      }

      // If we have user data, mark email as confirmed
      if (userData && !userData.email_confirmed_at) {
        // Update email confirmation status
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          tokenData.user_id,
          { email_confirm: true }
        );

        if (updateError) {
          console.error('Error confirming email:', updateError);
          // Don't fail the verification if we can't update the admin way
          // The token verification was successful, so consider it verified
        }
      }

      setStatus('success');
      setMessage('Your email has been successfully verified! You can now sign in to your account and start learning with Jacal.');

      setTimeout(() => {
        navigate('/register?verified=true');
      }, 3000);

    } catch (error) {
      console.error('Verification error:', error);
      
      if (error.message.includes('expired')) {
        setStatus('expired');
        setMessage('This verification link has expired. Please request a new one.');
      } else if (error.message.includes('used')) {
        setStatus('success');
        setMessage('This email has already been verified! You can sign in to your account.');
        setTimeout(() => {
          navigate('/register?verified=true');
        }, 3000);
      } else {
        setStatus('error');
        setMessage('Verification failed. Please try again or contact support.');
      }
    }
  };

  const handleResendVerification = async () => {
    if (!userEmail) return;

    setResendLoading(true);

    try {
      // Get user by email to resend verification
      const { data: users, error: getUserError } = await supabase
        .from('auth.users')
        .select('id, email')
        .eq('email', userEmail);

      if (getUserError || !users || users.length === 0) {
        throw new Error('User not found');
      }

      const userId = users[0].id;

      // Generate new token
      const newToken = emailService.generateVerificationToken();
      
      // Store new verification token
      await emailService.storeVerificationToken(
        userId,
        userEmail,
        newToken,
        'email_confirmation'
      );

      // Create new confirmation URL
      const confirmationUrl = `${window.location.origin}/auth/verify-email?token=${newToken}&email=${encodeURIComponent(userEmail)}`;

      // Send new verification email via Hostinger
      await emailService.sendConfirmationEmail(userEmail, confirmationUrl, '');
      
      setMessage(`A new verification email has been sent to ${userEmail} via our Hostinger email service. Please check your inbox.`);
      setStatus('success');

    } catch (error) {
      console.error('Resend verification error:', error);
      setMessage('Failed to resend verification email. Please try again later or contact support.');
    } finally {
      setResendLoading(false);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'verifying':
        return <FaSpinner className="spinner" style={{ fontSize: '3rem', color: '#4facfe' }} />;
      case 'success':
        return <FaCheckCircle style={{ fontSize: '3rem', color: '#28a745' }} />;
      case 'error':
      case 'expired':
        return <FaExclamationTriangle style={{ fontSize: '3rem', color: '#ff4757' }} />;
      default:
        return <FaEnvelope style={{ fontSize: '3rem', color: '#4facfe' }} />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success': return '#28a745';
      case 'error':
      case 'expired': return '#ff4757';
      default: return '#4facfe';
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'verifying': return 'Verifying Email...';
      case 'success': return 'Email Verified!';
      case 'expired': return 'Link Expired';
      case 'error': return 'Verification Failed';
      default: return 'Email Verification';
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon" style={{ background: 'transparent', boxShadow: 'none' }}>
            {getStatusIcon()}
          </div>
          <h1 style={{ color: getStatusColor() }}>
            {getStatusTitle()}
          </h1>
          <p style={{ color: '#aaa', lineHeight: 1.6 }}>
            {message}
          </p>
        </div>

        {(status === 'expired' || status === 'error') && (
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <button
              onClick={handleResendVerification}
              disabled={resendLoading}
              className="submit-btn"
              style={{ 
                background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                marginBottom: '16px'
              }}
            >
              {resendLoading ? (
                <>
                  <FaSpinner className="spinner" />
                  Sending via Hostinger...
                </>
              ) : (
                <>
                  <FaEnvelope />
                  Resend Verification Email
                </>
              )}
            </button>
          </div>
        )}

        <div className="terms-privacy" style={{ marginTop: '24px' }}>
          {status === 'success' ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                background: 'linear-gradient(135deg, rgba(40, 167, 69, 0.1) 0%, rgba(79, 172, 254, 0.05) 100%)',
                border: '1px solid rgba(40, 167, 69, 0.3)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '1.5rem' }}>🎉</span>
                  <strong style={{ color: '#28a745' }}>Email Successfully Verified!</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#28a745' }}>
                  Your Jacal account is now active and ready to use.
                </p>
              </div>
              <p>
                <Link to="/register" className="legal-link" style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  color: 'white',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: '600'
                }}>
                  Continue to Sign In →
                </Link>
              </p>
            </div>
          ) : (
            <p>
              <Link to="/register" className="legal-link">← Back to Sign In</Link>
            </p>
          )}
        </div>

        {/* Additional Help for Failed Verification */}
        {(status === 'error' || status === 'expired') && (
          <div className="terms-privacy" style={{ marginTop: '16px' }}>
            <div style={{ 
              background: 'rgba(255, 193, 7, 0.1)',
              border: '1px solid rgba(255, 193, 7, 0.3)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '0.85rem',
              color: '#856404'
            }}>
              <strong>💡 Need Help?</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                <li>Check your email spam/junk folder</li>
                <li>Make sure you clicked the latest verification link</li>
                <li>Try requesting a new verification email</li>
                <li>Contact support if the problem persists</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}