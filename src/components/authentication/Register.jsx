// src/components/authentication/Register.jsx - CLEAN: Removed debug info
import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();

  const isVerified = searchParams.get('verified') === 'true';
  const verifiedEmail = searchParams.get('email') || '';

  const [formData, setFormData] = useState({
    fullName: '',
    email: verifiedEmail,
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSignUp, setIsSignUp] = useState(!isVerified);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: [] });

  useEffect(() => {
    if (isLoggedIn) {
      navigate('/');
    }
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    if (isVerified && verifiedEmail) {
      setMessage(`🎉 Email verified successfully! You can now sign in to your account with ${verifiedEmail}.`);
      setIsSignUp(false);
    }
  }, [isVerified, verifiedEmail]);

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
    if (message && !isVerified) setMessage(null);
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
    if (!isVerified) setMessage(null);

    try {
      if (isSignUp) {
        await handleCustomSignUp();
      } else {
        await handleSignIn();
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSignUp = async () => {
    try {
      const requestData = {
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName.trim()
      };
      
      const apiUrl = envConfig.isLocal 
        ? 'http://localhost:3002/api/auth/signup'
        : '/api/auth/signup';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          throw new Error('Server error - please try again later');
        }
        
        throw new Error(errorData.error || `HTTP ${response.status}: Server error`);
      }

      const data = await response.json();

      setMessage(data.message || `Account created successfully! Verification email sent to ${formData.email}.`);
      
      setFormData({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: ''
      });

    } catch (error) {
      setError(error.message || 'Signup failed. Please try again.');
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
      setError('An error occurred with Google sign in. Please try again.');
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError(null);
    if (!isVerified) setMessage(null);
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

        {isVerified && verifiedEmail && (
          <div className="alert alert-success" style={{ marginBottom: '20px' }}>
            <FaCheckCircle />
            <span>🎉 Email verified! Your account is ready. Please sign in below.</span>
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            <FaExclamationTriangle />
            <span>{error}</span>
          </div>
        )}

        {message && !isVerified && (
          <div className="alert alert-success">
            <FaCheckCircle />
            <span>{message}</span>
          </div>
        )}

        {!message || isVerified ? (
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
              <div className={`input-wrapper ${validationErrors.email ? 'error' : ''} ${isVerified ? 'verified' : ''}`}>
                <FaEnvelope className="input-icon" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="Enter your email address"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={loading || isVerified}
                  autoComplete="email"
                />
                {isVerified && <FaCheckCircle className="verified-icon" style={{ color: '#28a745' }} />}
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
        ) : null}

        {(!message || isVerified) && (
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

        {message && isSignUp && !isVerified && (
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
                <strong style={{ color: '#28a745' }}>Success!</strong>
              </div>
              <p style={{ 
                color: '#28a745', 
                margin: 0, 
                fontSize: '0.9rem', 
                lineHeight: 1.5 
              }}>
                {message}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}