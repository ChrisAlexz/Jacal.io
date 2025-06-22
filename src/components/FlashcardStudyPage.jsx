// src/components/FlashcardStudyPage.jsx - ENHANCED WITH PROGRESS PERSISTENCE
import React, { useState, useEffect, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import AudioPlayer from "./AudioPlayer";
import UserAuthContext from './context/UserAuthContext';
import { trackReview, trackStudySession } from '../utils/heatmapTracking';
import { 
  calculateNextReview, 
  getDueCards, 
  getStudyStats, 
  getIntervalPreviews,
  shouldRemoveFromSession,
  DEFAULT_SETTINGS,
  CARD_STATES,
  IMMEDIATE_REVIEW_SETTINGS,
  calculateNextReviewWithImmediate,
  getIntervalPreviewsFixed
} from "../utils/SpacedRepetition";

import "../styles/FlashcardStudyPage.css";

// Helper functions moved to top for better organization
const getCardType = (card, deckType) => {
  return card.card_type || deckType;
};

const processClozeText = (text, isRevealed, activeClozeDeletion = 1) => {
  if (!text) return '';
  
  let processedText = text;
  const clozePattern = /{{c(\d+)::(.*?)}}/g;
  
  processedText = processedText.replace(clozePattern, (match, clozeNumber, clozeText) => {
    const clozeNum = parseInt(clozeNumber);
    
    if (isRevealed) {
      if (clozeNum === activeClozeDeletion) {
        return `<span class="cloze-revealed-active">${clozeText}</span>`;
      } else {
        return `<span class="cloze-revealed-inactive">${clozeText}</span>`;
      }
    } else {
      if (clozeNum === activeClozeDeletion) {
        return `<span class="cloze-question">[...]</span>`;
      } else {
        return `<span class="cloze-other">${clozeText}</span>`;
      }
    }
  });
  
  return processedText;
};

export default function FlashcardStudyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(UserAuthContext);
  
  const [allCards, setAllCards] = useState([]);
  const [sessionCards, setSessionCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [deckType, setDeckType] = useState("Basic");
  const [setTitle, setSetTitle] = useState("");
  const [studyStats, setStudyStats] = useState(null);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState(null);
  const [isMasterAgainSession, setIsMasterAgainSession] = useState(false);
  const [sessionReviewCount, setSessionReviewCount] = useState(0);

  // MINIMAL SPACED LEARNING - just a few variables
  const [spacedLearningBatches, setSpacedLearningBatches] = useState([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [spacedLearningEnabled, setSpacedLearningEnabled] = useState(false);
  const [batchCompletionModal, setBatchCompletionModal] = useState(null);

  // NEW: Study session persistence state
  const [studySessionId, setStudySessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    if (id) {
      fetchFlashcardSet(id);
    }
  }, [id]);

  // NEW: Save study progress to database
  const saveStudyProgress = async (cards, currentIdx, completedCardIds = []) => {
    if (!user?.id || !id) return;

    try {
      const progressData = {
        user_id: user.id,
        set_id: id,
        session_cards: cards.map(card => card.id),
        current_index: currentIdx,
        completed_cards: completedCardIds,
        batch_index: currentBatchIndex,
        is_spaced_learning: spacedLearningEnabled,
        updated_at: new Date().toISOString()
      };

      if (studySessionId) {
        // Update existing session
        const { error } = await supabase
          .from('study_sessions')
          .update(progressData)
          .eq('id', studySessionId);

        if (error) {
          console.error('Error updating study progress:', error);
        }
      } else {
        // Create new session
        const { data, error } = await supabase
          .from('study_sessions')
          .insert([progressData])
          .select()
          .single();

        if (error) {
          console.error('Error creating study session:', error);
        } else if (data) {
          setStudySessionId(data.id);
        }
      }
    } catch (error) {
      console.error('Error saving study progress:', error);
    }
  };

  // NEW: Load study progress from database
  const loadStudyProgress = async () => {
    if (!user?.id || !id) return null;

    try {
      const { data, error } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('set_id', id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading study progress:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in loadStudyProgress:', error);
      return null;
    }
  };

  // NEW: Clear study progress (when session is complete)
  const clearStudyProgress = async () => {
    if (!studySessionId) return;

    try {
      const { error } = await supabase
        .from('study_sessions')
        .delete()
        .eq('id', studySessionId);

      if (error) {
        console.error('Error clearing study progress:', error);
      } else {
        setStudySessionId(null);
      }
    } catch (error) {
      console.error('Error in clearStudyProgress:', error);
    }
  };

  const fetchFlashcardSet = async (setId) => {
    try {
      setLoading(true);

      const { data: setData, error: setError } = await supabase
        .from("flashcard_sets")
        .select("*")
        .eq("id", setId)
        .single();

      if (setError) {
        console.error("Error fetching flashcard set");
        return;
      }

      if (setData) {
        setDeckType(setData.type);
        setSetTitle(setData.title);
      }

      const { data, error } = await supabase
        .from("flashcard_cards")
        .select("*")
        .eq("set_id", setId);

      if (error) {
        console.error("Error fetching flashcards");
        return;
      }

      const cards = data || [];
      
      // Initialize cards with mastery status
      const cardsWithMasteryStatus = cards.map(card => ({
        ...card,
        _mastered: false,
        _isImported: true
      }));
      
      setAllCards(cardsWithMasteryStatus);

      // NEW: Try to load saved progress
      const savedProgress = await loadStudyProgress();
      
      if (savedProgress && savedProgress.session_cards?.length > 0) {
        console.log('📖 Loading saved study progress...');
        
        // Restore session from saved progress
        const savedSessionCards = cardsWithMasteryStatus.filter(card => 
          savedProgress.session_cards.includes(card.id)
        );
        
        // Mark completed cards as mastered
        const restoredCards = cardsWithMasteryStatus.map(card => ({
          ...card,
          _mastered: savedProgress.completed_cards?.includes(card.id) || false
        }));
        
        setAllCards(restoredCards);
        setSessionCards(savedSessionCards);
        setCurrentIndex(Math.min(savedProgress.current_index || 0, savedSessionCards.length - 1));
        setStudySessionId(savedProgress.id);
        
        if (savedProgress.is_spaced_learning) {
          setSpacedLearningEnabled(true);
          setCurrentBatchIndex(savedProgress.batch_index || 0);
          
          // Recreate batches
          const batches = [];
          for (let i = 0; i < restoredCards.length; i += 20) {
            batches.push(restoredCards.slice(i, i + 20));
          }
          setSpacedLearningBatches(batches);
        }
        
        console.log('✅ Study progress restored');
      } else {
        // Start new session
        console.log('🆕 Starting new study session...');
        
        // SIMPLE: If 20+ cards, enable spaced learning and create batches
        if (cardsWithMasteryStatus.length >= 20) {
          setSpacedLearningEnabled(true);
          const batches = [];
          for (let i = 0; i < cardsWithMasteryStatus.length; i += 20) {
            batches.push(cardsWithMasteryStatus.slice(i, i + 20));
          }
          setSpacedLearningBatches(batches);
          setCurrentBatchIndex(0);
          setSessionCards(batches[0]); // Start with first batch
        } else {
          setSessionCards(cardsWithMasteryStatus); // Normal mode
        }
      }
      
      setCurrentIndex(0);
      
      const stats = getStudyStats(cardsWithMasteryStatus);
      setStudyStats(stats);
      
    } catch (error) {
      console.error("Error in fetchFlashcardSet");
    } finally {
      setLoading(false);
    }
  };

  const handleMasterAgain = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user?.id || allCards.length === 0) {
      return;
    }
    
    // Clear saved progress when starting over
    await clearStudyProgress();
    
    const resetCards = allCards.map(card => ({
      ...card,
      _masterAgainSession: true,
      _mastered: false,
      session_failures: 0,
      session_reviews: 0
    }));
    
    setAllCards(resetCards);
    
    // SIMPLE: Reset spaced learning
    if (spacedLearningEnabled) {
      const batches = [];
      for (let i = 0; i < resetCards.length; i += 20) {
        batches.push(resetCards.slice(i, i + 20));
      }
      setSpacedLearningBatches(batches);
      setCurrentBatchIndex(0);
      setSessionCards(batches[0]);
    } else {
      setSessionCards(resetCards);
    }
    
    setIsMasterAgainSession(true);
    setCurrentIndex(0);
    setShowBack(false);
    setShowCorrectAnswer(false);
    setIsAnswerCorrect(null);
    setUserAnswer('');
    setSessionReviewCount(0);
    setBatchCompletionModal(null);
  };

  const getIntervalPreviewsForCard = () => {
    if (sessionCards.length === 0 || currentIndex >= sessionCards.length || !sessionCards[currentIndex]) {
      return { again: "30s", hard: "10m", good: "1d", easy: "4d" };
    }

    const currentCard = sessionCards[currentIndex];
    return getIntervalPreviewsFixed(currentCard, IMMEDIATE_REVIEW_SETTINGS);
  };

  const handleShowAnswer = () => setShowBack(true);

  const handleSubmitAnswer = () => {
    const currentCard = sessionCards[currentIndex];
    const currentCardType = getCardType(currentCard, deckType);
    
    if (currentCardType !== 'Basic-Type' || !currentCard) return;
    
    const correctAnswer = currentCard.back.replace(/<[^>]*>/g, '').trim().toLowerCase();
    const userAnswerClean = userAnswer.trim().toLowerCase();
    
    const isCorrect = correctAnswer === userAnswerClean;
    setIsAnswerCorrect(isCorrect);
    setShowCorrectAnswer(true);
  };

  // ENHANCED: handleDifficultyChoice with progress persistence
  const handleDifficultyChoice = async (difficulty) => {
    if (!sessionCards[currentIndex] || !user?.id) {
      console.error('Missing card or user for difficulty choice');
      return;
    }
    
    const currentCardData = sessionCards[currentIndex];
    const now = new Date().toISOString();
    const currentUserId = user.id;
    
    try {
      // STEP 1: Update card in database
      const basicUpdate = {
        last_reviewed: now,
        reviews: (currentCardData.reviews || 0) + 1
      };

      const { error: basicError } = await supabase
        .from('flashcard_cards')
        .update(basicUpdate)
        .eq('id', currentCardData.id);

      if (basicError) {
        console.error('Database update failed');
      } else {
        // STEP 2: Track in heatmap (ONLY ONCE per card review)
        try {
          const trackingSuccess = await trackReview(currentUserId, isMasterAgainSession);
          if (trackingSuccess) {
            setSessionReviewCount(prev => prev + 1);
          }
        } catch (trackingError) {
          console.error('Heatmap tracking error');
        }
      }

      // STEP 3: Session management
      const updatedCard = {
        ...currentCardData,
        last_reviewed: now,
        reviews: (currentCardData.reviews || 0) + 1
      };

      let newAllCards = allCards.map(card => 
        card.id === currentCardData.id ? updatedCard : card
      );
      
      let newSessionCards = [...sessionCards];
      let completedCardIds = allCards.filter(card => card._mastered).map(card => card.id);

      if (difficulty === 'easy') {
        // Mark card as mastered and remove from session
        newSessionCards = sessionCards.filter((_, index) => index !== currentIndex);
        
        // Update the card in allCards to mark it as mastered
        newAllCards = allCards.map(card => 
          card.id === currentCardData.id ? { ...updatedCard, _mastered: true } : card
        );
        
        // Add to completed cards
        completedCardIds.push(currentCardData.id);
        
        setAllCards(newAllCards);
        setSessionCards(newSessionCards);
        
        // NEW: Save progress after marking as easy
        await saveStudyProgress(newSessionCards, currentIndex, completedCardIds);
        
        // SIMPLE: Check if batch is complete
        if (newSessionCards.length === 0) {
          // Clear progress when session/batch is complete
          await clearStudyProgress();
          
          if (spacedLearningEnabled && currentBatchIndex + 1 < spacedLearningBatches.length) {
            // Show batch completion modal
            setBatchCompletionModal({
              completed: currentBatchIndex + 1,
              total: spacedLearningBatches.length
            });
          } else {
            // Regular completion
            setShowCompletionPopup(true);
            setTimeout(() => setShowCompletionPopup(false), 2000);
          }
          return;
        }
        
        const nextIndex = currentIndex >= newSessionCards.length ? 0 : currentIndex;
        setCurrentIndex(nextIndex);
        
      } else if (difficulty === 'again') {
        const moveToPosition = Math.min(currentIndex + 3, newSessionCards.length - 1);
        
        if (moveToPosition !== currentIndex && newSessionCards.length > 3) {
          const [cardToMove] = newSessionCards.splice(currentIndex, 1);
          newSessionCards.splice(moveToPosition, 0, cardToMove);
        }
        
        setSessionCards(newSessionCards);
        const nextIndex = currentIndex >= newSessionCards.length ? 0 : currentIndex;
        setCurrentIndex(nextIndex);
        
        // NEW: Save progress after again
        await saveStudyProgress(newSessionCards, nextIndex, completedCardIds);
        
      } else {
        const nextIndex = (currentIndex + 1) % sessionCards.length;
        setCurrentIndex(nextIndex);
        
        // NEW: Save progress after hard/good
        await saveStudyProgress(newSessionCards, nextIndex, completedCardIds);
      }

      setAllCards(newAllCards);

      // Reset UI state
      setShowBack(false);
      setShowCorrectAnswer(false);
      setIsAnswerCorrect(null);
      setUserAnswer('');

    } catch (error) {
      console.error('Error in handleDifficultyChoice');
      alert('There was an error processing your answer.');
    }
  };

  // SIMPLE: Continue to next batch
  const continueToNextBatch = async () => {
    const nextBatchIndex = currentBatchIndex + 1;
    setCurrentBatchIndex(nextBatchIndex);
    setSessionCards(spacedLearningBatches[nextBatchIndex]);
    setCurrentIndex(0);
    setShowBack(false);
    setShowCorrectAnswer(false);
    setIsAnswerCorrect(null);
    setUserAnswer('');
    setBatchCompletionModal(null);
    
    // NEW: Save progress for new batch
    const completedCardIds = allCards.filter(card => card._mastered).map(card => card.id);
    await saveStudyProgress(spacedLearningBatches[nextBatchIndex], 0, completedCardIds);
  };

  // NEW: Reset Session function - clears all progress and starts fresh
  const handleResetSession = async () => {
    setShowResetModal(true);
  };

  // NEW: Confirm reset function
  const confirmResetSession = async () => {
    try {
      // Clear saved progress from database
      await clearStudyProgress();
      
      // Reset all cards to unmastered state and clear session tracking
      const resetCards = allCards.map(card => ({
        ...card,
        _mastered: false,
        _isImported: true,
        session_failures: 0,
        session_reviews: 0,
        _masterAgainSession: false
      }));
      
      setAllCards(resetCards);
      
      // Reset spaced learning if enabled
      if (spacedLearningEnabled) {
        const batches = [];
        for (let i = 0; i < resetCards.length; i += 20) {
          batches.push(resetCards.slice(i, i + 20));
        }
        setSpacedLearningBatches(batches);
        setCurrentBatchIndex(0);
        setSessionCards(batches[0]);
      } else {
        setSessionCards(resetCards);
      }
      
      // Reset UI state
      setCurrentIndex(0);
      setShowBack(false);
      setShowCorrectAnswer(false);
      setIsAnswerCorrect(null);
      setUserAnswer('');
      setSessionReviewCount(0);
      setIsMasterAgainSession(false);
      setBatchCompletionModal(null);
      setStudySessionId(null);
      setShowResetModal(false);
      
      console.log('✅ Session reset successfully');
      
      // Optional: Show brief confirmation
      setShowCompletionPopup(true);
      setTimeout(() => setShowCompletionPopup(false), 1500);
      
    } catch (error) {
      console.error('Error resetting session:', error);
      alert('Failed to reset session. Please try again.');
    }
  };

  // SIMPLE: Batch completion modal
  if (batchCompletionModal) {
    const isLast = batchCompletionModal.completed >= batchCompletionModal.total;
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '40px',
          maxWidth: '500px',
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}>
          <h2 style={{ margin: '0 0 20px 0', color: '#333', fontSize: '1.5rem' }}>
            {isLast ? 'All Sessions Complete!' : `Session ${batchCompletionModal.completed} Complete!`}
          </h2>
          <p style={{ margin: '0 0 30px 0', color: '#666', lineHeight: '1.5' }}>
            {isLast 
              ? `You've completed all ${batchCompletionModal.total} sessions!`
              : `Session ${batchCompletionModal.completed} of ${batchCompletionModal.total} complete. Ready for the next 20 cards?`
            }
          </p>
          
          <div style={{ 
            display: 'flex', 
            gap: '15px', 
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <button 
              style={{
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '1rem',
                cursor: 'pointer'
              }}
              onClick={() => navigate(-1)}
            >
              Back to Sets
            </button>
            {!isLast && (
              <button 
                style={{
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
                onClick={continueToNextBatch}
              >
                Continue to Next Session
              </button>
            )}
            {isLast && (
              <button 
                style={{
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontSize: '1rem',
                  cursor: 'pointer'
                }}
                onClick={handleMasterAgain}
              >
                Study Again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading || (sessionCards.length === 0 && allCards.length === 0)) {
    return (
      <div className="study-container">
        <div className="loading-study">
          <div className="loading-spinner"></div>
          <p>Loading cards...</p>
        </div>
      </div>
    );
  }

  // Completion state
  if (sessionCards.length === 0 && allCards.length > 0) {
    return (
      <div className="study-container">
        <div className="study-completion">
          <div className="completion-icon">🎉</div>
          <h2>Perfect! All Cards Mastered!</h2>
          <p>Congratulations! You've marked every single card as "Easy" - you've truly mastered this deck! All {allCards.length} cards have been successfully completed.</p>
         
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
      </div>
    );
  }

  const currentCard = sessionCards[currentIndex];
  
  if (!currentCard) {
    return (
      <div className="study-container">
        <div className="loading-study">
          <div className="loading-spinner"></div>
          <p>Loading cards...</p>
        </div>
      </div>
    );
  }
  
  const currentCardType = getCardType(currentCard, deckType);
  
  const hasCustomBackContent =
    currentCardType === "Cloze" &&
    currentCard.back !== currentCard.front &&
    currentCard.back.trim() !== "";

  const isImageOcclusionCard = currentCard.front && (
    currentCard.front.includes('image-occlusion-card') || 
    currentCard.front.includes('occlusion-') ||
    currentCardType === 'Image-Occlusion'
  );

  const intervalPreviews = getIntervalPreviewsForCard();

  return (
    <div className="study-container">
      {showCompletionPopup && (
        <div className="completion-popup">
          <div className="completion-popup-content">
            <div className="completion-popup-icon">🎉</div>
            <div className="completion-popup-text">
              <h3>Card Mastered!</h3>
              <p>Marked as Easy!</p>
            </div>
          </div>
        </div>
      )}

      <div className="study-header">
        <div className="study-info">
          <h1>{setTitle}</h1>
          <div className="progress-info">
            <span>{currentIndex + 1} / {sessionCards.length} cards remaining</span>
            {studySessionId && (
              <span style={{ 
                fontSize: '0.8rem', 
                color: '#4facfe', 
                marginLeft: '10px',
                opacity: 0.8 
              }}>
                📖 Progress saved
              </span>
            )}
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
            <span className="count">{allCards.filter(card => card._mastered === true).length}</span>
            <span className="label">Mastered</span>
          </div>
          
          {/* Reset Session Button */}
          <div className="stat-item reset-session">
            <button 
              className="reset-session-btn"
              onClick={handleResetSession}
              title="Reset all progress and start fresh"
            >
              <span className="count">🔄</span>
              <span className="label">Reset</span>
            </button>
          </div>
        </div>
      </div>

      <div className="study-mode-selector">
        {spacedLearningEnabled ? (
          <button 
            className="speed-focus-btn"
            style={{ 
              background: 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)',
              cursor: 'default'
            }}
            title="Spaced Learning Mode - Complete batches of 20 cards"
          >
            📚 Session {currentBatchIndex + 1} of {spacedLearningBatches.length} (20 cards per session)
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

      <div className="flashcard-study-box">
        <div className="flashcard-front">
          {isImageOcclusionCard ? (
            <div dangerouslySetInnerHTML={{ __html: currentCard.front }} />
          ) : currentCardType === "Cloze" ? (
            <div dangerouslySetInnerHTML={{ __html: processClozeText(currentCard.front, showBack, 1) }} />
          ) : (
            <div dangerouslySetInnerHTML={{ __html: currentCard.front }} />
          )}
        </div>

        {currentCard.front_audio_url && (
          <div className="card-audio front-audio" key={`front-audio-${currentCard.id}-${currentIndex}`}>
            <div style={{ padding: '12px', background: 'rgba(79, 172, 254, 0.1)', borderRadius: '8px' }}>
              <div style={{ marginBottom: '8px', color: '#4facfe', fontWeight: '600', fontSize: '0.9rem' }}>
                🎵 Front Audio
              </div>
              <audio controls style={{ width: '100%' }}>
                <source src={currentCard.front_audio_url} type="audio/webm" />
                <source src={currentCard.front_audio_url} type="audio/mp4" />
                <source src={currentCard.front_audio_url} type="audio/mpeg" />
                Your browser does not support audio playback.
              </audio>
            </div>
          </div>
        )}

        {currentCardType === 'Basic-Type' && !showCorrectAnswer && (
          <div className="type-answer-section">
            <input
              type="text"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Type your answer here..."
              className="answer-input"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && userAnswer.trim()) {
                  handleSubmitAnswer();
                }
              }}
              autoFocus
            />
            <button 
              className="submit-answer-btn" 
              onClick={handleSubmitAnswer}
              disabled={!userAnswer.trim()}
            >
              Submit Answer
            </button>
          </div>
        )}

        {currentCardType === 'Basic-Type' && showCorrectAnswer && (
          <div className="answer-results">
            <div className={`answer-feedback ${isAnswerCorrect ? 'correct' : 'incorrect'}`}>
              <span>{isAnswerCorrect ? '✅' : '❌'}</span>
              <span>{isAnswerCorrect ? 'Correct!' : 'Incorrect'}</span>
            </div>
            <div className="answer-comparison">
              <div className="user-answer">
                <strong>Your answer:</strong>
                <div>{userAnswer}</div>
              </div>
              <div className="correct-answer">
                <strong>Correct answer:</strong> 
                <div dangerouslySetInnerHTML={{ __html: currentCard.back }} />
              </div>
            </div>
            
            {currentCard.back_audio_url && (
              <div className="card-audio back-audio" key={`back-audio-basic-${currentCard.id}-${currentIndex}`}>
                <div style={{ padding: '12px', background: 'rgba(40, 167, 69, 0.1)', borderRadius: '8px' }}>
                  <div style={{ marginBottom: '8px', color: '#28a745', fontWeight: '600', fontSize: '0.9rem' }}>
                    🎵 Back Audio
                  </div>
                  <audio controls style={{ width: '100%' }}>
                    <source src={currentCard.back_audio_url} type="audio/webm" />
                    <source src={currentCard.back_audio_url} type="audio/mp4" />
                    <source src={currentCard.back_audio_url} type="audio/mpeg" />
                    Your browser does not support audio playback.
                  </audio>
                </div>
              </div>
            )}
            
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
          </div>
        )}

        {currentCardType !== 'Basic-Type' && !showBack && (
          <button className="show-answer-btn" onClick={handleShowAnswer}>
            Show Answer
          </button>
        )}

        {currentCardType !== 'Basic-Type' && showBack && (
          <>
            {isImageOcclusionCard && (
              <div className="flashcard-back">
                <div dangerouslySetInnerHTML={{ __html: currentCard.back }} />
              </div>
            )}
            
            {!isImageOcclusionCard && (currentCardType !== "Cloze" || hasCustomBackContent) && (
              <div className="flashcard-back">
                <div dangerouslySetInnerHTML={{ __html: currentCard.back }} />
              </div>
            )}

            {currentCard.back_audio_url && (
              <div className="card-audio back-audio" key={`back-audio-${currentCard.id}-${currentIndex}`}>
                <div style={{ padding: '12px', background: 'rgba(40, 167, 69, 0.1)', borderRadius: '8px' }}>
                  <div style={{ marginBottom: '8px', color: '#28a745', fontWeight: '600', fontSize: '0.9rem' }}>
                    🎵 Back Audio
                  </div>
                  <audio controls style={{ width: '100%' }}>
                    <source src={currentCard.back_audio_url} type="audio/webm" />
                    <source src={currentCard.back_audio_url} type="audio/mp4" />
                    <source src={currentCard.back_audio_url} type="audio/mpeg" />
                    Your browser does not support audio playback.
                  </audio>
                </div>
              </div>
            )}

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
          </>
        )}
      </div>

      {/* Custom Reset Confirmation Modal */}
      {showResetModal && (
        <div className="reset-modal-overlay">
          <div className="reset-modal-content">
            <div className="reset-modal-header">
              <div className="reset-modal-icon">⚠️</div>
              <h3>Reset Study Session</h3>
            </div>
            
            <div className="reset-modal-body">
              <p>This will permanently reset your progress:</p>
              <ul className="reset-modal-list">
                <li>Clear all mastered cards</li>
                <li>Reset session statistics</li>
                <li>Return to the first card</li>
                <li>Delete saved progress</li>
              </ul>
              <p className="reset-modal-warning">
                <strong>This action cannot be undone.</strong>
              </p>
            </div>
            
            <div className="reset-modal-actions">
              <button 
                className="reset-modal-cancel"
                onClick={() => setShowResetModal(false)}
              >
                Cancel
              </button>
              <button 
                className="reset-modal-confirm"
                onClick={confirmResetSession}
              >
                Reset Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}