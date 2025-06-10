// src/components/FlashcardHeatmap.jsx - COMPLETE REBUILT HEATMAP COMPONENT
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { supabase } from '../supabase';
import UserAuthContext from './context/UserAuthContext';

const FlashcardHeatmap = () => {
  const { user } = useContext(UserAuthContext);
  
  // FORCE REFRESH STATE
  const [refreshKey, setRefreshKey] = useState(0);
  const [heatmapData, setHeatmapData] = useState([]);
  const [stats, setStats] = useState({
    longestStreak: 0,
    currentStreak: 0,
    totalReviews: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  
  // Force refresh function
  const forceRefresh = useCallback(() => {
    console.log('🔄 FORCING HEATMAP REFRESH');
    setRefreshKey(prev => prev + 1);
  }, []);

  // Make force refresh available globally
  useEffect(() => {
    window.forceHeatmapRefresh = forceRefresh;
    return () => {
      delete window.forceHeatmapRefresh;
    };
  }, [forceRefresh]);

  const getBackgroundColor = (level) => {
    switch (level) {
      case 1: return '#0e4429';
      case 2: return '#006d32';
      case 3: return '#26a641';
      case 4: return '#39d353';
      default: return '#2d2d2d';
    }
  };

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

  const getIntensityLevel = useCallback((count) => {
    if (count === 0) return 0;
    if (count <= 3) return 1;
    if (count <= 8) return 2;
    if (count <= 15) return 3;
    return 4;
  }, []);

  const calculateStreaks = useCallback((data) => {
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    const today = new Date().toISOString().split('T')[0];
    const sortedData = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));
    
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

  // MAIN DATA FETCHING FUNCTION
  const fetchReviewData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log(`🔄 Fetching review data for ${selectedYear} (refresh: ${refreshKey})`);
      
      const startDate = new Date(selectedYear, 0, 1).toISOString();
      const endDate = new Date(selectedYear, 11, 31, 23, 59, 59).toISOString();

      // Get review data with fresh query
      const { data: reviewData, error } = await supabase
        .from('review_sessions')
        .select('reviewed_at, reviews_count')
        .eq('user_id', user.id)
        .gte('reviewed_at', startDate)
        .lte('reviewed_at', endDate)
        .order('reviewed_at', { ascending: true });

      if (error && error.code !== '42P01') {
        console.error('Error fetching review data:', error);
      }

      const yearDates = generateYearDates(selectedYear);
      const reviewsByDate = {};
      let totalReviews = 0;

      // Process review data
      if (reviewData && reviewData.length > 0) {
        reviewData.forEach(session => {
          const date = session.reviewed_at.split('T')[0];
          reviewsByDate[date] = (reviewsByDate[date] || 0) + (session.reviews_count || 1);
          totalReviews += (session.reviews_count || 1);
        });
      }

      console.log('📊 Reviews by date:', reviewsByDate);
      console.log('📊 Total reviews:', totalReviews);

      // FORCE TODAY'S DATE - Get from localStorage as backup
      const today = new Date().toISOString().split('T')[0];
      if (!reviewsByDate[today] && user?.id) {
        const storageKey = `reviews_${user.id}_${today}`;
        const storedCount = localStorage.getItem(storageKey);
        if (storedCount && parseInt(storedCount) > 0) {
          reviewsByDate[today] = parseInt(storedCount);
          totalReviews += parseInt(storedCount);
          console.log(`📱 Added from storage: ${storedCount} reviews for ${today}`);
        }
      }

      // Create heatmap data
      const heatmapDataWithCounts = yearDates.map(day => ({
        ...day,
        count: reviewsByDate[day.date] || 0,
        level: getIntensityLevel(reviewsByDate[day.date] || 0)
      }));

      setHeatmapData(heatmapDataWithCounts);

      const streaks = calculateStreaks(heatmapDataWithCounts);
      setStats({
        longestStreak: streaks.longest,
        currentStreak: streaks.current,
        totalReviews
      });

      console.log('✅ Heatmap data updated:', {
        totalReviews,
        todayCount: reviewsByDate[today] || 0,
        streaks
      });

    } catch (error) {
      console.error('Error fetching review data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedYear, refreshKey, generateYearDates, getIntensityLevel, calculateStreaks]);

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

  // LISTEN FOR ALL POSSIBLE REFRESH EVENTS
  useEffect(() => {
    if (!user?.id) return;

    const refreshEvents = [
      'flashcard-reviewed',
      'heatmap-refresh',
      'heatmap-force-refresh',
      'study-complete',
      'data-updated',
      'review-tracked'
    ];

    const handleRefresh = (event) => {
      console.log('🔔 Received refresh event:', event.type);
      setTimeout(() => {
        forceRefresh();
      }, 300);
    };

    refreshEvents.forEach(eventName => {
      window.addEventListener(eventName, handleRefresh);
    });

    return () => {
      refreshEvents.forEach(eventName => {
        window.removeEventListener(eventName, handleRefresh);
      });
    };
  }, [user?.id, forceRefresh]);

  // LOAD DATA
  useEffect(() => {
    fetchReviewData();
  }, [fetchReviewData]);

  // Manual refresh button
  const handleManualRefresh = () => {
    console.log('🔄 Manual refresh triggered');
    forceRefresh();
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric'
    });
  };

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
    
    while (currentWeek.length > 0 && currentWeek.length < 7) {
      currentWeek.push(null);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }
    
    return weeks;
  };

  const generateMonthLabels = (weeks) => {
    const monthLabels = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let currentMonthInYear = -1;
    
    weeks.forEach((week, weekIndex) => {
      const firstRealDay = week.find(day => day !== null);
      
      if (firstRealDay) {
        const date = new Date(firstRealDay.date);
        const monthOfYear = date.getMonth();
        const year = date.getFullYear();
        
        if (year === selectedYear) {
          if (monthOfYear !== currentMonthInYear) {
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
    
    return monthLabels;
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div style={{ 
        background: '#1e1e1e',
        border: '1px solid #333',
        borderRadius: '16px',
        padding: '24px',
        color: 'white'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: '0', color: 'white' }}>📊 Study Activity</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' }}>
          <div style={{ 
            width: '30px',
            height: '30px',
            border: '3px solid #333',
            borderTop: '3px solid #4facfe',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
          }}></div>
          <p style={{ color: '#aaa', margin: '0', fontSize: '0.9rem' }}>Loading your study data...</p>
        </div>
      </div>
    );
  }

  const weeks = groupIntoWeeks(heatmapData);
  const monthLabels = generateMonthLabels(weeks);
  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{ 
      background: '#1e1e1e',
      border: '1px solid #333',
      borderRadius: '16px',
      padding: '24px',
      color: 'white',
      transition: 'all 0.3s ease',
      position: 'relative',
      overflow: 'hidden'
    }} key={`heatmap-${refreshKey}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: '0', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📊 Study Activity
            <span style={{ fontSize: '0.7rem', background: '#4facfe', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>
              R{refreshKey}
            </span>
          </h3>
          <span style={{ fontSize: '0.9rem', color: '#aaa', fontWeight: '500' }}>
            {stats.totalReviews} reviews in {selectedYear}
          </span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '12px', padding: '6px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          {availableYears.length > 1 && (
            <>
              <button 
                onClick={() => setSelectedYear(selectedYear - 1)}
                disabled={selectedYear <= Math.min(...availableYears)}
                title="Previous year"
                style={{
                  background: 'rgba(79, 172, 254, 0.1)',
                  border: '1px solid rgba(79, 172, 254, 0.3)',
                  color: '#4facfe',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}
              >
                ←
              </button>
              <div>
                <select 
                  value={selectedYear} 
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  style={{
                    background: 'rgba(30, 30, 30, 0.8)',
                    border: '1px solid #444',
                    color: 'white',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    minWidth: '80px',
                    textAlign: 'center'
                  }}
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              <button 
                onClick={() => setSelectedYear(selectedYear + 1)}
                disabled={selectedYear >= Math.max(...availableYears)}
                title="Next year"
                style={{
                  background: 'rgba(79, 172, 254, 0.1)',
                  border: '1px solid rgba(79, 172, 254, 0.3)',
                  color: '#4facfe',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}
              >
                →
              </button>
            </>
          )}
          <button 
            onClick={handleManualRefresh}
            title="Force refresh data"
            style={{
              background: 'rgba(79, 172, 254, 0.1)',
              border: '1px solid rgba(79, 172, 254, 0.3)',
              color: '#4facfe',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600'
            }}
          >
            🔄
          </button>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px', alignItems: 'center', justifyContent: 'center' }}>
        {/* Month labels */}
        <div style={{ position: 'relative', height: '20px', marginBottom: '8px', width: '100%', maxWidth: '900px' }}>
          {monthLabels.map((label, index) => (
            <span 
              key={index}
              style={{
                position: 'absolute',
                left: `${label.weekIndex * 14 + 40}px`,
                fontSize: '0.7rem',
                color: '#666',
                fontWeight: '500',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
                userSelect: 'none'
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
        
        {/* Main grid with day labels and weeks */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', justifyContent: 'center', maxWidth: '900px', width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '40px', paddingTop: '2px', flexShrink: 0 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <span key={day} style={{ fontSize: '0.7rem', color: '#666', fontWeight: '500', textAlign: 'right', height: '12px', lineHeight: '12px' }}>{day}</span>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: '2px', flex: 1, justifyContent: 'flex-start', paddingBottom: '2px' }}>
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '12px' }}>
                {week.map((day, dayIndex) => {
                  if (!day) {
                    return (
                      <div
                        key={`${weekIndex}-${dayIndex}`}
                        style={{
                          width: '12px',
                          height: '12px',
                          background: 'transparent'
                        }}
                      />
                    );
                  }
                  
                  const isToday = day.date === today;
                  
                  return (
                    <div
                      key={`${weekIndex}-${dayIndex}-${refreshKey}`}
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '6px',
                        fontWeight: 'bold',
                        backgroundColor: getBackgroundColor(day.level),
                        border: isToday ? '2px solid #4facfe' : `1px solid ${getBackgroundColor(day.level)}`,
                        color: day.level === 4 ? '#000' : '#fff',
                        transition: 'all 0.2s ease',
                        boxShadow: isToday ? '0 0 8px rgba(79, 172, 254, 0.6)' : 'none'
                      }}
                      title={day.count === 0 ? 
                        `No reviews on ${formatDate(day.date)}${isToday ? ' (TODAY)' : ''}` : 
                        `${day.count} review${day.count !== 1 ? 's' : ''} on ${formatDate(day.date)}${isToday ? ' (TODAY)' : ''} (Level: ${day.level})`
                      }
                      onMouseEnter={(e) => {
                        if (day.level > 0) {
                          e.target.style.transform = 'scale(1.2)';
                          e.target.style.border = '2px solid #4facfe';
                          e.target.style.zIndex = '10';
                          e.target.style.boxShadow = '0 2px 8px rgba(79, 172, 254, 0.3)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'scale(1)';
                        e.target.style.border = isToday ? '2px solid #4facfe' : `1px solid ${getBackgroundColor(day.level)}`;
                        e.target.style.zIndex = '1';
                        e.target.style.boxShadow = isToday ? '0 0 8px rgba(79, 172, 254, 0.6)' : 'none';
                      }}
                    >
                      {day.count > 0 && day.count < 100 && (
                        <span style={{ 
                          fontSize: '5px', 
                          fontWeight: '700', 
                          opacity: '0.8',
                          position: 'relative',
                          zIndex: 1,
                          color: day.level === 4 ? '#000' : '#fff'
                        }}>
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
      
      {/* Statistics */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: '16px', padding: '16px', background: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#4facfe', marginBottom: '4px', textShadow: '0 0 10px rgba(79, 172, 254, 0.3)' }}>{stats.longestStreak}</div>
          <div style={{ fontSize: '0.75rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>Longest Streak</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#4facfe', marginBottom: '4px', textShadow: '0 0 10px rgba(79, 172, 254, 0.3)' }}>{stats.currentStreak}</div>
          <div style={{ fontSize: '0.75rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
            {selectedYear === new Date().getFullYear() ? 'Current Streak' : 'Final Streak'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#4facfe', marginBottom: '4px', textShadow: '0 0 10px rgba(79, 172, 254, 0.3)' }}>
            {Math.round((stats.totalReviews / 365) * 10) / 10}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>Daily Average</div>
        </div>
      </div>
      
      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: '0.8', marginBottom: '16px' }}>
        <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: '500' }}>Less</span>
        <div style={{ display: 'flex', gap: '2px' }}>
          {[0, 1, 2, 3, 4].map(level => (
            <div 
              key={level} 
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                backgroundColor: getBackgroundColor(level),
                border: `1px solid ${level > 0 ? getBackgroundColor(level) : '#3a3a3a'}`
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: '500' }}>More</span>
      </div>

      {/* DEBUG INFO */}
      <div style={{ 
        fontSize: '0.7rem', 
        color: '#666', 
        textAlign: 'center', 
        padding: '8px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '6px',
        marginTop: '12px'
      }}>
        Today: {today} | Refresh: #{refreshKey} | Total: {stats.totalReviews}
      </div>
    </div>
  );
};

export default FlashcardHeatmap;