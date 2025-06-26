// src/config/environment.js - FIXED for proper OAuth redirects
const getEnvironmentConfig = () => {
  // Determine environment
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;
  
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  const isStaging = hostname.includes('staging') || hostname.includes('preview');
  const isProduction = hostname === 'jacal.io' || (!isLocal && !isStaging);

  // Base URL configuration
  let baseUrl;
  let apiUrl;
  
  if (isLocal) {
    // Local development - detect actual port
    baseUrl = `${protocol}//${hostname}${port ? `:${port}` : ''}`;
    apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
  } else if (isStaging) {
    // Staging environment
    baseUrl = `${protocol}//${hostname}`;
    apiUrl = process.env.REACT_APP_API_URL || `${protocol}//${hostname}`;
  } else {
    // Production
    baseUrl = 'https://jacal.io';
    apiUrl = process.env.REACT_APP_API_URL || 'https://jacal.io';
  }

  // OAuth redirect URLs
  const redirectUrl = `${baseUrl}/auth/callback`;
  
  console.log('🌍 Environment Config:', {
    hostname,
    port,
    isLocal,
    isStaging, 
    isProduction,
    baseUrl,
    redirectUrl,
    env: process.env.NODE_ENV
  });

  return {
    isLocal,
    isStaging,
    isProduction,
    baseUrl,
    apiUrl,
    redirectUrl,
    
    // Email service config
    emailService: {
      fromEmail: process.env.REACT_APP_FROM_EMAIL || 'noreply@jacal.io',
      fromName: process.env.REACT_APP_FROM_NAME || 'Jacal Learning Platform',
      supportEmail: process.env.REACT_APP_SUPPORT_EMAIL || 'support@jacal.io',
      websiteUrl: baseUrl
    }
  };
};

export default getEnvironmentConfig;