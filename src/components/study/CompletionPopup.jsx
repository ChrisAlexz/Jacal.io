// src/components/study/CompletionPopup.jsx - Brief success notification
import React from 'react';

const CompletionPopup = ({ showCompletionPopup }) => {
  if (!showCompletionPopup) return null;

  return (
    <div className="completion-popup">
      <div className="completion-popup-content">
        <div className="completion-popup-icon">🎉</div>
        <div className="completion-popup-text">
          <h3>Card Mastered!</h3>
          <p>Marked as Easy!</p>
        </div>
      </div>
    </div>
  );
};

export default CompletionPopup;