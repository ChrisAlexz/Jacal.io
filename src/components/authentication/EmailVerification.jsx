// components/authentication/EmailVerification.jsx - FIXED IMPORTS
import React, { useEffect, useState, useContext } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../supabase';
import { emailService } from '../../api/emailService'; // FIXED: correct path
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
      const tokenData = await emailService.verifyToken(token, 'email_confirmation');
      
      if (!tokenData) {
        setStatus('expired');
        setMessage('This verification link has expired. Please request a new one.');
        return;
      }

      setStatus('success');
      setMessage('Your email has been successfully verified! You can now sign in to your account.');

      setTimeout(() => {
        navigate('/register?verified=true');
      }, 3000);

    } catch (error) {
      console.error('Email verification error:', error);
      
      if (error.message.includes('expired')) {
        setStatus('expired');
        setMessage('This verification link has expired. Please request a new one.');
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
      const newToken = emailService.generateVerificationToken();
      const confirmationUrl = `${window.location.origin}/auth/verify-email?token=${newToken}&email=${encodeURIComponent(userEmail)}`;
      
      await emailService.sendConfirmationEmail(userEmail, confirmationUrl, '');
      setMessage(`A new verification email has been sent to ${userEmail}. Please check your inbox.`);
      setStatus('success');

    } catch (error) {
      console.error('Resend verification error:', error);
      setMessage('Failed to resend verification email. Please try again later.');
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

        <div className="terms-privacy" style={{ marginTop: '24px' }}>
          {status === 'success' ? (
            <p>
              <Link to="/register" className="legal-link">
                Continue to Sign In →
              </Link>
            </p>
          ) : (
            <p>
              <Link to="/register" className="legal-link">← Back to Sign In</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}