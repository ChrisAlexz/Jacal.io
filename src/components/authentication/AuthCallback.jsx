// src/components/authentication/AuthCallback.jsx - HANDLES AUTH REDIRECTS
import React, { useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase';
import UserAuthContext from '../context/UserAuthContext';
import { FaSpinner, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import '../../styles/Register.css';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { login } = useContext(UserAuthContext);
  const [searchParams] = useSearchParams();
  const [status, setStatus] = React.useState('loading'); // loading, success, error
  const [message, setMessage] = React.useState('Processing authentication...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the current URL hash and search params
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
        const type = hashParams.get('type') || searchParams.get('type');
        const error = hashParams.get('error') || searchParams.get('error');
        const errorDescription = hashParams.get('error_description') || searchParams.get('error_description');

        // Handle OAuth errors
        if (error) {
          console.error('OAuth error:', error, errorDescription);
          setStatus('error');
          
          if (error === 'access_denied') {
            setMessage('Authentication was cancelled. You can try signing in again.');
          } else {
            setMessage(errorDescription || 'Authentication failed. Please try again.');
          }
          
          // Redirect to register page after delay
          setTimeout(() => navigate('/register'), 3000);
          return;
        }

        // Handle different auth types
        if (type === 'recovery' || type === 'magiclink') {
          // Password reset or magic link - redirect to password reset with tokens
          if (accessToken) {
            const url = new URL('/auth/reset-password', window.location.origin);
            url.searchParams.set('access_token', accessToken);
            if (refreshToken) url.searchParams.set('refresh_token', refreshToken);
            url.searchParams.set('type', type);
            
            window.location.replace(url.toString());
            return;
          }
        }

        // Handle regular sign-in callback
        if (accessToken) {
          // Set the session with the tokens
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (sessionError) {
            console.error('Session error:', sessionError);
            setStatus('error');
            setMessage('Failed to establish session. Please try signing in again.');
            setTimeout(() => navigate('/register'), 3000);
            return;
          }

          if (data.user) {
            // Update context
            login(data.user);
            
            setStatus('success');
            setMessage('Successfully signed in! Redirecting...');
            
            // Clear URL parameters
            window.history.replaceState({}, document.title, '/');
            
            // Redirect to home
            setTimeout(() => navigate('/'), 1500);
            return;
          }
        }

        // If we get here, try to get the current session
        const { data: { session }, error: getSessionError } = await supabase.auth.getSession();
        
        if (getSessionError) {
          console.error('Get session error:', getSessionError);
          setStatus('error');
          setMessage('Authentication failed. Please try signing in again.');
          setTimeout(() => navigate('/register'), 3000);
          return;
        }

        if (session?.user) {
          login(session.user);
          setStatus('success');
          setMessage('Successfully signed in! Redirecting...');
          
          // Clear URL parameters
          window.history.replaceState({}, document.title, '/');
          
          setTimeout(() => navigate('/'), 1500);
        } else {
          // No session found, redirect to sign in
          setStatus('error');
          setMessage('No authentication session found. Redirecting to sign in...');
          setTimeout(() => navigate('/register'), 2000);
        }

      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage('An unexpected error occurred during authentication.');
        setTimeout(() => navigate('/register'), 3000);
      }
    };

    handleAuthCallback();
  }, [navigate, login, searchParams]);

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <FaSpinner className="spinner" style={{ fontSize: '3rem', color: '#4facfe' }} />;
      case 'success':
        return <FaCheckCircle style={{ fontSize: '3rem', color: '#28a745' }} />;
      case 'error':
        return <FaExclamationTriangle style={{ fontSize: '3rem', color: '#ff4757' }} />;
      default:
        return <FaSpinner className="spinner" style={{ fontSize: '3rem', color: '#4facfe' }} />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success': return '#28a745';
      case 'error': return '#ff4757';
      default: return '#4facfe';
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
            {status === 'loading' && 'Authenticating...'}
            {status === 'success' && 'Success!'}
            {status === 'error' && 'Authentication Failed'}
          </h1>
          <p style={{ color: '#aaa', lineHeight: 1.6 }}>
            {message}
          </p>
        </div>

        {/* Progress indicator for loading state */}
        {status === 'loading' && (
          <div style={{ 
            width: '100%', 
            height: '4px', 
            background: 'rgba(255,255,255,0.1)', 
            borderRadius: '2px',
            overflow: 'hidden',
            marginTop: '24px'
          }}>
            <div style={{
              width: '30%',
              height: '100%',
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              borderRadius: '2px',
              animation: 'progressSlide 2s ease-in-out infinite'
            }} />
          </div>
        )}

        {/* Additional info based on status */}
        {status === 'error' && (
          <div className="terms-privacy" style={{ marginTop: '24px' }}>
            <p>
              Having trouble? <a href="/register" className="legal-link">Try signing in again</a>
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="terms-privacy" style={{ marginTop: '24px' }}>
            <p style={{ color: '#28a745', fontWeight: '500' }}>
              Welcome back! Taking you to your dashboard...
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes progressSlide {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}