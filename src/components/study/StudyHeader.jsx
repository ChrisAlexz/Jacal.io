// src/components/study/StudyHeader.jsx - SIMPLE VERSION - Only button replacement
import React from 'react';
import { useNavigate } from 'react-router-dom';

const StudyHeader = ({ 
  setTitle, 
  currentIndex, 
  sessionCards, 
  allCards,
  id 
}) => {
  const navigate = useNavigate();

  const masteredCount = allCards.filter(card => card._mastered === true).length;

  // Check if spaced learning is active and get info
  const isSpacedLearning = window.spacedLearningEnabled;
  const batchInfo = window.spacedLearningRef?.current?.getCurrentBatchInfo?.() || {};

  return (
    <>
      <div className="study-header">
        <div className="study-info">
          <h1>{setTitle}</h1>
          <div className="progress-info">
            <span>{currentIndex + 1} / {sessionCards.length} cards remaining</span>
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
        {isSpacedLearning && batchInfo.totalBatches > 1 ? (
          <button 
            className="speed-focus-btn"
            style={{ 
              background: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)',
              cursor: 'default'
            }}
            title="Spaced Learning Mode - Complete batches of 20 cards"
          >
            📚 Session {batchInfo.currentBatchIndex + 1} of {batchInfo.totalBatches} ({batchInfo.sessionProgress?.cardsCompleted || 0}/{batchInfo.sessionProgress?.totalCards || 0})
          </button>
        ) : (
          <button 
            className="speed-focus-btn"
            onClick={() => navigate(`/speed/${id}`)}
            title="Speed Focus Mode - Test your knowledge under time pressure!"
          >
            ⚡ Speed Focus Mode
          </button>
        )}
      </div>
    </>
  );
};

export default StudyHeader;