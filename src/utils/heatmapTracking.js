// src/utils/heatmapTracking.js
import { supabase } from '../supabase';

/**
 * Track a review event and store it in the database
 * @param {string} userId - The user's ID
 * @param {string} cardId - The card being reviewed
 * @param {string} sessionType - Type of session ('study', 'master-again', 'speed-focus', 'card-creation')
 * @param {number} reviewsCount - Number of reviews in this session (default: 1)
 */
export const trackReviewEvent = async (userId, cardId, sessionType = 'study', reviewsCount = 1) => {
  try {
    console.log('📊 Tracking review event:', { userId, cardId, sessionType, reviewsCount });

    const { error } = await supabase
      .from('review_sessions')
      .insert({
        user_id: userId,
        card_id: cardId,
        session_type: sessionType,
        reviews_count: reviewsCount,
        reviewed_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error tracking review event:', error);
      
      // If table doesn't exist, create it automatically
      if (error.code === '42P01') {
        console.log('Creating review_sessions table...');
        await createReviewSessionsTable();
        // Retry the insert
        return await trackReviewEvent(userId, cardId, sessionType, reviewsCount);
      }
      
      return false;
    }

    console.log('✅ Review event tracked successfully');

    // Fire a custom event to update the heatmap in real-time
    window.dispatchEvent(new CustomEvent('flashcard-reviewed', {
      detail: {
        cardId,
        userId,
        sessionType,
        reviewsCount,
        timestamp: Date.now()
      }
    }));

    return true;
  } catch (error) {
    console.error('Error in trackReviewEvent:', error);
    return false;
  }
};

/**
 * Track multiple reviews from a master-again session
 * @param {string} userId - The user's ID
 * @param {Array} cardIds - Array of card IDs reviewed
 * @param {string} sessionType - Type of session
 */
export const trackBulkReviews = async (userId, cardIds, sessionType = 'master-again') => {
  try {
    console.log('📊 Tracking bulk reviews:', { userId, cardCount: cardIds.length, sessionType });

    const reviewSessions = cardIds.map(cardId => ({
      user_id: userId,
      card_id: cardId,
      session_type: sessionType,
      reviews_count: 1,
      reviewed_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('review_sessions')
      .insert(reviewSessions);

    if (error) {
      console.error('Error tracking bulk reviews:', error);
      
      // If table doesn't exist, create it automatically
      if (error.code === '42P01') {
        console.log('Creating review_sessions table...');
        await createReviewSessionsTable();
        // Retry the insert
        return await trackBulkReviews(userId, cardIds, sessionType);
      }
      
      return false;
    }

    console.log('✅ Bulk reviews tracked successfully');

    // Fire event for heatmap update
    window.dispatchEvent(new CustomEvent('flashcard-reviewed', {
      detail: {
        bulkReview: true,
        cardIds,
        userId,
        sessionType,
        reviewsCount: cardIds.length,
        timestamp: Date.now()
      }
    }));

    return true;
  } catch (error) {
    console.error('Error in trackBulkReviews:', error);
    return false;
  }
};

/**
 * Get review statistics for a user
 * @param {string} userId - The user's ID
 * @param {number} year - Year to get stats for (default: current year)
 */
export const getReviewStats = async (userId, year = new Date().getFullYear()) => {
  try {
    const startDate = new Date(year, 0, 1).toISOString();
    const endDate = new Date(year, 11, 31, 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from('review_sessions')
      .select('reviewed_at, reviews_count, session_type')
      .eq('user_id', userId)
      .gte('reviewed_at', startDate)
      .lte('reviewed_at', endDate);

    if (error) {
      console.error('Error fetching review stats:', error);
      return null;
    }

    // Process the data
    const totalReviews = data.reduce((sum, session) => sum + (session.reviews_count || 1), 0);
    const masterAgainSessions = data.filter(session => session.session_type === 'master-again').length;
    const studySessions = data.filter(session => session.session_type === 'study').length;
    const speedFocusSessions = data.filter(session => session.session_type === 'speed-focus').length;

    return {
      totalReviews,
      masterAgainSessions,
      studySessions,
      speedFocusSessions,
      reviewDays: [...new Set(data.map(session => session.reviewed_at.split('T')[0]))].length
    };
  } catch (error) {
    console.error('Error in getReviewStats:', error);
    return null;
  }
};

/**
 * Create the review_sessions table if it doesn't exist
 */
const createReviewSessionsTable = async () => {
  try {
    const { error } = await supabase.rpc('create_review_sessions_table');
    
    if (error) {
      console.error('Error creating review_sessions table:', error);
      
      // Fallback: try manual table creation via SQL
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS review_sessions (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          card_id UUID,
          reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          session_type TEXT DEFAULT 'study',
          reviews_count INTEGER DEFAULT 1,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_review_sessions_user_date ON review_sessions(user_id, reviewed_at);
        CREATE INDEX IF NOT EXISTS idx_review_sessions_card ON review_sessions(card_id);
        CREATE INDEX IF NOT EXISTS idx_review_sessions_session_type ON review_sessions(session_type);
        
        ALTER TABLE review_sessions ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Users can only see their own review sessions" ON review_sessions;
        CREATE POLICY "Users can only see their own review sessions" ON review_sessions
          FOR SELECT USING (auth.uid() = user_id);
        
        DROP POLICY IF EXISTS "Users can only insert their own review sessions" ON review_sessions;
        CREATE POLICY "Users can only insert their own review sessions" ON review_sessions
          FOR INSERT WITH CHECK (auth.uid() = user_id);
        
        DROP POLICY IF EXISTS "Users can only update their own review sessions" ON review_sessions;
        CREATE POLICY "Users can only update their own review sessions" ON review_sessions
          FOR UPDATE USING (auth.uid() = user_id);
        
        DROP POLICY IF EXISTS "Users can only delete their own review sessions" ON review_sessions;
        CREATE POLICY "Users can only delete their own review sessions" ON review_sessions
          FOR DELETE USING (auth.uid() = user_id);
      `;
      
      const { error: sqlError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
      
      if (sqlError) {
        console.error('Error executing SQL to create table:', sqlError);
        throw sqlError;
      }
    }
    
    console.log('✅ Review sessions table created successfully');
    return true;
  } catch (error) {
    console.error('Error in createReviewSessionsTable:', error);
    return false;
  }
};

/**
 * Migrate existing review data from flashcard_cards table
 * @param {string} userId - The user's ID
 */
export const migrateExistingReviews = async (userId) => {
  try {
    console.log('🔄 Migrating existing review data...');
    
    // Get all cards that have been reviewed (have last_reviewed date)
    const { data: reviewedCards, error } = await supabase
      .from('flashcard_cards')
      .select('id, last_reviewed, reviews')
      .eq('user_id', userId)
      .not('last_reviewed', 'is', null);

    if (error) {
      console.error('Error fetching reviewed cards:', error);
      return false;
    }

    if (!reviewedCards || reviewedCards.length === 0) {
      console.log('No reviewed cards found to migrate');
      return true;
    }

    // Check if migration already done
    const { data: existingReviews, error: checkError } = await supabase
      .from('review_sessions')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (checkError && checkError.code !== '42P01') {
      console.error('Error checking existing reviews:', checkError);
      return false;
    }

    if (existingReviews && existingReviews.length > 0) {
      console.log('Migration already completed - reviews exist');
      return true;
    }

    // Create review sessions for each reviewed card
    const reviewSessions = reviewedCards.map(card => ({
      user_id: userId,
      card_id: card.id,
      reviewed_at: card.last_reviewed,
      session_type: 'study',
      reviews_count: Math.max(1, card.reviews || 1)
    }));

    // Insert in batches to avoid timeout
    const batchSize = 100;
    for (let i = 0; i < reviewSessions.length; i += batchSize) {
      const batch = reviewSessions.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('review_sessions')
        .insert(batch);

      if (insertError) {
        console.error('Error inserting review session batch:', insertError);
        return false;
      }
      
      console.log(`✅ Migrated ${batch.length} review sessions`);
    }

    console.log(`🎉 Successfully migrated ${reviewSessions.length} review sessions`);
    
    // Fire event to refresh heatmap
    window.dispatchEvent(new CustomEvent('flashcard-reviewed', {
      detail: {
        migrationComplete: true,
        userId,
        reviewsCount: reviewSessions.length,
        timestamp: Date.now()
      }
    }));
    
    return true;
    
  } catch (error) {
    console.error('Error in migrateExistingReviews:', error);
    return false;
  }
};

/**
 * Initialize heatmap tracking for a user
 * @param {string} userId - The user's ID
 */
export const initializeHeatmapTracking = async (userId) => {
  try {
    console.log('🚀 Initializing heatmap tracking for user:', userId);
    
    // Try to migrate existing data
    await migrateExistingReviews(userId);
    
    console.log('✅ Heatmap tracking initialized');
    return true;
  } catch (error) {
    console.error('Error initializing heatmap tracking:', error);
    return false;
  }
};