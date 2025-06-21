// utils/validation.js - Input Validation & Sanitization
import DOMPurify from 'dompurify';

// Title validation
export const validateTitle = (title) => {
  if (!title || typeof title !== 'string') return false;
  if (title.length < 1 || title.length > 100) return false;
  // Block potentially dangerous characters
  if (/[<>\"'&{}]/.test(title)) return false;
  return true;
};

// Folder name validation
export const validateFolderName = (name) => {
  if (!name || typeof name !== 'string') return false;
  if (name.length < 1 || name.length > 50) return false;
  // Block potentially dangerous characters and path traversal
  if (/[<>\"'&{}\/\\]/.test(name)) return false;
  return true;
};

// Email validation
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

// Password validation
export const validatePassword = (password) => {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 8 || password.length > 128) return false;
  return true;
};

// Sanitize text input
export const sanitizeText = (input) => {
  if (!input || typeof input !== 'string') return '';
  // Remove potentially dangerous characters
  return input.replace(/[<>\"'&{}]/g, '').trim();
};

// Sanitize HTML content using DOMPurify
export const sanitizeHTML = (html) => {
  if (!html || typeof html !== 'string') return '';
  
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'span', 'div',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote',
      'img', 'a'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'style'
    ],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  });
};

// Validate and sanitize card content
export const validateCardContent = (content, allowEmpty = false) => {
  if (!content && !allowEmpty) return false;
  if (!content && allowEmpty) return true;
  if (typeof content !== 'string') return false;
  if (content.length > 10000) return false; // Reasonable limit for card content
  return true;
};

// Sanitize search terms
export const sanitizeSearchTerm = (term) => {
  if (!term || typeof term !== 'string') return '';
  // Remove special characters but allow spaces and basic punctuation
  return term.replace(/[<>\"'&{}]/g, '').trim().substring(0, 100);
};

// Validate file types for uploads
export const validateFileType = (file, allowedTypes = []) => {
  if (!file || !file.type) return false;
  return allowedTypes.includes(file.type);
};

// Validate file size
export const validateFileSize = (file, maxSizeInMB = 10) => {
  if (!file || !file.size) return false;
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  return file.size <= maxSizeInBytes;
};

// Generic error handler that doesn't expose sensitive information
export const createSafeError = (message = 'An error occurred') => {
  if (process.env.NODE_ENV === 'production') {
    return new Error('An error occurred. Please try again.');
  }
  return new Error(message);
};

// Validate URLs
export const validateURL = (url) => {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsedURL = new URL(url);
    // Only allow http and https protocols
    return ['http:', 'https:'].includes(parsedURL.protocol);
  } catch {
    return false;
  }
};

// Rate limiting helper (for client-side usage tracking)
export const createRateLimiter = (maxAttempts, windowMs) => {
  const attempts = new Map();
  
  return (key) => {
    const now = Date.now();
    const userAttempts = attempts.get(key) || [];
    
    // Remove old attempts outside the window
    const validAttempts = userAttempts.filter(time => now - time < windowMs);
    
    if (validAttempts.length >= maxAttempts) {
      return false; // Rate limited
    }
    
    validAttempts.push(now);
    attempts.set(key, validAttempts);
    return true; // Allow
  };
};