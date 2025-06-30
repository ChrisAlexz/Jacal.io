// src/components/authentication/EmailVerification.jsx - Updated for Custom Backend
import React, { useEffect, useState, useContext } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
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
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: token,
          email: email
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error && data.error.includes('expired')) {
          setStatus('expired');
          setMessage('This verification link has expired. Please request a new one.');
        } else if (data.error && data.error.includes('used')) {
          setStatus('success');
          setMessage('This email has already been verified! You can sign in to your account.');
          setTimeout(() => {
            navigate('/register?verified=true');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed. Please try again or contact support.');
        }
        return;
      }

      // Success
      setStatus('success');
      setMessage('Your email has been successfully verified! You can now sign in to your account and start learning with Jacal.');

      setTimeout(() => {
        navigate('/register?verified=true');
      }, 3000);

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
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      
      // Try to resend by calling the signup endpoint with special flag
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: userEmail,
          password: 'resend_verification', // Special flag
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