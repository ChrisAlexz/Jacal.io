// src/components/ReviewHeatmap.jsx
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

  // Generate mock data for demo
  const generateMockHeatmapData = useCallback(() => {
    const heatmapArray = [];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 364);
    
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
    
    setHeatmapData(heatmapArray);
    setStats({
      longestStreak: 12,
      currentStreak: 5,
      dailyAverage: 15.3,
      totalReviews: 1247
    });
  }, []);

  // Fetch real review data
  const fetchReviewData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Calculate date range (last 365 days)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 364);

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
        generateMockHeatmapData();
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

      // Generate heatmap data for the last 365 days
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
      const dailyAvg = totalReviews > 0 ? Math.round(totalReviews / 365 * 10) / 10 : 0;
      
      setStats({
        longestStreak: streakStats.longest,
        currentStreak: streakStats.current,
        dailyAverage: dailyAvg,
        totalReviews
      });
      
    } catch (error) {
      console.error('Error processing review data:', error);
      // Fallback to mock data
      generateMockHeatmapData();
    } finally {
      setLoading(false);
    }
  }, [generateMockHeatmapData]);

  // Load data on mount
  useEffect(() => {
    if (user) {
      fetchReviewData();
    } else {
      // Show demo data for non-logged in users
      generateMockHeatmapData();
      setLoading(false);
    }
  }, [user, fetchReviewData, generateMockHeatmapData]);

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
        
        if (month !== currentMonth) {
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
        <h3>📊 Study Activity</h3>
        <span className="total-reviews">{stats.totalReviews} reviews in the last year</span>
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
          <div className="stat-label">Current Streak</div>
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
    </div>
  );
};

export default ReviewHeatmap;