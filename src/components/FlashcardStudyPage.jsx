// src/components/FlashcardStudyPage.jsx - WITH ANKI ALGORITHM
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
  const [showIntervals, setShowIntervals] = useState(false);
  
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

  const handleShowAnswer = () => setShowBack(true);

  const handleSubmitAnswer = () => {
    if (deckType !== 'Basic-Type') return;
    
    const currentCard = dueCards[currentIndex];
    const correctAnswer = currentCard.back.replace(/<[^>]*>/g, '').trim().toLowerCase();
    const userAnswerClean = userAnswer.trim().toLowerCase();
    
    const isCorrect = correctAnswer === userAnswerClean;
    setIsAnswerCorrect(isCorrect);
    setShowCorrectAnswer(true);
  };

  const handleDifficultyChoice = async (difficulty) => {
    const currentCard = dueCards[currentIndex];
    
    try {
      // Calculate next review using Anki algorithm
      const updatedCard = calculateNextReview(currentCard, difficulty);
      
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
        .eq('id', currentCard.id);

      if (error) {
        console.error('Error updating card:', error);
        return;
      }

      // Update local state
      setFlashcards(prev => 
        prev.map(card => 
          card.id === currentCard.id ? updatedCard : card
        )
      );

      // Remove current card from due cards and move to next
      const newDueCards = dueCards.filter((_, index) => index !== currentIndex);
      setDueCards(newDueCards);

      // Update study stats
      const updatedFlashcards = flashcards.map(card => 
        card.id === currentCard.id ? updatedCard : card
      );
      const newStats = getStudyStats(updatedFlashcards);
      setStudyStats(newStats);

      // Move to next card or finish session
      if (newDueCards.length === 0) {
        // No more cards due - show completion message
        alert(`Study session complete! 🎉\n\nCards studied: ${flashcards.length - newDueCards.length}\nCome back later for more reviews.`);
        navigate(-1);
      } else {
        // Reset for next card
        const nextIndex = currentIndex >= newDueCards.length ? 0 : currentIndex;
        setCurrentIndex(nextIndex);
        setShowBack(false);
        setShowCorrectAnswer(false);
        setIsAnswerCorrect(null);
        setUserAnswer('');
      }

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

  // Show loading or no cards states
  if (dueCards.length === 0) {
    return (
      <div className="study-container">
        <div className="study-completion">
          <div className="completion-icon">🎉</div>
          <h2>All caught up!</h2>
          <p>No cards are due for review right now.</p>
          {studyStats && (
            <div className="study-stats">
              <div className="stat">
                <span className="stat-number">{studyStats.total}</span>
                <span className="stat-label">Total Cards</span>
              </div>
              <div className="stat">
                <span className="stat-number">{studyStats.new}</span>
                <span className="stat-label">New</span>
              </div>
              <div className="stat">
                <span className="stat-number">{studyStats.learning}</span>
                <span className="stat-label">Learning</span>
              </div>
              <div className="stat">
                <span className="stat-number">{studyStats.review}</span>
                <span className="stat-label">Review</span>
              </div>
            </div>
          )}
          <button onClick={() => navigate(-1)} className="back-button">
            ← Back to Sets
          </button>
        </div>
      </div>
    );
  }

  const currentCard = dueCards[currentIndex];
  const hasCustomBackContent =
    deckType === "Cloze" &&
    currentCard.back !== currentCard.front &&
    currentCard.back.trim() !== "";

  // Check if this is an image occlusion card by looking at the HTML content
  const isImageOcclusionCard = currentCard.front.includes('image-occlusion-card') || 
                              currentCard.front.includes('occlusion-');

  return (
    <div className="study-container">
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
        <button 
          className="show-intervals-btn"
          onClick={() => setShowIntervals(!showIntervals)}
          title="Show/hide next review intervals"
        >
          📅 {showIntervals ? 'Hide' : 'Show'} Intervals
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
              {showIntervals && (
                <div className="interval-preview">
                  <div className="interval-item">
                    <button className="again-btn preview" disabled>Again</button>
                    <span className="interval-text">1m</span>
                  </div>
                  <div className="interval-item">
                    <button className="hard-btn preview" disabled>Hard</button>
                    <span className="interval-text">10m</span>
                  </div>
                  <div className="interval-item">
                    <button className="good-btn preview" disabled>Good</button>
                    <span className="interval-text">1d</span>
                  </div>
                  <div className="interval-item">
                    <button className="easy-btn preview" disabled>Easy</button>
                    <span className="interval-text">4d</span>
                  </div>
                </div>
              )}
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
              {showIntervals && (
                <div className="interval-preview">
                  <div className="interval-item">
                    <button className="again-btn preview" disabled>Again</button>
                    <span className="interval-text">1m</span>
                  </div>
                  <div className="interval-item">
                    <button className="hard-btn preview" disabled>Hard</button>
                    <span className="interval-text">10m</span>
                  </div>
                  <div className="interval-item">
                    <button className="good-btn preview" disabled>Good</button>
                    <span className="interval-text">1d</span>
                  </div>
                  <div className="interval-item">
                    <button className="easy-btn preview" disabled>Easy</button>
                    <span className="interval-text">4d</span>
                  </div>
                </div>
              )}
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