// src/components/FlashcardHeatmap.jsx - Working Heatmap Component with MONTH-SEPARATED Layout
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
   * Group days into months with proper week separation - ALWAYS SHOW ALL 12 MONTHS
   */
  const groupIntoMonths = (days) => {
    console.log('🗓️ Input days for groupIntoMonths:', days?.length || 0);
    
    const months = [];
    
    // ALWAYS CREATE ALL 12 MONTHS regardless of data
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      console.log(`📅 Processing month ${monthIndex} (${new Date(selectedYear, monthIndex, 1).toLocaleDateString('en-US', { month: 'short' })})`);
      
      // Get the first and last day of the month
      const firstDay = new Date(selectedYear, monthIndex, 1);
      const lastDay = new Date(selectedYear, monthIndex + 1, 0);
      
      console.log(`📅 Month ${monthIndex}: ${firstDay.toDateString()} to ${lastDay.toDateString()}`);
      
      // Calculate weeks for this month
      const monthWeeks = [];
      
      // Find the start of the first week (Sunday before or on the first day)
      const firstWeekStart = new Date(firstDay);
      firstWeekStart.setDate(firstDay.getDate() - firstDay.getDay());
      
      // Create weeks for this month
      const weekStart = new Date(firstWeekStart);
      
      while (weekStart <= lastDay) {
        const week = [];
        
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
          const currentDate = new Date(weekStart);
          currentDate.setDate(weekStart.getDate() + dayOfWeek);
          
          if (currentDate.getMonth() === monthIndex && currentDate.getFullYear() === selectedYear) {
            // Find the day data for this date
            const dateStr = currentDate.toISOString().split('T')[0];
            const dayData = days ? days.find(d => d.date === dateStr) : null;
            
            // ALWAYS create day data, whether it exists or not
            week.push(dayData || {
              date: dateStr,
              count: 0,
              cardsStudied: 0,
              sessionCount: 0,
              masterAgainCount: 0,
              level: 0
            });
          } else {
            // Empty slot for days outside this month
            week.push(null);
          }
        }
        
        // Only add weeks that have at least one day from this month
        if (week.some(day => day !== null)) {
          monthWeeks.push(week);
        }
        
        // Move to next week
        weekStart.setDate(weekStart.getDate() + 7);
      }

      // ALWAYS add the month, even if no weeks (shouldn't happen but safety check)
      const monthName = new Date(selectedYear, monthIndex, 1).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      
      console.log(`📅 Adding month ${monthIndex} (${monthName}) with ${monthWeeks.length} weeks`);
      
      months.push({
        monthIndex,
        monthName,
        weeks: monthWeeks
      });
    }

    console.log('🗓️ Final months array:', months.map(m => `${m.monthName}(${m.weeks.length} weeks)`));
    return months;
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

  const monthsData = groupIntoMonths(heatmapData);
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

      {/* Heatmap Grid - MONTH-SEPARATED LAYOUT */}
      {!loading && !error && (
        <div className="heatmap-grid">
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

            {/* Monthly Heatmap Groups */}
            <div className="heatmap-months-container">
              {monthsData.map((month, monthIndex) => (
                <div key={month.monthIndex} className="heatmap-month-group">
                  {/* Month Label */}
                  <div className="month-label-vertical">
                    {month.monthName}
                  </div>
                  
                  {/* Month Weeks */}
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