// src/components/Home.jsx - FIXED: Proper Supabase query syntax + ClassDeckModal
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

  // FIXED: Improved fetchStats with better error handling and logging
  const fetchStats = async () => {
    if (!user?.id) {
      console.log('❌ No user ID available for stats');
      setLoading(false);
      return;
    }

    try {
      console.log('📊 Fetching stats for user:', user.id);

      // FIXED: Use the correct approach - get cards first, then fetch sets
      const { data: userCards, error: cardsError } = await supabase
        .from('flashcard_cards')
        .select('set_id, id, user_id')
        .eq('user_id', user.id);

      if (cardsError) {
        console.error('❌ Error fetching user cards:', cardsError);
        setStats({ totalSets: 0, totalCards: 0, studiedToday: 0 });
        setLoading(false);
        return;
      }

      console.log('✅ Found', userCards?.length || 0, 'cards for user');

      if (!userCards || userCards.length === 0) {
        console.log('ℹ️ No cards found for user');
        setStats({ totalSets: 0, totalCards: 0, studiedToday: 0 });
        setRecentSets([]);
        setLastStudiedSet(null);
        setLoading(false);
        return;
      }

      // Get unique set IDs
      const setIds = [...new Set(userCards.map(card => card.set_id))].filter(Boolean);
      console.log('📦 Found', setIds.length, 'unique set IDs:', setIds);

      if (setIds.length === 0) {
        console.log('ℹ️ No valid set IDs found');
        setStats({ totalSets: 0, totalCards: userCards.length, studiedToday: 0 });
        setRecentSets([]);
        setLastStudiedSet(null);
        setLoading(false);
        return;
      }

      // FIXED: Use multiple individual queries instead of .in() to avoid 400 error
      const setsData = [];
      
      // Fetch sets one by one to avoid the .in() syntax issue
      for (const setId of setIds) {
        try {
          const { data: setData, error: setError } = await supabase
            .from('flashcard_sets')
            .select('*')
            .eq('id', setId)
            .single();

          if (setError) {
            console.warn('⚠️ Error fetching set', setId, ':', setError.message);
            continue; // Skip this set and continue with others
          }

          if (setData) {
            setsData.push(setData);
          }
        } catch (error) {
          console.warn('⚠️ Exception fetching set', setId, ':', error.message);
          continue; // Skip this set and continue with others
        }
      }

      console.log('✅ Successfully fetched', setsData.length, 'sets');

      if (setsData.length === 0) {
        console.log('ℹ️ No sets data retrieved');
        setStats({ totalSets: 0, totalCards: userCards.length, studiedToday: 0 });
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
              console.warn('⚠️ Error counting cards for set', set.id, ':', countError.message);
            }

            return {
              ...set,
              card_count: count || 0
            };
          } catch (error) {
            console.warn('⚠️ Exception counting cards for set', set.id, ':', error.message);
            return {
              ...set,
              card_count: 0
            };
          }
        })
      );

      // Update stats
      setStats({
        totalSets: setsWithCounts.length,
        totalCards: userCards.length,
        studiedToday: 0 // TODO: Calculate actual studied today count if needed
      });

      // Sort by updated_at and set recent sets
      const sortedSets = setsWithCounts
        .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
        .slice(0, 6);

      setRecentSets(sortedSets);
      
      // Set last studied (most recently updated set with cards)
      const setsWithCards = setsWithCounts.filter(set => set.card_count > 0);
      if (setsWithCards.length > 0) {
        const mostRecentSet = setsWithCards
          .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))[0];
        setLastStudiedSet(mostRecentSet);
      }

      console.log('✅ Stats updated successfully:', {
        totalSets: setsWithCounts.length,
        totalCards: userCards.length,
        recentSetsCount: sortedSets.length
      });

    } catch (error) {
      console.error('💥 Unexpected error in fetchStats:', error);
      setStats({ totalSets: 0, totalCards: 0, studiedToday: 0 });
      setRecentSets([]);
      setLastStudiedSet(null);
    } finally {
      setLoading(false);
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
                <span className="feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span>Smart Spaced Repetition</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 3V21H21V9L15 3H3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 9H15M9 13H15M9 17H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span>Progress Tracking</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
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
            onClick={() => setShowCreateModal(true)}
          >
            <span className="cta-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            Create New Set
          </button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="stats-section">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon sets-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 3H8C9.1 3 10 3.9 10 5V19C10 20.1 9.1 21 8 21H2V3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M22 3H16C14.9 3 14 3.9 14 5V19C14 20.1 14.9 21 16 21H22V3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-number">{stats.totalSets}</div>
              <div className="stat-label">Flashcard Sets</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon cards-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M7 8H17M7 12H17M7 16H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-number">{stats.totalCards}</div>
              <div className="stat-label">Total Cards</div>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon study-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
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
            onClick={() => navigate('/set')}
          >
            <div className="action-icon browse-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="action-content">
              <h3>View My Sets</h3>
              <p>Browse and manage your flashcard collections</p>
            </div>
          </button>
          
          <button 
            className="action-card"
            onClick={() => setShowCreateModal(true)}
          >
            <div className="action-icon create-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="action-content">
              <h3>Create New Set</h3>
              <p>Start building a new flashcard collection</p>
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
            <div className="action-icon study-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
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

      {/* Heatmap */}
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
                  <span className="set-card-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
                      <path d="M7 8H17M7 12H17M7 16H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </span>
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
                    <span>Updated {new Date(set.updated_at || set.created_at).toLocaleDateString()}</span>
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
              <div className="empty-icon">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 3H8C9.1 3 10 3.9 10 5V19C10 20.1 9.1 21 8 21H2V3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M22 3H16C14.9 3 14 3.9 14 5V19C14 20.1 14.9 21 16 21H22V3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
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

      {/* ClassDeckModal */}
      {showCreateModal && (
        <ClassDeckModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            fetchStats(); // Refresh the stats to show the new set
            setShowCreateModal(false);
          }}
        />
      )}
    </div>
  );
}