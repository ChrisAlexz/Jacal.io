// src/components/authentication/Register.jsx - UPDATED FOR VERCEL FUNCTIONS
import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import UserAuthContext from '../context/UserAuthContext';
import { supabase } from '../../supabase';
import getEnvironmentConfig from '../../config/environment';
import { 
  FaEye, 
  FaEyeSlash, 
  FaUser, 
  FaEnvelope, 
  FaLock, 
  FaGoogle, 
  FaCheckCircle, 
  FaExclamationTriangle,
  FaSpinner
} from 'react-icons/fa';
import '../../styles/Register.css';

export default function Register() {
  const navigate = useNavigate();
  const { login, isLoggedIn } = useContext(UserAuthContext);
  const envConfig = getEnvironmentConfig();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSignUp, setIsSignUp] = useState(true);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: [] });

  useEffect(() => {
    if (isLoggedIn) {
      navigate('/');
    }
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    if (formData.password) {
      const strength = calculatePasswordStrength(formData.password);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength({ score: 0, feedback: [] });
    }
  }, [formData.password]);

  const calculatePasswordStrength = (password) => {
    let score = 0;
    const feedback = [];

    if (password.length >= 8) score++;
    else feedback.push('Use at least 8 characters');

    if (/[a-z]/.test(password)) score++;
    else feedback.push('Include lowercase letters');

    if (/[A-Z]/.test(password)) score++;
    else feedback.push('Include uppercase letters');

    if (/\d/.test(password)) score++;
    else feedback.push('Include numbers');

    if (/[^a-zA-Z0-9]/.test(password)) score++;
    else feedback.push('Include special characters');

    return { score, feedback };
  };

  const getPasswordStrengthInfo = () => {
    switch (passwordStrength.score) {
      case 0:
      case 1: return { color: '#ff4757', label: 'Very Weak' };
      case 2: return { color: '#ff6b35', label: 'Weak' };
      case 3: return { color: '#ffc107', label: 'Fair' };
      case 4: return { color: '#28a745', label: 'Good' };
      case 5: return { color: '#20c997', label: 'Strong' };
      default: return { color: '#6c757d', label: 'Unknown' };
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: null }));
    }
    
    if (error) setError(null);
  };

  const validateForm = () => {
    const errors = {};

    if (isSignUp) {
      if (!formData.fullName.trim()) {
        errors.fullName = 'Full name is required';
      } else if (formData.fullName.trim().length < 2) {
        errors.fullName = 'Full name must be at least 2 characters';
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (isSignUp) {
      if (formData.password.length < 8) {
        errors.password = 'Password must be at least 8 characters';
      } else if (passwordStrength.score < 3) {
        errors.password = 'Password is too weak. Please follow the requirements below.';
      }
    }

    if (isSignUp) {
      if (!formData.confirmPassword) {
        errors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        await handleCustomSignUp();
      } else {
        await handleSignIn();
      }
    } catch (err) {
      console.error('Form submission error:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // CUSTOM SIGNUP - CALLS VERCEL SERVERLESS FUNCTIONS OR LOCAL API
  const handleCustomSignUp = async () => {
    try {
      // For development: use relative /api path, for production: use current domain
      const isDev = window.location.hostname === 'localhost';
      const baseUrl = isDev ? '' : window.location.origin; // Empty string uses relative paths in dev
      
      console.log('🔄 Attempting signup with API:', `${baseUrl}/api/auth/signup`);
      
      const requestData = {
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName.trim()
      };
      
      const response = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      console.log('📡 Response status:', response.status);

      // Handle fetch errors
      if (!response) {
        throw new Error('Network error: Could not connect to server.');
      }

      // Check content type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error('❌ Non-JSON response:', textResponse);
        throw new Error(`Server returned invalid response. Expected JSON but got: ${contentType || 'unknown'}`);
      }

      // Parse JSON response
      let data;
      try {
        data = await response.json();
        console.log('✅ Parsed response:', data);
      } catch (jsonError) {
        console.error('❌ JSON parse error:', jsonError);
        throw new Error('Invalid response from server. Please try again.');
      }

      // Handle HTTP errors
      if (!response.ok) {
        const errorMessage = data.error || data.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      // Success!
      setMessage(
        `🎉 Welcome to Jacal, ${formData.fullName}! We've sent a verification email to ${formData.email}. Check your inbox and click the verification link to activate your account!`
      );
      
      // Clear form
      setFormData({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: ''
      });

    } catch (error) {
      console.error('❌ Signup error:', error);
      throw error;
    }
  };

  const handleSignIn = async () => {
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please check your credentials and try again.');
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Please check your email and click the confirmation link before signing in.');
        } else {
          setError(signInError.message);
        }
        return;
      }

      if (data.user) {
        login(data.user);
        navigate('/');
      }
    } catch (error) {
      console.error('Sign in error:', error);
      setError('An error occurred during sign in. Please try again.');
    }
  };

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
      console.error('Google sign in error:', error);
      setError('An error occurred with Google sign in. Please try again.');
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError(null);
    setMessage(null);
    setValidationErrors({});
    setFormData({
      fullName: '',
      email: formData.email,
      password: '',
      confirmPassword: ''
    });
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">
            <FaUser />
          </div>
          <h1>{isSignUp ? 'Join Jacal' : 'Welcome Back'}</h1>
          <p>
            {isSignUp 
              ? 'Start your intelligent learning journey today' 
              : 'Continue mastering new skills with Jacal'
            }
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <FaExclamationTriangle />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="alert alert-success">
            <FaCheckCircle />
            <span>{message}</span>
          </div>
        )}

        {!message && (
          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignUp && (
              <div className="form-group">
                <label htmlFor="fullName">Full Name</label>
                <div className={`input-wrapper ${validationErrors.fullName ? 'error' : ''}`}>
                  <FaUser className="input-icon" />
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    disabled={loading}
                    autoComplete="name"
                  />
                </div>
                {validationErrors.fullName && (
                  <span className="error-text">{validationErrors.fullName}</span>
                )}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <div className={`input-wrapper ${validationErrors.email ? 'error' : ''}`}>
                <FaEnvelope className="input-icon" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="Enter your email address"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
              {validationErrors.email && (
                <span className="error-text">{validationErrors.email}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className={`input-wrapper ${validationErrors.password ? 'error' : ''}`}>
                <FaLock className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  placeholder={isSignUp ? 'Create a strong password' : 'Enter your password'}
                  value={formData.password}
                  onChange={handleInputChange}
                  disabled={loading}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              {validationErrors.password && (
                <span className="error-text">{validationErrors.password}</span>
              )}
              
              {isSignUp && formData.password && (
                <div className="password-strength">
                  <div className="strength-bar">
                    <div 
                      className="strength-fill" 
                      style={{ 
                        width: `${(passwordStrength.score / 5) * 100}%`,
                        backgroundColor: getPasswordStrengthInfo().color
                      }}
                    />
                  </div>
                  <div className="strength-info">
                    <span 
                      className="strength-label"
                      style={{ color: getPasswordStrengthInfo().color }}
                    >
                      {getPasswordStrengthInfo().label}
                    </span>
                    {passwordStrength.feedback.length > 0 && (
                      <ul className="strength-feedback">
                        {passwordStrength.feedback.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>

            {isSignUp && (
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className={`input-wrapper ${validationErrors.confirmPassword ? 'error' : ''}`}>
                  <FaLock className="input-icon" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={loading}
                  >
                    {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                {validationErrors.confirmPassword && (
                  <span className="error-text">{validationErrors.confirmPassword}</span>
                )}
              </div>
            )}

            <button 
              type="submit" 
              className="submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <FaSpinner className="spinner" />
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : (
                isSignUp ? 'Start Learning with Jacal' : 'Sign In'
              )}
            </button>
          </form>
        )}

        {!message && (
          <>
            <div className="divider">
              <span>or</span>
            </div>

            <button
              className="google-btn"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              {loading ? (
                <FaSpinner className="spinner" />
              ) : (
                <FaGoogle />
              )}
              <span>Continue with Google</span>
            </button>
          </>
        )}

        <div className="auth-toggle">
          <p>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            <button
              type="button"
              className="toggle-btn"
              onClick={toggleMode}
              disabled={loading}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>

        {!isSignUp && (
          <div className="forgot-password">
            <Link to="/auth/reset-password" className="forgot-link">
              Forgot your password?
            </Link>
          </div>
        )}

        {isSignUp && !message && (
          <div className="terms-privacy">
            <p>
              By creating an account, you agree to our{' '}
              <Link to="/terms" className="legal-link">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" className="legal-link">Privacy Policy</Link>
            </p>
          </div>
        )}

        {message && isSignUp && (
          <div className="terms-privacy" style={{ marginTop: '24px' }}>
            <div style={{ 
              background: 'rgba(40, 167, 69, 0.1)', 
              border: '1px solid rgba(40, 167, 69, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <FaEnvelope style={{ color: '#28a745' }} />
                <strong style={{ color: '#28a745' }}>Check Your Email</strong>
              </div>
              <p style={{ 
                color: '#28a745', 
                margin: 0, 
                fontSize: '0.9rem', 
                lineHeight: 1.5 
              }}>
                We've sent a verification link to your email address. 
                Please click the link to activate your account and start learning!
              </p>
            </div>
            
            <ResendVerificationButton 
              email={formData.email} 
              userName={formData.fullName}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// Resend Verification Component
const ResendVerificationButton = ({ email, userName }) => {
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleResendVerification = async () => {
    if (!email) return;

    setResendLoading(true);
    setResendMessage('');

    try {
      const baseUrl = '';  // Use relative paths for both dev and prod
      
      const response = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          password: 'resend_verification',
          fullName: userName || '',
          resend: true
        })
      });

      if (response.ok) {
        setResendMessage('✅ Verification email sent successfully!');
        setCanResend(false);
        setCountdown(60);

        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              setCanResend(true);
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setResendMessage('❌ Failed to send verification email. Please try again.');
      }

    } catch (error) {
      setResendMessage('❌ Failed to send verification email. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div style={{ textAlign: 'center' }}>
      {resendMessage && (
        <p style={{ 
          color: resendMessage.includes('✅') ? '#28a745' : '#ff4757',
          fontSize: '0.9rem',
          marginBottom: '12px',
          fontWeight: '500'
        }}>
          {resendMessage}
        </p>
      )}
      
      <button
        onClick={handleResendVerification}
        disabled={!canResend || resendLoading}
        style={{
          background: canResend ? 'rgba(79, 172, 254, 0.1)' : 'rgba(255, 255, 255, 0.05)',
          border: `2px solid ${canResend ? 'rgba(79, 172, 254, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
          borderRadius: '8px',
          padding: '8px 16px',
          color: canResend ? '#4facfe' : '#666',
          fontSize: '0.85rem',
          cursor: canResend ? 'pointer' : 'not-allowed',
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          margin: '0 auto',
          minWidth: '180px'
        }}
      >
        {resendLoading ? (
          <>
            <FaSpinner className="spinner" style={{ fontSize: '0.8rem' }} />
            Sending...
          </>
        ) : canResend ? (
          <>
            <FaEnvelope style={{ fontSize: '0.8rem' }} />
            Resend Email
          </>
        ) : (
          <>
            <FaSpinner style={{ fontSize: '0.8rem' }} />
            Resend in {countdown}s
          </>
        )}
      </button>
      
      <p style={{ 
        color: '#999', 
        fontSize: '0.8rem', 
        marginTop: '12px',
        lineHeight: 1.4 
      }}>
        Didn't receive the email? Check your spam folder or try resending.
      </p>
    </div>
  );
};