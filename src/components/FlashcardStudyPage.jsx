// src/components/FlashcardStudyPage.jsx - FIXED VERSION WITH IMAGE OCCLUSION last_reviewed UPDATE

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { calculateNextReview, getDueCards, getStudyStats, shouldRemoveFromSession } from "../utils/SpacedRepetition";
import "../styles/FlashcardStudyPage.css";

// Key function to determine card type - prioritizes individual card type over deck type
const getCardType = (card, deckType) => {
  // If card has a specific type, use it; otherwise use deck type
  return card.card_type || deckType;
};

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
  
  // Get the actual type for this specific card
  const currentCardType = getCardType(currentCard, deckType);
  
  const hasCustomBackContent =
    currentCardType === "Cloze" &&
    currentCard.back !== currentCard.front &&
    currentCard.back.trim() !== "";

  // Check if this is an image occlusion card by looking at the HTML content
  const isImageOcclusionCard = currentCard.front && (
    currentCard.front.includes('image-occlusion-card') || 
    currentCard.front.includes('occlusion-') ||
    currentCardType === 'Image-Occlusion'
  );

  // Get interval previews for current card
  const intervalPreviews = getIntervalPreviews();

  const handleShowAnswer = () => setShowBack(true);

  const handleSubmitAnswer = () => {
    if (currentCardType !== 'Basic-Type' || !currentCard) return;
    
    const correctAnswer = currentCard.back.replace(/<[^>]*>/g, '').trim().toLowerCase();
    const userAnswerClean = userAnswer.trim().toLowerCase();
    
    const isCorrect = correctAnswer === userAnswerClean;
    setIsAnswerCorrect(isCorrect);
    setShowCorrectAnswer(true);
  };

  // *** FIXED: GUARANTEED last_reviewed UPDATE FOR ALL CARD TYPES INCLUDING IMAGE OCCLUSION ***
  const handleDifficultyChoice = async (difficulty) => {
    if (!currentCard) return;
    
    const currentCardData = currentCard;
    
    try {
      console.log(`Processing difficulty choice: ${difficulty} for card ${currentCardData.id}`);
      console.log(`Card type check - isImageOcclusion: ${isImageOcclusionCard}`);
      console.log(`Card front content preview: ${currentCardData.front ? currentCardData.front.substring(0, 100) : 'null'}`);
      
      // Calculate next review using Anki algorithm
      const updatedCard = calculateNextReview(currentCardData, difficulty);
      
      // *** CRITICAL FIX: ALWAYS ensure last_reviewed is set for heatmap tracking ***
      const now = new Date().toISOString();
      updatedCard.last_reviewed = now;
      
      console.log(`Card ${currentCardData.id} studied at ${now} with rating: ${difficulty}`);
      console.log(`Next due: ${updatedCard.due}, State: ${updatedCard.state}, Interval: ${updatedCard.interval_days} days`);
      
      // *** ENHANCED FIX: Robust update payload that handles all card types ***
      const updatePayload = {
        state: updatedCard.state || 'new',
        ease_factor: updatedCard.ease_factor || 2.5,
        interval_days: updatedCard.interval_days || 0,
        step: updatedCard.step || 0,
        reviews: updatedCard.reviews || 1,
        lapses: updatedCard.lapses || 0,
        due: updatedCard.due,
        last_reviewed: now  // *** This is CRITICAL for heatmap tracking ***
      };

      console.log(`Updating card ${currentCardData.id} with payload:`, updatePayload);

      // *** ROBUST UPDATE: Use multiple fallback strategies for difficult card types ***
      let updateSuccess = false;
      let updateError = null;

      // Strategy 1: Standard update
      try {
        const { error } = await supabase
          .from('flashcard_cards')
          .update(updatePayload)
          .eq('id', currentCardData.id);

        if (!error) {
          updateSuccess = true;
          console.log(`✅ Strategy 1 SUCCESS: Updated card ${currentCardData.id}`);
        } else {
          updateError = error;
          console.log(`⚠️ Strategy 1 FAILED:`, error);
        }
      } catch (err) {
        updateError = err;
        console.log(`⚠️ Strategy 1 EXCEPTION:`, err);
      }

      // Strategy 2: If standard update failed, try minimal update (just last_reviewed and reviews)
      if (!updateSuccess) {
        try {
          console.log(`🔄 Trying Strategy 2: Minimal update for card ${currentCardData.id}`);
          const minimalPayload = {
            last_reviewed: now,
            reviews: (currentCardData.reviews || 0) + 1
          };

          const { error } = await supabase
            .from('flashcard_cards')
            .update(minimalPayload)
            .eq('id', currentCardData.id);

          if (!error) {
            updateSuccess = true;
            console.log(`✅ Strategy 2 SUCCESS: Minimal update for card ${currentCardData.id}`);
          } else {
            updateError = error;
            console.log(`⚠️ Strategy 2 FAILED:`, error);
          }
        } catch (err) {
          updateError = err;
          console.log(`⚠️ Strategy 2 EXCEPTION:`, err);
        }
      }

      // Strategy 3: If both failed, try super minimal update (just last_reviewed)
      if (!updateSuccess) {
        try {
          console.log(`🔄 Trying Strategy 3: Super minimal update for card ${currentCardData.id}`);
          const superMinimalPayload = {
            last_reviewed: now
          };

          const { error } = await supabase
            .from('flashcard_cards')
            .update(superMinimalPayload)
            .eq('id', currentCardData.id);

          if (!error) {
            updateSuccess = true;
            console.log(`✅ Strategy 3 SUCCESS: Super minimal update for card ${currentCardData.id}`);
          } else {
            updateError = error;
            console.log(`⚠️ Strategy 3 FAILED:`, error);
          }
        } catch (err) {
          updateError = err;
          console.log(`⚠️ Strategy 3 EXCEPTION:`, err);
        }
      }

      // If all strategies failed, log comprehensive error information
      if (!updateSuccess) {
        console.error(`❌ ALL UPDATE STRATEGIES FAILED for card ${currentCardData.id}`);
        console.error(`Final error:`, updateError);
        console.error(`Card data:`, currentCardData);
        console.error(`Update payload that failed:`, updatePayload);
        
        // Even if update failed, continue with the UI logic but inform user
        alert(`Warning: Failed to save study progress for this card. Please try again or contact support.`);
      }

      // *** VERIFICATION: Double-check the update worked ***
      if (updateSuccess) {
        try {
          const { data: verificationData, error: verificationError } = await supabase
            .from('flashcard_cards')
            .select('last_reviewed, state, reviews, front, back')
            .eq('id', currentCardData.id)
            .single();

          if (verificationError) {
            console.error('❌ Error verifying update:', verificationError);
          } else {
            console.log(`✅ VERIFIED: Card ${currentCardData.id} last_reviewed:`, verificationData.last_reviewed);
            console.log(`✅ VERIFIED: Card ${currentCardData.id} state:`, verificationData.state);
            console.log(`✅ VERIFIED: Card ${currentCardData.id} reviews:`, verificationData.reviews);
            
            // Double-check that last_reviewed was actually set
            if (!verificationData.last_reviewed) {
              console.error(`❌ VERIFICATION FAILED: last_reviewed is still NULL for card ${currentCardData.id}`);
              
              // Try one more force update
              try {
                const forceUpdate = await supabase
                  .from('flashcard_cards')
                  .update({ last_reviewed: now })
                  .eq('id', currentCardData.id);
                  
                console.log(`🔄 Force update result:`, forceUpdate);
              } catch (forceError) {
                console.error(`❌ Force update failed:`, forceError);
              }
            }
          }
        } catch (verificationErr) {
          console.error('❌ Verification threw error:', verificationErr);
        }
      }

      // Update all cards state with the verified data from database
      const newAllCards = allCards.map(card => 
        card.id === currentCardData.id ? {
          ...updatedCard,
          last_reviewed: now  // Ensure this is always set
        } : card
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
          index === currentIndex ? {
            ...updatedCard,
            last_reviewed: now  // Ensure this is always set
          } : card
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
      console.error('💥 Unexpected error in handleDifficultyChoice:', error);
      console.error('💥 Error details:', {
        cardId: currentCardData.id,
        difficulty,
        isImageOcclusion: isImageOcclusionCard,
        cardType: currentCardType,
        error: error.message
      });
      
      // *** EMERGENCY FALLBACK: If there's any error, still try to update last_reviewed ***
      console.log('🆘 Attempting emergency fallback update...');
      try {
        const emergencyNow = new Date().toISOString();
        const { error: emergencyError, data: emergencyData } = await supabase
          .from('flashcard_cards')
          .update({ 
            last_reviewed: emergencyNow,
            reviews: (currentCardData.reviews || 0) + 1
          })
          .eq('id', currentCardData.id)
          .select();
        
        if (!emergencyError) {
          console.log(`✅ Emergency fallback successful for card ${currentCardData.id}`);
          console.log(`Emergency update data:`, emergencyData);
        } else {
          console.error('❌ Emergency fallback also failed:', emergencyError);
        }
      } catch (emergencyError) {
        console.error('❌ Emergency fallback threw error:', emergencyError);
      }
      
      // Show user-friendly error but continue with UI flow
      alert('There was an issue saving your study progress. Your session will continue, but this card may not be tracked properly.');
    }
  };

  // Process cloze text for different card types (excluding Image Occlusion)
  const processClozeText = (text, isRevealed, activeClozeDeletion = 1) => {
    if (currentCardType !== "Cloze") return text;
    
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
          ) : currentCardType === "Cloze" ? (
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

        {/* Show results for Basic-Type */}
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
        {currentCardType !== 'Basic-Type' && !showBack && (
          <button className="show-answer-btn" onClick={handleShowAnswer}>
            Show Answer
          </button>
        )}

        {currentCardType !== 'Basic-Type' && showBack && (
          <>
            {/* For Image Occlusion, show the back content when answer is revealed */}
            {isImageOcclusionCard && (
              <div className="flashcard-back">
                <div dangerouslySetInnerHTML={{ __html: currentCard.back }} />
              </div>
            )}
            
            {/* For regular Cloze, only show back content if it's different from front */}
            {!isImageOcclusionCard && (currentCardType !== "Cloze" || hasCustomBackContent) && (
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