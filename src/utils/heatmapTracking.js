// src/utils/heatmapTracking.js - COMPLETELY REBUILT TRACKING SYSTEM
import { supabase } from '../supabase';

/**
 * FORCE LOCAL DATE - NO TIMEZONE CONFUSION
 */
const getTodayString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * CREATE TIMESTAMP FOR TODAY IN LOCAL TIME
 */
const getTodayTimestamp = () => {
  const today = getTodayString();
  const now = new Date();
  const time = now.toTimeString().split(' ')[0];
  return `${today}T${time}`;
};

/**
 * NUCLEAR OPTION: Track review and FORCE UPDATE
 */
export const trackReviewEvent = async (userId, cardId, sessionType = 'study') => {
  if (!userId || !cardId) {
    console.error('❌ Missing userId or cardId');
    return false;
  }

  const today = getTodayString();
  const timestamp = getTodayTimestamp();
  
  console.log(`🎯 FORCE TRACKING FOR TODAY: ${today}`);

  try {
    // STEP 1: Delete any existing reviews for today
    await supabase
      .from('review_sessions')
      .delete()
      .eq('user_id', userId)
      .gte('reviewed_at', `${today}T00:00:00`)
      .lt('reviewed_at', `${today}T23:59:59`);

    console.log('🗑️ Cleared existing reviews for today');

    // STEP 2: Get total reviews from last session
    const existingCount = await getTodayReviewCount(userId);
    const newCount = existingCount + 1;

    // STEP 3: Insert fresh review for today
    const { data, error } = await supabase
      .from('review_sessions')
      .insert({
        user_id: userId,
        card_id: cardId,
        session_type: sessionType,
        reviews_count: newCount,
        reviewed_at: timestamp
      })
      .select();

    if (error) {
      console.error('❌ Error inserting review:', error);
      return false;
    }

    console.log(`✅ FORCED INSERT: ${newCount} reviews for ${today}`);

    // STEP 4: NUCLEAR REFRESH - Fire all possible events
    setTimeout(() => {
      const events = [
        'flashcard-reviewed',
        'heatmap-refresh',
        'heatmap-force-refresh', 
        'study-complete',
        'data-updated',
        'review-tracked'
      ];
      
      events.forEach(eventName => {
        window.dispatchEvent(new CustomEvent(eventName, {
          detail: {
            userId,
            cardId,
            date: today,
            count: newCount,
            timestamp: Date.now(),
            forced: true
          }
        }));
        console.log(`🔔 FIRED: ${eventName}`);
      });

      // ADDITIONAL: Trigger manual refresh on heatmap component
      if (window.forceHeatmapRefresh) {
        window.forceHeatmapRefresh();
      }
    }, 100);

    return true;
  } catch (error) {
    console.error('💥 TRACKING ERROR:', error);
    return false;
  }
};

/**
 * GET TODAY'S REVIEW COUNT FROM LOCAL STORAGE (BACKUP)
 */
const getTodayReviewCount = async (userId) => {
  const today = getTodayString();
  const storageKey = `reviews_${userId}_${today}`;
  
  // Get from localStorage first
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    const count = parseInt(stored, 10);
    console.log(`📱 Got count from storage: ${count}`);
    return count;
  }

  // Fallback to database
  try {
    const { data } = await supabase
      .from('review_sessions')
      .select('reviews_count')
      .eq('user_id', userId)
      .gte('reviewed_at', `${today}T00:00:00`)
      .lt('reviewed_at', `${today}T23:59:59`)
      .order('reviewed_at', { ascending: false })
      .limit(1);

    const count = data && data.length > 0 ? data[0].reviews_count : 0;
    
    // Store in localStorage
    localStorage.setItem(storageKey, count.toString());
    
    return count;
  } catch (error) {
    console.error('Error getting review count:', error);
    return 0;
  }
};

/**
 * UPDATE LOCAL STORAGE COUNT
 */
const updateLocalCount = (userId, newCount) => {
  const today = getTodayString();
  const storageKey = `reviews_${userId}_${today}`;
  localStorage.setItem(storageKey, newCount.toString());
  console.log(`💾 Updated local count: ${newCount}`);
};

