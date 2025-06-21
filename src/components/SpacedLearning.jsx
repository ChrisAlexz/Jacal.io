// src/components/SpacedLearning.jsx - Modular Spaced Learning Component
import React, { useState, useEffect } from 'react';
import '../SpacedLearning.css';

const SpacedLearning = ({
  allCards,
  onCardsUpdate,
  onSessionCardsUpdate,
  onCurrentIndexUpdate,
  onUIReset,
  isEnabled,
  onToggle,
  children
}) => {
  // Spaced Learning state
  const [spacedLearningBatches, setSpacedLearningBatches] = useState([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [showBatchCompletion, setShowBatchCompletion] = useState(false);
  const [batchCompletionData, setBatchCompletionData] = useState({ completed: 0, total: 0 });

  // Utility functions
  const createSpacedLearningBatches = (cards, batchSize = 20) => {
    const batches = [];
    for (let i = 0; i < cards.length; i += batchSize) {
      batches.push(cards.slice(i, i + batchSize));
    }
    return batches;
  };

  const shouldUseSpacedLearning = (cards, enabled) => {
    return enabled && cards.length >= 20;
  };

  // Initialize spaced learning when cards or enabled state changes
  useEffect(() => {
    if (allCards.length > 0 && shouldUseSpacedLearning(allCards, isEnabled)) {
      initializeSpacedLearning();
    } else if (allCards.length > 0 && !isEnabled) {
      // Regular study mode
      onSessionCardsUpdate(allCards);
      onCurrentIndexUpdate(0);
    }
  }, [allCards, isEnabled]);

  const initializeSpacedLearning = () => {
    const incompleteBatches = createSpacedLearningBatches(
      allCards.filter(card => !card._spacedLearningCompleted)
    );
    setSpacedLearningBatches(incompleteBatches);
    setCurrentBatchIndex(0);
    
    if (incompleteBatches.length > 0) {
      onSessionCardsUpdate(incompleteBatches[0]);
      onCurrentIndexUpdate(0);
    }
  };

  const toggleSpacedLearning = () => {
    const newEnabled = !isEnabled;
    onToggle(newEnabled);
    
    // Reset UI state
    onUIReset();
    onCurrentIndexUpdate(0);
    setShowBatchCompletion(false);
    
    if (newEnabled && allCards.length >= 20) {
      // Enable spaced learning
      const batches = createSpacedLearningBatches(allCards);
      setSpacedLearningBatches(batches);
      setCurrentBatchIndex(0);
      onSessionCardsUpdate(batches[0] || []);
    } else {
      // Disable spaced learning - return to normal mode
      setSpacedLearningBatches([]);
      setCurrentBatchIndex(0);
      onSessionCardsUpdate(allCards);
    }
  };

  const handleBatchCompletion = () => {
    const completedBatch = currentBatchIndex + 1;
    const totalBatches = spacedLearningBatches.length;
    
    setBatchCompletionData({
      completed: completedBatch,
      total: totalBatches
    });
    setShowBatchCompletion(true);
    
    // Mark current batch cards as completed
    const updatedAllCards = allCards.map(card => {
      const isInCurrentBatch = spacedLearningBatches[currentBatchIndex]?.some(
        batchCard => batchCard.id === card.id
      );
      return isInCurrentBatch ? { ...card, _spacedLearningCompleted: true } : card;
    });
    onCardsUpdate(updatedAllCards);
  };

  const continueToNextBatch = () => {
    setShowBatchCompletion(false);
    
    const nextBatchIndex = currentBatchIndex + 1;
    if (nextBatchIndex < spacedLearningBatches.length) {
      setCurrentBatchIndex(nextBatchIndex);
      onSessionCardsUpdate(spacedLearningBatches[nextBatchIndex]);
      onCurrentIndexUpdate(0);
      onUIReset();
    } else {
      // All batches completed
      onToggle(false);
      onSessionCardsUpdate([]);
    }
  };

  const resetSpacedLearning = () => {
    if (isEnabled && allCards.length >= 20) {
      const resetCards = allCards.map(card => ({
        ...card,
        _spacedLearningCompleted: false
      }));
      
      const batches = createSpacedLearningBatches(resetCards);
      setSpacedLearningBatches(batches);
      setCurrentBatchIndex(0);
      onSessionCardsUpdate(batches[0] || []);
      setShowBatchCompletion(false);
    }
  };

  // Expose methods to parent component
  useEffect(() => {
    // Attach methods to parent for external access
    if (window.spacedLearningRef) {
      window.spacedLearningRef.current = {
        handleBatchCompletion,
        resetSpacedLearning,
        shouldUseSpacedLearning: () => shouldUseSpacedLearning(allCards, isEnabled)
      };
    }
  }, [allCards, isEnabled, spacedLearningBatches, currentBatchIndex]);

  // Batch completion screen
  if (showBatchCompletion) {
    const isLastBatch = batchCompletionData.completed >= batchCompletionData.total;
    
    return (
      <div className="spaced-learning-container">
        <div className="batch-completion-screen">
          <div className="completion-icon">🎯</div>
          <h2>
            {isLastBatch ? 'All Sessions Complete!' : `Session ${batchCompletionData.completed} Complete!`}
          </h2>
          <p>
            {isLastBatch 
              ? `Congratulations! You've completed all ${batchCompletionData.total} sessions in this spaced learning deck. You've mastered the entire set!`
              : `Great job! You've completed session ${batchCompletionData.completed} of ${batchCompletionData.total}. Ready for the next batch of 20 cards?`
            }
          </p>
          
          <div className="batch-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${(batchCompletionData.completed / batchCompletionData.total) * 100}%` }}
              ></div>
            </div>
            <span className="progress-text">
              {batchCompletionData.completed} / {batchCompletionData.total} sessions completed
            </span>
          </div>
         
          <div className="completion-actions">
            <button 
              type="button"
              className="back-button"
              onClick={() => window.history.back()}
            >
              Back to Sets
            </button>
            {!isLastBatch && (
              <button 
                type="button"
                className="continue-button"
                onClick={continueToNextBatch}
              >
                Continue to Next Session
              </button>
            )}
            {isLastBatch && (
              <button 
                type="button"
                className="restart-button"
                onClick={resetSpacedLearning}
              >
                Study Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Regular study interface with spaced learning controls
  return (
    <div className="spaced-learning-container">
      {/* Spaced Learning Toggle Button */}
      {allCards.length >= 20 && (
        <div className="spaced-learning-controls">
          <button 
            className={`spaced-learning-btn ${isEnabled ? 'active' : ''}`}
            onClick={toggleSpacedLearning}
            title="Spaced Learning Mode: Break large decks into manageable 20-card sessions. Complete each session by marking all cards as 'Easy' before moving to the next batch. Perfect for systematic learning of large decks without overwhelm."
          >
            📚 Spaced Learning {isEnabled ? '(ON)' : '(OFF)'}
          </button>
        </div>
      )}

      {/* Batch Progress Indicator */}
      {isEnabled && spacedLearningBatches.length > 1 && (
        <div className="batch-progress-indicator">
          <span className="batch-info">
            Session {currentBatchIndex + 1} of {spacedLearningBatches.length}
          </span>
        </div>
      )}

      {/* Pass through children (main study content) */}
      {children}
    </div>
  );
};

export default SpacedLearning;