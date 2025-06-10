// src/utils/heatmapTracking.js - FIXED DATE/TIMEZONE BUG
import { supabase } from '../supabase';

/**
 * Get the correct local date string (fixes timezone issues)
 */
const getLocalDateString = () => {
  const now = new Date();
  // Force local timezone date
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  
  const localDate = `${year}-${month}-${day}`;
  console.log(`📅 Local date: ${localDate} (Day: ${now.toLocaleDateString('en-US', { weekday: 'long' })})`);
  return localDate;
};

/**
 * Get the correct timestamp for local timezone
 */
const getLocalTimestamp = () => {
  const now = new Date();
  // Create timestamp but ensure it's for the correct local date
  const localDate = getLocalDateString();
  const time = now.toTimeString().split(' ')[0]; // Get HH:MM:SS
  const localTimestamp = `${localDate}T${time}.000Z`;
  
  console.log(`🕐 Local timestamp: ${localTimestamp}`);
  return localTimestamp;
};

/**
 * Track a review event with CORRECT DATE
 */
export const trackReviewEvent = async (userId, cardId, sessionType = 'study', reviewsCount = 1) => {
  try {
    if (!userId || !cardId) {
      console.error('❌ Missing required parameters for tracking');
      return false;
    }

    // Use local timestamp to avoid timezone issues
    const reviewedAt = getLocalTimestamp();
    const localDate = getLocalDateString();
    
    console.log(`📊 Tracking review for LOCAL date: ${localDate}`);
    console.log(`📊 Today is: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
    
    const reviewData = {
      user_id: userId,
      card_id: cardId,
      session_type: sessionType,
      reviews_count: reviewsCount,
      reviewed_at: reviewedAt
    };

    console.log('💾 Inserting review data with CORRECT date:', reviewData);

    const { data, error } = await supabase
      .from('review_sessions')
      .insert(reviewData)
      .select();

    if (error) {
      console.error('❌ Error tracking review event:', error);
      
      if (error.code === '42P01') {
        await ensureReviewSessionsTable();
        return await trackReviewEvent(userId, cardId, sessionType, reviewsCount);
      }
      
      return false;
    }

    console.log('✅ Review tracked with CORRECT date:', data);

    // Fire events for heatmap update
    try {
      const event = new CustomEvent('flashcard-reviewed', {
        detail: {
          cardId,
          userId,
          sessionType,
          reviewsCount,
          timestamp: Date.now(),
          reviewedAt: reviewedAt,
          localDate: localDate
        }
      });
      window.dispatchEvent(event);
      console.log(`🔔 Event dispatched for date: ${localDate}`);
    } catch (eventError) {
      console.warn('⚠️ Failed to dispatch custom event:', eventError);
    }

    return true;
  } catch (error) {
    console.error('💥 Error in trackReviewEvent:', error);
    return false;
  }
};

/**
 * Ensure the review_sessions table exists
 */
const ensureReviewSessionsTable = async () => {
  try {
    const { error } = await supabase
      .from('review_sessions')
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') {
      console.error('❌ review_sessions table does not exist. Please create it in Supabase.');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('💥 Error checking table:', error);
    return false;
  }
};

/**
 * Fix existing reviews with wrong dates (run this once)
 */
export const fixReviewDates = async (userId) => {
  try {
    if (!userId) {
      console.error('❌ User ID required');
      return false;
    }

    console.log('🔧 Checking for reviews with wrong dates...');

    // Get all reviews for today that might have wrong date
    const today = getLocalDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayString = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    console.log(`📅 Today: ${today}, Yesterday: ${yesterdayString}`);

    // Check if we have reviews saved for yesterday that should be today
    const { data: yesterdayReviews, error } = await supabase
      .from('review_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('reviewed_at', `${yesterdayString}T00:00:00.000Z`)
      .lt('reviewed_at', `${today}T00:00:00.000Z`)
      .order('reviewed_at', { ascending: false });

    if (error) {
      console.error('❌ Error checking yesterday reviews:', error);
      return false;
    }

    if (yesterdayReviews && yesterdayReviews.length > 0) {
      console.log(`🔍 Found ${yesterdayReviews.length} reviews that might need date fixing`);
      
      // Ask user if they want to move recent reviews to today
      const shouldFix = window.confirm(`Found ${yesterdayReviews.length} reviews from yesterday. Do you want to move them to today (${today})?`);
      
      if (shouldFix) {
        const updatedReviews = [];
        
        for (const review of yesterdayReviews) {
          const newTimestamp = getLocalTimestamp();
          
          const { error: updateError } = await supabase
            .from('review_sessions')
            .update({ reviewed_at: newTimestamp })
            .eq('id', review.id);
          
          if (!updateError) {
            updatedReviews.push(review);
          }
        }
        
        console.log(`✅ Fixed ${updatedReviews.length} review dates`);
        
        // Force heatmap refresh
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('heatmap-force-refresh'));
        }, 500);
        
        return true;
      }
    } else {
      console.log('✅ No reviews found that need date fixing');
    }

    return true;
  } catch (error) {
    console.error('💥 Error in fixReviewDates:', error);
    return false;
  }
};

/**
 * Debug current date/time info
 */
export const debugDateTime = () => {
  const now = new Date();
  
  console.log('🕐 CURRENT DATE/TIME DEBUG:');
  console.log(`  - Browser time: ${now.toString()}`);
  console.log(`  - UTC time: ${now.toUTCString()}`);
  console.log(`  - ISO string: ${now.toISOString()}`);
  console.log(`  - Local date: ${getLocalDateString()}`);
  console.log(`  - Local timestamp: ${getLocalTimestamp()}`);
  console.log(`  - Day of week: ${now.toLocaleDateString('en-US', { weekday: 'long' })}`);
  console.log(`  - Timezone offset: ${now.getTimezoneOffset()} minutes`);
  
  return {
    browserTime: now.toString(),
    utcTime: now.toUTCString(),
    isoString: now.toISOString(),
    localDate: getLocalDateString(),
    localTimestamp: getLocalTimestamp(),
    dayOfWeek: now.toLocaleDateString('en-US', { weekday: 'long' }),
    timezoneOffset: now.getTimezoneOffset()
  };
};

// Make functions available globally for testing
window.fixReviewDates = (userId) => fixReviewDates(userId);
window.debugDateTime = debugDateTime;

console.log('🔧 Date/timezone fix loaded. Run debugDateTime() to check current date info.');