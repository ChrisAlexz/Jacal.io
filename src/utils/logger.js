// utils/logger.js - Production-Safe Logger
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

// Only log in development and test environments
const shouldLog = isDevelopment || isTest;

export const logger = {
  // Debug logs - only in development
  debug: (...args) => {
    if (shouldLog) {
      console.log('[DEBUG]', ...args);
    }
  },
  
  // Info logs - only in development  
  info: (...args) => {
    if (shouldLog) {
      console.info('[INFO]', ...args);
    }
  },
  
  // Warning logs - only in development
  warn: (...args) => {
    if (shouldLog) {
      console.warn('[WARN]', ...args);
    }
  },
  
  // Error logs - sanitized for production
  error: (...args) => {
    if (shouldLog) {
      console.error('[ERROR]', ...args);
    } else {
      // In production, you would send this to an error monitoring service
      // like Sentry, LogRocket, or your own error tracking system
      // errorReportingService.report({
      //   message: 'Application error occurred',
      //   timestamp: new Date().toISOString(),
      //   // Don't include sensitive data
      // });
    }
  },
  
  // Performance logs - only in development
  performance: (label, fn) => {
    if (shouldLog) {
      console.time(label);
      const result = fn();
      console.timeEnd(label);
      return result;
    }
    return fn();
  }
};

// Disable console methods in production
if (!shouldLog) {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
  console.warn = () => {};
  // Keep console.error for critical system errors
}