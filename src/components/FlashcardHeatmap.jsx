// src/components/FlashcardHeatmap.jsx - Working Heatmap Component with FIXED Month Positioning
import React, { useState, useEffect, useContext, useCallback } from 'react';
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
      console.log(`📊 Fetching heatmap data for ${selectedYear}`);
      
      // Get review stats for the selected year
      const [reviewStats, totalReviews] = await Promise.all([
        getYearReviewStats(user.id, selectedYear),
        getTotalReviewCount(user.id)
      ]);

      console.log(`📈 Found ${reviewStats.length} days with reviews`);

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

      setStats({
        currentStreak: streaks.currentStreak,
        longestStreak: streaks.longestStreak,
        totalReviews,
        todayReviews: todayStats?.reviews_count || 0
      });

      console.log('✅ Heatmap data loaded successfully');
    } catch (err) {
      console.error('❌ Error fetching heatmap data:', err);
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
   * Group days into weeks for display - BACK TO VERTICAL LAYOUT
   */
  const groupIntoWeeks = (days) => {
    if (!days || days.length === 0) return [];

    const weeks = [];
    let currentWeek = [];

    // Find the first day and determine starting day of week
    const firstDate = new Date(days[0].date + 'T00:00:00');
    const dayOfWeek = firstDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Add empty cells for days before the year starts
    for (let i = 0; i < dayOfWeek; i++) {
      currentWeek.push(null);
    }

    // Add all days
    days.forEach(day => {
      currentWeek.push(day);
      
      if (currentWeek.length === 7) {
        weeks.push([...currentWeek]);
        currentWeek = [];
      }
    });

    // Fill the last week if needed
    while (currentWeek.length > 0 && currentWeek.length < 7) {
      currentWeek.push(null);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  };

  /**
   * Get month labels for the year - FIXED VERSION
   */
  const getMonthLabels = () => {
    const months = [
      'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
    ];
    
    return months.map((month, index) => ({
      name: month,
      weekOffset: getWeekOffset(selectedYear, index)
    }));
  };

  /**
   * Calculate week offset for month labels - CORRECTED VERSION
   */
  const getWeekOffset = (year, monthIndex) => {
    const firstDayOfYear = new Date(year, 0, 1);
    const firstDayOfMonth = new Date(year, monthIndex, 1);
    const daysDiff = Math.floor((firstDayOfMonth - firstDayOfYear) / (1000 * 60 * 60 * 24));
    const firstDayWeekday = firstDayOfYear.getDay();
    return Math.floor((daysDiff + firstDayWeekday) / 7);
  };

  // Effect to fetch data when dependencies change
  useEffect(() => {
    fetchHeatmapData();
  }, [fetchHeatmapData]);

  // Effect to listen for heatmap refresh events
  useEffect(() => {
    const handleRefresh = () => {
      console.log('🔄 Heatmap refresh event received');
      fetchHeatmapData();
    };

    window.addEventListener('heatmap-refresh', handleRefresh);
    return () => window.removeEventListener('heatmap-refresh', handleRefresh);
  }, [fetchHeatmapData]);

  // Don't render if user is not logged in
  if (!user) return null;

  const weeks = groupIntoWeeks(heatmapData);
  const monthLabels = getMonthLabels();
  const today = getTodayLocalDate();

  return (
    <div className={`flashcard-heatmap ${className}`}>
      {/* Header */}
      <div className="heatmap-header">
        <div className="heatmap-title-section">
          <h3>
            📊 Study Activity
            {loading && <span className="loading-indicator">⟳</span>}
          </h3>
          <span className="total-reviews">
            {stats.totalReviews} reviews in {selectedYear}
          </span>
        </div>

        <div className="year-navigation">
          <button
            className="year-nav-btn"
            onClick={() => setSelectedYear(prev => prev - 1)}
            disabled={loading || selectedYear <= availableYears[availableYears.length - 1]}
            title="Previous year"
          >
            ‹
          </button>
          
          <select
            className="year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            disabled={loading}
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
          >
            ›
          </button>
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

      {/* Heatmap Grid - BACK TO VERTICAL LAYOUT */}
      {!loading && !error && (
        <div className="heatmap-grid">
          {/* Month Labels */}
          <div className="month-labels">
            {monthLabels.map((month, index) => (
              <span
                key={month.name}
                className="month-label"
                style={{ left: `${month.weekOffset * 15 + 45}px` }}
              >
                {month.name}
              </span>
            ))}
          </div>

          {/* Main Grid */}
          <div className="heatmap-main-grid">
            {/* Day Labels */}
            <div className="day-labels">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Heatmap */}
            <div className="heatmap-weeks">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="heatmap-week">
                  {week.map((day, dayIndex) => {
                    if (!day) {
                      return <div key={`${weekIndex}-${dayIndex}`} className="heatmap-day empty" />;
                    }

                    const isToday = day.date === today;
                    const tooltipText = `${day.count} reviews on ${day.date}${isToday ? ' (Today)' : ''}${
                      day.cardsStudied > 0 ? `\n${day.cardsStudied} cards studied` : ''
                    }${day.sessionCount > 0 ? `\n${day.sessionCount} sessions` : ''}${
                      day.masterAgainCount > 0 ? `\n${day.masterAgainCount} master again sessions` : ''
                    }`;

                    return (
                      <div
                        key={`${weekIndex}-${dayIndex}`}
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
        </div>
      )}

      {/* Stats */}
      {!loading && !error && (
        <div className="heatmap-stats">
          <div className="stat-item">
            <div className="stat-value">{stats.totalReviews}</div>
            <div className="stat-label">Total Reviews</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.currentStreak}</div>
            <div className="stat-label">Current Streak</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{stats.longestStreak}</div>
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
        <span className="legend-text">Less</span>
        <div className="legend-squares">
          {[0, 1, 2, 3, 4].map(level => (
            <div
              key={level}
              className={`legend-square level-${level}`}
              title={`Level ${level}`}
            />
          ))}
        </div>
        <span className="legend-text">More</span>
      </div>
    </div>
  );
};

export default FlashcardHeatmap;