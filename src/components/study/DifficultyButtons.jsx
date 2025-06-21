// src/components/study/DifficultyButtons.jsx - Spaced repetition difficulty buttons
import React from 'react';

const DifficultyButtons = ({ intervalPreviews, handleDifficultyChoice }) => {
  return (
    <div className="difficulty-buttons">
      <div className="interval-preview">
        <div className="interval-item">
          <button className="again-btn preview" disabled>Again</button>
          <span className="interval-text">{intervalPreviews.again}</span>
        </div>
        <div className="interval-item">
          <button className="hard-btn preview" disabled>Hard</button>
          <span className="interval-text">{intervalPreviews.hard}</span>
        </div>
        <div className="interval-item">
          <button className="good-btn preview" disabled>Good</button>
          <span className="interval-text">{intervalPreviews.good}</span>
        </div>
        <div className="interval-item">
          <button className="easy-btn preview" disabled>Easy</button>
          <span className="interval-text">{intervalPreviews.easy}</span>
        </div>
      </div>
      <div className="button-row">
        <button className="again-btn" onClick={() => handleDifficultyChoice('again')}>
          Again
        </button>
        <button className="hard-btn" onClick={() => handleDifficultyChoice('hard')}>
          Hard
        </button>
        <button className="good-btn" onClick={() => handleDifficultyChoice('good')}>
          Good
        </button>
        <button className="easy-btn" onClick={() => handleDifficultyChoice('easy')}>
          Easy
        </button>
      </div>
    </div>
  );
};

export default DifficultyButtons;