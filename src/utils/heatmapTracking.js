// src/utils/heatmapTracking.js - Fixed Version with Corrected Streak Logic
import { supabase } from '../supabase';

/**
 * Debug function to test date calculations
 * Call this in console: window.debugStreaks()
 */
const debugStreaks = () => {
  const today = getTodayLocalDate();
  const yesterday = addDaysToDate(today, -1);
  
  console.log('=== DATE DEBUGGING ===');
  console.log('Today:', today);
  console.log('Yesterday:', yesterday);
  
  // Test consecutive days
  const testDates = ['2025-06-01', '2025-06-02', '2025-06-03', '2025-06-04', '2025-06-05', '2025-06-06'];
  console.log('Testing consecutive days:');
  for (let i = 1; i < testDates.length; i++) {
    const date1 = testDates[i-1];
    const date2 = testDates[i];
    const isConsecutive = areConsecutiveDays(date1, date2);
    console.log(`${date1} → ${date2}: ${isConsecutive}`);
  }
  
  // Test with your actual June dates (adjust these to match what you see)
  const mockStats = [
    { review_date: '2025-06-01', reviews_count: 1 },
    { review_date: '2025-06-02', reviews_count: 1 },
    { review_date: '2025-06-03', reviews_count: 34 },
    { review_date: '2025-06-04', reviews_count: 1 },
    { review_date: '2025-06-05', reviews_count: 17 },
    { review_date: '2025-06-06', reviews_count: 2 }
  ];
  
  console.log('Testing with mock June data:');
  const result = calculateStreaks(mockStats);
  console.log('Result:', result);

  // Test if you studied yesterday
  console.log('=== YESTERDAY TEST ===');
  if (yesterday === '2025-06-26') {
    console.log('✅ If you studied yesterday (2025-06-26), current streak should be 1');
    const yesterdayStats = [...mockStats, { review_date: '2025-06-26', reviews_count: 5 }];
    const yesterdayResult = calculateStreaks(yesterdayStats);
    console.log('With yesterday study:', yesterdayResult);
  }
};

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  window.debugStreaks = debugStreaks;
  window.debugRealData = () => {
    console.log('=== CHECKING REAL HEATMAP DATA ===');
    console.log('Look for the log that shows your actual review stats...');
    console.log('It should say something like: "📅 Active dates (sorted): [...]"');
    console.log('If your June streak shows only 5 days in the real data, then one day might be missing from the database.');
  };
}

/**
 * Get today's date in user's local timezone as YYYY-MM-DD
 * @returns {string} Date string in YYYY-MM-DD format
 */
const getTodayLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const result = `${year}-${month}-${day}`;
  console.log('📅 getTodayLocalDate():', result);
  return result;
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
  return Math.abs(diffDays - 1) < 0.001; // Use small epsilon for floating point comparison
};

/**
 * Add days to a date string - FIXED VERSION
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {number} days - Number of days to add (can be negative)
 * @returns {string} New date string
 */
const addDaysToDate = (dateStr, days) => {
  // Create date object and ensure we're working in local time
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day); // month is 0-indexed
  
  // Add the days
  date.setDate(date.getDate() + days);
  
  // Format back to YYYY-MM-DD
  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, '0');
  const newDay = String(date.getDate()).padStart(2, '0');
  const result = `${newYear}-${newMonth}-${newDay}`;
  
  console.log(`📅 addDaysToDate(${dateStr}, ${days}) = ${result}`);
  return result;
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
 * Get review statistics for a specific year - FIXED TO USE SAME DATA SOURCE
 * @param {string} userId - User ID
 * @param {number} year - Year to get stats for
 * @returns {Promise<Array>} Array of review stats
 */
