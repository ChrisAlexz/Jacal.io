// src/components/FlashcardHeatmap.jsx - NUCLEAR VERSION THAT FORCES UPDATES
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { supabase } from '../supabase';
import UserAuthContext from './context/UserAuthContext';

const FlashcardHeatmap = () => {
  const { user } = useContext(UserAuthContext);
  
  // FORCE UPDATE STATE
  const [forceUpdate, setForceUpdate] = useState(0);
  const [heatmapData, setHeatmapData] = useState([]);
  const [stats, setStats] = useState({
    longestStreak: 0,
    currentStreak: 0,
    totalReviews: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Get today in YYYY-MM-DD format
  const getToday = () => {
    const now = new Date();
    return now.getFullYear() + '-' + 
           String(now.getMonth() + 1).padStart(2, '0') + '-' + 
           String(now.getDate()).padStart(2, '0');
  };

  // NUCLEAR REFRESH - FORCES COMPLETE RELOAD
  const nuclearRefresh = useCallback(() => {
    console.log('🚀 NUCLEAR REFRESH TRIGGERED');
    setForceUpdate(prev => prev + 1);
  }, []);

  // FETCH DATA - SIMPLIFIED AND DIRECT
  const fetchData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    console.log('📊 Fetching heatmap data...');
    setLoading(true);

    try {
      // Get all review sessions for this year
      const { data: reviewData, error } = await supabase
        .from('review_sessions')
        .select('reviewed_at, reviews_count')
        .eq('user_id', user.id)
        .gte('reviewed_at', `${selectedYear}-01-01`)
        .lte('reviewed_at', `${selectedYear}-12-31`)
        .order('reviewed_at', { ascending: true });

      if (error) {
        console.error('❌ Database error:', error);
        setLoading(false);
        return;
      }

      console.log('📊 Raw data:', reviewData);

      // Create year dates
      const yearDates = [];
      const startDate = new Date(selectedYear, 0, 1);
      const endDate = new Date(selectedYear, 11, 31);
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.getFullYear() + '-' + 
                       String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(d.getDate()).padStart(2, '0');
        yearDates.push({
          date: dateStr,
          count: 0,
          level: 0
        });
      }

      // Process review data
      const reviewsByDate = {};
      let totalReviews = 0;

      if (reviewData && reviewData.length > 0) {
        reviewData.forEach(session => {
          const dateStr = session.reviewed_at.split('T')[0];
          const count = session.reviews_count || 1;
          
          if (!reviewsByDate[dateStr]) {
            reviewsByDate[dateStr] = 0;
          }
          reviewsByDate[dateStr] = Math.max(reviewsByDate[dateStr], count);
          totalReviews += count;
        });
      }

      console.log('📊 Reviews by date:', reviewsByDate);
      console.log('📊 Total:', totalReviews);

      // Apply counts to dates and calculate levels
      const finalData = yearDates.map(day => {
        const count = reviewsByDate[day.date] || 0;
        let level = 0;
        if (count > 0) level = 1;
        if (count > 3) level = 2;
        if (count > 8) level = 3;
        if (count > 15) level = 4;
        
        return {
          ...day,
          count,
          level
        };
      });

      setHeatmapData(finalData);
      setStats({
        longestStreak: 0, // Simplified
        currentStreak: 0, // Simplified  
        totalReviews
      });

    } catch (error) {
      console.error('💥 Error:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedYear]);

  // LISTEN FOR REFRESH EVENTS
  useEffect(() => {
    if (!user?.id) return;

    const handleRefresh = () => {
      console.log('🔔 Refresh event received');
      nuclearRefresh();
    };

    // Listen to ALL possible events
    window.addEventListener('heatmap-refresh', handleRefresh);
    window.addEventListener('flashcard-reviewed', handleRefresh);
    window.addEventListener('study-complete', handleRefresh);
    
    // Make nuclear refresh available globally
    window.nuclearRefresh = nuclearRefresh;

    return () => {
      window.removeEventListener('heatmap-refresh', handleRefresh);
      window.removeEventListener('flashcard-reviewed', handleRefresh);
      window.removeEventListener('study-complete', handleRefresh);
      delete window.nuclearRefresh;
    };
  }, [user?.id, nuclearRefresh]);

  // FETCH DATA WHEN DEPENDENCIES CHANGE
  useEffect(() => {
    fetchData();
  }, [fetchData, forceUpdate]); // Include forceUpdate as dependency

  // Group days into weeks
  const groupIntoWeeks = (days) => {
    const weeks = [];
    let currentWeek = [];
    
    if (days.length === 0) return weeks;
    
    const firstDate = new Date(days[0].date + 'T00:00:00');
    const dayOfWeek = firstDate.getDay();
    
    // Add empty cells for days before month starts
    for (let i = 0; i < dayOfWeek; i++) {
      currentWeek.push(null);
    }
    
    days.forEach(day => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    });
    
    // Fill remaining cells
    while (currentWeek.length > 0 && currentWeek.length < 7) {
      currentWeek.push(null);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    
    return weeks;
  };

  if (!user) return null;

  if (loading) {
    return (
      <div style={{ 
        background: '#1e1e1e',
        border: '1px solid #333',
        borderRadius: '16px',
        padding: '24px',
        color: 'white'
      }}>
        <h3>📊 Study Activity</h3>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{ 
            width: '30px', height: '30px', 
            border: '3px solid #333', borderTop: '3px solid #4facfe',
            borderRadius: '50%', animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const weeks = groupIntoWeeks(heatmapData);
  const today = getToday();

  return (
    <div style={{ 
      background: '#1e1e1e',
      border: '1px solid #333',
      borderRadius: '16px',
      padding: '24px',
      color: 'white'
    }} key={`heatmap-${forceUpdate}`}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            📊 Study Activity
            <span style={{ fontSize: '0.7rem', background: '#4facfe', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>
              F{forceUpdate}
            </span>
          </h3>
          <span style={{ fontSize: '0.9rem', color: '#aaa' }}>
            {stats.totalReviews} reviews in {selectedYear}
          </span>
        </div>
        
        <button 
          onClick={nuclearRefresh}
          style={{
            background: 'rgba(79, 172, 254, 0.1)',
            border: '1px solid rgba(79, 172, 254, 0.3)',
            color: '#4facfe',
            borderRadius: '8px',
            padding: '8px 16px',
            cursor: 'pointer'
          }}
        >
          🔄 Refresh
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <div style={{ width: '40px' }}></div>
          <div style={{ display: 'flex', gap: '2px' }}>
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '12px' }}>
                {week.map((day, dayIndex) => {
                  if (!day) {
                    return <div key={`${weekIndex}-${dayIndex}`} style={{ width: '12px', height: '12px' }} />;
                  }
                  
                  const isToday = day.date === today;
                  const colors = ['#2d2d2d', '#0e4429', '#006d32', '#26a641', '#39d353'];
                  const bgColor = colors[day.level] || colors[0];
                  
                  return (
                    <div
                      key={`${weekIndex}-${dayIndex}`}
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '2px',
                        backgroundColor: bgColor,
                        border: isToday ? '2px solid #4facfe' : `1px solid ${bgColor}`,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '6px',
                        fontWeight: 'bold',
                        color: day.level === 4 ? '#000' : '#fff'
                      }}
                      title={`${day.count} reviews on ${day.date}${isToday ? ' (TODAY)' : ''}`}
                    >
                      {day.count > 0 && day.count < 100 && (
                        <span style={{ fontSize: '5px', opacity: 0.8 }}>
                          {day.count}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-around', 
        padding: '16px',
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '12px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#4facfe' }}>
            {stats.totalReviews}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#aaa' }}>Total Reviews</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#4facfe' }}>
            {today}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#aaa' }}>Today</div>
        </div>
      </div>
      
      <div style={{ 
        fontSize: '0.7rem', 
        color: '#666', 
        textAlign: 'center', 
        marginTop: '12px',
        fontFamily: 'monospace'
      }}>
        Force Update: {forceUpdate} | Today: {today} | Data Points: {heatmapData.length}
      </div>
    </div>
  );
};

export default FlashcardHeatmap;