/**
 * INSTANT FIX: Move yesterday's reviews to today
 */
export const instantFix = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.id) {
      alert('❌ Please log in first');
      return false;
    }

    const userId = session.user.id;
    const today = getTodayString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    console.log(`🔧 Moving reviews from ${yesterdayStr} to ${today}`);

    // Get yesterday's reviews
    const { data: yesterdayReviews } = await supabase
      .from('review_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('reviewed_at', `${yesterdayStr}T00:00:00`)
      .lt('reviewed_at', `${yesterdayStr}T23:59:59`);

    if (!yesterdayReviews || yesterdayReviews.length === 0) {
      console.log('❌ No reviews found for yesterday');
      return false;
    }

    // Calculate total reviews
    const totalReviews = yesterdayReviews.reduce((sum, review) => sum + (review.reviews_count || 1), 0);
    
    // Delete yesterday's reviews
    await supabase
      .from('review_sessions')
      .delete()
      .eq('user_id', userId)
      .gte('reviewed_at', `${yesterdayStr}T00:00:00`)
      .lt('reviewed_at', `${yesterdayStr}T23:59:59`);

    // Delete today's reviews
    await supabase
      .from('review_sessions')
      .delete()
      .eq('user_id', userId)
      .gte('reviewed_at', `${today}T00:00:00`)
      .lt('reviewed_at', `${today}T23:59:59`);

    // Insert fresh review for today
    const { error } = await supabase
      .from('review_sessions')
      .insert({
        user_id: userId,
        card_id: 'fixed-review',
        session_type: 'fixed',
        reviews_count: totalReviews,
        reviewed_at: getTodayTimestamp()
      });

    if (error) {
      console.error('❌ Error fixing reviews:', error);
      return false;
    }

    console.log(`✅ FIXED: Moved ${totalReviews} reviews to ${today}`);

    // Update localStorage
    updateLocalCount(userId, totalReviews);

    // NUCLEAR REFRESH
    setTimeout(() => {
      window.location.reload();
    }, 1000);

    alert(`✅ Fixed! Moved ${totalReviews} reviews to today. Page will refresh.`);
    return true;

  } catch (error) {
    console.error('💥 Fix error:', error);
    alert('❌ Fix failed. Check console.');
    return false;
  }
};

/**
 * MANUAL ADD REVIEWS FOR TESTING
 */
export const addTestReviews = async (count = 5) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user?.id) {
      alert('❌ Please log in first');
      return false;
    }

    const userId = session.user.id;
    const today = getTodayString();

    // Delete existing reviews for today
    await supabase
      .from('review_sessions')
      .delete()
      .eq('user_id', userId)
      .gte('reviewed_at', `${today}T00:00:00`)
      .lt('reviewed_at', `${today}T23:59:59`);

    // Insert test reviews
    const { error } = await supabase
      .from('review_sessions')
      .insert({
        user_id: userId,
        card_id: 'test-review',
        session_type: 'test',
        reviews_count: count,
        reviewed_at: getTodayTimestamp()
      });

    if (error) {
      console.error('❌ Error adding test reviews:', error);
      return false;
    }

    console.log(`✅ Added ${count} test reviews for ${today}`);

    // Update localStorage
    updateLocalCount(userId, count);

    // Force refresh
    setTimeout(() => {
      window.location.reload();
    }, 500);

    alert(`✅ Added ${count} test reviews for today! Page will refresh.`);
    return true;

  } catch (error) {
    console.error('💥 Test error:', error);
    return false;
  }
};

// Export functions for console use
window.instantFix = instantFix;
window.addTestReviews = addTestReviews;
window.getTodayString = getTodayString;

console.log('🔥 REBUILT HEATMAP TRACKING LOADED');
console.log('🚀 Run: instantFix() - Fix stuck reviews');
console.log('🧪 Run: addTestReviews(5) - Add 5 test reviews for today');
console.log('📅 Today is:', getTodayString());