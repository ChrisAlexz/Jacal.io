// src/utils/heatmapTracking.js - COMPLETE FIXED VERSION
import { supabase } from '../supabase';

/**
 * Track a review event and store it in the database
 */
export const trackReviewEvent = async (userId, cardId, sessionType = 'study', reviewsCount = 1) => {
  try {
    if (!userId || !cardId) {
      console.error('❌ Missing required parameters for tracking');
      return false;
    }

    const now = new Date().toISOString();
    
    const reviewData = {
      user_id: userId,
      card_id: cardId,
      session_type: sessionType,
      reviews_count: reviewsCount,
      reviewed_at: now
    };

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

    // Fire event for real-time heatmap update
    try {
      const event = new CustomEvent('flashcard-reviewed', {
        detail: {
          cardId,
          userId,
          sessionType,
          reviewsCount,
          timestamp: Date.now(),
          reviewedAt: now
        }
      });
      window.dispatchEvent(event);
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
    // Try to create table with a simple insert test
    const { error } = await supabase
      .from('review_sessions')
      .select('id')
      .limit(1);
    
    if (error && error.code === '42P01') {
      // Table doesn't exist, but we can't create it programmatically
      // This needs to be done in Supabase dashboard
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
 * Track multiple reviews from a session
 */
export const trackBulkReviews = async (userId, cardIds, sessionType = 'master-again') => {
  try {
    if (!userId || !cardIds || cardIds.length === 0) {
      return false;
    }

    const now = new Date().toISOString();
    const reviewSessions = cardIds.map(cardId => ({
      user_id: userId,
      card_id: cardId,
      session_type: sessionType,
      reviews_count: 1,
      reviewed_at: now
    }));

    const batchSize = 50;
    let successCount = 0;
    
    for (let i = 0; i < reviewSessions.length; i += batchSize) {
      const batch = reviewSessions.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('review_sessions')
        .insert(batch);

      if (!error) {
        successCount += batch.length;
      }
    }

    if (successCount > 0) {
      try {
        window.dispatchEvent(new CustomEvent('flashcard-reviewed', {
          detail: {
            bulkReview: true,
            cardIds,
            userId,
            sessionType,
            reviewsCount: successCount,
            timestamp: Date.now(),
            reviewedAt: now
          }
        }));
      } catch (eventError) {
        console.warn('⚠️ Failed to dispatch bulk review event:', eventError);
      }
    }

    return successCount > 0;
  } catch (error) {
    console.error('💥 Error in trackBulkReviews:', error);
    return false;
  }
};

/**
 * Get review statistics
 */
export const getReviewStats = async (userId, year = new Date().getFullYear()) => {
  try {
    if (!userId) {
      return null;
    }

    const startDate = new Date(year, 0, 1).toISOString();
    const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from('review_sessions')
      .select('reviewed_at, reviews_count, session_type')
      .eq('user_id', userId)
      .gte('reviewed_at', startDate)
      .lte('reviewed_at', endDate)
      .order('reviewed_at', { ascending: true });

    if (error) {
      if (error.code === '42P01') {
        return {
          totalReviews: 0,
          masterAgainSessions: 0,
          studySessions: 0,
          speedFocusSessions: 0,
          reviewDays: 0,
          dailyData: []
        };
      }
      return null;
    }

    if (!data || data.length === 0) {
      return {
        totalReviews: 0,
        masterAgainSessions: 0,
        studySessions: 0,
        speedFocusSessions: 0,
        reviewDays: 0,
        dailyData: []
      };
    }

    const totalReviews = data.reduce((sum, session) => sum + (session.reviews_count || 1), 0);
    const masterAgainSessions = data.filter(session => session.session_type === 'master-again').length;
    const studySessions = data.filter(session => session.session_type === 'study').length;
    const speedFocusSessions = data.filter(session => session.session_type === 'speed-focus').length;
    
    const dailyData = {};
    data.forEach(session => {
      const date = session.reviewed_at.split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = 0;
      }
      dailyData[date] += (session.reviews_count || 1);
    });

    return {
      totalReviews,
      masterAgainSessions,
      studySessions,
      speedFocusSessions,
      reviewDays: Object.keys(dailyData).length,
      dailyData: Object.entries(dailyData).map(([date, count]) => ({ date, count }))
    };
    
  } catch (error) {
    console.error('💥 Error in getReviewStats:', error);
    return null;
  }
};

/**
 * Initialize heatmap tracking
 */
export const initializeHeatmapTracking = async (userId) => {
  try {
    if (!userId) {
      return false;
    }
    
    // Check if we have recent data
    const recentStats = await getReviewStats(userId);
    if (recentStats && recentStats.totalReviews === 0) {
      await migrateExistingReviews(userId);
    }
    
    return true;
  } catch (error) {
    console.error('💥 Error initializing heatmap tracking:', error);
    return false;
  }
};

/**
 * Migrate existing review data
 */
export const migrateExistingReviews = async (userId) => {
  try {
    if (!userId) {
      return false;
    }
    
    const { data: reviewedCards, error } = await supabase
      .from('flashcard_cards')
      .select('id, last_reviewed, reviews, created_at')
      .eq('user_id', userId)
      .not('last_reviewed', 'is', null);

    if (error || !reviewedCards || reviewedCards.length === 0) {
      return true;
    }

    // Check if migration already done
    const { data: existingReviews } = await supabase
      .from('review_sessions')
      .select('id')
      .eq('user_id', userId)
      .limit(5);

    if (existingReviews && existingReviews.length > 0) {
      return true;
    }

    const reviewSessions = reviewedCards.map(card => ({
      user_id: userId,
      card_id: card.id,
      reviewed_at: card.last_reviewed || card.created_at,
      session_type: 'study',
      reviews_count: Math.max(1, card.reviews || 1)
    }));

    const batchSize = 50;
    let migratedCount = 0;
    
    for (let i = 0; i < reviewSessions.length; i += batchSize) {
      const batch = reviewSessions.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('review_sessions')
        .insert(batch);

      if (!insertError) {
        migratedCount += batch.length;
      }
    }

    if (migratedCount > 0) {
      try {
        window.dispatchEvent(new CustomEvent('flashcard-reviewed', {
          detail: {
            migrationComplete: true,
            userId,
            reviewsCount: migratedCount,
            timestamp: Date.now()
          }
        }));
      } catch (eventError) {
        console.warn('⚠️ Failed to dispatch migration event:', eventError);
      }
    }
    
    return migratedCount > 0;
    
  } catch (error) {
    console.error('💥 Error in migrateExistingReviews:', error);
    return false;
  }
};
// Add this to your heatmapTracking.js file at the bottom:

/**
 * Test tracking with the current logged-in user (no manual user ID needed)
 */
export const testTrackingWithCurrentUser = async () => {
  try {
    console.log('🧪 Testing heatmap tracking...');
    
    // Get current user automatically
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('❌ Error getting current user:', error);
      return false;
    }
    
    if (!user) {
      console.error('❌ No user is currently logged in');
      return false;
    }
    
    console.log('✅ Found current user:', user.email);
    
    // Test tracking
    const testCardId = 'test-' + Date.now();
    const result = await trackReviewEvent(user.id, testCardId, 'manual-test', 1);
    
    if (result) {
      console.log('✅ Tracking test PASSED! Your heatmap should update.');
      
      // Also test getting stats
      const stats = await getReviewStats(user.id);
      console.log('📊 Current stats:', stats);
      
      return true;
    } else {
      console.log('❌ Tracking test FAILED! Check the errors above.');
      return false;
    }
    
  } catch (error) {
    console.error('💥 Error in tracking test:', error);
    return false;
  }
};

/**
 * Quick debug function to check everything
 */
export const debugHeatmapForCurrentUser = async () => {
  try {
    console.log('🔍 Running complete heatmap debug...');
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('❌ Please log in first');
      return;
    }
    
    console.log('👤 User:', user.email, user.id);
    
    // Check if table exists
    const { data: tableTest, error: tableError } = await supabase
      .from('review_sessions')
      .select('count')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Table check failed:', tableError);
      if (tableError.code === '42P01') {
        console.error('💡 The review_sessions table does not exist. Please run the SQL script in Supabase.');
      }
      return;
    }
    
    console.log('✅ Table exists');
    
    // Check recent data
    const { data: recentData, error: recentError } = await supabase
      .from('review_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('reviewed_at', { ascending: false })
      .limit(5);
    
    if (recentError) {
      console.error('❌ Error fetching recent data:', recentError);
      return;
    }
    
    console.log('📋 Recent review sessions:', recentData);
    
    // Test today's data specifically
    const today = new Date().toISOString().split('T')[0];
    const { data: todayData, error: todayError } = await supabase
      .from('review_sessions')
      .select('*')
      .eq('user_id', user.id)
      .gte('reviewed_at', today + 'T00:00:00.000Z')
      .lte('reviewed_at', today + 'T23:59:59.999Z');
    
    if (todayError) {
      console.error('❌ Error fetching today\'s data:', todayError);
      return;
    }
    
    console.log('📅 Today\'s review sessions:', todayData);
    
    if (!todayData || todayData.length === 0) {
      console.log('⚠️ No review sessions recorded for today yet');
      console.log('💡 Try studying some flashcards or run testTrackingWithCurrentUser()');
    } else {
      console.log('✅ Found', todayData.length, 'review sessions today');
    }
    
    // Test tracking
    console.log('🧪 Testing new tracking...');
    await testTrackingWithCurrentUser();
    
  } catch (error) {
    console.error('💥 Debug error:', error);
  }
};