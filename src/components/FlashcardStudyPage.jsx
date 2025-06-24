// src/components/FlashcardStudyPage.jsx - FULLY FIXED: Proper Progress Restoration on Refresh
import React, { useState, useEffect, useContext, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import AudioPlayer from "./AudioPlayer";
import ResetSessionModal from "./ResetSessionModal";
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

  // Study session persistence state
  const [studySessionId, setStudySessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // FIXED: Add mastered cards tracking with proper restoration
  const [masteredCardIds, setMasteredCardIds] = useState(new Set());
  
  // CRITICAL FIX: Add initialization flag to prevent duplicate session creation
  const [isInitialized, setIsInitialized] = useState(false);
  
  // CRITICAL FIX: Add a flag to track if we've restored saved progress
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);

  useEffect(() => {
    if (id && user?.id) {
      fetchFlashcardSet(id);
    }
  }, [id, user?.id]);

  // CRITICAL FIX: Load study progress from database with mastered cards
  const loadStudyProgress = useCallback(async () => {
    if (!user?.id || !id) {
      return null;
    }

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
  }, [user?.id, id]);

  // FIXED: Save study progress with mastered cards to database
  const saveStudyProgress = useCallback(async (cards, currentIdx, masteredIds = null) => {
    if (!user?.id || !id || !isInitialized) {
      return;
    }

    try {
      // Use passed masteredIds or current state, ensuring it's always fresh
      const currentMasteredIds = masteredIds || Array.from(masteredCardIds);
      
      const progressData = {
        user_id: user.id,
        set_id: id,
        session_cards: cards.map(card => card.id),
        current_index: currentIdx,
        completed_cards: currentMasteredIds,
        batch_index: currentBatchIndex,
        is_spaced_learning: spacedLearningEnabled,
        mastered_cards: currentMasteredIds,
        updated_at: new Date().toISOString()
      };

      if (studySessionId) {
        const { error } = await supabase
          .from('study_sessions')
          .update(progressData)
          .eq('id', studySessionId);

        if (error) {
          console.error('Error updating study progress:', error);
        }
      } else {
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
  }, [user?.id, id, currentBatchIndex, spacedLearningEnabled, masteredCardIds, studySessionId, isInitialized]);

  // Clear study progress (when session is complete)
  const clearStudyProgress = useCallback(async () => {
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
  }, [studySessionId]);

  // CRITICAL FIX: Fetch flashcard set with proper initialization order
  const fetchFlashcardSet = useCallback(async (setId) => {
    try {
      setLoading(true);
      setIsInitialized(false);

      const { data: setData, error: setError } = await supabase
        .from("flashcard_sets")
        .select("*")
        .eq("id", setId)
        .single();

      if (setError) {
        console.error("Error fetching flashcard set:", setError);
        return;
      }

      setDeckType(setData.type);
      setSetTitle(setData.title);

      const { data, error } = await supabase
        .from("flashcard_cards")
        .select("*")
        .eq("set_id", setId);

      if (error) {
        console.error("Error fetching flashcards:", error);
        return;
      }

      const cards = data || [];
      const savedProgress = await loadStudyProgress();
      
      if (savedProgress && savedProgress.session_cards?.length > 0) {
        const savedMasteredCards = new Set(savedProgress.mastered_cards || []);
        setMasteredCardIds(savedMasteredCards);
        setHasRestoredProgress(true);
        
        const restoredAllCards = cards.map(card => ({
          ...card,
          _mastered: savedMasteredCards.has(card.id),
          _isImported: true
        }));
        
        const unmastered = restoredAllCards.filter(card => !savedMasteredCards.has(card.id));
        const savedSessionCards = unmastered.filter(card => 
          savedProgress.session_cards.includes(card.id)
        );
        
        setAllCards(restoredAllCards);
        setSessionCards(savedSessionCards);
        setCurrentIndex(Math.min(savedProgress.current_index || 0, Math.max(0, savedSessionCards.length - 1)));
        setStudySessionId(savedProgress.id);
        
        if (savedProgress.is_spaced_learning) {
          setSpacedLearningEnabled(true);
          setCurrentBatchIndex(savedProgress.batch_index || 0);
          
          const batches = [];
          for (let i = 0; i < unmastered.length; i += 20) {
            batches.push(unmastered.slice(i, i + 20));
          }
          setSpacedLearningBatches(batches);
        }
        
      } else {
        const cardsWithMasteryStatus = cards.map(card => ({
          ...card,
          _mastered: false,
          _isImported: true
        }));
        
        setMasteredCardIds(new Set());
        setHasRestoredProgress(true);
        setAllCards(cardsWithMasteryStatus);
        
        if (cardsWithMasteryStatus.length >= 20) {
          setSpacedLearningEnabled(true);
          const batches = [];
          for (let i = 0; i < cardsWithMasteryStatus.length; i += 20) {
            batches.push(cardsWithMasteryStatus.slice(i, i + 20));
          }
          setSpacedLearningBatches(batches);
          setCurrentBatchIndex(0);
          setSessionCards(batches[0]);
        } else {
          setSessionCards(cardsWithMasteryStatus);
        }
        
        setCurrentIndex(0);
      }
      
      setIsInitialized(true);
      
    } catch (error) {
      console.error("Error in fetchFlashcardSet:", error);
    } finally {
      setLoading(false);
    }
  }, [loadStudyProgress]);

  // Modal management functions
  const handleResetSession = useCallback(() => {
    setShowResetModal(true);
  }, []);

  const handleCloseResetModal = useCallback(() => {
    setShowResetModal(false);
  }, []);

  const confirmResetSession = useCallback(async () => {
    setResetLoading(true);
    
    try {
      await clearStudyProgress();
      
      const resetCards = allCards.map(card => ({
        ...card,
        _mastered: false,
        _isImported: true,
        session_failures: 0,
        session_reviews: 0,
        _masterAgainSession: false
      }));
      
      setAllCards(resetCards);
      setMasteredCardIds(new Set());
      
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
      
    } catch (error) {
      console.error('Error resetting session:', error);
      alert('Failed to reset session. Please try again.');
    } finally {
      setResetLoading(false);
    }
  }, [allCards, spacedLearningEnabled, clearStudyProgress]);

  const handleMasterAgain = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user?.id || allCards.length === 0) {
      return;
    }
    
    await clearStudyProgress();
    
    const resetCards = allCards.map(card => ({
      ...card,
      _masterAgainSession: true,
      _mastered: false,
      session_failures: 0,
      session_reviews: 0
    }));
    
    setAllCards(resetCards);
    setMasteredCardIds(new Set());
    
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

  const handleDifficultyChoice = async (difficulty) => {
    if (!sessionCards[currentIndex] || !user?.id || !isInitialized) {
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

      if (!basicError) {
        try {
          const trackingSuccess = await trackReview(currentUserId, isMasterAgainSession);
          if (trackingSuccess) {
            setSessionReviewCount(prev => prev + 1);
          }
        } catch (trackingError) {
          console.error('Heatmap tracking error');
        }
      }

      // STEP 2: Session management with proper mastered cards handling
      const updatedCard = {
        ...currentCardData,
        last_reviewed: now,
        reviews: (currentCardData.reviews || 0) + 1
      };

      if (difficulty === 'easy') {
        // Create new mastered set with this card added
        const newMasteredCardIds = new Set(masteredCardIds);
        newMasteredCardIds.add(currentCardData.id);
        const masteredArray = Array.from(newMasteredCardIds);
        
        // Update states
        const newAllCards = allCards.map(card => 
          card.id === currentCardData.id ? { ...updatedCard, _mastered: true } : card
        );
        const newSessionCards = sessionCards.filter((_, index) => index !== currentIndex);
        
        setMasteredCardIds(newMasteredCardIds);
        setAllCards(newAllCards);
        setSessionCards(newSessionCards);
        
        // Save progress immediately with the fresh mastered array
        await saveStudyProgress(newSessionCards, Math.min(currentIndex, newSessionCards.length - 1), masteredArray);
        
        if (newSessionCards.length === 0) {
          await clearStudyProgress();
          
          if (spacedLearningEnabled && currentBatchIndex + 1 < spacedLearningBatches.length) {
            setBatchCompletionModal({
              completed: currentBatchIndex + 1,
              total: spacedLearningBatches.length
            });
          } else {
            setShowCompletionPopup(true);
            setTimeout(() => setShowCompletionPopup(false), 2000);
          }
          return;
        }
        
        const nextIndex = currentIndex >= newSessionCards.length ? 0 : currentIndex;
        setCurrentIndex(nextIndex);
        
      } else if (difficulty === 'again') {
        const newSessionCards = [...sessionCards];
        const moveToPosition = Math.min(currentIndex + 3, newSessionCards.length - 1);
        
        if (moveToPosition !== currentIndex && newSessionCards.length > 3) {
          const [cardToMove] = newSessionCards.splice(currentIndex, 1);
          newSessionCards.splice(moveToPosition, 0, cardToMove);
        }
        
        setSessionCards(newSessionCards);
        const nextIndex = currentIndex >= newSessionCards.length ? 0 : currentIndex;
        setCurrentIndex(nextIndex);
        
        await saveStudyProgress(newSessionCards, nextIndex);
        
      } else {
        const nextIndex = (currentIndex + 1) % sessionCards.length;
        setCurrentIndex(nextIndex);
        
        await saveStudyProgress(sessionCards, nextIndex);
      }

      const newAllCards = allCards.map(card => 
        card.id === currentCardData.id ? updatedCard : card
      );
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
    
    const completedCardIds = Array.from(masteredCardIds);
    await saveStudyProgress(spacedLearningBatches[nextBatchIndex], 0, completedCardIds);
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
              ? `You've completed all ${batchCompletionModal.total} sessions! Mastered ${masteredCardIds.size} cards.`
              : `Session ${batchCompletionModal.completed} of ${batchCompletionModal.total} complete. Mastered ${masteredCardIds.size} cards so far. Ready for the next 20 cards?`
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

  // Loading state - WAIT until both loading is false AND progress is restored
  if (loading || !isInitialized || !hasRestoredProgress) {
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
          <p>Congratulations! You've marked every single card as "Easy" - you've truly mastered this deck! All {allCards.length} cards have been successfully completed. You mastered {masteredCardIds.size} cards in this session!</p>
         
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
            <span className="count">{masteredCardIds.size}</span>
            <span className="label">Mastered</span>
          </div>
        </div>
      </div>

      <div className="study-mode-selector">
        {spacedLearningEnabled ? (
          <div className="study-mode-with-reset">
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
            <button 
              className="reset-session-mode-btn"
              onClick={handleResetSession}
              title="Reset all progress and start fresh"
            >
              🔄 Reset Session
            </button>
          </div>
        ) : (
          <div className="study-mode-with-reset">
            <button 
              className="speed-focus-btn"
              onClick={() => navigate(`/speed/${id}`)}
              title="Speed Focus Mode - Test your knowledge under time pressure!"
            >
              ⚡ Speed Focus Mode
            </button>
            <button 
              className="reset-session-mode-btn"
              onClick={handleResetSession}
              title="Reset all progress and start fresh"
            >
              🔄 Reset Session
            </button>
          </div>
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

      {/* Reset Modal */}
      <ResetSessionModal
        isOpen={showResetModal}
        onClose={handleCloseResetModal}
        onConfirm={confirmResetSession}
        isLoading={resetLoading}
      />
    </div>
  );
}