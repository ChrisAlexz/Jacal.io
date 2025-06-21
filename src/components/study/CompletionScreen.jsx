// src/components/study/CompletionScreen.jsx - Study completion screen
import React from 'react';
import { useNavigate } from 'react-router-dom';

const CompletionScreen = ({ allCards, handleMasterAgain }) => {
  const navigate = useNavigate();

  return (
    <div className="study-completion">
      <div className="completion-icon">🎉</div>
      <h2>Perfect! All Cards Mastered!</h2>
      <p>
        Congratulations! You've marked every single card as "Easy" - you've truly mastered this deck! 
        All {allCards.length} cards have been successfully completed.
      </p>
     
      <div className="completion-actions">
        <button 
          type="button"
          className="back-button"
          onClick={() => navigate(-1)}
        >
          Back to Sets
        </button>
        <button 
          type="button"
          className="restart-button"
          onClick={handleMasterAgain}
        >
          Master Again
        </button>
      </div>
    </div>
  );
};

export default CompletionScreen;