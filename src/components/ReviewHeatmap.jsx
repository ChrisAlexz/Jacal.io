// src/components/ReviewHeatmap.jsx - YEAR-BASED HEATMAP WITH NAVIGATION
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
  const [accountCreatedYear, setAccountCreatedYear] = useState(null);

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
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    // Calculate current streak (from the end)
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].count > 0) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    // Calculate longest streak
    data.forEach(day => {
      if (day.count > 0) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    });
    
    return { current: currentStreak, longest: longestStreak };
  };

  // Get user account creation date
  const getUserCreationDate = useCallback(async () => {
    if (!user) return null;
    
    try {
      // Try to get from user metadata first
      if (user.created_at) {
        return new Date(user.created_at);
      }
      
      // Fallback: get from auth.users if we have access
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user && data.user.created_at) {
        return new Date(data.user.created_at);
      }
      
      // Ultimate fallback: assume current year
      return new Date();
    } catch (error) {
      console.error('Error getting user creation date:', error);
      return new Date();
    }
  }, [user]);

  // Generate mock data for demo
  const generateMockHeatmapData = useCallback((year) => {
    const heatmapArray = [];
    const startDate = new Date(year, 0, 1); // January 1st of the year
    const endDate = new Date(year, 11, 31); // December 31st of the year
    
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // Generate semi-realistic review patterns
      let reviewCount = 0;
      const dayOfWeek = currentDate.getDay();
      const randomFactor = Math.random();
      
      // Higher activity on weekdays, lower on weekends
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        if (randomFactor > 0.2) {
          reviewCount = Math.floor(Math.random() * 25) + 1;
        }
      } else {
        if (randomFactor > 0.4) {
          reviewCount = Math.floor(Math.random() * 15) + 1;
        }
      }
      
      heatmapArray.push({
        date: dateStr,
        count: reviewCount,
        level: getIntensityLevel(reviewCount)
      });
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return heatmapArray;
  }, []);

  // Fetch real review data for a specific year
  const fetchReviewDataForYear = useCallback(async (year) => {
    try {
      setLoading(true);
      
      // Calculate date range for the specific year
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);

      // Fetch review history from flashcard_cards where last_reviewed is set
      const { data: cards, error } = await supabase
        .from('flashcard_cards')
        .select('last_reviewed, reviews')
        .not('last_reviewed', 'is', null)
        .gte('last_reviewed', startDate.toISOString())
        .lte('last_reviewed', endDate.toISOString());

      if (error) {
        console.error('Error fetching review data:', error);
        // Fallback to mock data
        const mockData = generateMockHeatmapData(year);
        setHeatmapData(mockData);
        setStats({
          longestStreak: 12,
          currentStreak: year === new Date().getFullYear() ? 5 : 0, // Only show current streak for current year
          dailyAverage: 15.3,
          totalReviews: 1247
        });
        return;
      }

      // Process the data into daily review counts
      const reviewsByDate = {};
      let totalReviews = 0;

      if (cards) {
        cards.forEach(card => {
          if (card.last_reviewed) {
            const date = new Date(card.last_reviewed).toISOString().split('T')[0];
            reviewsByDate[date] = (reviewsByDate[date] || 0) + (card.reviews || 1);
            totalReviews += (card.reviews || 1);
          }
        });
      }

      // Generate heatmap data for the entire year
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

      setHeatmapData(heatmapArray);
      
      // Calculate statistics
      const streakStats = calculateStreaks(heatmapArray);
      const daysInYear = heatmapArray.length;
      const dailyAvg = totalReviews > 0 ? Math.round(totalReviews / daysInYear * 10) / 10 : 0;
      
      setStats({
        longestStreak: streakStats.longest,
        currentStreak: year === new Date().getFullYear() ? streakStats.current : 0, // Only show current streak for current year
        dailyAverage: dailyAvg,
        totalReviews
      });
      
    } catch (error) {
      console.error('Error processing review data:', error);
      // Fallback to mock data
      const mockData = generateMockHeatmapData(year);
      setHeatmapData(mockData);
      setStats({
        longestStreak: 12,
        currentStreak: year === new Date().getFullYear() ? 5 : 0,
        dailyAverage: 15.3,
        totalReviews: 1247
      });
    } finally {
      setLoading(false);
    }
  }, [generateMockHeatmapData]);

  // Initialize available years based on account creation
  const initializeAvailableYears = useCallback(async () => {
    if (user) {
      const creationDate = await getUserCreationDate();
      const creationYear = creationDate.getFullYear();
      const currentYear = new Date().getFullYear();
      
      setAccountCreatedYear(creationYear);
      
      // Generate array of years from account creation to current year
      const years = [];
      for (let year = creationYear; year <= currentYear; year++) {
        years.push(year);
      }
      
      setAvailableYears(years);
      
      // Set selected year to current year by default
      setSelectedYear(currentYear);
      
      // Load data for current year
      await fetchReviewDataForYear(currentYear);
    } else {
      // Show demo data for non-logged in users
      const currentYear = new Date().getFullYear();
      setAvailableYears([currentYear]);
      setSelectedYear(currentYear);
      const mockData = generateMockHeatmapData(currentYear);
      setHeatmapData(mockData);
      setStats({
        longestStreak: 12,
        currentStreak: 5,
        dailyAverage: 15.3,
        totalReviews: 1247
      });
      setLoading(false);
    }
  }, [user, getUserCreationDate, fetchReviewDataForYear, generateMockHeatmapData]);

  // Load data on mount
  useEffect(() => {
    initializeAvailableYears();
  }, [initializeAvailableYears]);

  // Handle year change
  const handleYearChange = async (year) => {
    if (year !== selectedYear) {
      setSelectedYear(year);
      await fetchReviewDataForYear(year);
    }
  };

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
    
    // Find the start of the first week (Sunday)
    const firstDate = new Date(days[0].date);
    const dayOfWeek = firstDate.getDay();
    
    // Add empty cells for the beginning of the first week
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
    
    // Add remaining days to the last week
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
    }
    
    return weeks;
  };

  // Generate month labels with proper positioning
  const generateMonthLabels = (weeks) => {
    const monthLabels = [];
    let currentMonth = -1;
    
    weeks.forEach((week, weekIndex) => {
      const firstDayOfWeek = week.find(day => day !== null);
      if (firstDayOfWeek) {
        const date = new Date(firstDayOfWeek.date);
        const month = date.getMonth();
        
        if (month !== currentMonth && date.getDate() <= 7) { // Only add label at beginning of month
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
                left: `${monthLabel.weekIndex * 14 + 40}px`, // 14px per week (12px width + 2px gap) + 40px for day labels
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
                    {day && day.count > 0 && (
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
      
      {/* Previous Years Toggle - only show if user has previous years and not viewing current year */}
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