// src/components/authentication/PasswordReset.jsx - CLEAN: No debug info
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase';
import getEnvironmentConfig from '../../config/environment';
import { 
  FaEnvelope, 
  FaLock, 
  FaEye, 
  FaEyeSlash, 
  FaCheckCircle, 
  FaExclamationTriangle,
  FaSpinner,
  FaArrowLeft
} from 'react-icons/fa';
import '../../styles/Register.css';

export default function PasswordReset() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const envConfig = getEnvironmentConfig();
  
  const resetToken = searchParams.get('token');
  const resetEmail = searchParams.get('email');
  const isUpdatingPassword = !!(resetToken && resetEmail);
  
  const [formData, setFormData] = useState({
    email: resetEmail || '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: [] });

  useEffect(() => {
    if (formData.password && isUpdatingPassword) {
      const strength = calculatePasswordStrength(formData.password);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength({ score: 0, feedback: [] });
    }
  }, [formData.password, isUpdatingPassword]);

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

    if (isUpdatingPassword) {
      if (!formData.password) {
        errors.password = 'New password is required';
      } else if (formData.password.length < 8) {
        errors.password = 'Password must be at least 8 characters';
      } else if (passwordStrength.score < 3) {
        errors.password = 'Password is too weak. Please follow the requirements below.';
      }

      if (!formData.confirmPassword) {
        errors.confirmPassword = 'Please confirm your new password';
      } else if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!formData.email) {
        errors.email = 'Email is required';
      } else if (!emailRegex.test(formData.email)) {
        errors.email = 'Please enter a valid email address';
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
      if (isUpdatingPassword) {
        await handlePasswordUpdate();
      } else {
        await handlePasswordResetRequest();
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordResetRequest = async () => {
    try {
      const apiUrl = envConfig.isLocal 
        ? 'http://localhost:3002/api/auth/reset-password-request'
        : '/api/auth/reset-password-request';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.email
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send reset email');
      }

      const data = await response.json();
      setMessage(`Password reset instructions have been sent to ${formData.email}. Please check your inbox and follow the instructions.`);
      
      setFormData({ email: '', password: '', confirmPassword: '' });

    } catch (error) {
      if (error.message.includes('rate limit') || error.message.includes('limit exceeded')) {
        setError('Email rate limit reached. Please wait a few minutes before requesting another password reset.');
      } else {
        setError(error.message || 'Failed to send reset email. Please try again.');
      }
    }
  };

  const handlePasswordUpdate = async () => {
    try {
      const apiUrl = envConfig.isLocal 
        ? 'http://localhost:3002/api/auth/update-password'
        : '/api/auth/update-password';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resetToken: resetToken,
          email: resetEmail,
          newPassword: formData.password
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update password');
      }

      setMessage('Your password has been successfully updated! You can now sign in with your new password.');
      
      setTimeout(() => {
        navigate('/register');
      }, 3000);

    } catch (error) {
      if (error.message.includes('expired')) {
        setError('Your reset link has expired. Please request a new password reset.');
      } else {
        setError(error.message || 'Failed to update password. Please try again.');
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-icon">
            {isUpdatingPassword ? <FaLock /> : <FaEnvelope />}
          </div>
          <h1>
            {isUpdatingPassword ? 'Set New Password' : 'Reset Password'}
          </h1>
          <p>
            {isUpdatingPassword 
              ? 'Choose a strong password for your account'
              : 'Enter your email address and we\'ll send you a secure reset link'
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
            {!isUpdatingPassword ? (
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
                    autoFocus
                  />
                </div>
                {validationErrors.email && (
                  <span className="error-text">{validationErrors.email}</span>
                )}
              </div>
            ) : (
              <>
                <div className="form-group">
                  <label>Resetting password for:</label>
                  <div style={{ 
                    padding: '12px 16px',
                    background: 'rgba(79, 172, 254, 0.1)',
                    border: '2px solid rgba(79, 172, 254, 0.3)',
                    borderRadius: '8px',
                    color: '#4facfe',
                    fontWeight: '600'
                  }}>
                    {resetEmail}
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="password">New Password</label>
                  <div className={`input-wrapper ${validationErrors.password ? 'error' : ''}`}>
                    <FaLock className="input-icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      placeholder="Enter your new password"
                      value={formData.password}
                      onChange={handleInputChange}
                      disabled={loading}
                      autoComplete="new-password"
                      autoFocus
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
                  
                  {formData.password && (
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

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm New Password</label>
                  <div className={`input-wrapper ${validationErrors.confirmPassword ? 'error' : ''}`}>
                    <FaLock className="input-icon" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      name="confirmPassword"
                      placeholder="Confirm your new password"
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
              </>
            )}

            <button 
              type="submit" 
              className="submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <FaSpinner className="spinner" />
                  {isUpdatingPassword ? 'Updating Password...' : 'Sending Reset Email...'}
                </>
              ) : (
                isUpdatingPassword ? 'Update Password' : 'Send Reset Email'
              )}
            </button>
          </form>
        )}

        <div className="auth-toggle">
          <Link to="/register" className="toggle-btn" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            justifyContent: 'center', 
            textDecoration: 'none', 
            marginTop: '16px' 
          }}>
            <FaArrowLeft style={{ fontSize: '0.9rem' }} />
            Back to Sign In
          </Link>
        </div>

        {!isUpdatingPassword && !message && (
          <div className="terms-privacy">
            <p>
              Remember your password? <Link to="/register" className="legal-link">Sign in instead</Link>
            </p>
          </div>
        )}

        {message && isUpdatingPassword && (
          <div className="terms-privacy">
            <p style={{ color: '#4facfe', fontWeight: '500' }}>
              Redirecting to sign in page in a few seconds...
            </p>
          </div>
        )}

        {message && !isUpdatingPassword && (
          <div className="terms-privacy">
            <div style={{
              background: 'rgba(40, 167, 69, 0.1)',
              border: '1px solid rgba(40, 167, 69, 0.3)',
              borderRadius: '8px',
              padding: '16px',
              marginTop: '16px'
            }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#155724' }}>
                <strong>📧 Email Sent:</strong> Check your inbox for reset instructions. The email comes from support@jacal.io.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}