// src/components/SpacedLearning.jsx - FIXED: Proper Integration with StudyPage
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
  // Spaced Learning state
  const [spacedLearningBatches, setSpacedLearningBatches] = useState([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [showBatchCompletion, setShowBatchCompletion] = useState(false);
  const [batchCompletionData, setBatchCompletionData] = useState({ completed: 0, total: 0 });
  const [isInitialized, setIsInitialized] = useState(false);

  // Create ref for external access
  const spacedLearningRef = useRef();

  // DEBUG: Log when component renders
  console.log('🔄 SpacedLearning render:', {
    allCardsLength: allCards.length,
    isEnabled,
    isInitialized,
    showBatchCompletion
  });

  // Utility functions
  const createSpacedLearningBatches = (cards, batchSize = 20) => {
    console.log(`🔧 Creating batches for ${cards.length} cards with batch size ${batchSize}`);
    const batches = [];
    
    // For very large datasets, process in chunks to avoid blocking
    const processChunk = (startIndex) => {
      const endIndex = Math.min(startIndex + batchSize, cards.length);
      batches.push(cards.slice(startIndex, endIndex));
    };
    
    for (let i = 0; i < cards.length; i += batchSize) {
      processChunk(i);
    }
    
    console.log(`✅ Created ${batches.length} batches`);
    return batches;
  };

  const shouldUseSpacedLearning = (cards, enabled) => {
    return enabled && cards.length >= 20;
  };

  // FIXED: Initialize spaced learning when cards or enabled state changes
  useEffect(() => {
    console.log('🔄 SpacedLearning useEffect triggered:', {
      allCardsLength: allCards.length,
      isEnabled,
      isInitialized
    });

    // Always mark as initialized if we have cards, regardless of spaced learning mode
    if (allCards.length > 0) {
      if (shouldUseSpacedLearning(allCards, isEnabled)) {
        console.log('📚 Initializing spaced learning mode');
        initializeSpacedLearning();
      } else {
        console.log('📖 Using regular study mode');
        // Regular study mode - just pass through cards
        onSessionCardsUpdate(allCards);
        onCurrentIndexUpdate(0);
        setIsInitialized(true);
      }
    } else if (allCards.length === 0) {
      // No cards yet, but mark as initialized to show loading state properly
      setIsInitialized(true);
    }
  }, [allCards.length, isEnabled]); // FIXED: Only depend on length and enabled state

  // FIXED: Proper initialization that handles both new sessions and master again
  const initializeSpacedLearning = () => {
    console.log('🚀 Starting spaced learning initialization...');
    
    // Filter out completed cards only if this isn't a master again session
    const isMasterAgain = allCards.some(card => card._masterAgainSession);
    
    let cardsToUse;
    if (isMasterAgain) {
      // Master again: use all cards, reset completion status
      cardsToUse = allCards.map(card => ({
        ...card,
        _spacedLearningCompleted: false,
        _mastered: false
      }));
      console.log('🔄 Master Again: Resetting all', cardsToUse.length, 'cards');
    } else {
      // Regular session: filter out completed cards
      cardsToUse = allCards.filter(card => !card._spacedLearningCompleted);
      console.log('📚 Regular session: Using', cardsToUse.length, 'incomplete cards');
    }
    
    if (cardsToUse.length === 0) {
      console.log('✅ All spaced learning completed');
      setSpacedLearningBatches([]);
      setCurrentBatchIndex(0);
      onSessionCardsUpdate([]);
      setIsInitialized(true);
      return;
    }
    
    // OPTIMIZED: Create batches more efficiently for large datasets
    console.log('📊 Creating batches for', cardsToUse.length, 'cards...');
    const batches = createSpacedLearningBatches(cardsToUse);
    console.log('✅ Created', batches.length, 'batches');
    
    setSpacedLearningBatches(batches);
    setCurrentBatchIndex(0);
    setShowBatchCompletion(false);
    
    if (batches.length > 0) {
      console.log('🎯 Starting batch 1 with', batches[0].length, 'cards');
      onSessionCardsUpdate(batches[0]);
      onCurrentIndexUpdate(0);
    }
    
    setIsInitialized(true);
    console.log('🎉 Spaced learning initialization complete!');
  };

  // FIXED: Toggle spaced learning with proper state management
  const toggleSpacedLearning = () => {
    const newEnabled = !isEnabled;
    console.log('🔄 Toggling spaced learning:', newEnabled ? 'ON' : 'OFF');
    onToggle(newEnabled);
    
    // Reset UI state
    onUIReset();
    onCurrentIndexUpdate(0);
    setShowBatchCompletion(false);
    
    if (newEnabled && allCards.length >= 20) {
      // Enable spaced learning
      console.log('✅ Enabling spaced learning mode');
      initializeSpacedLearning();
    } else {
      // Disable spaced learning - return to normal mode
      console.log('❌ Disabling spaced learning, returning to normal mode');
      setSpacedLearningBatches([]);
      setCurrentBatchIndex(0);
      onSessionCardsUpdate(allCards);
      setIsInitialized(true);
    }
  };

  // FIXED: Handle batch completion properly
  const handleBatchCompletion = () => {
    console.log('🎯 handleBatchCompletion called for batch', currentBatchIndex + 1);
    
    const completedBatch = currentBatchIndex + 1;
    const totalBatches = spacedLearningBatches.length;
    
    console.log(`📊 Batch ${completedBatch} of ${totalBatches} completed`);
    
    setBatchCompletionData({
      completed: completedBatch,
      total: totalBatches
    });
    
    // Mark current batch cards as completed
    const updatedAllCards = allCards.map(card => {
      const isInCurrentBatch = spacedLearningBatches[currentBatchIndex]?.some(
        batchCard => batchCard.id === card.id
      );
      if (isInCurrentBatch) {
        console.log('✅ Marking card as spaced learning completed:', card.id);
        return { ...card, _spacedLearningCompleted: true };
      }
      return card;
    });
    
    onCardsUpdate(updatedAllCards);
    
    // CRITICAL: Show batch completion screen
    setShowBatchCompletion(true);
    console.log('🎉 Batch completion screen should now be visible');
  };

  // FIXED: Continue to next batch
  const continueToNextBatch = () => {
    console.log('➡️ Continuing to next batch');
    setShowBatchCompletion(false);
    
    const nextBatchIndex = currentBatchIndex + 1;
    if (nextBatchIndex < spacedLearningBatches.length) {
      console.log('🎯 Starting batch', nextBatchIndex + 1, 'of', spacedLearningBatches.length);
      setCurrentBatchIndex(nextBatchIndex);
      onSessionCardsUpdate(spacedLearningBatches[nextBatchIndex]);
      onCurrentIndexUpdate(0);
      onUIReset();
    } else {
      // All batches completed
      console.log('🎉 All spaced learning batches completed!');
      onToggle(false);
      onSessionCardsUpdate([]);
    }
  };

  // FIXED: Reset spaced learning properly
  const resetSpacedLearning = () => {
    console.log('🔄 Resetting spaced learning');
    if (isEnabled && allCards.length >= 20) {
      const resetCards = allCards.map(card => ({
        ...card,
        _spacedLearningCompleted: false,
        _mastered: false,
        _masterAgainSession: true // Mark as master again session
      }));
      
      onCardsUpdate(resetCards);
      
      // Will trigger re-initialization via useEffect
      setShowBatchCompletion(false);
    }
  };

  // FIXED: Expose methods to parent component via ref
  useEffect(() => {
    spacedLearningRef.current = {
      handleBatchCompletion,
      resetSpacedLearning,
      shouldUseSpacedLearning: () => shouldUseSpacedLearning(allCards, isEnabled),
      initializeSpacedLearning
    };

    // Also expose globally for FlashcardStudyPage to access
    if (window) {
      window.spacedLearningRef = spacedLearningRef;
    }

    return () => {
      if (window) {
        window.spacedLearningRef = null;
      }
    };
  }, [allCards, isEnabled, spacedLearningBatches, currentBatchIndex]);

  // Don't render anything until initialized, but add timeout for large datasets
  if (!isInitialized) {
    // Add timeout for very large datasets
    setTimeout(() => {
      if (!isInitialized) {
        console.log('⚠️ Initialization timeout - forcing initialization');
        setIsInitialized(true);
        // If still no session cards, provide a fallback
        if (allCards.length > 0) {
          onSessionCardsUpdate(allCards.slice(0, 20)); // Show first 20 as fallback
        }
      }
    }, 3000); // 3 second timeout

    return (
      <div className="spaced-learning-container">
        <div className="loading-spaced-learning">
          <div className="loading-spinner"></div>
          <p>Initializing study session...</p>
          {allCards.length > 100 && (
            <p style={{ fontSize: '0.9rem', color: '#888', marginTop: '10px' }}>
              Large deck detected ({allCards.length} cards) - this may take a moment...
            </p>
          )}
        </div>
      </div>
    );
  }

  // CRITICAL: Debug log to see what state we're in
  console.log('🔍 SpacedLearning render state:', {
    showBatchCompletion,
    isEnabled,
    batchesLength: spacedLearningBatches.length,
    currentBatchIndex,
    batchCompletionData
  });

  // FIXED: Batch completion screen
  if (showBatchCompletion) {
    const isLastBatch = batchCompletionData.completed >= batchCompletionData.total;
    
    console.log('🎭 Rendering batch completion screen:', {
      isLastBatch,
      completed: batchCompletionData.completed,
      total: batchCompletionData.total
    });
    
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
              onClick={() => {
                console.log('🔙 Back button clicked');
                window.history.back();
              }}
            >
              Back to Sets
            </button>
            {!isLastBatch && (
              <button 
                type="button"
                className="continue-button"
                onClick={() => {
                  console.log('➡️ Continue button clicked');
                  continueToNextBatch();
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
                  console.log('🔄 Restart button clicked');
                  resetSpacedLearning();
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
      {isEnabled && spacedLearningBatches.length > 1 && (
        <div className="batch-progress-indicator">
          <span className="batch-info">
            Session {currentBatchIndex + 1} of {spacedLearningBatches.length}
            <span className="batch-cards-info">
              ({spacedLearningBatches[currentBatchIndex]?.length || 0} cards in this session)
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