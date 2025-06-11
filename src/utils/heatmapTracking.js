// src/utils/heatmapTracking.js - NUCLEAR VERSION
import { supabase } from '../supabase';

const getToday = () => {
  const now = new Date();
  return now.getFullYear() + '-' + 
         String(now.getMonth() + 1).padStart(2, '0') + '-' + 
         String(now.getDate()).padStart(2, '0');
};

export const trackReviewEvent = async (userId, cardId, sessionType = 'study') => {
  if (!userId) {
    console.error('❌ No user ID');
    return false;
  }
  
  const today = getToday();
  const now = new Date().toISOString();
  
  console.log('🎯 TRACKING REVIEW FOR:', today);
  
  try {
    // Get current count
    const { data: existing } = await supabase
      .from('review_sessions')
      .select('reviews_count')
      .eq('user_id', userId)
      .eq('card_id', `daily_${today}`)
      .single();
    
    const currentCount = existing?.reviews_count || 0;
    const newCount = currentCount + 1;
    
    console.log(`📊 ${currentCount} -> ${newCount}`);
    
    // Upsert the count
    const { error } = await supabase
      .from('review_sessions')
      .upsert({
        user_id: userId,
        card_id: `daily_${today}`,
        session_type: sessionType,
        reviews_count: newCount,
        reviewed_at: now
      });
    
    if (error) {
      console.error('❌ DB Error:', error);
      return false;
    }
    
    console.log('✅ TRACKED SUCCESSFULLY');
    
    // NUCLEAR REFRESH
    setTimeout(() => {
      console.log('🚀 FIRING NUCLEAR REFRESH');
      
      // Fire ALL events
      window.dispatchEvent(new CustomEvent('heatmap-refresh'));
      window.dispatchEvent(new CustomEvent('flashcard-reviewed'));
      window.dispatchEvent(new CustomEvent('study-complete'));
      
      // Call nuclear refresh if available
      if (window.nuclearRefresh) {
        window.nuclearRefresh();
      }
      
      // Force page refresh as last resort
      if (window.location.pathname.includes('/study/')) {
        console.log('💥 FORCING PAGE REFRESH AS LAST RESORT');
        setTimeout(() => {
          if (window.nuclearRefresh) window.nuclearRefresh();
        }, 500);
      }
      
    }, 100);
    
    return true;
    
  } catch (error) {
    console.error('💥 TRACKING FAILED:', error);
    return false;
  }
};

// Test function - call this in console
window.testTrackReview = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id) {
    console.log('🧪 Testing review tracking...');
    await trackReviewEvent(session.user.id, 'test-card', 'test');
  } else {
    console.log('❌ Not logged in');
  }
};

console.log('🔥 NUCLEAR TRACKING LOADED');
console.log('🧪 Test: testTrackReview()');
console.log('📅 Today:', getToday());