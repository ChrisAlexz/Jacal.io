// src/components/study/StudyHeader.jsx - Props-driven study header
import React from 'react';

const StudyHeader = ({
  setTitle,
  currentIndex,
  sessionCards,
  allCards,
  masteredCount,
  studySessionId,
  spacedLearningEnabled,
  currentBatchIndex,
  spacedLearningBatches,
  onResetSession
}) => {
  return (
    <>
      <div className="study-header">
        <div className="study-info">
          <h1>{setTitle}</h1>
          <div className="progress-info">
            <span>{currentIndex + 1} / {sessionCards.length} cards remaining</span>
            {studySessionId && (
              <span style={{ fontSize: '0.8rem', color: '#4facfe', marginLeft: '10px', opacity: 0.8 }}>
                Progress saved
              </span>
            )}
          </div>
        </div>

        <div className="study-stats-header">
          <div className="stat-item total-cards">
            <span className="count">{allCards.length}</span>
            <span className="label">Total Cards</span>
          </div>
          <div className="stat-item remaining">
            <span className="count">{sessionCards.length}</span>
            <span className="label">Remaining</span>
          </div>
          <div className="stat-item mastered">
            <span className="count">{masteredCount}</span>
            <span className="label">Mastered</span>
          </div>
        </div>
      </div>

      <div className="study-mode-selector">
        {spacedLearningEnabled ? (
          <div className="study-mode-with-reset">
            <button
              className="speed-focus-btn"
              style={{ background: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)', cursor: 'default' }}
              title="Spaced Learning Mode - Complete batches of 20 cards"
            >
              Session {currentBatchIndex + 1} of {spacedLearningBatches.length} (20 cards per session)
            </button>
            <button className="reset-session-mode-btn" onClick={onResetSession} title="Reset all progress and start fresh">
              Reset Session
            </button>
          </div>
        ) : (
          <div className="study-mode-with-reset">
            <button className="reset-session-mode-btn" onClick={onResetSession} title="Reset all progress and start fresh">
              Reset Session
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default StudyHeader;
