// src/components/FlashcardStudyPage.jsx - COMPLETE FIXED VERSION WITH HEATMAP TRACKING

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { calculateNextReview, getDueCards, getStudyStats, shouldRemoveFromSession } from "../utils/SpacedRepetition";
import "../styles/FlashcardStudyPage.css";

export default function FlashcardStudyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // All cards from the deck
  const [allCards, setAllCards] = useState([]);
  
  // Cards currently in the study session
  const [sessionCards, setSessionCards] = useState([]);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [deckType, setDeckType] = useState("Basic");
  const [setTitle, setSetTitle] = useState("");
  const [studyStats, setStudyStats] = useState(null);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  
  // State for type-in-answer functionality
  const [userAnswer, setUserAnswer] = useState('');
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState(null);

  useEffect(() => {
    if (id) {
      fetchFlashcardSet(id);
    }
  }, [id]);

  const fetchFlashcardSet = async (setId) => {
    try {
      console.log(`Fetching flashcard set: ${setId}`);
      
      // First, get the flashcard set to determine its type
      const { data: setData, error: setError } = await supabase
        .from("flashcard_sets")
        .select("*")
        .eq("id", setId)
        .single();

      if (setError) {
        console.error("Error fetching flashcard set:", setError);
        return;
      }

      if (setData) {
        setDeckType(setData.type);
        setSetTitle(setData.title);
        console.log(`Loaded deck: ${setData.title} (Type: ${setData.type})`);
      }

      // Then, get the cards with spaced repetition data
      const { data, error } = await supabase
        .from("flashcard_cards")
        .select("*")
        .eq("set_id", setId);

      if (error) {
        console.error("Error fetching flashcards:", error);
        return;
      }

      const cards = data || [];
      console.log(`Loaded ${cards.length} cards`);
      setAllCards(cards);
      
      // Initialize session cards - get all cards that should be in current session
      const sessionDueCards = getDueCards(cards);
      console.log(`${sessionDueCards.length} cards due for study`);
      setSessionCards(sessionDueCards);
      setCurrentIndex(0);
      
      // Calculate study statistics
      const stats = getStudyStats(cards);
      setStudyStats(stats);
      
    } catch (error) {
      console.error("Error in fetchFlashcardSet:", error);
    }
  };

  // Calculate what the intervals would be for each button
  const getIntervalPreviews = () => {
    if (sessionCards.length === 0 || currentIndex >= sessionCards.length || !sessionCards[currentIndex]) {
      return { again: "1m", hard: "10m", good: "1d", easy: "4d" };
    }

    const currentCard = sessionCards[currentIndex];
    const previews = {};
    
    ['again', 'hard', 'good', 'easy'].forEach(rating => {
      try {
        const tempCard = calculateNextReview({ ...currentCard }, rating);
        
        let intervalText = "New";
        
        if (tempCard.due) {
          const now = new Date();
          const dueDate = new Date(tempCard.due);
          
          if (!isNaN(dueDate.getTime())) {
            const diffMs = dueDate.getTime() - now.getTime();
            const diffMinutes = Math.round(diffMs / (1000 * 60));
            
            if (diffMinutes <= 1) {
              intervalText = "1m";
            } else if (diffMinutes < 60) {
              intervalText = `${diffMinutes}m`;
            } else if (diffMinutes < 1440) {
              const hours = Math.round(diffMinutes / 60);
              intervalText = `${hours}h`;
            } else {
              const days = Math.round(diffMinutes / 1440);
              if (days >= 365) {
                const years = Math.round(days / 365);
                intervalText = `${years}y`;
              } else if (days >= 30) {
                const months = Math.round(days / 30);
                intervalText = `${months}mo`;
              } else {
                intervalText = `${days}d`;
              }
            }
          }
        }
        
        // Fallback intervals if calculation failed
        if (intervalText === "New" || intervalText === "Now") {
          const cardState = currentCard.state || 'new';
          
          if (cardState === 'new' || !cardState) {
            const newCardIntervals = {
              again: "1m", hard: "1m", good: "1m", easy: "4d"
            };
            intervalText = newCardIntervals[rating];
          } else if (cardState === 'learning') {
            const learningIntervals = {
              again: "1m", hard: "10m", good: "1d", easy: "4d"
            };
            intervalText = learningIntervals[rating];
          } else if (cardState === 'review') {
            const currentInterval = currentCard.interval_days || 1;
            const reviewIntervals = {
              again: "10m",
              hard: `${Math.max(1, Math.round(currentInterval * 1.2))}d`,
              good: `${Math.max(1, Math.round(currentInterval * 2.5))}d`,
              easy: `${Math.max(1, Math.round(currentInterval * 2.5 * 1.3))}d`
            };
            intervalText = reviewIntervals[rating];
          } else {
            const fallbackIntervals = { again: "1m", hard: "10m", good: "1d", easy: "4d" };
            intervalText = fallbackIntervals[rating];
          }
        }
        
        previews[rating] = intervalText;
      } catch (error) {
        console.error(`Error calculating interval for ${rating}:`, error);
        const fallbacks = { again: "1m", hard: "10m", good: "1d", easy: "4d" };
        previews[rating] = fallbacks[rating];
      }
    });
    
    return previews;
  };

  // Show loading only if we truly have no cards
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

  // Check if session is complete
  if (sessionCards.length === 0 && allCards.length > 0) {
    return (
      <div className="study-container">
        <div className="study-completion">
          <div className="completion-icon">🎉</div>
          <h2>Study Session Complete!</h2>
          <p>You've mastered all the cards in this session. Every card was marked as "Easy" - excellent work!</p>
          <div className="completion-actions">
            <button 
              className="back-button"
              onClick={() => navigate(-1)}
            >
              Back to Sets
            </button>
            <button 
              className="restart-button"
              onClick={() => {
                // Restart session with all cards
                const newSessionCards = getDueCards(allCards);
                setSessionCards(newSessionCards);
                setCurrentIndex(0);
                setShowBack(false);
                setShowCorrectAnswer(false);
                setIsAnswerCorrect(null);
                setUserAnswer('');
              }}
            >
              Study Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentCard = sessionCards.length > 0 && currentIndex < sessionCards.length ? sessionCards[currentIndex] : null;
  
  // Safety check - if no current card, show loading
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
  
  const hasCustomBackContent =
    deckType === "Cloze" &&
    currentCard.back !== currentCard.front &&
    currentCard.back.trim() !== "";

  // Check if this is an image occlusion card by looking at the HTML content
  const isImageOcclusionCard = currentCard.front.includes('image-occlusion-card') || 
                              currentCard.front.includes('occlusion-');

  // Get interval previews for current card
  const intervalPreviews = getIntervalPreviews();

  const handleShowAnswer = () => setShowBack(true);

  const handleSubmitAnswer = () => {
    if (deckType !== 'Basic-Type' || !currentCard) return;
    
    const correctAnswer = currentCard.back.replace(/<[^>]*>/g, '').trim().toLowerCase();
    const userAnswerClean = userAnswer.trim().toLowerCase();
    
    const isCorrect = correctAnswer === userAnswerClean;
    setIsAnswerCorrect(isCorrect);
    setShowCorrectAnswer(true);
  };

  const handleDifficultyChoice = async (difficulty) => {
    if (!currentCard) return;
    
    const currentCardData = currentCard;
    
    try {
      console.log(`Processing difficulty choice: ${difficulty} for card ${currentCardData.id}`);
      
      // Calculate next review using Anki algorithm
      const updatedCard = calculateNextReview(currentCardData, difficulty);
      
      // CRITICAL: Always update last_reviewed to current timestamp for heatmap tracking
      const now = new Date().toISOString();
      updatedCard.last_reviewed = now;
      
      console.log(`Card ${currentCardData.id} studied at ${now} with rating: ${difficulty}`);
      console.log(`Next due: ${updatedCard.due}, State: ${updatedCard.state}, Interval: ${updatedCard.interval_days} days`);
      
      // Update card in database - ENSURE last_reviewed is always set for heatmap
      const { error } = await supabase
        .from('flashcard_cards')
        .update({
          state: updatedCard.state,
          ease_factor: updatedCard.ease_factor,
          interval_days: updatedCard.interval_days,
          step: updatedCard.step,
          reviews: updatedCard.reviews,
          lapses: updatedCard.lapses,
          due: updatedCard.due,
          last_reviewed: now  // This is crucial for heatmap tracking
        })
        .eq('id', currentCardData.id);

      if (error) {
        console.error('Error updating card:', error);
        return;
      }

      console.log(`Successfully updated card ${currentCardData.id} in database`);

      // Update all cards state
      const newAllCards = allCards.map(card => 
        card.id === currentCardData.id ? updatedCard : card
      );
      setAllCards(newAllCards);

      // Check if this card should be removed from session
      if (shouldRemoveFromSession(updatedCard, difficulty)) {
        console.log(`Removing card from session (marked as ${difficulty})`);
        
        // Remove card from session
        const newSessionCards = sessionCards.filter((_, index) => index !== currentIndex);
        setSessionCards(newSessionCards);
        
        // Check if session is complete
        if (newSessionCards.length === 0) {
          console.log('Study session completed!');
          // Show completion popup briefly, then show completion screen
          setShowCompletionPopup(true);
          setTimeout(() => {
            setShowCompletionPopup(false);
          }, 2000);
          return;
        }
        
        // Adjust current index if needed
        const nextIndex = currentIndex >= newSessionCards.length ? 0 : currentIndex;
        setCurrentIndex(nextIndex);
      } else {
        console.log(`Keeping card in session (marked as ${difficulty})`);
        
        // Keep card in session, update it
        const newSessionCards = sessionCards.map((card, index) => 
          index === currentIndex ? updatedCard : card
        );
        setSessionCards(newSessionCards);
        
        // Move to next card (or loop back to start)
        const nextIndex = (currentIndex + 1) % sessionCards.length;
        setCurrentIndex(nextIndex);
      }

      // Update study stats
      const progressStats = getStudyStats(newAllCards);
      setStudyStats(progressStats);

      // Reset card state
      setShowBack(false);
      setShowCorrectAnswer(false);
      setIsAnswerCorrect(null);
      setUserAnswer('');

    } catch (error) {
      console.error('Error processing difficulty choice:', error);
    }
  };

  // Process cloze text for different card types (excluding Image Occlusion)
  const processClozeText = (text, isRevealed, activeClozeDeletion = 1) => {
    if (deckType !== "Cloze") return text;
    
    // Replace all cloze deletions with appropriate styling
    let processedText = text;
    
    // Find all cloze deletions (c1, c2, c3, etc.)
    const clozePattern = /{{c(\d+)::(.*?)}}/g;
    
    processedText = processedText.replace(clozePattern, (match, clozeNumber, clozeText) => {
      const clozeNum = parseInt(clozeNumber);
      
      if (isRevealed) {
        // When answer is revealed, show all cloze deletions with highlighting
        if (clozeNum === activeClozeDeletion) {
          return `<span class="cloze-revealed-active">${clozeText}</span>`;
        } else {
          return `<span class="cloze-revealed-inactive">${clozeText}</span>`;
        }
      } else {
        // When question is shown
        if (clozeNum === activeClozeDeletion) {
          // The active cloze deletion being tested - show as blue question
          return `<span class="cloze-question">[...]</span>`;
        } else {
          // Other cloze deletions - show the actual text but dimmed
          return `<span class="cloze-other">${clozeText}</span>`;
        }
      }
    });
    
    return processedText;
  };

  return (
    <div className="study-container">
      {/* Completion Popup */}
      {showCompletionPopup && (
        <div className="completion-popup">
          <div className="completion-popup-content">
            <div className="completion-popup-icon">🎉</div>
            <div className="completion-popup-text">
              <h3>Session Complete!</h3>
              <p>All cards have been studied!</p>
            </div>
          </div>
        </div>
      )}

      {/* Study Progress and Stats */}
      <div className="study-header">
        <div className="study-info">
          <h1>{setTitle}</h1>
          <div className="progress-info">
            <span>{currentIndex + 1} / {sessionCards.length} session cards</span>
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
            <span className="count">{allCards.length - sessionCards.length}</span>
            <span className="label">Mastered</span>
          </div>
        </div>
      </div>

      {/* Speed Focus Mode Button */}
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
            // For Image Occlusion, ALWAYS show the front HTML (which has all areas masked)
            <div
              dangerouslySetInnerHTML={{
                __html: currentCard.front
              }}
            />
          ) : deckType === "Cloze" ? (
            <div
              dangerouslySetInnerHTML={{
                __html: processClozeText(currentCard.front, showBack, 1),
              }}
            />
          ) : (
            <div dangerouslySetInnerHTML={{ __html: currentCard.front }} />
          )}
        </div>

        {/* Basic Type Answer Input */}
        {deckType === 'Basic-Type' && !showCorrectAnswer && (
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

        {/* Show results for Basic-Type */}
        {deckType === 'Basic-Type' && showCorrectAnswer && (
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

        {/* Regular Basic, Cloze, and Image Occlusion flow */}
        {deckType !== 'Basic-Type' && !showBack && (
          <button className="show-answer-btn" onClick={handleShowAnswer}>
            Show Answer
          </button>
        )}

        {deckType !== 'Basic-Type' && showBack && (
          <>
            {/* For Image Occlusion, show the back content when answer is revealed */}
            {isImageOcclusionCard && (
              <div className="flashcard-back">
                <div dangerouslySetInnerHTML={{ __html: currentCard.back }} />
              </div>
            )}
            
            {/* For regular Cloze, only show back content if it's different from front */}
            {!isImageOcclusionCard && (deckType !== "Cloze" || hasCustomBackContent) && (
              <div className="flashcard-back">
                <div dangerouslySetInnerHTML={{ __html: currentCard.back }} />
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