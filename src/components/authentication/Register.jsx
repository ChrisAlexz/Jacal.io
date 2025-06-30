// src/components/authentication/Register.jsx - FIXED to prevent Supabase emails
import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import UserAuthContext from '../context/UserAuthContext';
import { supabase } from '../../supabase';
import { emailService } from '../../utils/emailService';
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

  // Form states
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // UI states
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSignUp, setIsSignUp] = useState(true);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: [] });

  // Redirect if already logged in
  useEffect(() => {
    if (isLoggedIn) {
      navigate('/');
    }
  }, [isLoggedIn, navigate]);

  // Real-time password strength validation
  useEffect(() => {
    if (formData.password) {
      const strength = calculatePasswordStrength(formData.password);
      setPasswordStrength(strength);
    } else {
      setPasswordStrength({ score: 0, feedback: [] });
    }
  }, [formData.password]);

  // Calculate password strength
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

  // Get password strength color and label
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

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear validation error for this field
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: null }));
    }
    
    // Clear general errors when user starts typing
    if (error) setError(null);
  };

  // Comprehensive form validation
  const validateForm = () => {
    const errors = {};

    // Full name validation (only for sign up)
    if (isSignUp) {
      if (!formData.fullName.trim()) {
        errors.fullName = 'Full name is required';
      } else if (formData.fullName.trim().length < 2) {
        errors.fullName = 'Full name must be at least 2 characters';
      }
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (isSignUp) {
      if (formData.password.length < 8) {
        errors.password = 'Password must be at least 8 characters';
      } else if (passwordStrength.score < 3) {
        errors.password = 'Password is too weak. Please follow the requirements below.';
      }
    }

    // Confirm password validation (only for sign up)
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

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        await handleSignUp();
      } else {
        await handleSignIn();
      }
    } catch (err) {
      console.error('Form submission error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Handle sign up without triggering Supabase emails
  const handleSignUp = async () => {
    try {
      console.log('🔄 Starting custom signup process...');

      // STEP 1: Create user account with Supabase (no email confirmation)
      // This should NOT trigger any emails if you disabled email confirmation in dashboard
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          // IMPORTANT: No emailRedirectTo - this prevents automatic emails
          data: {
            name: formData.fullName.trim(),
            picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.fullName)}&background=4facfe&color=fff&size=200`,
            email_verified: false
          }
        }
      });

      if (signUpError) {
        console.error('❌ Supabase signup error:', signUpError);
        if (signUpError.message.includes('already registered')) {
          setError('An account with this email already exists. Try signing in instead.');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      const userId = authData.user?.id;
      if (!userId) {
        console.error('❌ No user ID returned from Supabase');
        setError('Failed to create account. Please try again.');
        return;
      }

      console.log('✅ Supabase user created:', userId);

      // STEP 2: Generate our custom verification token
      const verificationToken = emailService.generateVerificationToken();
      console.log('✅ Generated verification token');
      
      // STEP 3: Store verification token in our custom table
      await emailService.storeVerificationToken(
        userId, 
        formData.email, 
        verificationToken, 
        'email_confirmation'
      );
      console.log('✅ Stored verification token in database');

      // STEP 4: Create confirmation URL for our custom verification
      const confirmationUrl = `${envConfig.baseUrl}/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(formData.email)}`;
      console.log('✅ Generated confirmation URL');

      // STEP 5: Send our beautiful Hostinger email
      console.log('📧 Sending confirmation email via Hostinger...');
      await emailService.sendConfirmationEmail(
        formData.email,
        confirmationUrl,
        formData.fullName.trim()
      );
      console.log('✅ Hostinger email sent successfully');

      // Success message
      setMessage(
        `🎉 Welcome to Jacal, ${formData.fullName}! We've sent a beautiful welcome email to ${formData.email} via our Hostinger email service. Check your inbox for the verification link to start your learning journey!`
      );
      
      // Clear form after successful sign up
      setFormData({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: ''
      });

    } catch (error) {
      console.error('❌ Custom signup process error:', error);
      setError(`Failed to send verification email: ${error.message}`);
    }
  };

  // Handle sign in
  const handleSignIn = async () => {
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
  };

  // Handle Google sign in
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    
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
  };

  // Toggle between sign up and sign in
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
        {/* Header */}
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

        {/* Alert Messages */}
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

        {/* Main Form */}
        {!message && (
          <form className="auth-form" onSubmit={handleSubmit}>
            {/* Full Name Field (Sign Up Only) */}
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

            {/* Email Field */}
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

            {/* Password Field */}
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
              
              {/* Password Strength Indicator (Sign Up Only) */}
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

            {/* Confirm Password Field (Sign Up Only) */}
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

            {/* Submit Button */}
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

        {/* Google Sign In (only if no success message) */}
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

        {/* Toggle Mode */}
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

        {/* Forgot Password Link (Sign In Only) */}
        {!isSignUp && (
          <div className="forgot-password">
            <Link to="/auth/reset-password" className="forgot-link">
              Forgot your password?
            </Link>
          </div>
        )}

        {/* Success Message Enhancement */}
        {message && isSignUp && (
          <div className="terms-privacy" style={{ marginTop: '24px' }}>
            <div style={{ 
              background: 'linear-gradient(135deg, rgba(79, 172, 254, 0.1) 0%, rgba(0, 242, 254, 0.05) 100%)', 
              border: '1px solid rgba(79, 172, 254, 0.3)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '2rem' }}>🎨</div>
                <div>
                  <strong style={{ color: '#4facfe', fontSize: '1.1rem' }}>
                    Beautiful Email Sent via Hostinger!
                  </strong>
                  <p style={{ 
                    color: '#4facfe', 
                    margin: '4px 0 0 0', 
                    fontSize: '0.9rem', 
                    lineHeight: 1.5 
                  }}>
                    We've sent you a gorgeous, custom-designed welcome email using our Hostinger SMTP service.
                  </p>
                </div>
              </div>
              
              <div style={{
                background: 'rgba(79, 172, 254, 0.1)',
                padding: '12px',
                borderRadius: '8px',
                borderLeft: '4px solid #4facfe'
              }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
                  💡 <strong>Pro tip:</strong> Look for the beautifully designed Jacal email - it stands out from regular emails!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Terms and Privacy (Sign Up Only) */}
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
      </div>
    </div>
  );
}