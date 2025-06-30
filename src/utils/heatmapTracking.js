// src/utils/heatmapTracking.js - Clean Version
import { supabase } from '../supabase';

/**
 * Get today's date in user's local timezone as YYYY-MM-DD
 * @returns {string} Date string in YYYY-MM-DD format
 */
const getTodayLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Check if two date strings represent consecutive days
 * @param {string} date1 - First date (YYYY-MM-DD)
 * @param {string} date2 - Second date (YYYY-MM-DD)
 * @returns {boolean} True if date2 is exactly one day after date1
 */
const areConsecutiveDays = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  // Calculate the difference in milliseconds
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  
  // Return true if date2 is exactly 1 day after date1
  return Math.abs(diffDays - 1) < 0.001;
};

/**
 * Add days to a date string
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {number} days - Number of days to add (can be negative)
 * @returns {string} New date string
 */
const addDaysToDate = (dateStr, days) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  date.setDate(date.getDate() + days);
  
  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, '0');
  const newDay = String(date.getDate()).padStart(2, '0');
  
  return `${newYear}-${newMonth}-${newDay}`;
};

/**
 * Track a single review event
 * @param {string} userId - User ID
 * @param {boolean} isMasterAgain - Whether this is from a master again session
 * @returns {Promise<boolean>} Success status
 */
const trackReview = async (userId, isMasterAgain = false) => {
  if (!userId) {
    return false;
  }

  const reviewDate = getTodayLocalDate();
  
  try {
    const { error } = await supabase.rpc('increment_daily_review_count', {
      p_user_id: userId,
      p_review_date: reviewDate,
      p_reviews_count: 1,
      p_cards_studied: 1,
      p_is_master_again: isMasterAgain
    });

    if (error) {
      return false;
    }
    
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('heatmap-refresh', {
        detail: { 
          date: reviewDate, 
          isMasterAgain,
          timestamp: Date.now()
        }
      }));
    }, 100);

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Track completion of a study session
 * @param {string} userId - User ID
 * @param {number} cardsReviewed - Number of cards reviewed in session
 * @param {boolean} isMasterAgain - Whether this was a master again session
 * @returns {Promise<boolean>} Success status
 */
const trackStudySession = async (userId, cardsReviewed = 0, isMasterAgain = false) => {
  if (!userId || cardsReviewed <= 0) {
    return false;
  }

  const reviewDate = getTodayLocalDate();
  
  try {
    const { error } = await supabase.rpc('increment_daily_review_count', {
      p_user_id: userId,
      p_review_date: reviewDate,
      p_reviews_count: cardsReviewed,
      p_cards_studied: cardsReviewed,
      p_is_master_again: isMasterAgain
    });

    if (error) {
      return false;
    }
    
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('heatmap-refresh', {
        detail: { 
          date: reviewDate, 
          cardsReviewed,
          isMasterAgain,
          sessionComplete: true,
          timestamp: Date.now()
        }
      }));
    }, 100);

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Get review statistics for a date range
 * @param {string} userId - User ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} Array of review stats
 */
const getReviewStats = async (userId, startDate, endDate) => {
  if (!userId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('daily_review_stats')
      .select('*')
      .eq('user_id', userId)
      .gte('review_date', startDate)
      .lte('review_date', endDate)
      .order('review_date', { ascending: true });

    if (error) {
      return [];
    }

    return data || [];
  } catch (error) {
    return [];
  }
};

/**
 * Get review statistics for a specific year
 * @param {string} userId - User ID
 * @param {number} year - Year to get stats for
 * @returns {Promise<Array>} Array of review stats
 */
const getYearReviewStats = async (userId, year) => {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  
  try {
    const { data, error } = await supabase
      .from('daily_review_stats')
      .select('*')
      .eq('user_id', userId)
      .gte('review_date', startDate)
      .lte('review_date', endDate)
      .order('review_date', { ascending: true });

    if (error) {
      return [];
    }
    
    return data || [];
  } catch (error) {
    return [];
  }
};

/**
 * Get total review count for user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Total review count
 */
const getTotalReviewCount = async (userId) => {
  if (!userId) return 0;

  try {
    const { data, error } = await supabase
      .from('daily_review_stats')
      .select('reviews_count')
      .eq('user_id', userId);

    if (error) {
      return 0;
    }

    return (data || []).reduce((total, day) => total + (day.reviews_count || 0), 0);
  } catch (error) {
    return 0;
  }
};

/**
 * Calculate streak information
 * @param {Array} reviewStats - Array of review stats
 * @returns {Object} Streak information
 */
const calculateStreaks = (reviewStats) => {
  if (!reviewStats || reviewStats.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Get unique dates with activity (reviews_count > 0) and sort them
  const activeDates = reviewStats
    .filter(stat => stat.reviews_count > 0)
    .map(stat => stat.review_date)
    .filter(date => date)
    .sort();

  if (activeDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  if (activeDates.length === 1) {
    const today = getTodayLocalDate();
    const yesterday = addDaysToDate(today, -1);
    const singleDate = activeDates[0];
    
    const currentStreak = (singleDate === today || singleDate === yesterday) ? 1 : 0;
    return { currentStreak, longestStreak: 1 };
  }

  // Calculate longest streak
  let longestStreak = 1;
  let currentSequence = 1;
  
  for (let i = 1; i < activeDates.length; i++) {
    const date1 = activeDates[i - 1];
    const date2 = activeDates[i];
    
    if (areConsecutiveDays(date1, date2)) {
      currentSequence++;
    } else {
      longestStreak = Math.max(longestStreak, currentSequence);
      currentSequence = 1;
    }
  }
  
  // Don't forget the last sequence
  longestStreak = Math.max(longestStreak, currentSequence);

  // Calculate current streak
  const today = getTodayLocalDate();
  const yesterday = addDaysToDate(today, -1);
  
  let currentStreak = 0;
  const lastActivityDate = activeDates[activeDates.length - 1];

  if (lastActivityDate === today || lastActivityDate === yesterday) {
    currentStreak = 1;
    let checkDate = lastActivityDate;
    
    for (let i = activeDates.length - 2; i >= 0; i--) {
      const previousDate = activeDates[i];
      const expectedPrevDate = addDaysToDate(checkDate, -1);
      
      if (previousDate === expectedPrevDate) {
        currentStreak++;
        checkDate = previousDate;
      } else {
        break;
      }
    }
  } else {
    currentStreak = 0;
  }

  return { currentStreak, longestStreak };
};

// Export all functions
export {
  trackReview,
  trackStudySession,
  getReviewStats,
  getYearReviewStats,
  getTotalReviewCount,
  calculateStreaks,
  getTodayLocalDate
};

export default {
  trackReview,
  trackStudySession,
  getReviewStats,
  getYearReviewStats,
  getTotalReviewCount,
  calculateStreaks,
  getTodayLocalDate
};