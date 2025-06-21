// src/components/FlashcardStudyPage.jsx - Production-safe version
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

const getCardType = (card, deckType) => {
  return card.card_type || deckType;
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

  useEffect(() => {
    if (id) {
      fetchFlashcardSet(id);
    }
  }, [id]);

  const fetchFlashcardSet = async (setId) => {
    try {
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
      
      // Initialize imported cards properly - they should NOT be considered mastered
      const cardsWithMasteryStatus = cards.map(card => ({
        ...card,
        _mastered: false,
        _isImported: true
      }));
      
      setAllCards(cardsWithMasteryStatus);
      setSessionCards(cardsWithMasteryStatus);
      setCurrentIndex(0);
      
      const stats = getStudyStats(cardsWithMasteryStatus);
      setStudyStats(stats);
      
    } catch (error) {
      console.error("Error in fetchFlashcardSet");
    }
  };

  const handleMasterAgain = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user?.id || allCards.length === 0) {
      return;
    }
    
    const resetCards = allCards.map(card => ({
      ...card,
      _masterAgainSession: true,
      _mastered: false,
      session_failures: 0,
      session_reviews: 0
    }));
    
    setSessionCards(resetCards);
    setIsMasterAgainSession(true);
    setCurrentIndex(0);
    setShowBack(false);
    setShowCorrectAnswer(false);
    setIsAnswerCorrect(null);
    setUserAnswer('');
    setSessionReviewCount(0);
  };

  const getIntervalPreviewsForCard = () => {
    if (sessionCards.length === 0 || currentIndex >= sessionCards.length || !sessionCards[currentIndex]) {
      return { again: "30s", hard: "10m", good: "1d", easy: "4d" };
    }

    const currentCard = sessionCards[currentIndex];
    return getIntervalPreviewsFixed(currentCard, IMMEDIATE_REVIEW_SETTINGS);
  };

  if (sessionCards.length === 0 && allCards.length === 0) {
    return (
      <div className="study-container">
        <div className="loading-study">
          <div className="loading-spinner"></div>
          <p>Loading cards...</p>
        </div>
      </div>
    );
  }

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

  const currentCard = sessionCards.length > 0 && currentIndex < sessionCards.length ? sessionCards[currentIndex] : null;
  
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

  const handleShowAnswer = () => setShowBack(true);

  const handleSubmitAnswer = () => {
    if (currentCardType !== 'Basic-Type' || !currentCard) return;
    
    const correctAnswer = currentCard.back.replace(/<[^>]*>/g, '').trim().toLowerCase();
    const userAnswerClean = userAnswer.trim().toLowerCase();
    
    const isCorrect = correctAnswer === userAnswerClean;
    setIsAnswerCorrect(isCorrect);
    setShowCorrectAnswer(true);
  };

  // Enhanced difficulty choice handling with minimal logging
  const handleDifficultyChoice = async (difficulty) => {
    if (!currentCard || !user?.id) {
      console.error('Missing card or user for difficulty choice');
      return;
    }
    
    const currentCardData = currentCard;
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

      const newAllCards = allCards.map(card => 
        card.id === currentCardData.id ? updatedCard : card
      );
      setAllCards(newAllCards);

      if (difficulty === 'easy') {
        // Mark card as mastered and remove from session
        const newSessionCards = sessionCards.filter((_, index) => index !== currentIndex);
        setSessionCards(newSessionCards);
        
        // Update the card in allCards to mark it as mastered
        const newAllCards = allCards.map(card => 
          card.id === currentCardData.id ? { ...updatedCard, _mastered: true } : card
        );
        setAllCards(newAllCards);
        
        if (newSessionCards.length === 0) {
          setShowCompletionPopup(true);
          setTimeout(() => setShowCompletionPopup(false), 2000);
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
        
      } else {
        const nextIndex = (currentIndex + 1) % sessionCards.length;
        setCurrentIndex(nextIndex);
      }

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

  const processClozeText = (text, isRevealed, activeClozeDeletion = 1) => {
    if (currentCardType !== "Cloze") return text;
    
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
        </div>
      </div>

      <div className="study-mode-selector">
        <button 
          className="speed-focus-btn"
          onClick={() => navigate(`/speed/${id}`)}
          title="Speed Focus Mode - Test your knowledge under time pressure!"
        >
          ⚡ Speed Focus Mode
        </button>
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
    </div>
  );
}