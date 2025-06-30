// src/components/FlashcardHeatmap.jsx - STALE CLOSURE FIX
import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import UserAuthContext from './context/UserAuthContext';
import { 
  getYearReviewStats, 
  getTotalReviewCount, 
  calculateStreaks, 
  getTodayLocalDate 
} from '../utils/heatmapTracking';
import '../styles/FlashcardHeatmap.css';

const FlashcardHeatmap = ({ className = '' }) => {
  const { user } = useContext(UserAuthContext);
  
  const [heatmapData, setHeatmapData] = useState([]);
  const [stats, setStats] = useState({
    currentStreak: 0,
    longestStreak: 0,
    totalReviews: 0,
    todayReviews: 0
  });
  
  // FIX: Use ref to store the actual longest streak value to avoid stale closure
  const longestStreakRef = useRef(0);
  
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Generate years for selection (current year and past 5 years)
  const availableYears = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  /**
   * Fetch and process heatmap data
   */
  const fetchHeatmapData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get review stats for the selected year
      const [reviewStats, totalReviews] = await Promise.all([
        getYearReviewStats(user.id, selectedYear),
        getTotalReviewCount(user.id)
      ]);

      // Create a map for faster lookups
      const reviewMap = new Map();
      reviewStats.forEach(stat => {
        reviewMap.set(stat.review_date, stat);
      });

      // Generate all dates for the year
      const yearData = [];
      const startDate = new Date(selectedYear, 0, 1);
      const endDate = new Date(selectedYear, 11, 31);
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const reviewStat = reviewMap.get(dateStr);
        
        yearData.push({
          date: dateStr,
          count: reviewStat?.reviews_count || 0,
          cardsStudied: reviewStat?.cards_studied || 0,
          sessionCount: reviewStat?.session_count || 0,
          masterAgainCount: reviewStat?.master_again_count || 0,
          level: getHeatmapLevel(reviewStat?.reviews_count || 0)
        });
      }

      setHeatmapData(yearData);

      // Calculate stats
      const streaks = calculateStreaks(reviewStats);
      const todayStr = getTodayLocalDate();
      const todayStats = reviewMap.get(todayStr);

      // FIX: Store the correct value in ref to avoid stale closure
      longestStreakRef.current = streaks.longestStreak;

      setStats({
        currentStreak: streaks.currentStreak,
        longestStreak: streaks.longestStreak,
        totalReviews,
        todayReviews: todayStats?.reviews_count || 0
      });

    } catch (err) {
      setError('Failed to load heatmap data');
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedYear]);

  /**
   * Get heatmap level (0-4) based on review count
   */
  const getHeatmapLevel = (count) => {
    if (count === 0) return 0;
    if (count <= 3) return 1;
    if (count <= 7) return 2;
    if (count <= 15) return 3;
    return 4;
  };

  /**
   * Group days into months with proper week separation
   */
  const groupIntoMonths = (days) => {
    const months = [];
    
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const firstDay = new Date(selectedYear, monthIndex, 1);
      const lastDay = new Date(selectedYear, monthIndex + 1, 0);
      
      const monthWeeks = [];
      const firstWeekStart = new Date(firstDay);
      firstWeekStart.setDate(firstDay.getDate() - firstDay.getDay());
      
      const weekStart = new Date(firstWeekStart);
      
      while (weekStart <= lastDay) {
        const week = [];
        
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
          const currentDate = new Date(weekStart);
          currentDate.setDate(weekStart.getDate() + dayOfWeek);
          
          if (currentDate.getMonth() === monthIndex && currentDate.getFullYear() === selectedYear) {
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayData = days ? days.find(d => d.date === dateStr) : null;
            
            week.push(dayData || {
              date: dateStr,
              count: 0,
              cardsStudied: 0,
              sessionCount: 0,
              masterAgainCount: 0,
              level: 0
            });
          } else {
            week.push(null);
          }
        }
        
        if (week.some(day => day !== null)) {
          monthWeeks.push(week);
        }
        
        weekStart.setDate(weekStart.getDate() + 7);
      }

      const monthName = new Date(selectedYear, monthIndex, 1).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      
      months.push({
        monthIndex,
        monthName,
        weeks: monthWeeks
      });
    }

    return months;
  };

  // Effect to fetch data when dependencies change
  useEffect(() => {
    fetchHeatmapData();
  }, [fetchHeatmapData]);

  // Effect to listen for heatmap refresh events
  useEffect(() => {
    const handleRefresh = () => {
      fetchHeatmapData();
    };

    window.addEventListener('heatmap-refresh', handleRefresh);
    return () => window.removeEventListener('heatmap-refresh', handleRefresh);
  }, [fetchHeatmapData]);

  // Don't render if user is not logged in
  if (!user) return null;

  const monthsData = groupIntoMonths(heatmapData);
  const today = getTodayLocalDate();

  return (
    <div className={`flashcard-heatmap ${className}`}>
      {/* Header */}
      <div className="heatmap-header" style={{ position: 'relative' }}>
        <div 
          className="heatmap-title-section"
          style={{ 
            paddingTop: window.innerWidth <= 768 ? '20px' : '32px',
            paddingLeft: window.innerWidth <= 768 ? '20px' : '40px',
            paddingBottom: window.innerWidth <= 768 ? '16px' : '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: window.innerWidth <= 768 ? '12px' : '16px'
          }}
        >
          <h3 style={{ 
            margin: '0', 
            padding: '0',
            fontSize: window.innerWidth <= 768 ? '1.3rem' : '1.6rem'
          }}>
            📊 Study Activity
            {loading && <span className="loading-indicator">⟳</span>}
          </h3>
          <span 
            className="total-reviews"
            style={{ 
              paddingLeft: window.innerWidth <= 768 ? '16px' : '24px',
              margin: '0',
              fontSize: window.innerWidth <= 768 ? '0.9rem' : '1rem'
            }}
          >
            {stats.totalReviews} reviews in {selectedYear}
          </span>
        </div>

        <div 
          style={{
            position: window.innerWidth <= 768 ? 'static' : 'absolute',
            top: window.innerWidth <= 768 ? 'auto' : '32px',
            right: window.innerWidth <= 768 ? 'auto' : '40px',
            zIndex: 10,
            marginTop: window.innerWidth <= 768 ? '20px' : '0',
            display: 'flex',
            justifyContent: window.innerWidth <= 768 ? 'center' : 'flex-start',
            paddingRight: window.innerWidth <= 768 ? '20px' : '0',
            paddingLeft: window.innerWidth <= 768 ? '20px' : '0'
          }}
        >
          <div className="year-navigation">
            <button
              className="year-nav-btn"
              onClick={() => setSelectedYear(prev => prev - 1)}
              disabled={loading || selectedYear <= availableYears[availableYears.length - 1]}
              title="Previous year"
              style={{
                width: window.innerWidth <= 768 ? '36px' : '40px',
                height: window.innerWidth <= 768 ? '36px' : '40px',
                fontSize: window.innerWidth <= 768 ? '1rem' : '1.2rem'
              }}
            >
              ‹
            </button>
            
            <select
              className="year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              disabled={loading}
              style={{
                padding: window.innerWidth <= 768 ? '10px 32px 10px 16px' : '12px 40px 12px 20px',
                fontSize: window.innerWidth <= 768 ? '0.9rem' : '1rem',
                minWidth: window.innerWidth <= 768 ? '90px' : '100px'
              }}
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            
            <button
              className="year-nav-btn"
              onClick={() => setSelectedYear(prev => prev + 1)}
              disabled={loading || selectedYear >= new Date().getFullYear()}
              title="Next year"
              style={{
                width: window.innerWidth <= 768 ? '36px' : '40px',
                height: window.innerWidth <= 768 ? '36px' : '40px',
                fontSize: window.innerWidth <= 768 ? '1rem' : '1.2rem'
              }}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="heatmap-error">
          <p>⚠️ {error}</p>
          <button onClick={fetchHeatmapData} className="retry-button">
            Try Again
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="heatmap-loading">
          <div className="loading-spinner"></div>
          <p>Loading heatmap...</p>
        </div>
      )}

      {/* Heatmap Grid */}
      {!loading && !error && (
        <div className="heatmap-grid">
          <div className="heatmap-main-grid">
            <div className="day-labels">
              <div className="spacer"></div>
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            <div className="heatmap-months-container">
              {monthsData.map((month, monthIndex) => (
                <div key={month.monthIndex} className="heatmap-month-group">
                  <div className="month-label-vertical">
                    {month.monthName}
                  </div>
                  
                  <div className="heatmap-month-weeks">
                    {month.weeks.map((week, weekIndex) => (
                      <div key={`${month.monthIndex}-${weekIndex}`} className="heatmap-week">
                        {week.map((day, dayIndex) => {
                          if (!day) {
                            return <div key={`${month.monthIndex}-${weekIndex}-${dayIndex}`} className="heatmap-day empty" />;
                          }

                          const isToday = day.date === today;
                          const tooltipText = `${day.count} reviews on ${day.date}${isToday ? ' (Today)' : ''}${
                            day.cardsStudied > 0 ? `\n${day.cardsStudied} cards studied` : ''
                          }${day.sessionCount > 0 ? `\n${day.sessionCount} sessions` : ''}${
                            day.masterAgainCount > 0 ? `\n${day.masterAgainCount} master again sessions` : ''
                          }`;

                          return (
                            <div
                              key={`${month.monthIndex}-${weekIndex}-${dayIndex}`}
                              className={`heatmap-day ${isToday ? 'today' : ''}`}
                              data-level={day.level}
                              data-today={isToday}
                              title={tooltipText}
                            >
                              {day.count > 0 && day.count < 100 && (
                                <span className="day-count">{day.count}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats - FIX: Use ref value to avoid stale closure */}
      {!loading && !error && (
        <div 
          className="heatmap-stats" 
          style={{ 
            marginTop: window.innerWidth <= 768 ? '24px' : '40px',
            gridTemplateColumns: window.innerWidth <= 768 ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: window.innerWidth <= 768 ? '16px' : '24px',
            padding: window.innerWidth <= 768 ? '20px 16px' : '32px 28px'
          }}
        >
          <div className="stat-item">
            <div className="stat-value">{stats.totalReviews}</div>
            <div className="stat-label">Total Reviews</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.currentStreak}</div>
            <div className="stat-label">Current Streak</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{longestStreakRef.current}</div>
            <div className="stat-label">Longest Streak</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.todayReviews}</div>
            <div className="stat-label">Today</div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="heatmap-legend">
        <div className="legend-squares">
          {[0, 1, 2, 3, 4].map(level => (
            <div
              key={level}
              className={`legend-square level-${level}`}
              title={`Level ${level}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FlashcardHeatmap;