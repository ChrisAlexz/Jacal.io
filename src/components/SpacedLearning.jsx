// src/components/SpacedLearning.jsx - SIMPLE VERSION - ONLY LOGIC, NO UI INTERFERENCE
import { useState, useEffect, useRef } from 'react';

const SpacedLearning = ({
  allCards = [],
  onCardsUpdate,
  onSessionCardsUpdate,
  onCurrentIndexUpdate,
  onUIReset,
  isEnabled = false,
  onToggle
}) => {
  // State
  const [batches, setBatches] = useState([]);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [cardsCompleted, setCardsCompleted] = useState(0);
  const [initialized, setInitialized] = useState(false);

  // Ref for external access
  const ref = useRef({});

  // Create batches of 20 cards
  const createBatches = (cards) => {
    if (!Array.isArray(cards) || cards.length === 0) return [];
    
    const batchSize = 20;
    const newBatches = [];
    
    for (let i = 0; i < cards.length; i += batchSize) {
      newBatches.push(cards.slice(i, i + batchSize));
    }
    
    return newBatches;
  };

  // Initialize spaced learning
  const initialize = () => {
    if (!isEnabled || allCards.length < 20) {
      onSessionCardsUpdate?.(allCards);
      onCurrentIndexUpdate?.(0);
      setInitialized(true);
      return;
    }

    // Filter out completed cards
    const incompleteCards = allCards.filter(card => !card._spacedLearningCompleted);
    
    if (incompleteCards.length === 0) {
      setBatches([]);
      setCurrentBatch(0);
      onSessionCardsUpdate?.([]);
      setInitialized(true);
      return;
    }

    const newBatches = createBatches(incompleteCards);
    setBatches(newBatches);
    setCurrentBatch(0);
    setCardsCompleted(0);
    
    if (newBatches.length > 0) {
      onSessionCardsUpdate?.(newBatches[0]);
      onCurrentIndexUpdate?.(0);
    }
    
    setInitialized(true);
  };

  // Initialize when cards or enabled state changes
  useEffect(() => {
    initialize();
  }, [allCards.length, isEnabled]);

  // Track card completion
  const trackCompletion = (cardId) => {
    const newCompleted = cardsCompleted + 1;
    setCardsCompleted(newCompleted);
    
    const currentBatchSize = batches[currentBatch]?.length || 0;
    
    if (newCompleted >= currentBatchSize) {
      handleBatchComplete();
    }
  };

  // Handle batch completion
  const handleBatchComplete = () => {
    // Mark current batch cards as completed
    if (batches[currentBatch]) {
      const updatedCards = allCards.map(card => {
        const isInBatch = batches[currentBatch].some(batchCard => batchCard.id === card.id);
        return isInBatch ? { ...card, _spacedLearningCompleted: true } : card;
      });
      onCardsUpdate?.(updatedCards);
    }
    
    // Show completion screen via window flag
    window.showSpacedLearningCompletion = {
      completed: currentBatch + 1,
      total: batches.length,
      isLast: (currentBatch + 1) >= batches.length
    };
  };

  // Continue to next batch
  const continueNext = () => {
    window.showSpacedLearningCompletion = null;
    const nextBatch = currentBatch + 1;
    
    if (nextBatch < batches.length) {
      setCurrentBatch(nextBatch);
      setCardsCompleted(0);
      onSessionCardsUpdate?.(batches[nextBatch]);
      onCurrentIndexUpdate?.(0);
      onUIReset?.();
    } else {
      onToggle?.(false);
      onSessionCardsUpdate?.([]);
    }
  };

  // Reset everything
  const reset = () => {
    const resetCards = allCards.map(card => ({
      ...card,
      _spacedLearningCompleted: false,
      _mastered: false,
      _masterAgainSession: true
    }));
    
    onCardsUpdate?.(resetCards);
    window.showSpacedLearningCompletion = null;
    setInitialized(false);
  };

  // Expose methods
  useEffect(() => {
    ref.current = {
      handleBatchCompletion: handleBatchComplete,
      trackCardCompletion: trackCompletion,
      resetSpacedLearning: reset,
      continueToNextBatch: continueNext,
      getCurrentBatchInfo: () => ({
        currentBatchIndex: currentBatch,
        totalBatches: batches.length,
        sessionProgress: {
          cardsCompleted,
          totalCards: batches[currentBatch]?.length || 0
        }
      })
    };
    
    window.spacedLearningRef = ref;
    window.spacedLearningEnabled = isEnabled;
    
    return () => {
      window.spacedLearningRef = null;
      window.spacedLearningEnabled = false;
    };
  }, [batches, currentBatch, cardsCompleted, allCards, isEnabled]);

  // RENDER NOTHING - This component is LOGIC ONLY
  return null;
};

export default SpacedLearning;