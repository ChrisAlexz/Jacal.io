// src/components/Home.jsx - Updated with Heatmap
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import UserAuthContext from './context/UserAuthContext';
import FlashcardHeatmap from './FlashcardHeatmap'; // ADD THIS IMPORT
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

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  // Fetch user statistics and sets - FIXED VERSION
  const fetchStats = async () => {
    if (!user?.id) return;

    try {
      // Get your cards first (we know these exist - 73 cards)
      const { data: yourCards, error: cardsError } = await supabase
        .from('flashcard_cards')
        .select('set_id, user_id')
        .eq('user_id', user.id);

      if (cardsError || !yourCards || yourCards.length === 0) {
        setStats({ totalSets: 0, totalCards: 0, studiedToday: 0 });
        return;
      }

      // Get unique set_ids from your cards
      const setIds = [...new Set(yourCards.map(card => card.set_id))];

      // Get sets by these set_ids (regardless of user_id on sets table)
      const { data: setsData, error: setsError } = await supabase
        .from('flashcard_sets')
        .select('*')
        .in('id', setIds)
        .order('updated_at', { ascending: false });

      if (setsError || !setsData) {
        setStats({ totalSets: 0, totalCards: yourCards.length, studiedToday: 0 });
        return;
      }

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

      // Update stats
      setStats({
        totalSets: setsData.length,
        totalCards: yourCards.length,
        studiedToday: 0
      });

      // Set recent sets (show all sets, user can see what they have)
      const recentSetsData = setsWithCounts
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        .slice(0, 6);

      setRecentSets(recentSetsData);
      
      // Set last studied (most recently updated set with cards)
      const setsWithCards = setsWithCounts.filter(set => set.card_count > 0);
      if (setsWithCards.length > 0) {
        setLastStudiedSet(setsWithCards[0]);
      }

    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats({ totalSets: 0, totalCards: 0, studiedToday: 0 });
    }
  };

  // Fetch recent sets and find last studied
  const fetchRecentSets = async () => {
    // This is now handled in fetchStats() to avoid duplicate calls
    return;
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchStats(); // This now handles both stats and recent sets
      setLoading(false);
    };

    if (user) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user]);

  // If user is not logged in, show hero section
  if (!user) {
    return (
      <div className="home-container">
        <div className="hero-section">
          <div className="hero-content">
            <div className="hero-icon">🧠</div>
            <h1 className="hero-title">Master Any Subject with Intelligent Flashcards</h1>
            <p className="hero-subtitle">
              Create, study, and master flashcards with spaced repetition. 
              Track your progress and build lasting knowledge.
            </p>
            
            <div className="hero-features">
              <div className="feature-item">
                <span className="feature-icon">⚡</span>
                <span>Smart Spaced Repetition</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📊</span>
                <span>Progress Tracking</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🎯</span>
                <span>Focused Learning</span>
              </div>
            </div>

            <button 
              className="cta-button" 
              onClick={() => navigate('/register')}
            >
              Start Learning Today
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If user is logged in, show dashboard
  return (
    <div className="home-container">
      {/* Welcome Section */}
      <div className="welcome-section">
        <div className="welcome-content">
          <div className="greeting-text">
            <span className="greeting-time">{getGreeting()}</span>
            <h1 className="welcome-title">
              Welcome back, {user.user_metadata?.name || user.email?.split('@')[0] || 'Learner'}!
            </h1>
            <p className="welcome-subtitle">
              Ready to continue your learning journey?
            </p>
          </div>
          
          <button 
            className="primary-cta"
            onClick={() => navigate('/set')}
          >
            <span className="cta-icon">📚</span>
            View My Sets
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
              <div className="stat-label">Flashcard Sets</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon cards-icon">🃏</div>
            <div className="stat-content">
              <div className="stat-number">{stats.totalCards}</div>
              <div className="stat-label">Total Cards</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon study-icon">⚡</div>
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
            onClick={() => navigate('/flashcards')}
          >
            <div className="action-icon create-icon">➕</div>
            <div className="action-content">
              <h3>Create New Set</h3>
              <p>Start building a new flashcard collection</p>
            </div>
          </button>
          
          <button 
            className="action-card"
            onClick={() => navigate('/set')}
          >
            <div className="action-icon browse-icon">👁️</div>
            <div className="action-content">
              <h3>Browse Sets</h3>
              <p>View and manage your flashcard sets</p>
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
            <div className="action-icon study-icon">⚡</div>
            <div className="action-content">
              <h3>Quick Study</h3>
              <p>
                {lastStudiedSet 
                  ? `Continue studying "${lastStudiedSet.title}"` 
                  : 'No sets available to study'
                }
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* HEATMAP - Moved to after Quick Actions */}
      {user && <FlashcardHeatmap />}

      {/* Recent Sets */}
      <div className="recent-section">
        <div className="section-header">
          <h2 className="section-title">Recent Sets</h2>
          <button 
            className="view-all-btn"
            onClick={() => navigate('/set')}
          >
            View All
          </button>
        </div>

        {loading ? (
          <div className="loading-sets">
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
                <div className="set-card-header">
                  <span className="set-card-icon">📝</span>
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
                
                <div className="set-card-content">
                  <h3 className="set-card-title">{set.title}</h3>
                  <div className="set-card-meta">
                    <span>{set.card_count || 0} cards</span>
                    <span>Updated {new Date(set.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <div className="set-card-footer">
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
              <p>Create your first set to start your learning journey</p>
              <button 
                className="empty-action-btn"
                onClick={() => navigate('/flashcards')}
              >
                Create Your First Set
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}