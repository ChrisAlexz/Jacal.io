// src/components/SpacedLearning.jsx - COMPLETELY DEFENSIVE VERSION
import React, { useState, useEffect, useRef } from 'react';
import '../styles/SpacedLearning.css';

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
  // DEFENSIVE: Ensure all props are safe
  const safeAllCards = Array.isArray(allCards) ? allCards : [];
  const safeIsEnabled = Boolean(isEnabled);
  const safeOnCardsUpdate = typeof onCardsUpdate === 'function' ? onCardsUpdate : () => {};
  const safeOnSessionCardsUpdate = typeof onSessionCardsUpdate === 'function' ? onSessionCardsUpdate : () => {};
  const safeOnCurrentIndexUpdate = typeof onCurrentIndexUpdate === 'function' ? onCurrentIndexUpdate : () => {};
  const safeOnUIReset = typeof onUIReset === 'function' ? onUIReset : () => {};
  const safeOnToggle = typeof onToggle === 'function' ? onToggle : () => {};

  // Spaced Learning state - with safe defaults
  const [spacedLearningBatches, setSpacedLearningBatches] = useState([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [showBatchCompletion, setShowBatchCompletion] = useState(false);
  const [batchCompletionData, setBatchCompletionData] = useState({ completed: 0, total: 0 });
  const [isInitialized, setIsInitialized] = useState(false);

  // Create ref for external access
  const spacedLearningRef = useRef({});

  // DEFENSIVE: Ensure batches is always an array
  const safeBatches = Array.isArray(spacedLearningBatches) ? spacedLearningBatches : [];
  const safeBatchIndex = typeof currentBatchIndex === 'number' && currentBatchIndex >= 0 ? currentBatchIndex : 0;

  // DEBUG: Log when component renders
  console.log('🔄 SpacedLearning render:', {
    allCardsLength: safeAllCards.length,
    isEnabled: safeIsEnabled,
    isInitialized,
    showBatchCompletion,
    batchesLength: safeBatches.length
  });

  // Utility functions with complete safety
  const createSpacedLearningBatches = (cards, batchSize = 20) => {
    // SAFETY: Complete validation
    if (!Array.isArray(cards)) {
      console.warn('⚠️ createSpacedLearningBatches: cards is not an array');
      return [];
    }
    
    if (cards.length === 0) {
      console.log('📝 createSpacedLearningBatches: empty cards array');
      return [];
    }
    
    if (typeof batchSize !== 'number' || batchSize <= 0) {
      console.warn('⚠️ createSpacedLearningBatches: invalid batch size, using default');
      batchSize = 20;
    }
    
    console.log(`🔧 Creating batches for ${cards.length} cards with batch size ${batchSize}`);
    const batches = [];
    
    try {
      for (let i = 0; i < cards.length; i += batchSize) {
        const endIndex = Math.min(i + batchSize, cards.length);
        const batch = cards.slice(i, endIndex);
        if (Array.isArray(batch) && batch.length > 0) {
          batches.push(batch);
        }
      }
    } catch (error) {
      console.error('❌ Error creating batches:', error);
      return [];
    }
    
    console.log(`✅ Created ${batches.length} batches`);
    return batches;
  };

  const shouldUseSpacedLearning = (cards, enabled) => {
    return Boolean(enabled) && Array.isArray(cards) && cards.length >= 20;
  };

  // DEFENSIVE: Initialize spaced learning with complete error handling
  const initializeSpacedLearning = () => {
    console.log('🚀 Starting spaced learning initialization...');
    
    try {
      // SAFETY: Validate all inputs
      if (!Array.isArray(safeAllCards)) {
        console.warn('⚠️ initializeSpacedLearning: safeAllCards is not an array');
        setIsInitialized(true);
        return;
      }
      
      if (safeAllCards.length === 0) {
        console.warn('⚠️ initializeSpacedLearning: no cards available');
        setSpacedLearningBatches([]);
        setCurrentBatchIndex(0);
        safeOnSessionCardsUpdate([]);
        setIsInitialized(true);
        return;
      }
      
      // Filter out completed cards only if this isn't a master again session
      const isMasterAgain = safeAllCards.some(card => card && card._masterAgainSession);
      
      let cardsToUse = [];
      if (isMasterAgain) {
        // Master again: use all cards, reset completion status
        cardsToUse = safeAllCards.map(card => ({
          ...(card || {}),
          _spacedLearningCompleted: false,
          _mastered: false
        }));
        console.log('🔄 Master Again: Resetting all', cardsToUse.length, 'cards');
      } else {
        // Regular session: filter out completed cards
        cardsToUse = safeAllCards.filter(card => card && !card._spacedLearningCompleted);
        console.log('📚 Regular session: Using', cardsToUse.length, 'incomplete cards');
      }
      
      if (!Array.isArray(cardsToUse) || cardsToUse.length === 0) {
        console.log('✅ All spaced learning completed or no valid cards');
        setSpacedLearningBatches([]);
        setCurrentBatchIndex(0);
        safeOnSessionCardsUpdate([]);
        setIsInitialized(true);
        return;
      }
      
      // Create batches with full error handling
      console.log('📊 Creating batches for', cardsToUse.length, 'cards...');
      const batches = createSpacedLearningBatches(cardsToUse);
      
      if (!Array.isArray(batches)) {
        console.error('❌ Batch creation failed - not an array');
        setSpacedLearningBatches([]);
        setCurrentBatchIndex(0);
        safeOnSessionCardsUpdate(cardsToUse.slice(0, 20)); // Fallback
        setIsInitialized(true);
        return;
      }
      
      console.log('✅ Created', batches.length, 'batches');
      
      setSpacedLearningBatches(batches);
      setCurrentBatchIndex(0);
      setShowBatchCompletion(false);
      
      if (batches.length > 0 && Array.isArray(batches[0])) {
        console.log('🎯 Starting batch 1 with', batches[0].length, 'cards');
        safeOnSessionCardsUpdate(batches[0]);
        safeOnCurrentIndexUpdate(0);
      } else {
        console.warn('⚠️ No valid first batch, using fallback');
        safeOnSessionCardsUpdate(cardsToUse.slice(0, 20));
        safeOnCurrentIndexUpdate(0);
      }
      
      setIsInitialized(true);
      console.log('🎉 Spaced learning initialization complete!');
      
    } catch (error) {
      console.error('❌ Error during spaced learning initialization:', error);
      // Fallback: just use regular mode
      setSpacedLearningBatches([]);
      setCurrentBatchIndex(0);
      if (safeAllCards.length > 0) {
        safeOnSessionCardsUpdate(safeAllCards);
      }
      setIsInitialized(true);
    }
  };

  // FIXED: Initialize spaced learning when cards or enabled state changes
  useEffect(() => {
    console.log('🔄 SpacedLearning useEffect triggered:', {
      allCardsLength: safeAllCards.length,
      isEnabled: safeIsEnabled,
      isInitialized
    });

    try {
      // Always mark as initialized if we have cards, regardless of spaced learning mode
      if (safeAllCards.length > 0) {
        if (shouldUseSpacedLearning(safeAllCards, safeIsEnabled)) {
          console.log('📚 Initializing spaced learning mode');
          initializeSpacedLearning();
        } else {
          console.log('📖 Using regular study mode');
          // Regular study mode - just pass through cards
          safeOnSessionCardsUpdate(safeAllCards);
          safeOnCurrentIndexUpdate(0);
          setIsInitialized(true);
        }
      } else {
        // No cards yet, but mark as initialized to show loading state properly
        console.log('📭 No cards available, marking as initialized');
        setIsInitialized(true);
      }
    } catch (error) {
      console.error('❌ Error in SpacedLearning useEffect:', error);
      setIsInitialized(true);
    }
  }, [safeAllCards.length, safeIsEnabled]); // FIXED: Only depend on length and enabled state

  // DEFENSIVE: Toggle spaced learning with complete error handling
  const toggleSpacedLearning = () => {
    try {
      const newEnabled = !safeIsEnabled;
      console.log('🔄 Toggling spaced learning:', newEnabled ? 'ON' : 'OFF');
      safeOnToggle(newEnabled);
      
      // Reset UI state
      safeOnUIReset();
      safeOnCurrentIndexUpdate(0);
      setShowBatchCompletion(false);
      
      if (newEnabled && safeAllCards.length >= 20) {
        // Enable spaced learning
        console.log('✅ Enabling spaced learning mode');
        initializeSpacedLearning();
      } else {
        // Disable spaced learning - return to normal mode
        console.log('❌ Disabling spaced learning, returning to normal mode');
        setSpacedLearningBatches([]);
        setCurrentBatchIndex(0);
        if (safeAllCards.length > 0) {
          safeOnSessionCardsUpdate(safeAllCards);
        }
        setIsInitialized(true);
      }
    } catch (error) {
      console.error('❌ Error toggling spaced learning:', error);
    }
  };

  // DEFENSIVE: Handle batch completion with complete error handling
  const handleBatchCompletion = () => {
    try {
      console.log('🎯 handleBatchCompletion called for batch', safeBatchIndex + 1);
      
      const completedBatch = safeBatchIndex + 1;
      const totalBatches = safeBatches.length;
      
      console.log(`📊 Batch ${completedBatch} of ${totalBatches} completed`);
      
      setBatchCompletionData({
        completed: completedBatch,
        total: totalBatches
      });
      
      // Mark current batch cards as completed
      if (Array.isArray(safeAllCards) && Array.isArray(safeBatches) && safeBatches[safeBatchIndex]) {
        const currentBatch = safeBatches[safeBatchIndex];
        const updatedAllCards = safeAllCards.map(card => {
          if (!card || !card.id) return card;
          
          const isInCurrentBatch = Array.isArray(currentBatch) && currentBatch.some(
            batchCard => batchCard && batchCard.id === card.id
          );
          
          if (isInCurrentBatch) {
            console.log('✅ Marking card as spaced learning completed:', card.id);
            return { ...card, _spacedLearningCompleted: true };
          }
          return card;
        });
        
        safeOnCardsUpdate(updatedAllCards);
      }
      
      // CRITICAL: Show batch completion screen
      setShowBatchCompletion(true);
      console.log('🎉 Batch completion screen should now be visible');
      
    } catch (error) {
      console.error('❌ Error in handleBatchCompletion:', error);
      // Fallback: at least show some completion
      setShowBatchCompletion(true);
    }
  };

  // DEFENSIVE: Continue to next batch with error handling
  const continueToNextBatch = () => {
    try {
      console.log('➡️ Continuing to next batch');
      setShowBatchCompletion(false);
      
      const nextBatchIndex = safeBatchIndex + 1;
      if (nextBatchIndex < safeBatches.length && Array.isArray(safeBatches[nextBatchIndex])) {
        console.log('🎯 Starting batch', nextBatchIndex + 1, 'of', safeBatches.length);
        setCurrentBatchIndex(nextBatchIndex);
        safeOnSessionCardsUpdate(safeBatches[nextBatchIndex]);
        safeOnCurrentIndexUpdate(0);
        safeOnUIReset();
      } else {
        // All batches completed
        console.log('🎉 All spaced learning batches completed!');
        safeOnToggle(false);
        safeOnSessionCardsUpdate([]);
      }
    } catch (error) {
      console.error('❌ Error continuing to next batch:', error);
      setShowBatchCompletion(false);
    }
  };

  // DEFENSIVE: Reset spaced learning with error handling
  const resetSpacedLearning = () => {
    try {
      console.log('🔄 Resetting spaced learning');
      if (safeIsEnabled && safeAllCards.length >= 20) {
        const resetCards = safeAllCards.map(card => ({
          ...(card || {}),
          _spacedLearningCompleted: false,
          _mastered: false,
          _masterAgainSession: true // Mark as master again session
        }));
        
        safeOnCardsUpdate(resetCards);
        
        // Will trigger re-initialization via useEffect
        setShowBatchCompletion(false);
      }
    } catch (error) {
      console.error('❌ Error resetting spaced learning:', error);
      setShowBatchCompletion(false);
    }
  };

  // DEFENSIVE: Expose methods to parent component via ref
  useEffect(() => {
    try {
      spacedLearningRef.current = {
        handleBatchCompletion,
        resetSpacedLearning,
        shouldUseSpacedLearning: () => shouldUseSpacedLearning(safeAllCards, safeIsEnabled),
        initializeSpacedLearning
      };

      // Also expose globally for FlashcardStudyPage to access
      if (typeof window !== 'undefined') {
        window.spacedLearningRef = spacedLearningRef;
      }

      return () => {
        if (typeof window !== 'undefined') {
          window.spacedLearningRef = null;
        }
      };
    } catch (error) {
      console.error('❌ Error setting up SpacedLearning ref:', error);
    }
  }, [safeAllCards.length, safeIsEnabled, safeBatches.length, safeBatchIndex]);

  // Don't render anything until initialized, but add timeout for large datasets
  if (!isInitialized) {
    // Add timeout for very large datasets
    setTimeout(() => {
      if (!isInitialized) {
        console.log('⚠️ Initialization timeout - forcing initialization');
        setIsInitialized(true);
        // If still no session cards, provide a fallback
        if (safeAllCards.length > 0) {
          safeOnSessionCardsUpdate(safeAllCards.slice(0, Math.min(20, safeAllCards.length)));
        }
      }
    }, 3000); // 3 second timeout

    return (
      <div className="spaced-learning-container">
        <div className="loading-spaced-learning">
          <div className="loading-spinner"></div>
          <p>Initializing study session...</p>
          {safeAllCards.length > 100 && (
            <p style={{ fontSize: '0.9rem', color: '#888', marginTop: '10px' }}>
              Large deck detected ({safeAllCards.length} cards) - this may take a moment...
            </p>
          )}
        </div>
      </div>
    );
  }

  // CRITICAL: Debug log to see what state we're in
  console.log('🔍 SpacedLearning render state:', {
    showBatchCompletion,
    isEnabled: safeIsEnabled,
    batchesLength: safeBatches.length,
    currentBatchIndex: safeBatchIndex,
    batchCompletionData
  });

  // DEFENSIVE: Batch completion screen with complete safety
  if (showBatchCompletion) {
    const safeCompletionData = batchCompletionData || { completed: 0, total: 0 };
    const isLastBatch = safeCompletionData.completed >= safeCompletionData.total;
    
    console.log('🎭 Rendering batch completion screen:', {
      isLastBatch,
      completed: safeCompletionData.completed,
      total: safeCompletionData.total
    });
    
    return (
      <div className="spaced-learning-container">
        <div className="batch-completion-screen">
          <div className="completion-icon">🎯</div>
          <h2>
            {isLastBatch ? 'All Sessions Complete!' : `Session ${safeCompletionData.completed} Complete!`}
          </h2>
          <p>
            {isLastBatch 
              ? `Congratulations! You've completed all ${safeCompletionData.total} sessions in this spaced learning deck. You've mastered the entire set!`
              : `Great job! You've completed session ${safeCompletionData.completed} of ${safeCompletionData.total}. Ready for the next batch of 20 cards?`
            }
          </p>
          
          <div className="batch-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ 
                  width: safeCompletionData.total > 0 
                    ? `${(safeCompletionData.completed / safeCompletionData.total) * 100}%` 
                    : '0%'
                }}
              ></div>
            </div>
            <span className="progress-text">
              {safeCompletionData.completed} / {safeCompletionData.total} sessions completed
            </span>
          </div>
         
          <div className="completion-actions">
            <button 
              type="button"
              className="back-button"
              onClick={() => {
                try {
                  console.log('🔙 Back button clicked');
                  if (typeof window !== 'undefined' && window.history) {
                    window.history.back();
                  }
                } catch (error) {
                  console.error('❌ Error going back:', error);
                }
              }}
            >
              Back to Sets
            </button>
            {!isLastBatch && (
              <button 
                type="button"
                className="continue-button"
                onClick={() => {
                  try {
                    console.log('➡️ Continue button clicked');
                    continueToNextBatch();
                  } catch (error) {
                    console.error('❌ Error continuing:', error);
                  }
                }}
              >
                Continue to Next Session
              </button>
            )}
            {isLastBatch && (
              <button 
                type="button"
                className="restart-button"
                onClick={() => {
                  try {
                    console.log('🔄 Restart button clicked');
                    resetSpacedLearning();
                  } catch (error) {
                    console.error('❌ Error restarting:', error);
                  }
                }}
              >
                Study Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Regular study interface - just show batch progress and pass through children
  return (
    <div className="spaced-learning-container">
      {/* Batch Progress Indicator - Only show when enabled and multiple batches */}
      {safeIsEnabled && safeBatches.length > 1 && (
        <div className="batch-progress-indicator">
          <span className="batch-info">
            Session {safeBatchIndex + 1} of {safeBatches.length}
            <span className="batch-cards-info">
              ({(safeBatches[safeBatchIndex] && Array.isArray(safeBatches[safeBatchIndex]) 
                ? safeBatches[safeBatchIndex].length 
                : 0)} cards in this session)
            </span>
          </span>
        </div>
      )}

      {/* Pass through children (main study content) */}
      {children}
    </div>
  );
};

export default SpacedLearning;