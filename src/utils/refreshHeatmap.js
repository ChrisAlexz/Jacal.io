// src/utils/refreshHeatmap.js - Simple utility to force heatmap refresh
export const forceHeatmapRefresh = () => {
  console.log('🔄 Forcing heatmap refresh...');
  
  // Dispatch multiple events to ensure update
  const events = [
    'flashcard-reviewed',
    'heatmap-force-refresh', 
    'study-session-complete',
    'flashcard-study-complete'
  ];
  
  events.forEach(eventName => {
    try {
      window.dispatchEvent(new CustomEvent(eventName, {
        detail: {
          timestamp: Date.now(),
          source: 'manual-refresh'
        }
      }));
      console.log(`✅ Dispatched ${eventName}`);
    } catch (error) {
      console.error(`❌ Failed to dispatch ${eventName}:`, error);
    }
  });
  
  console.log('🔔 All refresh events dispatched');
};

// Export for easy testing in console
window.forceHeatmapRefresh = forceHeatmapRefresh;