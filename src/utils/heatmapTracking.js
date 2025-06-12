// src/utils/heatmapTracking.js - Fixed Version
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
 * Track a single review event
 * @param {string} userId - User ID
 * @param {boolean} isMasterAgain - Whether this is from a master again session
 * @returns {Promise<boolean>} Success status
 */
const trackReview = async (userId, isMasterAgain = false) => {
  if (!userId) {
    console.warn('⚠️ No user ID provided for heatmap tracking');
    return false;
  }

  const reviewDate = getTodayLocalDate();
  
  try {
    console.log(`📊 Tracking review: ${reviewDate} (Master Again: ${isMasterAgain})`);
    
    const { error } = await supabase.rpc('increment_daily_review_count', {
      p_user_id: userId,
      p_review_date: reviewDate,
      p_reviews_count: 1,
      p_cards_studied: 1,
      p_is_master_again: isMasterAgain
    });

    if (error) {
      console.error('❌ Error tracking review:', error);
      return false;
    }

    console.log('✅ Review tracked successfully');
    
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
    console.error('💥 Error in trackReview:', error);
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
    console.warn('⚠️ Invalid parameters for study session tracking');
    return false;
  }

  const reviewDate = getTodayLocalDate();
  
  try {
    console.log(`📚 Tracking study session: ${cardsReviewed} cards on ${reviewDate} (Master Again: ${isMasterAgain})`);
    
    const { error } = await supabase.rpc('increment_daily_review_count', {
      p_user_id: userId,
      p_review_date: reviewDate,
      p_reviews_count: cardsReviewed,
      p_cards_studied: cardsReviewed,
      p_is_master_again: isMasterAgain
    });

    if (error) {
      console.error('❌ Error tracking study session:', error);
      return false;
    }

    console.log('✅ Study session tracked successfully');
    
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
    console.error('💥 Error in trackStudySession:', error);
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
    console.warn('⚠️ No user ID provided for getting review stats');
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
      console.error('❌ Error fetching review stats:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('💥 Error in getReviewStats:', error);
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
  return getReviewStats(userId, startDate, endDate);
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
      console.error('❌ Error fetching total review count:', error);
      return 0;
    }

    return (data || []).reduce((total, day) => total + (day.reviews_count || 0), 0);
  } catch (error) {
    console.error('💥 Error in getTotalReviewCount:', error);
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

  const sortedStats = [...reviewStats].sort((a, b) => 
    new Date(b.review_date) - new Date(a.review_date)
  );

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  
  const today = getTodayLocalDate();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Calculate current streak
  let streakDate = new Date();
  for (const stat of sortedStats) {
    const statDate = stat.review_date;
    const expectedDate = streakDate.toISOString().split('T')[0];
    
    if (statDate === expectedDate && stat.reviews_count > 0) {
      currentStreak++;
      streakDate.setDate(streakDate.getDate() - 1);
    } else {
      break;
    }
  }

  // If no review today but there was yesterday, current streak should include today
  if (currentStreak === 0) {
    const todayStats = sortedStats.find(s => s.review_date === today);
    const yesterdayStats = sortedStats.find(s => s.review_date === yesterdayStr);
    
    if (!todayStats && yesterdayStats && yesterdayStats.reviews_count > 0) {
      currentStreak = 1;
      streakDate = yesterday;
      streakDate.setDate(streakDate.getDate() - 1);
      
      for (const stat of sortedStats) {
        const statDate = stat.review_date;
        const expectedDate = streakDate.toISOString().split('T')[0];
        
        if (statDate === expectedDate && stat.reviews_count > 0) {
          currentStreak++;
          streakDate.setDate(streakDate.getDate() - 1);
        } else {
          break;
        }
      }
    }
  }

  // Calculate longest streak
  for (const stat of reviewStats) {
    if (stat.reviews_count > 0) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  return { currentStreak, longestStreak };
};

// Export all functions - SINGLE EXPORT BLOCK
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