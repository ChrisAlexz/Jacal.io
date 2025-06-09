// src/components/FlashcardHeatmap.jsx
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { supabase } from '../supabase';
import UserAuthContext from './context/UserAuthContext';

const FlashcardHeatmap = () => {
  const { user } = useContext(UserAuthContext);
  const [heatmapData, setHeatmapData] = useState([]);
  const [stats, setStats] = useState({
    longestStreak: 0,
    currentStreak: 0,
    totalReviews: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);

  // Generate dates for the entire year
  const generateYearDates = useCallback((year) => {
    const dates = [];
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push({
        date: d.toISOString().split('T')[0],
        count: 0,
        level: 0
      });
    }
    return dates;
  }, []);

  // Calculate intensity level based on review count
  const getIntensityLevel = useCallback((count) => {
    if (count === 0) return 0;
    if (count <= 3) return 1;
    if (count <= 8) return 2;
    if (count <= 15) return 3;
    return 4;
  }, []);

  // Calculate streaks
  const calculateStreaks = useCallback((data) => {
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    const today = new Date().toISOString().split('T')[0];
    const sortedData = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Calculate current streak (from today backwards)
    for (const day of sortedData) {
      if (day.date > today) continue;
      if (day.count > 0) {
        if (day.date === today || tempStreak > 0) {
          tempStreak++;
        } else {
          break;
        }
      } else if (day.date <= today) {
        break;
      }
    }
    currentStreak = tempStreak;
    
    // Calculate longest streak
    tempStreak = 0;
    const chronologicalData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    for (const day of chronologicalData) {
      if (day.count > 0) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }
    
    return { current: currentStreak, longest: longestStreak };
  }, []);

  // Fetch review data for the year
  const fetchReviewData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Get start and end of the selected year
      const startDate = new Date(selectedYear, 0, 1).toISOString();
      const endDate = new Date(selectedYear, 11, 31, 23, 59, 59).toISOString();

      // Query review sessions for the year
      const { data: reviewData, error } = await supabase
        .from('review_sessions')
        .select('reviewed_at, reviews_count')
        .eq('user_id', user.id)
        .gte('reviewed_at', startDate)
        .lte('reviewed_at', endDate);

      if (error && error.code !== '42P01') {
        console.error('Error fetching review data:', error);
        // If table doesn't exist, continue with empty data
        if (error.code === '42P01') {
          console.log('Review sessions table not found, showing empty heatmap');
        }
      }

      // Generate empty year data
      const yearDates = generateYearDates(selectedYear);
      
      // Aggregate reviews by date
      const reviewsByDate = {};
      let totalReviews = 0;

      if (reviewData) {
        reviewData.forEach(session => {
          const date = session.reviewed_at.split('T')[0];
          reviewsByDate[date] = (reviewsByDate[date] || 0) + (session.reviews_count || 1);
          totalReviews += (session.reviews_count || 1);
        });
      }

      // Apply review counts to dates
      const heatmapDataWithCounts = yearDates.map(day => ({
        ...day,
        count: reviewsByDate[day.date] || 0,
        level: getIntensityLevel(reviewsByDate[day.date] || 0)
      }));

      setHeatmapData(heatmapDataWithCounts);

      // Calculate statistics
      const streaks = calculateStreaks(heatmapDataWithCounts);
      setStats({
        longestStreak: streaks.longest,
        currentStreak: streaks.current,
        totalReviews
      });

    } catch (error) {
      console.error('Error fetching review data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedYear, generateYearDates, getIntensityLevel, calculateStreaks]);

  // Initialize available years
  useEffect(() => {
    if (!user?.id) {
      setAvailableYears([]);
      return;
    }

    const currentYear = new Date().getFullYear();
    const startYear = user.created_at ? new Date(user.created_at).getFullYear() : currentYear;
    
    const years = [];
    for (let year = startYear; year <= currentYear + 1; year++) {
      years.push(year);
    }
    
    setAvailableYears(years);
  }, [user]);

  // Set up event listeners for review tracking
  useEffect(() => {
    if (!user?.id) return;

    const handleReviewEvent = (event) => {
      console.log('🔔 Heatmap received review event:', event.detail);
      // Refresh heatmap data when reviews happen
      setTimeout(() => {
        fetchReviewData();
      }, 500); // Small delay to ensure database is updated
    };

    // Listen for custom review events
    window.addEventListener('flashcard-reviewed', handleReviewEvent);

    return () => {
      window.removeEventListener('flashcard-reviewed', handleReviewEvent);
    };
  }, [user?.id, fetchReviewData]);

  // Load data on mount and user change
  useEffect(() => {
    fetchReviewData();
  }, [fetchReviewData]);

  // Format date for tooltip
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric'
    });
  };

  // Group days into weeks for display
  const groupIntoWeeks = (days) => {
    const weeks = [];
    let currentWeek = [];
    
    if (days.length === 0) return weeks;
    
    // Start with the actual first day of the year, not padding
    let startIndex = 0;
    const firstDate = new Date(days[0].date);
    const dayOfWeek = firstDate.getDay();
    
    // Add empty cells for days before the first day of the year
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
    
    // Fill remaining days in last week
    while (currentWeek.length > 0 && currentWeek.length < 7) {
      currentWeek.push(null);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    
    return weeks;
  };

  // Generate month labels with better logic for proper year display
  const generateMonthLabels = (weeks) => {
    const monthLabels = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let currentMonthInYear = -1;
    
    weeks.forEach((week, weekIndex) => {
      // Find the first actual day (not null) in this week
      const firstRealDay = week.find(day => day !== null);
      
      if (firstRealDay) {
        const date = new Date(firstRealDay.date);
        const monthOfYear = date.getMonth();
        const year = date.getFullYear();
        
        // Only show months that belong to our selected year
        if (year === selectedYear) {
          // Show month label if this is a new month we haven't seen
          if (monthOfYear !== currentMonthInYear) {
            // Additional check: make sure this is actually near the beginning of the month
            // or that enough weeks have passed since the last label
            const dayOfMonth = date.getDate();
            const lastLabelWeek = monthLabels.length > 0 ? monthLabels[monthLabels.length - 1].weekIndex : -5;
            
            if (dayOfMonth <= 14 || weekIndex - lastLabelWeek >= 4) {
              monthLabels.push({
                name: months[monthOfYear],
                weekIndex: weekIndex,
                month: monthOfYear,
                date: firstRealDay.date,
                dayOfMonth: dayOfMonth
              });
              currentMonthInYear = monthOfYear;
            }
          }
        }
      }
    });
    
    console.log('Generated month labels for year', selectedYear, ':', monthLabels);
    return monthLabels;
  };

  if (!user) {
    return null;
  }

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

  const weeks = groupIntoWeeks(heatmapData);
  const monthLabels = generateMonthLabels(weeks);

  return (
    <div className="heatmap-container">
      <div className="heatmap-header">
        <div className="heatmap-title-section">
          <h3>📊 Study Activity</h3>
          <span className="total-reviews">
            {stats.totalReviews} reviews in {selectedYear}
          </span>
        </div>
        
        {availableYears.length > 1 && (
          <div className="year-navigation">
            <button 
              className="year-nav-btn"
              onClick={() => setSelectedYear(selectedYear - 1)}
              disabled={selectedYear <= Math.min(...availableYears)}
              title="Previous year"
            >
              ←
            </button>
            <div className="year-selector">
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="year-select"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <button 
              className="year-nav-btn"
              onClick={() => setSelectedYear(selectedYear + 1)}
              disabled={selectedYear >= Math.max(...availableYears)}
              title="Next year"
            >
              →
            </button>
            <button 
              className="year-nav-btn"
              onClick={fetchReviewData}
              title="Refresh data"
            >
              🔄
            </button>
          </div>
        )}
      </div>
      
      <div className="heatmap-grid">
        {/* Month labels */}
        <div className="month-labels">
          {monthLabels.map((label, index) => (
            <span 
              key={index}
              className="month-label"
              style={{
                position: 'absolute',
                left: `${label.weekIndex * 14 + 40}px`
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
        
        {/* Main grid with day labels and weeks */}
        <div className="heatmap-main-grid">
          <div className="day-labels">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <span key={day}>{day}</span>
            ))}
          </div>
          
          <div className="heatmap-weeks">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="heatmap-week">
                {week.map((day, dayIndex) => (
                  <div
                    key={`${weekIndex}-${dayIndex}`}
                    className={`heatmap-day ${day ? `level-${day.level}` : 'empty'}`}
                    title={day ? 
                      (day.count === 0 ? 
                        `No reviews on ${formatDate(day.date)}` : 
                        `${day.count} review${day.count !== 1 ? 's' : ''} on ${formatDate(day.date)}`
                      ) : ''
                    }
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
          <div className="stat-label">
            {selectedYear === new Date().getFullYear() ? 'Current Streak' : 'Final Streak'}
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-value">
            {Math.round((stats.totalReviews / 365) * 10) / 10}
          </div>
          <div className="stat-label">Daily Average</div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="heatmap-legend">
        <span className="legend-text">Less</span>
        <div className="legend-squares">
          {[0, 1, 2, 3, 4].map(level => (
            <div key={level} className={`legend-square level-${level}`} />
          ))}
        </div>
        <span className="legend-text">More</span>
      </div>
    </div>
  );
};

export default FlashcardHeatmap;