// src/components/Home.jsx - Updated with Heatmap
import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import '../styles/Home.css';
import '../styles/FlashcardHeatmap.css';
import UserAuthContext from './context/UserAuthContext';
import ClassDeckModal from './ClassDeckModal';
import FlashcardHeatmap from './FlashcardHeatmap';
import { MdFlashOn, MdFolderOpen, MdTrendingUp, MdViewList } from 'react-icons/md';

export default function Home() {
  const navigate = useNavigate();
  const [recentSets, setRecentSets] = useState([]);
  const { user } = useContext(UserAuthContext);
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState({
    totalSets: 0,
    totalCards: 0,
    studiedToday: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      // Fetch recent sets
      const { data: setsData, error: setsError } = await supabase
        .from('flashcard_sets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(6);

      if (!setsError && setsData) {
        // Get card counts for each set
        const setsWithCounts = await Promise.all(
          setsData.map(async (set) => {
            const { count } = await supabase
              .from('flashcard_cards')
              .select('*', { count: 'exact', head: true })
              .eq('set_id', set.id);
            
            return {
              ...set,
              card_count: count || 0
            };
          })
        );

        setRecentSets(setsWithCounts);

        // Calculate stats
        const totalSets = setsWithCounts.length;
        const totalCards = setsWithCounts.reduce((sum, set) => sum + (set.card_count || 0), 0);
        
        // Get today's review count from review_sessions if available
        const today = new Date().toISOString().split('T')[0];
        const { data: todayReviews } = await supabase
          .from('review_sessions')
          .select('reviews_count')
          .eq('user_id', user.id)
          .gte('reviewed_at', today + 'T00:00:00.000Z')
          .lte('reviewed_at', today + 'T23:59:59.999Z');
        
        const studiedToday = todayReviews 
          ? todayReviews.reduce((sum, session) => sum + (session.reviews_count || 1), 0)
          : Math.floor(totalCards * 0.1); // Fallback estimate
        
        setStats({
          totalSets,
          totalCards,
          studiedToday
        });
      }
    };

    fetchData();
  }, [user]);

  const getWelcomeName = () => {
    if (!user) return "Welcome Back!";
    const name = user.user_metadata?.name || user.email?.split('@')[0] || 'there';
    return `Welcome back, ${name}!`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const handleModalClose = () => {
    setShowModal(false);
  };

  const handleSetCreated = (deckId) => {
    // Refresh data after creating new set
    window.location.reload();
  };

  if (!user) {
    return (
      <div className="home-container">
        <div className="hero-section">
          <div className="hero-content">
            <div className="hero-icon">🧠</div>
            <h1 className="hero-title">Master Any Subject</h1>
            <p className="hero-subtitle">
              Create, study, and master flashcards with our intelligent learning system. 
              Built for students, professionals, and lifelong learners.
            </p>
            <div className="hero-features">
              <div className="feature-item">
                <span className="feature-icon">⚡</span>
                <span>Smart Spaced Repetition</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🎨</span>
                <span>Rich Text Formatting</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📱</span>
                <span>Study Anywhere</span>
              </div>
            </div>
            <button 
              className="cta-button"
              onClick={() => navigate('/register')}
            >
              Get Started Free
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      {/* Hero Section */}
      <div className="welcome-section">
        <div className="welcome-content">
          <div className="greeting-text">
            <span className="greeting-time">{getGreeting()}</span>
            <h1 className="welcome-title">{getWelcomeName()}</h1>
            <p className="welcome-subtitle">Ready to continue your learning journey?</p>
          </div>
          <button 
            className="primary-cta"
            onClick={() => setShowModal(true)}
          >
            <span className="cta-icon">+</span>
            Create New Set
          </button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="stats-section">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon sets-icon">📚</div>
            <div className="stat-content">
              <div className="stat-number">{stats.totalSets}</div>
              <div className="stat-label">Total Sets</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon cards-icon"><MdViewList /></div>
            <div className="stat-content">
              <div className="stat-number">{stats.totalCards}</div>
              <div className="stat-label">Total Cards</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon study-icon"><MdTrendingUp /></div>
            <div className="stat-content">
              <div className="stat-number">{stats.studiedToday}</div>
              <div className="stat-label">Studied Today</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions-section">
        <h2 className="section-title">Quick Actions</h2>
        <div className="actions-grid">
          <button 
            className="action-card"
            onClick={() => setShowModal(true)}
          >
            <div className="action-icon create-icon">➕</div>
            <div className="action-content">
              <h3>Create Set</h3>
              <p>Start a new flashcard collection</p>
            </div>
          </button>
          <button 
            className="action-card"
            onClick={() => navigate('/set')}
          >
            <div className="action-icon browse-icon"><MdFolderOpen /></div>
            <div className="action-content">
              <h3>Browse Sets</h3>
              <p>View and manage all your sets</p>
            </div>
          </button>
          <button 
            className="action-card"
            onClick={() => recentSets.length > 0 && navigate(`/study/${recentSets[0].id}`)}
            disabled={recentSets.length === 0}
          >
            <div className="action-icon study-icon"><MdFlashOn /></div>
            <div className="action-content">
              <h3>Quick Study</h3>
              <p>Jump into your latest set</p>
            </div>
          </button>
        </div>
      </div>

      {/* Heatmap Section */}
      <div className="heatmap-section">
        <FlashcardHeatmap />
      </div>

      {/* Recent Sets */}
      <div className="recent-section">
        <div className="section-header">
          <h2 className="section-title">Recent Sets</h2>
          {recentSets.length > 3 && (
            <button 
              className="view-all-btn"
              onClick={() => navigate('/set')}
            >
              View All
            </button>
          )}
        </div>

        {recentSets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-illustration">
              <div className="empty-icon">📚</div>
              <div className="empty-books">
                <div className="book book-1"></div>
                <div className="book book-2"></div>
                <div className="book book-3"></div>
              </div>
            </div>
            <div className="empty-content">
              <h3>No flashcard sets yet</h3>
              <p>Create your first set to start learning and see it here</p>
              <button 
                className="empty-action-btn"
                onClick={() => setShowModal(true)}
              >
                Create Your First Set
              </button>
            </div>
          </div>
        ) : (
          <div className="sets-grid">
            {recentSets.map((set) => (
              <div 
                key={set.id}
                className="set-card"
                onClick={() => navigate(`/flashcards/${set.id}`)}
              >
                <div className="set-card-header">
                  <div className="set-card-icon">📝</div>
                  <div className="set-card-menu">
                    <button 
                      className="menu-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/study/${set.id}`);
                      }}
                    >
                      Study
                    </button>
                  </div>
                </div>
                <div className="set-card-content">
                  <h3 className="set-card-title">{set.title}</h3>
                  <div className="set-card-meta">
                    <span className="card-count">{set.card_count} cards</span>
                    <span className="created-date">{formatDate(set.created_at)}</span>
                  </div>
                </div>
                <div className="set-card-footer">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${Math.min(100, (set.card_count || 0) * 10)}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">Ready to study</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <ClassDeckModal 
          onClose={handleModalClose} 
          onSuccess={handleSetCreated}
        />
      )}
    </div>
  );
}