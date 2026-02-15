// src/components/Dashboard.jsx - Authenticated user dashboard
import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import UserAuthContext from './context/UserAuthContext';
import FlashcardHeatmap from './FlashcardHeatmap';
import ClassDeckModal from './ClassDeckModal';
import { useHomeStats } from '../hooks/useHomeStats';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useContext(UserAuthContext);
  const { stats, recentSets, lastStudiedSet, loading, fetchStats } = useHomeStats(user);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <div className="home-container logged-in">
      {/* Welcome Section */}
      <div className="welcome-section">
        <div className="welcome-content">
          <div className="greeting-text">
            <span className="greeting-time">{getGreeting()}</span>
            <h1 className="welcome-title">
              Welcome back, {user.user_metadata?.name || user.email?.split('@')[0] || 'Learner'}
            </h1>
            <p className="welcome-subtitle">Ready to continue your learning journey?</p>
          </div>

          <button className="primary-cta" onClick={() => setShowCreateModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14m-7-7h14"/>
            </svg>
            Create new set
          </button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="stats-section">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon sets-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-number">{stats.totalSets}</div>
              <div className="stat-label">Flashcard Sets</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon cards-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="2"/>
                <path d="M7 8h10M7 12h4"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-number">{stats.totalCards}</div>
              <div className="stat-label">Total Cards</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon study-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
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
          <button className="action-card" onClick={() => navigate('/set')}>
            <div className="action-icon browse-icon">
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

          <button className="action-card" onClick={() => setShowCreateModal(true)}>
            <div className="action-icon create-icon">
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
              if (lastStudiedSet) navigate(`/study/${lastStudiedSet.id}`);
              else navigate('/set');
            }}
            disabled={!lastStudiedSet}
          >
            <div className="action-icon study-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <div className="action-content">
              <h3>Quick Study</h3>
              <p>{lastStudiedSet ? `Continue "${lastStudiedSet.title}"` : 'No sets available'}</p>
            </div>
          </button>
        </div>
      </div>

      {/* Heatmap */}
      <FlashcardHeatmap />

      {/* Recent Sets */}
      <div className="recent-section">
        <div className="section-header">
          <h2 className="section-title">Recent Sets</h2>
          <button className="view-all-btn" onClick={() => navigate('/set')}>View all</button>
        </div>

        {loading ? (
          <div className="loading-sets">
            <div className="loading-spinner"></div>
            <p>Loading your sets...</p>
          </div>
        ) : recentSets.length > 0 ? (
          <div className="sets-grid">
            {recentSets.map((set) => (
              <div key={set.id} className="set-card" onClick={() => navigate(`/flashcards/${set.id}`)}>
                <div className="set-card-header">
                  <span className="set-card-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="16" rx="2"/>
                      <path d="M7 8h10M7 12h10M7 16h6"/>
                    </svg>
                  </span>
                  <button
                    className="menu-btn"
                    onClick={(e) => { e.stopPropagation(); navigate(`/study/${set.id}`); }}
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
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
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
              <button className="empty-action-btn" onClick={() => setShowCreateModal(true)}>
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
          onSuccess={() => { fetchStats(); setShowCreateModal(false); }}
        />
      )}
    </div>
  );
}
