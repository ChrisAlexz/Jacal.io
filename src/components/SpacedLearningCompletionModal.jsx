// src/components/SpacedLearningCompletionModal.jsx - Separate completion modal
import React, { useState, useEffect } from 'react';

const SpacedLearningCompletionModal = () => {
  const [completionData, setCompletionData] = useState(null);

  useEffect(() => {
    const checkCompletion = () => {
      if (window.showSpacedLearningCompletion) {
        setCompletionData(window.showSpacedLearningCompletion);
      } else {
        setCompletionData(null);
      }
    };

    const interval = setInterval(checkCompletion, 100);
    return () => clearInterval(interval);
  }, []);

  if (!completionData) return null;

  const handleContinue = () => {
    window.spacedLearningRef?.current?.continueToNextBatch?.();
  };

  const handleRestart = () => {
    window.spacedLearningRef?.current?.resetSpacedLearning?.();
  };

  const handleBack = () => {
    window.history.back();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(18, 18, 18, 0.95)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      backdropFilter: 'blur(5px)'
    }}>
      <div className="batch-completion-screen">
        <div className="completion-icon">🎯</div>
        <h2>
          {completionData.isLast ? 'All Sessions Complete!' : `Session ${completionData.completed} Complete!`}
        </h2>
        <p>
          {completionData.isLast 
            ? `You've completed all ${completionData.total} sessions!`
            : `Session ${completionData.completed} of ${completionData.total} complete. Ready for the next 20 cards?`
          }
        </p>
        
        <div className="batch-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ 
                width: `${(completionData.completed / completionData.total) * 100}%`
              }}
            ></div>
          </div>
          <span className="progress-text">
            {completionData.completed} / {completionData.total} sessions
          </span>
        </div>
       
        <div className="completion-actions">
          <button 
            className="back-button"
            onClick={handleBack}
          >
            Back to Sets
          </button>
          {!completionData.isLast && (
            <button 
              className="continue-button"
              onClick={handleContinue}
            >
              Continue to Next Session
            </button>
          )}
          {completionData.isLast && (
            <button 
              className="restart-button"
              onClick={handleRestart}
            >
              Study Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpacedLearningCompletionModal;