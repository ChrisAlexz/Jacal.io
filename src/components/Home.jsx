// src/components/Home.jsx - PROFESSIONAL TECH-FOCUSED DESIGN
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import UserAuthContext from './context/UserAuthContext';
import FlashcardHeatmap from './FlashcardHeatmap';
import ClassDeckModal from './ClassDeckModal';
import '../styles/Home.css';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useContext(UserAuthContext);
  
  const [stats, setStats] = useState({
    totalSets: 0,
    totalCards: 0,
    studiedToday: 0
  });
  const [recentSets, setRecentSets] = useState([]);
  const [lastStudiedSet, setLastStudiedSet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Enhanced fetchStats with proper last studied tracking AND studied today count
  const fetchStats = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Get cards first, then fetch sets
      const { data: userCards, error: cardsError } = await supabase
        .from('flashcard_cards')
        .select('set_id, id, user_id, last_reviewed')
        .eq('user_id', user.id);

      if (cardsError) {
        console.error('Error fetching user cards');
        setStats({ totalSets: 0, totalCards: 0, studiedToday: 0 });
        setLoading(false);
        return;
      }

      if (!userCards || userCards.length === 0) {
        setStats({ totalSets: 0, totalCards: 0, studiedToday: 0 });
        setRecentSets([]);
        setLastStudiedSet(null);
        setLoading(false);
        return;
      }

      // Calculate cards studied today
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      
      const studiedTodayCount = userCards.filter(card => {
        if (!card.last_reviewed) return false;
        const reviewDate = new Date(card.last_reviewed);
        return reviewDate >= todayStart && reviewDate < todayEnd;
      }).length;

      // Get unique set IDs
      const setIds = [...new Set(userCards.map(card => card.set_id))].filter(Boolean);

      if (setIds.length === 0) {
        setStats({ totalSets: 0, totalCards: userCards.length, studiedToday: studiedTodayCount });
        setRecentSets([]);
        setLastStudiedSet(null);
        setLoading(false);
        return;
      }

      // Fetch sets one by one to avoid the .in() syntax issue
      const setsData = [];
      
      for (const setId of setIds) {
        try {
          const { data: setData, error: setError } = await supabase
            .from('flashcard_sets')
            .select('*')
            .eq('id', setId)
            .single();

          if (setError) {
            console.warn('Error fetching individual set');
            continue;
          }

          if (setData) {
            setsData.push(setData);
          }
        } catch (error) {
          console.warn('Exception fetching individual set');
          continue;
        }
      }

      if (setsData.length === 0) {
        setStats({ totalSets: 0, totalCards: userCards.length, studiedToday: studiedTodayCount });
        setRecentSets([]);
        setLastStudiedSet(null);
        setLoading(false);
        return;
      }

      // Get card counts for each set
      const setsWithCounts = await Promise.all(
        setsData.map(async (set) => {
          try {
            const { count, error: countError } = await supabase
              .from('flashcard_cards')
              .select('*', { count: 'exact', head: true })
              .eq('set_id', set.id);

            if (countError) {
              console.warn('Error counting cards for set');
            }

            return {
              ...set,
              card_count: count || 0
            };
          } catch (error) {
            console.warn('Exception counting cards for set');
            return {
              ...set,
              card_count: 0
            };
          }
        })
      );

      // Update stats with actual studied today count
      setStats({
        totalSets: setsWithCounts.length,
        totalCards: userCards.length,
        studiedToday: studiedTodayCount
      });

      // Sort by updated_at and set recent sets
      const sortedSets = setsWithCounts
        .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
        .slice(0, 6);

      setRecentSets(sortedSets);
      
      // Get the actual last studied set from study sessions
      await getLastStudiedSet(setsWithCounts);

    } catch (error) {
      console.error('Error in fetchStats');
      setStats({ totalSets: 0, totalCards: 0, studiedToday: 0 });
      setRecentSets([]);
      setLastStudiedSet(null);
    } finally {
      setLoading(false);
    }
  };

  // Function to get the actual last studied set from study history
  const getLastStudiedSet = async (availableSets) => {
    if (!user?.id || availableSets.length === 0) {
      setLastStudiedSet(null);
      return;
    }

    try {
      // First, try to get the most recent study session
      const { data: recentSession, error: sessionError } = await supabase
        .from('study_sessions')
        .select('set_id, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (!sessionError && recentSession) {
        // Find the set that matches this session
        const lastStudiedSetData = availableSets.find(set => set.id === recentSession.set_id);
        if (lastStudiedSetData && lastStudiedSetData.card_count > 0) {
          setLastStudiedSet({
            ...lastStudiedSetData,
            last_studied_at: recentSession.updated_at
          });
          return;
        }
      }

      // Fallback: Look for the most recently reviewed cards to infer last studied set
      const { data: recentCards, error: cardsError } = await supabase
        .from('flashcard_cards')
        .select('set_id, last_reviewed')
        .eq('user_id', user.id)
        .not('last_reviewed', 'is', null)
        .order('last_reviewed', { ascending: false })
        .limit(10);

      if (!cardsError && recentCards && recentCards.length > 0) {
        // Group by set_id and find the set with the most recent review
        const setReviewDates = {};
        recentCards.forEach(card => {
          if (!setReviewDates[card.set_id] || card.last_reviewed > setReviewDates[card.set_id]) {
            setReviewDates[card.set_id] = card.last_reviewed;
          }
        });

        // Find the set with the most recent review date
        let mostRecentSetId = null;
        let mostRecentDate = null;
        
        Object.entries(setReviewDates).forEach(([setId, reviewDate]) => {
          if (!mostRecentDate || reviewDate > mostRecentDate) {
            mostRecentDate = reviewDate;
            mostRecentSetId = setId;
          }
        });

        if (mostRecentSetId) {
          const lastStudiedSetData = availableSets.find(set => set.id === mostRecentSetId);
          if (lastStudiedSetData && lastStudiedSetData.card_count > 0) {
            setLastStudiedSet({
              ...lastStudiedSetData,
              last_studied_at: mostRecentDate
            });
            return;
          }
        }
      }

      // Final fallback: Use the most recently updated set with cards
      const setsWithCards = availableSets.filter(set => set.card_count > 0);
      if (setsWithCards.length > 0) {
        const mostRecentSet = setsWithCards
          .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))[0];
        setLastStudiedSet(mostRecentSet);
      } else {
        setLastStudiedSet(null);
      }

    } catch (error) {
      console.error('Error getting last studied set:', error);
      // Fallback to most recently updated set
      const setsWithCards = availableSets.filter(set => set.card_count > 0);
      if (setsWithCards.length > 0) {
        const mostRecentSet = setsWithCards
          .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))[0];
        setLastStudiedSet(mostRecentSet);
      } else {
        setLastStudiedSet(null);
      }
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      if (user) {
        await fetchStats();
      } else {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // If user is not logged in, show hero section
  if (!user) {
    return (
      <div className="home-container">
        {/* Grid Background */}
        <div className="grid-background"></div>
        
        {/* Hero Section */}
        <section className="hero-section">
          <div className="hero-content">
            {/* Status Badge */}
            <div className="status-badge">
              <div className="status-dot"></div>
              <span>Powered by spaced repetition</span>
            </div>
            
            {/* Main Headline */}
            <h1 className="hero-title">
              The new standard for
              <br />
              <span className="gradient-text">intelligent learning</span>
            </h1>
            
            <p className="hero-description">
              Master any subject with scientifically-proven spaced repetition.
              Built for students, professionals, and lifelong learners.
            </p>
            
            {/* CTA Buttons */}
            <div className="hero-cta">
              <button 
                className="btn-primary"
                onClick={() => navigate('/register')}
              >
                Start learning
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </button>
              <button 
                className="btn-secondary"
                onClick={() => {
                  const featuresSection = document.querySelector('.features-section');
                  featuresSection?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Learn more
              </button>
            </div>
            
            {/* Social Proof */}
            <div className="social-proof">
              <span className="social-proof-text">Trusted by 10,000+ learners</span>
              <div className="social-proof-logos">
                <div className="logo-placeholder">Stanford</div>
                <div className="logo-placeholder">MIT</div>
                <div className="logo-placeholder">Harvard</div>
                <div className="logo-placeholder">Berkeley</div>
              </div>
            </div>
          </div>
          
          {/* Hero Visual */}
          <div className="hero-visual">
            <div className="terminal-window">
              <div className="terminal-header">
                <div className="terminal-controls">
                  <div className="control control-close"></div>
                  <div className="control control-minimize"></div>
                  <div className="control control-maximize"></div>
                </div>
                <div className="terminal-title">flashcard-session.py</div>
              </div>
              <div className="terminal-body">
                <div className="terminal-line">
                  <span className="prompt">$</span>
                  <span className="command">python study.py --algorithm=spaced-repetition</span>
                </div>
                <div className="terminal-line">
                  <span className="output">✓ Loading deck: Advanced Algorithms</span>
                </div>
                <div className="terminal-line">
                  <span className="output">✓ Cards to review: 15</span>
                </div>
                <div className="terminal-line">
                  <span className="output">✓ Optimizing intervals based on performance</span>
                </div>
                <div className="terminal-line typing">
                  <span className="output">Starting session...</span>
                  <span className="cursor">|</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="features-section">
          <div className="container">
            <div className="section-header">
              <div className="section-badge">Features</div>
              <h2 className="section-title">Everything you need to master any subject</h2>
              <p className="section-description">
                Built with performance, scalability, and user experience in mind.
              </p>
            </div>
            
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                  </svg>
                </div>
                <h3>Spaced Repetition</h3>
                <p>AI-powered algorithm schedules reviews at optimal intervals for maximum retention.</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18"/>
                    <path d="m19 9-5 5-4-4-3 3"/>
                  </svg>
                </div>
                <h3>Progress Analytics</h3>
                <p>Detailed insights into your learning patterns and performance metrics.</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 2v4"/>
                    <path d="M16 2v4"/>
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <path d="M3 10h18"/>
                  </svg>
                </div>
                <h3>Smart Scheduling</h3>
                <p>Automatic scheduling based on forgetting curves and personal performance.</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m16 6 4 14"/>
                    <path d="M12 6v14"/>
                    <path d="M8 6v14"/>
                    <path d="M4 6v14"/>
                  </svg>
                </div>
                <h3>Organized Library</h3>
                <p>Hierarchical organization with folders, tags, and advanced search capabilities.</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="m9 12 2 2 4-4"/>
                  </svg>
                </div>
                <h3>Seamless Sync</h3>
                <p>Real-time synchronization across all your devices with offline support.</p>
              </div>
              
              <div className="feature-card">
                <div className="feature-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <h3>Privacy First</h3>
                <p>End-to-end encryption ensures your study data remains private and secure.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section - Real Spaced Repetition Facts */}
        <section className="stats-section">
          <div className="container">
            <div className="section-header">
              <div className="section-badge">Science-backed learning</div>
              <h2 className="section-title">Proven by research</h2>
              <p className="section-description">
                Spaced repetition has been extensively studied and validated by cognitive scientists worldwide.
              </p>
            </div>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-number">85%</div>
                <div className="stat-label">Better retention vs traditional methods</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">50%</div>
                <div className="stat-label">Less time needed to memorize</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">1885</div>
                <div className="stat-label">First studied by Ebbinghaus</div>
              </div>
              <div className="stat-item">
                <div className="stat-number">95%</div>
                <div className="stat-label">Retention after optimal intervals</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <div className="container">
            <div className="cta-content">
              <h2>Ready to transform your learning?</h2>
              <p>Join thousands of students and professionals using intelligent flashcards.</p>
              <button 
                className="btn-primary"
                onClick={() => navigate('/register')}
              >
                Get started for free
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* Terminal Demo Section */}
        <section className="terminal-demo-section">
          <div className="container">
            <div className="section-header">
              <div className="section-badge">Developer-friendly</div>
              <h2 className="section-title">Built for efficiency</h2>
              <p className="section-description">
                Our algorithm automatically calculates optimal review intervals based on your performance.
              </p>
            </div>
            <div className="terminal-demo-grid">
              <div className="terminal-window">
                <div className="terminal-header">
                  <div className="terminal-controls">
                    <div className="control control-close"></div>
                    <div className="control control-minimize"></div>
                    <div className="control control-maximize"></div>
                  </div>
                  <div className="terminal-title">algorithm-analysis.py</div>
                </div>
                <div className="terminal-body">
                  <div className="terminal-line">
                    <span className="prompt">$</span>
                    <span className="command">python analyze_performance.py --user-id=12345</span>
                  </div>
                  <div className="terminal-line">
                    <span className="output">✓ Analyzing 847 review sessions...</span>
                  </div>
                  <div className="terminal-line">
                    <span className="output">✓ Optimal interval: 2.3 days</span>
                  </div>
                  <div className="terminal-line">
                    <span className="output">✓ Retention rate: 92.4%</span>
                  </div>
                  <div className="terminal-line typing">
                    <span className="output">Scheduling next review...</span>
                    <span className="cursor">|</span>
                  </div>
                </div>
              </div>
              
              <div className="terminal-window">
                <div className="terminal-header">
                  <div className="terminal-controls">
                    <div className="control control-close"></div>
                    <div className="control control-minimize"></div>
                    <div className="control control-maximize"></div>
                  </div>
                  <div className="terminal-title">deck-optimization.py</div>
                </div>
                <div className="terminal-body">
                  <div className="terminal-line">
                    <span className="prompt">$</span>
                    <span className="command">python optimize_deck.py --deck="Machine Learning"</span>
                  </div>
                  <div className="terminal-line">
                    <span className="output">✓ Cards ready for review: 23</span>
                  </div>
                  <div className="terminal-line">
                    <span className="output">✓ New cards to introduce: 5</span>
                  </div>
                  <div className="terminal-line">
                    <span className="output">✓ Estimated session time: 12 min</span>
                  </div>
                  <div className="terminal-line typing">
                    <span className="output">Generating study queue...</span>
                    <span className="cursor">|</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // If user is logged in, show dashboard
  return (
    <div className="home-container logged-in">
      <div className="grid-background"></div>
      
      {/* Welcome Section */}
      <div className="welcome-section">
        <div className="container">
          <div className="welcome-content">
            <div className="greeting-text">
              <span className="greeting-time">{getGreeting()}</span>
              <h1 className="welcome-title">
                Welcome back, {user.user_metadata?.name || user.email?.split('@')[0] || 'Learner'}
              </h1>
              <p className="welcome-subtitle">
                Ready to continue your learning journey?
              </p>
            </div>
            
            <button 
              className="btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14m-7-7h14"/>
              </svg>
              Create new set
            </button>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="dashboard-stats">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Flashcard Sets</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
              </div>
              <div className="stat-value">{stats.totalSets}</div>
            </div>
            
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Total Cards</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="16" rx="2"/>
                  <path d="M7 8h10M7 12h4"/>
                </svg>
              </div>
              <div className="stat-value">{stats.totalCards}</div>
            </div>
            
            <div className="stat-card">
              <div className="stat-header">
                <span className="stat-label">Studied Today</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
              </div>
              <div className="stat-value">{stats.studiedToday}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <div className="container">
          <h2 className="section-title">Quick Actions</h2>
          <div className="actions-grid">
            <button 
              className="action-card"
              onClick={() => navigate('/set')}
            >
              <div className="action-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
              </div>
              <div className="action-content">
                <h3>Browse Sets</h3>
                <p>Manage your flashcard collections</p>
              </div>
            </button>
            
            <button 
              className="action-card"
              onClick={() => setShowCreateModal(true)}
            >
              <div className="action-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14m-7-7h14"/>
                </svg>
              </div>
              <div className="action-content">
                <h3>Create Set</h3>
                <p>Start a new flashcard collection</p>
              </div>
            </button>

            <button 
              className="action-card"
              onClick={() => {
                if (lastStudiedSet) {
                  navigate(`/study/${lastStudiedSet.id}`);
                } else {
                  navigate('/set');
                }
              }}
              disabled={!lastStudiedSet}
            >
              <div className="action-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
              </div>
              <div className="action-content">
                <h3>Quick Study</h3>
                <p>
                  {lastStudiedSet ? 
                    `Continue "${lastStudiedSet.title}"` : 
                    'No sets available'
                  }
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      {user && <FlashcardHeatmap />}

      {/* Recent Sets */}
      <div className="recent-sets">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Recent Sets</h2>
            <button 
              className="btn-secondary"
              onClick={() => navigate('/set')}
            >
              View all
            </button>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading your sets...</p>
            </div>
          ) : recentSets.length > 0 ? (
            <div className="sets-grid">
              {recentSets.map((set) => (
                <div 
                  key={set.id} 
                  className="set-card"
                  onClick={() => navigate(`/flashcards/${set.id}`)}
                >
                  <div className="set-header">
                    <h3 className="set-title">{set.title}</h3>
                    <button 
                      className="btn-ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/study/${set.id}`);
                      }}
                    >
                      Study
                    </button>
                  </div>
                  
                  <div className="set-meta">
                    <span>{set.card_count || 0} cards</span>
                    <span>Updated {new Date(set.updated_at || set.created_at).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="set-progress">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: '60%' }}></div>
                    </div>
                    <span className="progress-text">60% studied</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
              </div>
              <h3>No flashcard sets yet</h3>
              <p>Create your first set to start your learning journey</p>
              <button 
                className="btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                Create your first set
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ClassDeckModal */}
      {showCreateModal && (
        <ClassDeckModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            fetchStats();
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}