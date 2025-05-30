// src/components/FlashcardStudyPage.jsx - WITH ANKI ALGORITHM & AUTO INTERVALS
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { calculateNextReview, getDueCards, getStudyStats } from "../utils/SpacedRepetition";
import "../styles/FlashcardStudyPage.css";

export default function FlashcardStudyPage() {
  const { id } = useParams(); // ID of the flashcard set
  const navigate = useNavigate();
  const [flashcards, setFlashcards] = useState([]);
  const [dueCards, setDueCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [deckType, setDeckType] = useState("Basic");
  const [setTitle, setSetTitle] = useState("");
  const [studyStats, setStudyStats] = useState(null);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  
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
      setFlashcards(cards);
      
      // Get cards that are due for review
      const due = getDueCards(cards);
      setDueCards(due);
      
      // Calculate study statistics
      const stats = getStudyStats(cards);
      setStudyStats(stats);
      
    } catch (error) {
      console.error("Error in fetchFlashcardSet:", error);
    }
  };

  // Calculate what the intervals would be for each button
  const getIntervalPreviews = () => {
    if (dueCards.length === 0 || currentIndex >= dueCards.length || !dueCards[currentIndex]) {
      return { again: "1m", hard: "10m", good: "1d", easy: "4d" };
    }

    const currentCard = dueCards[currentIndex];
    const previews = {};
    
    ['again', 'hard', 'good', 'easy'].forEach(rating => {
      try {
        const tempCard = calculateNextReview({ ...currentCard }, rating);
        
        // Calculate interval based on the algorithm result
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
        
        // If we still have "New" or invalid result, use defaults based on card state and rating
        if (intervalText === "New" || intervalText === "Now") {
          const cardState = currentCard.state || 'new';
          
          if (cardState === 'new' || !cardState) {
            // New card intervals
            const newCardIntervals = {
              again: "1m",
              hard: "1m", 
              good: "1m",
              easy: "4d"
            };
            intervalText = newCardIntervals[rating];
          } else if (cardState === 'learning') {
            // Learning card intervals
            const learningIntervals = {
              again: "1m",
              hard: "10m",
              good: "1d", 
              easy: "4d"
            };
            intervalText = learningIntervals[rating];
          } else if (cardState === 'review') {
            // Review card intervals - base on current interval if available
            const currentInterval = currentCard.interval_days || 1;
            const reviewIntervals = {
              again: "10m",
              hard: `${Math.max(1, Math.round(currentInterval * 1.2))}d`,
              good: `${Math.max(1, Math.round(currentInterval * 2.5))}d`,
              easy: `${Math.max(1, Math.round(currentInterval * 2.5 * 1.3))}d`
            };
            intervalText = reviewIntervals[rating];
          } else {
            // Fallback intervals
            const fallbackIntervals = {
              again: "1m",
              hard: "10m", 
              good: "1d",
              easy: "4d"
            };
            intervalText = fallbackIntervals[rating];
          }
        }
        
        previews[rating] = intervalText;
      } catch (error) {
        console.error(`Error calculating interval for ${rating}:`, error);
        // Fallback intervals
        const fallbacks = { again: "1m", hard: "10m", good: "1d", easy: "4d" };
        previews[rating] = fallbacks[rating];
      }
    });
    
    return previews;
  };

  // Format interval for display
  const formatInterval = (card) => {
    if (!card.due) return "New";
    
    const now = new Date();
    const dueDate = new Date(card.due);
    
    // Check for invalid dates
    if (isNaN(dueDate.getTime())) return "New";
    
    const diffMs = dueDate.getTime() - now.getTime();
    const diffMinutes = Math.round(diffMs / (1000 * 60));
    
    // If in the past or very soon, show as due now
    if (diffMinutes <= 0) {
      return "Now";
    }
    
    if (diffMinutes < 60) {
      return `${diffMinutes}m`;
    } else if (diffMinutes < 1440) { // Less than 24 hours
      const hours = Math.round(diffMinutes / 60);
      return `${hours}h`;
    } else {
      const days = Math.round(diffMinutes / 1440);
      if (days >= 365) {
        const years = Math.round(days / 365);
        return `${years}y`;
      } else if (days >= 30) {
        const months = Math.round(days / 30);
        return `${months}mo`;
      } else {
        return `${days}d`;
      }
    }
  };

  // Show loading only if we truly have no cards
  if (dueCards.length === 0 && flashcards.length === 0) {
    return (
      <div className="study-container">
        <div className="loading-study">
          <div className="loading-spinner"></div>
          <p>Loading cards...</p>
        </div>
      </div>
    );
  }

  // If we just completed and showing popup, don't interfere
  if (justCompleted && showCompletionPopup) {
    // Continue to render the study interface with the popup
  }
  // If we have flashcards but no due cards, and we're not in completion state
  else if (dueCards.length === 0 && flashcards.length > 0 && !justCompleted) {
    // This happens on initial load when cards aren't properly set as due
    const allCardsWithUpdatedDue = flashcards.map(card => ({
      ...card,
      due: new Date().toISOString()
    }));
    setDueCards(allCardsWithUpdatedDue);
    setCurrentIndex(0);
    return (
      <div className="study-container">
        <div className="loading-study">
          <div className="loading-spinner"></div>
          <p>Preparing cards...</p>
        </div>
      </div>
    );
  }

  const currentCard = dueCards.length > 0 && currentIndex < dueCards.length ? dueCards[currentIndex] : null;
  
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
      // Calculate next review using Anki algorithm
      const updatedCard = calculateNextReview(currentCardData, difficulty);
      
      // Update card in database
      const { error } = await supabase
        .from('flashcard_cards')
        .update({
          state: updatedCard.state,
          ease_factor: updatedCard.ease_factor,
          interval_days: updatedCard.interval,
          step: updatedCard.step,
          reviews: updatedCard.reviews,
          lapses: updatedCard.lapses,
          due: updatedCard.due,
          last_reviewed: updatedCard.last_reviewed
        })
        .eq('id', currentCardData.id);

      if (error) {
        console.error('Error updating card:', error);
        return;
      }

      // Update local flashcards state
      setFlashcards(prev => 
        prev.map(card => 
          card.id === currentCardData.id ? updatedCard : card
        )
      );

      // Calculate new due cards (remove current card)
      const newDueCards = dueCards.filter((_, index) => index !== currentIndex);

      // Check if this was the last card
      if (newDueCards.length === 0) {
        // Show completion popup immediately
        setJustCompleted(true);
        setShowCompletionPopup(true);
        
        // Set timeout to restart after popup
        setTimeout(() => {
          setShowCompletionPopup(false);
          setJustCompleted(false);
          
          // Restart with all cards
          const allCardsWithUpdatedDue = flashcards.map(card => ({
            ...card,
            due: new Date().toISOString()
          }));
          
          setFlashcards(allCardsWithUpdatedDue);
          setDueCards(allCardsWithUpdatedDue);
          setCurrentIndex(0);
          setShowBack(false);
          setShowCorrectAnswer(false);
          setIsAnswerCorrect(null);
          setUserAnswer('');
          
          // Update study stats
          const restartStats = getStudyStats(allCardsWithUpdatedDue);
          setStudyStats(restartStats);
        }, 2000);
        
        return; // Don't continue with normal flow
      }

      // Normal flow: move to next card
      setDueCards(newDueCards);

      // Update study stats for normal progression
      const progressStats = getStudyStats(flashcards.map(card => 
        card.id === currentCardData.id ? updatedCard : card
      ));
      setStudyStats(progressStats);

      // Reset for next card
      const nextIndex = currentIndex >= newDueCards.length ? 0 : currentIndex;
      setCurrentIndex(nextIndex);
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
              <h3>You studied all of them!</h3>
              <p>Will start over again now!</p>
            </div>
          </div>
        </div>
      )}

      {/* Study Progress and Stats */}
      <div className="study-header">
        <div className="study-info">
          <h1>{setTitle}</h1>
          <div className="progress-info">
            <span>{currentIndex + 1} / {dueCards.length} due cards</span>
          </div>
        </div>
        
        {studyStats && (
          <div className="study-stats-header">
            <div className="stat-item new">
              <span className="count">{studyStats.new}</span>
              <span className="label">New</span>
            </div>
            <div className="stat-item learning">
              <span className="count">{studyStats.learning}</span>
              <span className="label">Learning</span>
            </div>
            <div className="stat-item review">
              <span className="count">{studyStats.review}</span>
              <span className="label">Review</span>
            </div>
          </div>
        )}
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
            // The front HTML contains the proper blocked areas with active question styling
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