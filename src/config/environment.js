// src/config/environment.js - PRODUCTION READY
const getEnvironmentConfig = () => {
  // Determine environment
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port;
  
  // Enhanced environment detection
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
  const isStaging = hostname.includes('staging') || hostname.includes('preview') || hostname.includes('vercel.app');
  const isProduction = hostname === 'jacal.io' || hostname.includes('jacal.io') || (!isLocal && !isStaging);

  // Base URL configuration
  let baseUrl;
  let apiUrl;
  
  if (isLocal) {
    // Local development
    baseUrl = `${protocol}//${hostname}${port ? `:${port}` : ''}`;
    apiUrl = 'http://localhost:3002'; // Local email server
  } else if (isStaging) {
    // Staging environment (Vercel preview deployments)
    baseUrl = `${protocol}//${hostname}`;
    apiUrl = `${protocol}//${hostname}`; // Use Vercel serverless functions
  } else {
    // Production - jacal.io
    baseUrl = 'https://jacal.io';
    apiUrl = 'https://jacal.io'; // Use Vercel serverless functions
  }

  // OAuth redirect URLs
  const redirectUrl = `${baseUrl}/auth/callback`;
  
  // Only log in development
  if (isLocal && process.env.NODE_ENV === 'development') {
    console.log('🌍 Environment Config:', {
      hostname,
      port,
      isLocal,
      isStaging,
      isProduction,
      baseUrl,
      apiUrl,
      env: process.env.NODE_ENV
    });
  }

  return {
    isLocal,
    isStaging,
    isProduction,
    baseUrl,
    apiUrl,
    redirectUrl,
    
    // Email service config
    emailService: {
      fromEmail: process.env.NEXT_PUBLIC_FROM_EMAIL || 'support@jacal.io',
      fromName: process.env.NEXT_PUBLIC_FROM_NAME || 'Jacal Learning Platform',
      supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@jacal.io',
      websiteUrl: baseUrl
    }
  };
};

export default getEnvironmentConfig;