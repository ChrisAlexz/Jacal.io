// src/components/SpeedFocusMode.jsx - REDESIGNED SIMPLIFIED VERSION WITH TYPE-IN-ANSWER SUPPORT

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import '../styles/SpeedFocusMode.css';

// Key function to determine card type - prioritizes individual card type over deck type
const getCardType = (card, deckType) => {
  // If card has a specific type, use it; otherwise use deck type
  return card.card_type || deckType;
};

export default function SpeedFocusMode() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Game State
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deckType, setDeckType] = useState("Basic");
  const [setTitle, setSetTitle] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  
  // Timer
  const [timeLeft, setTimeLeft] = useState(10);
  
  // Card State
  const [showAnswer, setShowAnswer] = useState(false);
  
  // State for type-in-answer functionality
  const [userAnswer, setUserAnswer] = useState('');
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState(null);
  
  // Settings
  const [settings, setSettings] = useState({
    timePerCard: 10,
    showTimer: true
  });

  // Fetch flashcards on component mount
  useEffect(() => {
    if (id) {
      fetchFlashcardSet(id);
    }
  }, [id]);

  // Timer effect - when time runs out, move to next card
  useEffect(() => {
    let interval;
    if (isActive && timeLeft > 0 && !gameEnded && cards.length > 0 && currentIndex < cards.length) {
      interval = setInterval(() => {
        setTimeLeft(time => {
          if (time <= 1) {
            // Time's up - move to next card
            handleTimeOut();
            return settings.timePerCard;
          }
          return time - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, gameEnded, cards.length, currentIndex, settings.timePerCard]);

  const fetchFlashcardSet = async (setId) => {
    try {
      // Get the flashcard set
      const { data: setData, error: setError } = await supabase
        .from("flashcard_sets")
        .select("*")
        .eq("id", setId)
        .single();

      if (setError) throw setError;
      if (setData) {
        setDeckType(setData.type);
        setSetTitle(setData.title);
      }

      // Get the cards
      const { data, error } = await supabase
        .from("flashcard_cards")
        .select("*")
        .eq("set_id", setId);

      if (error) throw error;
      
      const cardData = data || [];
      setCards(cardData);
    } catch (error) {
      console.error("Error fetching flashcards:", error);
    }
  };

  // Process cloze text for different card types
  const processClozeText = (text, isRevealed, activeClozeDeletion = 1) => {
    // Check if this is an image occlusion card
    if (text.includes('image-occlusion-card') || text.includes('occlusion-')) {
      return text;
    }
    
    if (deckType !== "Cloze") return text;
    
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

  const startGame = () => {
    if (cards.length === 0) {
      console.error('No flashcards available to start game');
      return;
    }

    setGameStarted(true);
    setIsActive(true);
    setTimeLeft(settings.timePerCard);
    setCurrentIndex(0);
    setGameEnded(false);
    setShowAnswer(false);
    setShowCorrectAnswer(false);
    setIsAnswerCorrect(null);
    setUserAnswer('');
  };

  const resetGame = () => {
    setGameStarted(false);
    setGameEnded(false);
    setIsActive(false);
    setCurrentIndex(0);
    setShowAnswer(false);
    setShowCorrectAnswer(false);
    setIsAnswerCorrect(null);
    setUserAnswer('');
    setTimeLeft(settings.timePerCard);
  };

  const handleTimeOut = () => {
    // When timer runs out, move to next card
    nextCard();
  };

  const handleShowAnswer = () => {
    setShowAnswer(true);
    setIsActive(false); // Stop timer when answer is shown
  };

  const handleSubmitAnswer = () => {
    if (currentCardType !== 'Basic-Type' || !currentCard) return;
    
    const correctAnswer = currentCard.back.replace(/<[^>]*>/g, '').trim().toLowerCase();
    const userAnswerClean = userAnswer.trim().toLowerCase();
    
    const isCorrect = correctAnswer === userAnswerClean;
    setIsAnswerCorrect(isCorrect);
    setShowCorrectAnswer(true);
    setIsActive(false); // Stop timer when answer is submitted
  };

  const nextCard = () => {
    const nextIndex = currentIndex + 1;
    
    if (nextIndex >= cards.length) {
      // Reached the end
      endGame();
      return;
    }
    
    // Move to next card
    setCurrentIndex(nextIndex);
    setShowAnswer(false);
    setShowCorrectAnswer(false);
    setIsAnswerCorrect(null);
    setUserAnswer('');
    setTimeLeft(settings.timePerCard);
    setIsActive(true); // Restart timer for next card
  };

  const endGame = () => {
    setIsActive(false);
    setGameEnded(true);
  };

  const formatTime = (seconds) => {
    return seconds.toString().padStart(2, '0');
  };

  const getTimerColor = () => {
    const percentage = timeLeft / settings.timePerCard;
    if (percentage > 0.6) return '#28a745';
    if (percentage > 0.3) return '#ffc107';
    return '#dc3545';
  };

  const currentCard = cards.length > 0 && currentIndex < cards.length ? cards[currentIndex] : null;

  if (cards.length === 0) {
    return (
      <div className="speed-focus-container">
        <div className="loading">Loading flashcards...</div>
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

  // Settings Screen
  if (!gameStarted) {
    return (
      <div className="speed-focus-container">
        <div className="speed-focus-setup">
          <div className="setup-header">
            <h1>⚡ Speed Focus Mode</h1>
            <p>Quick review mode - beat the timer or show the answer!</p>
          </div>
          
          <div className="speed-goal">
            <h3>🎯 Goal: Review all cards quickly</h3>
            <p>Each card has a timer. Show the answer before time runs out, or the timer will automatically move to the next card!</p>
          </div>
          
          <div className="setup-options">
            <div className="option-group">
              <label>Time per card:</label>
              <select 
                value={settings.timePerCard} 
                onChange={(e) => {
                  const newTime = parseInt(e.target.value);
                  setSettings(prev => ({...prev, timePerCard: newTime}));
                  setTimeLeft(newTime);
                }}
              >
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
                <option value={15}>15 seconds</option>
                <option value={20}>20 seconds</option>
                <option value={30}>30 seconds</option>
              </select>
            </div>
            
            <div className="option-group">
              <label>
                <input
                  type="checkbox"
                  checked={settings.showTimer}
                  onChange={(e) => setSettings(prev => ({...prev, showTimer: e.target.checked}))}
                />
                Show timer
              </label>
            </div>
          </div>
          
          <div className="game-info">
            <div className="info-stat">
              <div className="stat-number">{cards.length}</div>
              <div className="stat-label">Cards</div>
            </div>
            <div className="info-stat">
              <div className="stat-number">{Math.round(cards.length * settings.timePerCard / 60)}</div>
              <div className="stat-label">Est. Minutes</div>
            </div>
          </div>
          
          <button className="start-game-btn" onClick={startGame}>
            🚀 Start Speed Review
          </button>
          
          <button className="back-btn" onClick={() => navigate(-1)}>
            ← Back to Study
          </button>
        </div>
      </div>
    );
  }

  // Game Over Screen
  if (gameEnded) {
    return (
      <div className="speed-focus-container">
        <div className="game-over">
          <div className="game-over-header">
            <h1>⚡ Speed Review Complete!</h1>
            <div className="completion-message">
              You've reviewed all {cards.length} cards in speed mode!
            </div>
          </div>
          
          <div className="final-stats">
            <div className="stat-card">
              <div className="stat-value">{cards.length}</div>
              <div className="stat-label">Cards Reviewed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{setTitle}</div>
              <div className="stat-label">Deck</div>
            </div>
          </div>
          
          <div className="game-over-actions">
            <button className="play-again-btn" onClick={resetGame}>
              🔄 Review Again
            </button>
            <button className="back-btn" onClick={() => navigate(-1)}>
              ← Back to Study
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="speed-focus-container">
        <div className="loading">Loading card...</div>
      </div>
    );
  }

  // Main Game Screen
  return (
    <div className="speed-focus-container game-active">
      {/* HUD */}
      <div className="game-hud">
        <div className="hud-left">
          <div className="deck-title">{setTitle}</div>
        </div>
        <div className="hud-center">
          <div className="card-progress">
            {currentIndex + 1} / {cards.length} cards
          </div>
        </div>
        <div className="hud-right">
          <div className="cards-remaining">
            {cards.length - currentIndex - 1} cards left
          </div>
        </div>
      </div>

      {/* Timer */}
      {settings.showTimer && (
        <div className="timer-container">
          <div 
            className="timer-bar" 
            style={{ 
              width: `${(timeLeft / settings.timePerCard) * 100}%`,
              backgroundColor: getTimerColor()
            }}
          />
          <div className="timer-text" style={{ color: getTimerColor() }}>
            {formatTime(timeLeft)}
          </div>
        </div>
      )}

      {/* Main Card */}
      <div className="speed-card">
        <div className="card-content">
          <div className="card-front">
            {isImageOcclusionCard ? (
              <div dangerouslySetInnerHTML={{ 
                __html: showAnswer ? currentCard.back : currentCard.front 
              }} />
            ) : (currentCardType === "Cloze") ? (
              <div dangerouslySetInnerHTML={{ 
                __html: processClozeText(currentCard.front, showAnswer, 1) 
              }} />
            ) : (
              <div dangerouslySetInnerHTML={{ __html: currentCard.front }} />
            )}
          </div>

          {/* Show Answer Button or Next Button */}
          {!showAnswer && !showCorrectAnswer ? (
            currentCardType === 'Basic-Type' ? (
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
            ) : (
              <button className="speed-reveal-btn" onClick={handleShowAnswer}>
                Show Answer
              </button>
            )
          ) : (
            <div className="answer-section">
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
                </div>
              )}
              
              {/* Show back content for non-cloze cards or cloze cards with custom back content */}
              {(currentCardType !== "Cloze" || (currentCardType === "Cloze" && hasCustomBackContent)) && 
               !isImageOcclusionCard && 
               currentCardType !== 'Basic-Type' && (
                <div className="card-back">
                  <div dangerouslySetInnerHTML={{ __html: currentCard.back }} />
                </div>
              )}
              
              {/* Show back content for Image Occlusion when answer is revealed */}
              {isImageOcclusionCard && showAnswer && (
                <div className="card-back">
                  <div dangerouslySetInnerHTML={{ __html: currentCard.back }} />
                </div>
              )}
              
              <button className="next-card-btn" onClick={nextCard}>
                {currentIndex === cards.length - 1 ? 'Finish' : 'Next Card'} →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}