// src/components/ReviewHeatmap.jsx - DEBUGGED VERSION WITH FIXED DEPENDENCIES

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

  // Debug logging
  useEffect(() => {
    console.log('🔍 ReviewHeatmap Debug:', {
      user: user?.id,
      loading,
      selectedYear,
      availableYears,
      heatmapDataLength: heatmapData.length,
      error
    });
  }, [user?.id, loading, selectedYear, availableYears.length, heatmapData.length, error]);

  // Helper function to get intensity level
  const getIntensityLevel = (count) => {
    if (count === 0) return 0;
    if (count <= 3) return 1;
    if (count <= 8) return 2;
    if (count <= 15) return 3;
    return 4;
  };

  // Calculate streak statistics
  const calculateStreaks = (data) => {
    if (!data || data.length === 0) return { current: 0, longest: 0 };
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    // Sort data by date to ensure proper streak calculation
    const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Calculate current streak (from today backwards)
    const today = new Date().toISOString().split('T')[0];
    let streakDate = new Date(today);
    
    for (let i = 0; i < 365; i++) { // Limit to prevent infinite loop
      const dateStr = streakDate.toISOString().split('T')[0];
      const dayData = sortedData.find(d => d.date === dateStr);
      
      if (dayData && dayData.count > 0) {
        currentStreak++;
        streakDate.setDate(streakDate.getDate() - 1);
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
  };

  // Generate empty heatmap for a year
  const generateEmptyHeatmap = useCallback((year) => {
    console.log(`🔧 Generating empty heatmap for year: ${year}`);
    const heatmapArray = [];
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      heatmapArray.push({
        date: dateStr,
        count: 0,
        level: 0
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`📊 Generated empty heatmap with ${heatmapArray.length} days`);
    return heatmapArray;
  }, []);

  // Fetch REAL review data for a specific year
  const fetchReviewDataForYear = useCallback(async (year) => {
    console.log(`🔄 fetchReviewDataForYear called for year: ${year}, user:`, user?.id);
    
    if (!user) {
      console.log('❌ No user found, setting loading to false');
      setLoading(false);
      setError('Please log in to view your study activity');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Calculate date range for the specific year
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);

      console.log(`📅 Fetching data from ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Step 1: Fetch ALL flashcard sets for the user first
      const { data: userSets, error: setsError } = await supabase
        .from('flashcard_sets')
        .select('id')
        .eq('user_id', user.id);

      if (setsError) {
        console.error('❌ Error fetching user sets:', setsError);
        setError('Error fetching your flashcard sets');
        setHeatmapData(generateEmptyHeatmap(year));
        setStats({ longestStreak: 0, currentStreak: 0, dailyAverage: 0, totalReviews: 0 });
        return;
      }

      console.log(`📚 Found ${userSets?.length || 0} flashcard sets for user`);

      if (!userSets || userSets.length === 0) {
        console.log('📭 No flashcard sets found for user - showing empty heatmap');
        const emptyHeatmapData = generateEmptyHeatmap(year);
        setHeatmapData(emptyHeatmapData);
        setStats({ longestStreak: 0, currentStreak: 0, dailyAverage: 0, totalReviews: 0 });
        return;
      }

      const setIds = userSets.map(set => set.id);
      console.log(`🎯 Looking for cards in sets: ${setIds.join(', ')}`);

      // Step 2: Fetch review history from flashcard_cards where last_reviewed is set
      const { data: cards, error } = await supabase
        .from('flashcard_cards')
        .select('last_reviewed, reviews, set_id')
        .in('set_id', setIds)
        .not('last_reviewed', 'is', null)
        .gte('last_reviewed', startDate.toISOString())
        .lte('last_reviewed', endDate.toISOString());

      if (error) {
        console.error('❌ Error fetching review data:', error);
        setError('Error fetching your study data');
        const emptyHeatmapData = generateEmptyHeatmap(year);
        setHeatmapData(emptyHeatmapData);
        setStats({ longestStreak: 0, currentStreak: 0, dailyAverage: 0, totalReviews: 0 });
        return;
      }

      console.log(`📊 Found ${cards?.length || 0} reviewed cards for ${year}`);

      // Step 3: Process the data into daily review counts
      const reviewsByDate = {};
      let totalReviews = 0;

      if (cards && cards.length > 0) {
        cards.forEach(card => {
          if (card.last_reviewed) {
            // Count each study session (not total reviews)
            const date = new Date(card.last_reviewed).toISOString().split('T')[0];
            reviewsByDate[date] = (reviewsByDate[date] || 0) + 1;
            totalReviews++;
          }
        });
        console.log(`📈 Processed reviews by date:`, Object.keys(reviewsByDate).length, 'days with activity');
      }

      // Step 4: Generate heatmap data for the entire year
      const heatmapArray = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const reviewCount = reviewsByDate[dateStr] || 0;
        
        heatmapArray.push({
          date: dateStr,
          count: reviewCount,
          level: getIntensityLevel(reviewCount)
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log(`📅 Generated heatmap with ${heatmapArray.length} days, ${heatmapArray.filter(d => d.count > 0).length} active days`);

      setHeatmapData(heatmapArray);
      
      // Step 5: Calculate statistics
      const streakStats = calculateStreaks(heatmapArray);
      const daysInYear = heatmapArray.length;
      const dailyAvg = totalReviews > 0 ? Math.round((totalReviews / daysInYear) * 10) / 10 : 0;
      
      const newStats = {
        longestStreak: streakStats.longest,
        currentStreak: year === new Date().getFullYear() ? streakStats.current : 0,
        dailyAverage: dailyAvg,
        totalReviews
      };

      console.log(`📊 Calculated stats:`, newStats);
      setStats(newStats);
      
    } catch (error) {
      console.error('💥 Unexpected error in fetchReviewDataForYear:', error);
      setError(`Unexpected error: ${error.message}`);
      const emptyHeatmapData = generateEmptyHeatmap(year);
      setHeatmapData(emptyHeatmapData);
      setStats({ longestStreak: 0, currentStreak: 0, dailyAverage: 0, totalReviews: 0 });
    } finally {
      setLoading(false);
    }
  }, [user?.id, generateEmptyHeatmap, getIntensityLevel]); // Fixed dependencies

  // Initialize available years and load data - FIXED DEPENDENCIES
  useEffect(() => {
    console.log('🚀 Main useEffect triggered, user:', user?.id);
    
    if (!user) {
      console.log('👤 No user, resetting state');
      setAvailableYears([]);
      setHeatmapData([]);
      setStats({ longestStreak: 0, currentStreak: 0, dailyAverage: 0, totalReviews: 0 });
      setLoading(false);
      setError('Please log in to view your study activity');
      return;
    }

    const initializeData = async () => {
      try {
        // Get user creation date or use current year
        const currentYear = new Date().getFullYear();
        let creationYear = currentYear;
        
        if (user.created_at) {
          creationYear = new Date(user.created_at).getFullYear();
        }
        
        console.log(`📅 User account created in: ${creationYear}, current year: ${currentYear}`);
        
        // Generate array of years from account creation to current year
        const years = [];
        for (let year = creationYear; year <= currentYear; year++) {
          years.push(year);
        }
        
        console.log(`📊 Available years:`, years);
        setAvailableYears(years);
        setSelectedYear(currentYear);
        
        // Load data for current year
        await fetchReviewDataForYear(currentYear);
      } catch (error) {
        console.error('💥 Error in initializeData:', error);
        setError(`Initialization error: ${error.message}`);
        setLoading(false);
      }
    };

    initializeData();
  }, [user?.id]); // Only depend on user.id to prevent infinite loops

  // Handle year change
  const handleYearChange = async (year) => {
    if (year !== selectedYear && !loading) {
      console.log(`📅 Year changed from ${selectedYear} to ${year}`);
      setSelectedYear(year);
      await fetchReviewDataForYear(year);
    }
  };

  // Set up real-time subscription for automatic updates - SEPARATE USEEFFECT
  useEffect(() => {
    if (!user?.id) return;

    console.log('📡 Setting up real-time subscription...');

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
        (payload) => {
          console.log('📡 Real-time update detected:', payload);
          // Refresh heatmap data after a delay
          setTimeout(() => {
            fetchReviewDataForYear(selectedYear);
          }, 2000);
        }
      )
      .subscribe();

    return () => {
      console.log('🧹 Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id, selectedYear, fetchReviewDataForYear]);

  // Helper functions for rendering
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
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
    
    const firstDate = new Date(days[0].date);
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
        const date = new Date(firstDayOfWeek.date);
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
          {process.env.NODE_ENV === 'development' && (
            <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#666' }}>
              <p>Debug: User ID: {user?.id}</p>
              <p>Debug: Selected Year: {selectedYear}</p>
            </div>
          )}
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
        </div>
        <div className="heatmap-loading">
          <p style={{ color: '#ff6b6b' }}>❌ {error}</p>
          {user && (
            <button 
              onClick={() => fetchReviewDataForYear(selectedYear)}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                background: '#4facfe',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🔄 Retry
            </button>
          )}
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
          <span className="total-reviews">{stats.totalReviews} reviews in {selectedYear}</span>
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

      {/* Debug info - only in development */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ marginTop: '20px', fontSize: '0.8rem', color: '#666', padding: '10px', background: '#1a1a1a', borderRadius: '4px' }}>
          <details>
            <summary>🔍 Debug Info (Development Only)</summary>
            <p>User ID: {user?.id}</p>
            <p>Selected Year: {selectedYear}</p>
            <p>Available Years: {availableYears.join(', ')}</p>
            <p>Total data points: {heatmapData.length}</p>
            <p>Days with activity: {heatmapData.filter(d => d.count > 0).length}</p>
            <p>Loading: {loading.toString()}</p>
            <p>Error: {error || 'None'}</p>
            <p>Last render: {new Date().toLocaleTimeString()}</p>
          </details>
        </div>
      )}
    </div>
  );
};

export default ReviewHeatmap;