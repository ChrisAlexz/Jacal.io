// src/config/environment.js - Environment-specific configuration
const getEnvironmentConfig = () => {
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // Determine environment based on hostname
  const isProduction = hostname === 'jacal.io' || hostname === 'www.jacal.io';
  const isStaging = hostname.includes('staging') || hostname.includes('preview');
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('192.168.');
  
  let baseUrl;
  
  if (isProduction) {
    baseUrl = 'https://jacal.io';
  } else if (isStaging) {
    baseUrl = `${protocol}//${hostname}`;
  } else if (isLocal) {
    baseUrl = `${protocol}//${hostname}:${window.location.port || '3000'}`;
  } else {
    // Fallback for other environments (Vercel previews, etc.)
    baseUrl = `${protocol}//${hostname}`;
  }
  
  return {
    baseUrl,
    isProduction,
    isStaging,
    isLocal,
    redirectUrl: `${baseUrl}/auth/callback`,
    // Add other environment-specific configs here
    supabaseUrl: process.env.REACT_APP_SUPABASE_URL,
    supabaseAnonKey: process.env.REACT_APP_SUPABASE_ANON_KEY,
  };
};

export default getEnvironmentConfig;