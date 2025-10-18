// src/components/authentication/Register.jsx - GOOGLE SIGN-IN ONLY
import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserAuthContext from '../context/UserAuthContext';
import { supabase } from '../../supabase';
import getEnvironmentConfig from '../../config/environment';
import { FaGoogle, FaSpinner } from 'react-icons/fa';
import '../../styles/Register.css';

export default function Register() {
  const navigate = useNavigate();
  const { isLoggedIn } = useContext(UserAuthContext);
  const envConfig = getEnvironmentConfig();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  // Redirect if already logged in
  useEffect(() => {
    if (isLoggedIn) {
      navigate('/');
    }
  }, [isLoggedIn, navigate]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: envConfig.redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
            scope: 'openid profile email',
          },
        },
      });
      
      if (error) {
        setError('Failed to sign in with Google. Please try again.');
        setLoading(false);
      }
    } catch (error) {
      setError('An error occurred with Google sign in. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Header */}
        <div className="auth-header">
          <h1>Welcome to Jacal</h1>
          <p style={{ fontSize: '1.1rem', marginTop: '12px' }}>
            Master any subject with intelligent flashcards
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="alert alert-error" style={{ marginTop: '24px' }}>
            <span>{error}</span>
          </div>
        )}

        {/* Google Sign In Button */}
        <div style={{ marginTop: '32px' }}>
          <button
            className="google-btn"
            onClick={handleGoogleSignIn}
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '1.1rem',
              background: 'white',
              color: '#333',
              border: '2px solid #e0e0e0',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              fontWeight: '600',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.borderColor = '#4facfe';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 172, 254, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e0e0e0';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            }}
          >
            {loading ? (
              <FaSpinner className="spinner" style={{ fontSize: '1.2rem' }} />
            ) : (
              <FaGoogle style={{ fontSize: '1.2rem', color: '#4285F4' }} />
            )}
            <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
          </button>
        </div>

        {/* Terms and Privacy */}
        <div className="terms-privacy" style={{ marginTop: '24px' }}>
          <p style={{ fontSize: '0.85rem', color: '#666', lineHeight: 1.6 }}>
            By signing in, you agree to our{' '}
            <a href="/terms" className="legal-link" style={{ color: '#4facfe' }}>Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" className="legal-link" style={{ color: '#4facfe' }}>Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}