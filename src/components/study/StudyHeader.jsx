// src/components/study/StudyHeader.jsx - Study session header with stats
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
        <button 
          className="speed-focus-btn"
          onClick={() => navigate(`/speed/${id}`)}
          title="Speed Focus Mode - Test your knowledge under time pressure!"
        >
          ⚡ Speed Focus Mode
        </button>
      </div>
    </>
  );
};

export default StudyHeader;