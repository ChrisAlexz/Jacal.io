import { logger } from './logger';
// src/utils/DataRefresh.js - Utility to handle data refresh after imports

/**
 * Wait for database operations to settle
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise}
 */
export const waitForDatabase = (ms = 1000) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Verify that cards were actually inserted into the database
 * @param {Object} supabase - Supabase client
 * @param {string} setId - Flashcard set ID
 * @param {number} expectedCount - Expected number of cards
 * @returns {Promise<boolean>} - True if verification passed
 */
export const verifyCardInsertion = async (supabase, setId, expectedCount) => {
  try {
    const { count, error } = await supabase
      .from('flashcard_cards')
      .select('*', { count: 'exact', head: true })
      .eq('set_id', setId);
      
    if (error) {
      logger.error('Error verifying card insertion:', error);
      return false;
    }
    
    logger.debug(`Verification: ${count} cards found, expected ${expectedCount}`);
    return count === expectedCount;
  } catch (error) {
    logger.error('Error in verification:', error);
    return false;
  }
};

/**
 * Force refresh component data by triggering a re-fetch
 * @param {Function} fetchFunction - Function to call for re-fetching data
 * @param {number} retryCount - Number of retries if data is not found
 * @returns {Promise}
 */
export const forceDataRefresh = async (fetchFunction, retryCount = 3) => {
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      logger.debug(`Data refresh attempt ${attempt}/${retryCount}`);
      await fetchFunction();
      return; // Success, exit the loop
    } catch (error) {
      logger.error(`Refresh attempt ${attempt} failed:`, error);
      if (attempt < retryCount) {
        // Wait longer with each retry
        await waitForDatabase(attempt * 1000);
      } else {
        throw error; // Re-throw on final attempt
      }
    }
  }
};

/**
 * Enhanced navigation that ensures data is ready
 * @param {Function} navigate - React Router navigate function
 * @param {string} path - Path to navigate to
 * @param {Object} options - Navigation options
 */
export const navigateWithDataCheck = async (navigate, path, options = {}) => {
  // Wait for any pending database operations
  await waitForDatabase(500);
  
  // Use replace by default to avoid navigation issues
  const navigationOptions = { replace: true, ...options };
  
  // Navigate in next tick to ensure current operations complete
  setTimeout(() => {
    navigate(path, navigationOptions);
  }, 100);
};

/**
 * Debounced function creator
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} - Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Safe async operation with retry logic
 * @param {Function} operation - Async operation to perform
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delayMs - Delay between retries
 * @returns {Promise}
 */
export const safeAsyncOperation = async (operation, maxRetries = 3, delayMs = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      logger.error(`Operation attempt ${attempt} failed:`, error);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      await waitForDatabase(delayMs * attempt);
    }
  }
};

// Default export for convenience
export default {
  waitForDatabase,
  verifyCardInsertion,
  forceDataRefresh,
  navigateWithDataCheck,
  debounce,
  safeAsyncOperation
};