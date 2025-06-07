// src/components/ReviewHeatmap.jsx - FIXED: Timezone & Real-time Updates

// ALSO UPDATE FlashcardStudyPage.jsx handleDifficultyChoice function to ensure proper event triggering:
/*
In FlashcardStudyPage.jsx, in the handleDifficultyChoice function, make sure this event is triggered:

// Trigger heatmap refresh even for emergency updates
window.dispatchEvent(new CustomEvent('flashcard-reviewed', {
  detail: {
    cardId: currentCardData.id,
    userId: user?.id,
    reviewedAt: now, // Make sure this is the current timestamp
    difficulty: difficulty,
    sessionType: 'master-again' // Add this to distinguish master again sessions
  }
}));

This should be triggered EVERY time a card is reviewed, regardless of update success/failure.
*/

import React, { useState, useEffect, useContext, useCallback } from 'react';
import { supabase } from '../supabase';
import UserAuthContext from './context/UserAuthContext';

const ReviewHeatmap = () => {
  const { user } = useContext(UserAuthContext);
  const [heatmapData, setHeatmapData] = useState([]);
  const [stats, setStats] = useState({
    longestStreak: 0,
    currentStreak: 0,
    dailyAverage: 0,
    totalReviews: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Helper function to get intensity level
  const getIntensityLevel = useCallback((count) => {
    if (count === 0) return 0;
    if (count <= 3) return 1;
    if (count <= 8) return 2;
    if (count <= 15) return 3;
    return 4;
  }, []);

  // FIXED: Convert UTC timestamp to user's local date properly
  const getLocalDateString = useCallback((utcTimestamp) => {
    if (!utcTimestamp) return null;
    
    // Create date object from UTC timestamp
    const utcDate = new Date(utcTimestamp);
    
    // Get the user's local date string in YYYY-MM-DD format
    // This automatically handles the user's timezone
    const year = utcDate.getFullYear();
    const month = String(utcDate.getMonth() + 1).padStart(2, '0');
    const day = String(utcDate.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }, []);

  // Calculate streak statistics
  const calculateStreaks = useCallback((data) => {
    if (!data || data.length === 0) return { current: 0, longest: 0 };
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate current streak (from today backwards)
    const today = new Date();
    const todayStr = getLocalDateString(today.toISOString());
    
    // Start from today and go backwards
    let checkDate = new Date(today);
    
    for (let i = 0; i < 365; i++) {
      const dateStr = getLocalDateString(checkDate.toISOString());
      const dayData = sortedData.find(d => d.date === dateStr);
      
      if (dayData && dayData.count > 0) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (i === 0) {
        // If today has no reviews, check yesterday
        checkDate.setDate(checkDate.getDate() - 1);
        continue;
      } else {
        break;
      }
    }
    
    // Calculate longest streak
    sortedData.forEach(day => {
      if (day.count > 0) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    });
    
    return { current: currentStreak, longest: longestStreak };
  }, [getLocalDateString]);

  // Generate empty heatmap for a year
  const generateEmptyHeatmap = useCallback((year) => {
    const heatmapArray = [];
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = getLocalDateString(currentDate.toISOString());
      
      heatmapArray.push({
        date: dateStr,
        count: 0,
        level: 0
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return heatmapArray;
  }, [getLocalDateString]);

  // FIXED: Enhanced fetch function with proper timezone handling
  const fetchReviewDataForYear = useCallback(async (year, userId) => {
    if (!userId) {
      setLoading(false);
      setError('Please log in to view your study activity');
      return;
    }

    try {
      console.log(`🔄 Fetching review data for year ${year}, user ${userId}`);
      setError(null);
      
      // Calculate date range for the specific year in user's timezone
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);

      // Step 1: Get user's flashcard sets
      const { data: userSets, error: setsError } = await supabase
        .from('flashcard_sets')
        .select('id')
        .eq('user_id', userId);

      if (setsError) {
        console.error('❌ Error fetching user sets:', setsError);
        setError('Error fetching your flashcard sets');
        return;
      }

      if (!userSets || userSets.length === 0) {
        console.log('📝 No flashcard sets found for user');
        const emptyHeatmapData = generateEmptyHeatmap(year);
        setHeatmapData(emptyHeatmapData);
        setStats({ longestStreak: 0, currentStreak: 0, dailyAverage: 0, totalReviews: 0 });
        return;
      }

      const setIds = userSets.map(set => set.id);
      console.log(`📦 Found ${setIds.length} sets for user`);

      // Step 2: Fetch ALL cards with last_reviewed data (no date filtering in SQL)
      // We'll handle timezone conversion in JavaScript
      const { data: cards, error } = await supabase
        .from('flashcard_cards')
        .select('last_reviewed, reviews, set_id')
        .in('set_id', setIds)
        .not('last_reviewed', 'is', null);

      if (error) {
        console.error('❌ Error fetching review data:', error);
        setError('Error fetching your study data');
        return;
      }

      console.log(`📊 Found ${cards?.length || 0} reviewed cards total`);

      // Step 3: Process the data into daily review counts using proper timezone conversion
      const reviewsByDate = {};
      let totalReviewsInYear = 0;

      if (cards && cards.length > 0) {
        cards.forEach(card => {
          if (card.last_reviewed) {
            // FIXED: Convert to user's local date
            const localDateStr = getLocalDateString(card.last_reviewed);
            
            if (localDateStr) {
              // Check if this date falls within the selected year
              const localYear = parseInt(localDateStr.split('-')[0]);
              
              if (localYear === year) {
                console.log(`📅 Review: UTC ${card.last_reviewed} → Local Date: ${localDateStr}`);
                reviewsByDate[localDateStr] = (reviewsByDate[localDateStr] || 0) + 1;
                totalReviewsInYear++;
              }
            }
          }
        });
      }
      
      console.log(`📊 Reviews by local date in ${year}:`, reviewsByDate);
      console.log(`📈 Total reviews in ${year}: ${totalReviewsInYear}`);

      // Step 4: Generate heatmap data for the entire year
      const heatmapArray = generateEmptyHeatmap(year);
      
      // Update heatmap with actual review data
      heatmapArray.forEach(day => {
        const reviewCount = reviewsByDate[day.date] || 0;
        day.count = reviewCount;
        day.level = getIntensityLevel(reviewCount);
      });

      setHeatmapData(heatmapArray);
      
      // Step 5: Calculate statistics
      const streakStats = calculateStreaks(heatmapArray);
      const daysInYear = heatmapArray.length;
      const dailyAvg = totalReviewsInYear > 0 ? Math.round((totalReviewsInYear / daysInYear) * 10) / 10 : 0;
      
      const newStats = {
        longestStreak: streakStats.longest,
        currentStreak: year === new Date().getFullYear() ? streakStats.current : 0,
        dailyAverage: dailyAvg,
        totalReviews: totalReviewsInYear
      };

      setStats(newStats);
      console.log('✅ Heatmap data updated successfully:', newStats);
      
    } catch (error) {
      console.error('💥 Unexpected error in fetchReviewDataForYear:', error);
      setError(`Unexpected error: ${error.message}`);
    }
  }, [generateEmptyHeatmap, getIntensityLevel, calculateStreaks, getLocalDateString]);

  // Initialize available years and load data
  useEffect(() => {
    if (!user?.id) {
      setAvailableYears([]);
      setHeatmapData([]);
      setStats({ longestStreak: 0, currentStreak: 0, dailyAverage: 0, totalReviews: 0 });
      setLoading(false);
      setError('Please log in to view your study activity');
      return;
    }

    const initializeData = async () => {
      try {
        setLoading(true);
        
        const currentYear = new Date().getFullYear();
        let creationYear = currentYear;
        
        if (user.created_at) {
          creationYear = new Date(user.created_at).getFullYear();
        }
        
        // Generate array of years from account creation to current year
        const years = [];
        for (let year = creationYear; year <= currentYear; year++) {
          years.push(year);
        }
        
        setAvailableYears(years);
        setSelectedYear(currentYear);
        
        // Load data for current year
        await fetchReviewDataForYear(currentYear, user.id);
      } catch (error) {
        console.error('💥 Error in initializeData:', error);
        setError(`Initialization error: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [user?.id, fetchReviewDataForYear]);

  // Handle year change
  const handleYearChange = useCallback(async (year) => {
    if (year !== selectedYear && !loading && user?.id) {
      setSelectedYear(year);
      setLoading(true);
      await fetchReviewDataForYear(year, user.id);
      setLoading(false);
    }
  }, [selectedYear, loading, user?.id, fetchReviewDataForYear]);

  // FIXED: Enhanced real-time updates with proper timezone handling
  useEffect(() => {
    if (!user?.id) return;

    console.log('🔄 Setting up real-time subscription for heatmap updates...');

    let refreshTimeoutId = null;

    // Strategy 1: Listen for custom events from study sessions (MAIN FIX)
    const handleCustomReviewEvent = (event) => {
      console.log('🎯 Received custom review event:', event.detail);
      
      if (event.detail.userId === user.id) {
        console.log('✅ Custom event confirmed for current user, refreshing heatmap...');
        setIsUpdating(true);
        
        // Clear any existing timeout
        if (refreshTimeoutId) {
          clearTimeout(refreshTimeoutId);
        }
        
        // Handle session completion immediately (no debounce)
        if (event.detail.sessionCompleted || event.detail.sessionRestarted || event.detail.forceRefresh) {
          console.log('🏁 Session/Force event detected - IMMEDIATE refresh!', {
            sessionCompleted: event.detail.sessionCompleted,
            sessionRestarted: event.detail.sessionRestarted,
            forceRefresh: event.detail.forceRefresh,
            immediate: event.detail.immediate,
            delayed: event.detail.delayed
          });
          
          // Clear any existing timeout first
          if (refreshTimeoutId) {
            clearTimeout(refreshTimeoutId);
          }
          
          // Immediate refresh for session events
          const delay = event.detail.immediate ? 100 : (event.detail.delayed ? 500 : 200);
          
          refreshTimeoutId = setTimeout(async () => {
            try {
              console.log('🔄 Executing IMMEDIATE heatmap refresh for session event...');
              setIsUpdating(true);
              await fetchReviewDataForYear(selectedYear, user.id);
              console.log('✅ Session heatmap refresh completed');
              
              // Force a re-render by triggering state update
              setStats(prevStats => ({ ...prevStats }));
              
            } catch (error) {
              console.error('❌ Error refreshing heatmap for session:', error);
            } finally {
              setIsUpdating(false);
            }
          }, delay);
        } else {
          // Regular card reviews - debounced
          refreshTimeoutId = setTimeout(async () => {
            try {
              console.log('🔄 Executing heatmap refresh for card review...');
              await fetchReviewDataForYear(selectedYear, user.id);
              console.log('✅ Card review heatmap refresh completed');
            } catch (error) {
              console.error('❌ Error refreshing heatmap:', error);
            } finally {
              setIsUpdating(false);
            }
          }, 1000); // 1 second debounce for individual cards
        }
      }
    };

    window.addEventListener('flashcard-reviewed', handleCustomReviewEvent);

    // Strategy 2: Supabase real-time subscription as backup
    const channel = supabase
      .channel('heatmap-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'flashcard_cards',
          filter: `last_reviewed=not.is.null`
        },
        async (payload) => {
          console.log('🔔 Received Supabase real-time update:', payload);
          
          // Check if this update is for one of the user's cards
          if (payload.new && payload.new.last_reviewed) {
            try {
              // Verify this card belongs to the user
              const { data: cardSet, error } = await supabase
                .from('flashcard_cards')
                .select('set_id, flashcard_sets!inner(user_id)')
                .eq('id', payload.new.id)
                .single();

              if (!error && cardSet?.flashcard_sets?.user_id === user.id) {
                console.log('✅ Supabase update confirmed for current user, refreshing heatmap...');
                setIsUpdating(true);
                
                // Clear any existing timeout
                if (refreshTimeoutId) {
                  clearTimeout(refreshTimeoutId);
                }
                
                // Longer delay for database consistency, but still responsive
                refreshTimeoutId = setTimeout(async () => {
                  try {
                    console.log('🔄 Executing heatmap refresh for Supabase event...');
                    await fetchReviewDataForYear(selectedYear, user.id);
                    console.log('✅ Heatmap refresh completed');
                  } catch (error) {
                    console.error('❌ Error refreshing heatmap:', error);
                  } finally {
                    setIsUpdating(false);
                  }
                }, 2000); // 2 second delay for DB consistency
              }
            } catch (err) {
              console.error('❌ Error verifying card ownership:', err);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Supabase subscription status:', status);
      });

    // Strategy 3: Periodic refresh for current year (more frequent during active study)
    let periodicRefresh;
    if (selectedYear === new Date().getFullYear()) {
      // More frequent refresh during active sessions
      const refreshInterval = isUpdating ? 15000 : 30000; // 15s when updating, 30s normally
      
      periodicRefresh = setInterval(async () => {
        console.log('🕒 Periodic heatmap refresh (current year only)...');
        try {
          await fetchReviewDataForYear(selectedYear, user.id);
        } catch (error) {
          console.error('❌ Error in periodic refresh:', error);
        }
      }, refreshInterval);
    }

    // Strategy 4: Listen for visibility changes to refresh when tab becomes active
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedYear === new Date().getFullYear()) {
        console.log('👁️ Tab became visible - refreshing heatmap...');
        setTimeout(() => {
          fetchReviewDataForYear(selectedYear, user.id);
        }, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      console.log('🔌 Cleaning up heatmap subscriptions');
      window.removeEventListener('flashcard-reviewed', handleCustomReviewEvent);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
      if (periodicRefresh) {
        clearInterval(periodicRefresh);
      }
      if (refreshTimeoutId) {
        clearTimeout(refreshTimeoutId);
      }
    };
  }, [user?.id, selectedYear, fetchReviewDataForYear]);

  // Manual refresh function
  const refreshHeatmap = useCallback(async () => {
    if (user?.id) {
      console.log('🔄 Manual refresh triggered');
      setIsUpdating(true);
      try {
        await fetchReviewDataForYear(selectedYear, user.id);
      } catch (error) {
        console.error('❌ Error in manual refresh:', error);
      } finally {
        setIsUpdating(false);
      }
    }
  }, [user?.id, selectedYear, fetchReviewDataForYear]);

  // Helper functions for rendering
  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00'); // Ensure we're working with local date
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTooltipText = (day) => {
    if (day.count === 0) {
      return `No reviews on ${formatDate(day.date)}`;
    }
    return `${day.count} review${day.count !== 1 ? 's' : ''} on ${formatDate(day.date)}`;
  };

  // Group days into weeks for display
  const groupIntoWeeks = (days) => {
    const weeks = [];
    let currentWeek = [];
    
    if (days.length === 0) return weeks;
    
    const firstDate = new Date(days[0].date + 'T00:00:00');
    const dayOfWeek = firstDate.getDay();
    
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
    
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }
    
    return weeks;
  };

  // Generate month labels
  const generateMonthLabels = (weeks) => {
    const monthLabels = [];
    let currentMonth = -1;
    
    weeks.forEach((week, weekIndex) => {
      const firstDayOfWeek = week.find(day => day !== null);
      if (firstDayOfWeek) {
        const date = new Date(firstDayOfWeek.date + 'T00:00:00');
        const month = date.getMonth();
        
        if (month !== currentMonth && date.getDate() <= 7) {
          const monthName = date.toLocaleDateString('en-US', { month: 'short' });
          monthLabels.push({
            name: monthName,
            weekIndex: weekIndex,
            month: month
          });
          currentMonth = month;
        }
      }
    });
    
    return monthLabels;
  };

  // Show loading state
  if (loading) {
    return (
      <div className="heatmap-container">
        <div className="heatmap-header">
          <h3>📊 Study Activity</h3>
        </div>
        <div className="heatmap-loading">
          <div className="loading-spinner"></div>
          <p>Loading your study data...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="heatmap-container">
        <div className="heatmap-header">
          <h3>📊 Study Activity</h3>
          <button 
            onClick={refreshHeatmap}
            style={{
              background: '#4facfe',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >
            Retry
          </button>
        </div>
        <div className="heatmap-loading">
          <p style={{ color: '#ff6b6b' }}>❌ {error}</p>
        </div>
      </div>
    );
  }

  // Prepare data for rendering
  const weeks = groupIntoWeeks(heatmapData);
  const monthLabels = generateMonthLabels(weeks);

  return (
    <div className="heatmap-container">
      <div className="heatmap-header">
        <div className="heatmap-title-section">
          <h3>📊 Study Activity</h3>
          <span className="total-reviews">
            {stats.totalReviews} reviews in {selectedYear}
            {isUpdating && <span style={{ color: '#4facfe', marginLeft: '8px' }}>🔄 Updating...</span>}
          </span>
        </div>
        
        {/* Year Navigation */}
        {availableYears.length > 1 && (
          <div className="year-navigation">
            <button 
              className="year-nav-btn"
              onClick={() => handleYearChange(selectedYear - 1)}
              disabled={selectedYear <= Math.min(...availableYears)}
              title="Previous year"
            >
              ←
            </button>
            <div className="year-selector">
              <select 
                value={selectedYear} 
                onChange={(e) => handleYearChange(parseInt(e.target.value))}
                className="year-select"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <button 
              className="year-nav-btn"
              onClick={() => handleYearChange(selectedYear + 1)}
              disabled={selectedYear >= Math.max(...availableYears)}
              title="Next year"
            >
              →
            </button>
            {/* Manual Refresh Button */}
            <button 
              className="year-nav-btn"
              onClick={refreshHeatmap}
              disabled={isUpdating}
              title="Refresh data"
              style={{ marginLeft: '8px' }}
            >
              🔄
            </button>
          </div>
        )}
      </div>
      
      <div className="heatmap-grid">
        {/* Month labels positioned above their respective weeks */}
        <div className="month-labels">
          {monthLabels.map((monthLabel, index) => (
            <span 
              key={index} 
              className="month-label"
              style={{
                position: 'absolute',
                left: `${monthLabel.weekIndex * 14 + 40}px`,
                fontSize: '0.7rem'
              }}
            >
              {monthLabel.name}
            </span>
          ))}
        </div>
        
        {/* Main grid with day labels and weeks */}
        <div className="heatmap-main-grid">
          {/* Day labels */}
          <div className="day-labels">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>
          
          {/* Heatmap grid */}
          <div className="heatmap-weeks">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="heatmap-week">
                {week.map((day, dayIndex) => (
                  <div
                    key={`${weekIndex}-${dayIndex}`}
                    className={`heatmap-day ${day ? `level-${day.level}` : 'empty'}`}
                    title={day ? getTooltipText(day) : ''}
                  >
                    {day && day.count > 0 && day.count < 100 && (
                      <span className="day-count">{day.count}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Statistics */}
      <div className="heatmap-stats">
        <div className="stat-item">
          <div className="stat-value">{stats.longestStreak}</div>
          <div className="stat-label">Longest Streak</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.currentStreak}</div>
          <div className="stat-label">{selectedYear === new Date().getFullYear() ? 'Current Streak' : 'Final Streak'}</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.dailyAverage}</div>
          <div className="stat-label">Daily Average</div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="heatmap-legend">
        <span className="legend-text">Less</span>
        <div className="legend-squares">
          <div className="legend-square level-0"></div>
          <div className="legend-square level-1"></div>
          <div className="legend-square level-2"></div>
          <div className="legend-square level-3"></div>
          <div className="legend-square level-4"></div>
        </div>
        <span className="legend-text">More</span>
      </div>
      
      {/* Previous Years Toggle */}
      {availableYears.length > 1 && selectedYear < new Date().getFullYear() && (
        <div className="previous-years-toggle">
          <button 
            className="toggle-previous-btn"
            onClick={() => handleYearChange(new Date().getFullYear())}
            title="Return to current year"
          >
            📊 View Current Year Stats
          </button>
        </div>
      )}
    </div>
  );
};

export default ReviewHeatmap;