const getYearReviewStats = async (userId, year) => {
  console.log(`📊 getYearReviewStats: Fetching for user ${userId}, year ${year}`);
  
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  
  try {
    // Use the SAME data source as the other functions - daily_review_stats table
    const { data, error } = await supabase
      .from('daily_review_stats')
      .select('*')
      .eq('user_id', userId)
      .gte('review_date', startDate)
      .lte('review_date', endDate)
      .order('review_date', { ascending: true });

    if (error) {
      console.error('❌ Error fetching year review stats:', error);
      return [];
    }

    console.log(`📊 getYearReviewStats: Found ${data?.length || 0} records`);
    console.log('📊 Raw data:', data);
    
    return data || [];
  } catch (error) {
    console.error('💥 Error in getYearReviewStats:', error);
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
 * Calculate streak information - ULTRA DETAILED DEBUGGING VERSION
 * @param {Array} reviewStats - Array of review stats
 * @returns {Object} Streak information
 */
const calculateStreaks = (reviewStats) => {
  console.log('🔥 === STARTING STREAK CALCULATION ===');
  console.log('🔥 Input reviewStats:', reviewStats.length, reviewStats);
  
  if (!reviewStats || reviewStats.length === 0) {
    console.log('❌ No review stats provided');
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Get unique dates with activity (reviews_count > 0) and sort them
  const activeDates = reviewStats
    .filter(stat => {
      const hasActivity = stat.reviews_count > 0;
      console.log(`  📅 ${stat.review_date}: ${stat.reviews_count} reviews - ${hasActivity ? 'ACTIVE' : 'INACTIVE'}`);
      return hasActivity;
    })
    .map(stat => stat.review_date)
    .filter(date => date) // Remove any null/undefined dates
    .sort(); // Sort chronologically (oldest first)

  console.log('📅 === ACTIVE DATES ANALYSIS ===');
  console.log('📅 Total active dates:', activeDates.length);
  console.log('📅 Active dates (sorted):', activeDates);

  if (activeDates.length === 0) {
    console.log('❌ No active dates found');
    return { currentStreak: 0, longestStreak: 0 };
  }

  if (activeDates.length === 1) {
    console.log('ℹ️ Only one active date found');
    const today = getTodayLocalDate();
    const yesterday = addDaysToDate(today, -1);
    const singleDate = activeDates[0];
    
    const currentStreak = (singleDate === today || singleDate === yesterday) ? 1 : 0;
    console.log('🔥 Single date result:', { currentStreak, longestStreak: 1 });
    return { currentStreak, longestStreak: 1 };
  }

  // === CALCULATE LONGEST STREAK WITH ULTRA DETAILED LOGGING ===
  console.log('🏆 === LONGEST STREAK CALCULATION ===');
  let longestStreak = 1; // At least 1 if we have any activity
  let currentSequence = 1;
  let streaks = []; // Track all streaks for debugging
  let currentStreakDates = [activeDates[0]]; // Track dates in current streak

  console.log('🔍 Starting with first date:', activeDates[0]);
  console.log('🔍 Initial currentSequence: 1');
  
  for (let i = 1; i < activeDates.length; i++) {
    const date1 = activeDates[i - 1];
    const date2 = activeDates[i];
    
    // Create detailed date objects to check the calculation
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    const isConsecutive = Math.abs(diffDays - 1) < 0.001;
    
    console.log(`🔍 Step ${i}:`);
    console.log(`   Date 1: ${date1} (${d1.toDateString()})`);
    console.log(`   Date 2: ${date2} (${d2.toDateString()})`);
    console.log(`   Time diff: ${diffTime}ms`);
    console.log(`   Day diff: ${diffDays}`);
    console.log(`   Is consecutive: ${isConsecutive}`);
    
    if (isConsecutive) {
      currentSequence++;
      currentStreakDates.push(date2);
      console.log(`   ✅ CONSECUTIVE! Current sequence: ${currentSequence}`);
      console.log(`   Current streak dates: [${currentStreakDates.join(', ')}]`);
    } else {
      // End of a streak, record it
      console.log(`   ❌ NOT CONSECUTIVE - ending streak`);
      console.log(`   📊 Completed streak: ${currentSequence} days [${currentStreakDates.join(', ')}]`);
      
      streaks.push({
        length: currentSequence,
        dates: [...currentStreakDates],
        startDate: currentStreakDates[0],
        endDate: currentStreakDates[currentStreakDates.length - 1]
      });
      
      longestStreak = Math.max(longestStreak, currentSequence);
      console.log(`   🏆 New longest streak candidate: ${longestStreak}`);
      
      // Reset for new sequence
      currentSequence = 1;
      currentStreakDates = [date2];
      console.log(`   🔄 Reset - starting new streak with: ${date2}`);
    }
  }
  
  // Don't forget the last sequence
  console.log(`🔍 Processing final streak:`);
  console.log(`   📊 Final streak: ${currentSequence} days [${currentStreakDates.join(', ')}]`);
  
  streaks.push({
    length: currentSequence,
    dates: [...currentStreakDates],
    startDate: currentStreakDates[0],
    endDate: currentStreakDates[currentStreakDates.length - 1]
  });
  
  longestStreak = Math.max(longestStreak, currentSequence);
  
  console.log('🏆 === FINAL STREAK ANALYSIS ===');
  console.log('🏆 All streaks found:');
  streaks.forEach((streak, index) => {
    console.log(`   Streak ${index + 1}: ${streak.length} days (${streak.startDate} to ${streak.endDate})`);
    console.log(`      Dates: [${streak.dates.join(', ')}]`);
  });
  console.log('🥇 Longest streak calculated:', longestStreak);

  // === CALCULATE CURRENT STREAK ===
  console.log('📅 === CURRENT STREAK CALCULATION ===');
  const today = getTodayLocalDate();
  const yesterday = addDaysToDate(today, -1);
  
  console.log('📅 Today:', today);
  console.log('📅 Yesterday:', yesterday);
  console.log('📅 Last activity date:', activeDates[activeDates.length - 1]);

  let currentStreak = 0;
  const lastActivityDate = activeDates[activeDates.length - 1];

  if (lastActivityDate === today || lastActivityDate === yesterday) {
    console.log('✅ Recent activity found, calculating current streak...');
    currentStreak = 1;
    let checkDate = lastActivityDate;
    
    console.log('🔍 Calculating current streak backwards from:', checkDate);
    
    for (let i = activeDates.length - 2; i >= 0; i--) {
      const previousDate = activeDates[i];
      const expectedPrevDate = addDaysToDate(checkDate, -1);
      
      console.log(`   Checking: ${previousDate} vs expected: ${expectedPrevDate}`);
      
      if (previousDate === expectedPrevDate) {
        currentStreak++;
        checkDate = previousDate;
        console.log(`   ✅ Consecutive! Current streak: ${currentStreak}`);
      } else {
        console.log(`   ❌ Break in streak detected`);
        break;
      }
    }
  } else {
    currentStreak = 0;
    console.log('❌ No recent activity - current streak is 0');
  }

  const result = { currentStreak, longestStreak };
  console.log('🔥 === FINAL RESULT ===');
  console.log('🔥 Current Streak:', result.currentStreak);
  console.log('🔥 Longest Streak:', result.longestStreak);
  console.log('🔥 === END CALCULATION ===');
  
  return result;
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