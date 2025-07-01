// src/components/authentication/EmailVerification.jsx - UNIFIED: Handle magic link auto sign-in
import React, { useEffect, useState, useContext } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import UserAuthContext from '../context/UserAuthContext';
import getEnvironmentConfig from '../../config/environment';
import { FaCheckCircle, FaExclamationTriangle, FaSpinner, FaEnvelope } from 'react-icons/fa';
import '../../styles/Register.css';

export default function EmailVerification() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useContext(UserAuthContext);
  const envConfig = getEnvironmentConfig();
  
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('Verifying your email address...');
  const [userEmail, setUserEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    const email = searchParams.get('email');
    const userId = searchParams.get('user_id');
    
    if (!token || !email) {
      setStatus('error');
      setMessage('Invalid verification link. Please check your email for the correct link.');
      return;
    }

    setUserEmail(email);
    verifyEmailToken(token, email, userId);
  }, [searchParams]);

  const verifyEmailToken = async (token, email, userId) => {
    try {
      const apiUrl = envConfig.isLocal 
        ? 'http://localhost:3002/api/auth/verify-email'
        : '/api/auth/verify-email';

      console.log('🔍 Verifying token via:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: token,
          email: email,
          user_id: userId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error && data.error.includes('expired')) {
          setStatus('expired');
          setMessage('This verification link has expired. Please request a new one.');
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed. Please try again or contact support.');
        }
        return;
      }

      // UNIFIED: Handle successful verification
      setStatus('success');

      if (data.autoSignIn && data.magicLink) {
        // Auto sign-in with magic link
        setMessage('Email verified successfully! Signing you in automatically...');
        console.log('🔗 Using magic link for auto sign-in');
        
        // Redirect to magic link which will handle the sign-in
        setTimeout(() => {
          window.location.href = data.magicLink;
        }, 1000);
        
      } else if (data.redirectToSignIn) {
        // Manual sign-in required
        setMessage('Email verified successfully! You can now sign in with your email and password.');
        
        setTimeout(() => {
          navigate(`/register?verified=true&email=${encodeURIComponent(email)}`);
        }, 3000);
        
      } else {
        // Fallback
        setMessage('Email verified successfully! Please sign in to continue.');
        
        setTimeout(() => {
          navigate(`/register?verified=true&email=${encodeURIComponent(email)}`);
        }, 3000);
      }

    } catch (error) {
      console.error('Verification error:', error);
      setStatus('error');
      setMessage('Verification failed due to a network error. Please try again.');
    }
  };

  const handleResendVerification = async () => {
    if (!userEmail) return;

    setResendLoading(true);

    try {
      const apiUrl = envConfig.isLocal 
        ? 'http://localhost:3002/api/auth/signup'
        : '/api/auth/signup';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: userEmail,
          password: 'resend_verification',
          fullName: '',
          resend: true
        })
      });

      if (response.ok) {
        setMessage(`A new verification email has been sent to ${userEmail}. Please check your inbox.`);
        setStatus('success');
      } else {
        const errorData = await response.json();
        setMessage(errorData.error || 'Failed to resend verification email. Please try again later or contact support.');
      }

    } catch (error) {
      console.error('Resend verification error:', error);
      setMessage('Failed to resend verification email due to a network error. Please try again later.');
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
      case 'success': return 'Success!';
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
          {envConfig.isLocal && (
            <p style={{ fontSize: '0.8rem', color: '#ffc107', marginTop: '8px' }}>
              🔧 Local Development Mode - Unified Flow
            </p>
          )}
        </div>

        {/* Show resend option for failed/expired verification */}
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
                  Sending...
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

        {/* Success state with auto-redirect info */}
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
                  {message.includes('automatically') 
                    ? 'Your account is now active. Signing you in automatically...' 
                    : 'Your Jacal account is now active and ready to use.'
                  }
                </p>
              </div>
              
              {/* Manual sign-in option - only show if not auto-signing in */}
              {!message.includes('automatically') && (
                <p>
                  <Link to={`/register?verified=true&email=${encodeURIComponent(userEmail)}`} className="legal-link" style={{ 
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
              )}
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

        {/* Progress indicator for auto sign-in */}
        {status === 'success' && message.includes('automatically') && (
          <div style={{ 
            width: '100%', 
            height: '4px', 
            background: 'rgba(255,255,255,0.1)', 
            borderRadius: '2px',
            overflow: 'hidden',
            marginTop: '24px'
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
              borderRadius: '2px',
              animation: 'progressSlide 2s ease-in-out infinite'
            }} />
          </div>
        )}

        {/* Debug info for local development */}
        {envConfig.isLocal && (
          <div style={{ 
            marginTop: '20px', 
            padding: '10px', 
            background: 'rgba(255, 193, 7, 0.1)',
            borderRadius: '8px',
            fontSize: '0.8rem',
            color: '#856404'
          }}>
            <strong>🔧 Debug Info:</strong><br/>
            Token: {searchParams.get('token')?.substring(0, 20)}...<br/>
            Email: {userEmail}<br/>
            User ID: {searchParams.get('user_id')}<br/>
            Environment: Unified Flow
          </div>
        )}
      </div>

      <style>{`
        @keyframes progressSlide {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}