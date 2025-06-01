// src/components/SpeedFocusMode.jsx - COMPLETE FIXED VERSION

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { calculateNextReview, getDueCards, getStudyStats, shouldRemoveFromSession } from '../utils/SpacedRepetition';
import '../styles/SpeedFocusMode.css';

export default function SpeedFocusMode() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Game State
  const [allCards, setAllCards] = useState([]);
  const [sessionCards, setSessionCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deckType, setDeckType] = useState("Basic");
  const [isActive, setIsActive] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  
  // Timer & Speed
  const [timeLeft, setTimeLeft] = useState(10);
  const [cardStartTime, setCardStartTime] = useState(null);
  
  // Scoring & Stats
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [easyCount, setEasyCount] = useState(0);
  const [speedBonus, setSpeedBonus] = useState(1);
  
  // Card State
  const [showAnswer, setShowAnswer] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(null);
  
  // Add studyStats state
  const [studyStats, setStudyStats] = useState(null);
  
  // Settings
  const [settings, setSettings] = useState({
    timePerCard: 10,
    autoAdvance: true,
    showTimer: true
  });

  // Fetch flashcards on component mount
  useEffect(() => {
    if (id) {
      fetchFlashcardSet(id);
    }
  }, [id]);

  // FIXED: Handle timeout function
  const handleTimeOut = () => {
    setIsActive(false);
    handleAnswer(false, settings.timePerCard, 'again'); // Default to 'again' for timeouts
  };

  // Timer effect with better safety checks
  useEffect(() => {
    let interval;
    if (isActive && timeLeft > 0 && !showAnswer && !gameEnded && sessionCards.length > 0 && currentIndex < sessionCards.length) {
      interval = setInterval(() => {
        setTimeLeft(time => {
          if (time <= 1) {
            setIsActive(false);
            handleTimeOut();
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, showAnswer, gameEnded, sessionCards.length, currentIndex, settings.timePerCard]);

  // FIXED: Handle timeout function - moved to before useEffect that uses it

  // FIXED: Clear any lingering feedback when card changes
  useEffect(() => {
    if (currentIndex >= 0) {
      setLastAnswerCorrect(null);
      setShowAnswer(false);
      setUserAnswer('');
    }
  }, [currentIndex]);

  const fetchFlashcardSet = async (setId) => {
    try {
      // Get the flashcard set
      const { data: setData, error: setError } = await supabase
        .from("flashcard_sets")
        .select("*")
        .eq("id", setId)
        .single();

      if (setError) throw setError;
      if (setData) setDeckType(setData.type);

      // Get the cards
      const { data, error } = await supabase
        .from("flashcard_cards")
        .select("*")
        .eq("set_id", setId);

      if (error) throw error;
      
      const cards = data || [];
      setAllCards(cards);
      
      // Initialize session cards - all cards available for speed study
      const sessionDueCards = getDueCards(cards);
      setSessionCards(sessionDueCards);
    } catch (error) {
      console.error("Error fetching flashcards:", error);
    }
  };

  // Process cloze text for Speed Focus Mode (updated for image occlusion support)
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
    if (sessionCards.length === 0) {
      console.error('No flashcards available to start game');
      return;
    }

    setGameStarted(true);
    setIsActive(true);
    setTimeLeft(settings.timePerCard);
    setCardStartTime(Date.now());
    
    // Reset all stats when starting
    setScore(0);
    setStreak(0);
    setCorrectAnswers(0);
    setTotalAnswers(0);
    setEasyCount(0);
    setCurrentIndex(0);
    setSpeedBonus(1);
    setGameEnded(false);
    setShowAnswer(false);
    setUserAnswer('');
    setLastAnswerCorrect(null);
  };

  // FIXED: Reset game function with proper state clearing
  const resetGame = () => {
    // Reset all game state
    setGameStarted(false);
    setGameEnded(false);
    setIsActive(false);
    setCurrentIndex(0);
    setShowAnswer(false);
    setUserAnswer('');
    setLastAnswerCorrect(null);      // CRITICAL: Clear feedback
    setTimeLeft(settings.timePerCard);
    setCardStartTime(null);
    
    // Reset stats
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setCorrectAnswers(0);
    setTotalAnswers(0);
    setEasyCount(0);
    setSpeedBonus(1);
    
    // Reset session cards
    const newSessionCards = getDueCards(allCards);
    setSessionCards(newSessionCards);
  };

  // FIXED: Handle reveal function
  const handleReveal = () => {
    if (deckType !== 'Basic-Type') {
      setShowAnswer(true);
      setIsActive(false); // Stop timer when answer is revealed
    }
  };

  // FIXED: Handle submit typed answer function
  const handleSubmitTypedAnswer = () => {
    if (deckType === 'Basic-Type' && userAnswer.trim() && sessionCards.length > 0 && currentIndex < sessionCards.length) {
      setIsActive(false); // Stop timer immediately
      
      const currentCard = sessionCards[currentIndex];
      const correctAnswer = currentCard.back.replace(/<[^>]*>/g, '').trim().toLowerCase();
      const userAnswerClean = userAnswer.trim().toLowerCase();
      const isCorrect = correctAnswer === userAnswerClean;
      
      const responseTime = cardStartTime ? (Date.now() - cardStartTime) / 1000 : settings.timePerCard;
      handleAnswer(isCorrect, responseTime);
    }
  };

  const handleDifficultyChoice = async (difficulty) => {
    let isCorrect;
    switch (difficulty) {
      case 'again':
        isCorrect = false;
        break;
      case 'hard':
        isCorrect = true;
        break;
      case 'good':
        isCorrect = true;
        break;
      case 'easy':
        isCorrect = true;
        break;
      default:
        isCorrect = false;
    }
    
    const responseTime = cardStartTime ? (Date.now() - cardStartTime) / 1000 : settings.timePerCard;
    
    // Handle the answer first for scoring
    await handleAnswer(isCorrect, responseTime, difficulty);
  };

  // FIXED: Handle answer function with proper state management
  const handleAnswer = async (isCorrect, responseTime, difficulty = null) => {
    // Stop the timer immediately
    setIsActive(false);
    
    // Show feedback
    setLastAnswerCorrect(isCorrect);
    setTotalAnswers(prev => prev + 1);
    
    if (isCorrect) {
      setCorrectAnswers(prev => prev + 1);
      setStreak(prev => {
        const newStreak = prev + 1;
        if (newStreak > bestStreak) {
          setBestStreak(newStreak);
        }
        return newStreak;
      });
      
      // Calculate points
      const speedMultiplier = Math.max(0.5, (settings.timePerCard - responseTime) / settings.timePerCard);
      const basePoints = 100;
      const streakBonus = Math.min(streak * 10, 200);
      const difficultyMultiplier = difficulty === 'easy' ? 1.5 : 1;
      const speedPoints = Math.round(basePoints * speedMultiplier * difficultyMultiplier);
      const totalPoints = speedPoints + streakBonus;
      
      setScore(prev => prev + totalPoints);
      setSpeedBonus(speedMultiplier);
      
      if (difficulty === 'easy') {
        setEasyCount(prev => prev + 1);
      }
    } else {
      setStreak(0);
      setSpeedBonus(1);
    }

    // Handle spaced repetition if difficulty is provided
    if (difficulty && sessionCards.length > 0 && currentIndex < sessionCards.length) {
      const currentCard = sessionCards[currentIndex];
      
      try {
        const updatedCard = calculateNextReview(currentCard, difficulty);
        
        await supabase
          .from('flashcard_cards')
          .update({
            state: updatedCard.state,
            ease_factor: updatedCard.ease_factor,
            interval_days: updatedCard.interval_days,
            step: updatedCard.step,
            reviews: updatedCard.reviews,
            lapses: updatedCard.lapses,
            due: updatedCard.due,
            last_reviewed: updatedCard.last_reviewed
          })
          .eq('id', currentCard.id);

        const newAllCards = allCards.map(card => 
          card.id === currentCard.id ? updatedCard : card
        );
        setAllCards(newAllCards);

        if (shouldRemoveFromSession(updatedCard, difficulty)) {
          const newSessionCards = sessionCards.filter((_, index) => index !== currentIndex);
          setSessionCards(newSessionCards);
          
          if (newSessionCards.length === 0) {
            // FIXED: Clear feedback before ending game
            setTimeout(() => {
              setLastAnswerCorrect(null);
              endGame();
            }, 1500);
            return;
          }
          
          const nextIndex = currentIndex >= newSessionCards.length ? 0 : currentIndex;
          setCurrentIndex(nextIndex);
        } else {
          const newSessionCards = sessionCards.map((card, index) => 
            index === currentIndex ? updatedCard : card
          );
          setSessionCards(newSessionCards);
          
          const nextIndex = (currentIndex + 1) % sessionCards.length;
          setCurrentIndex(nextIndex);
        }

        const progressStats = getStudyStats(newAllCards);
        setStudyStats(progressStats);

        // FIXED: Clear feedback and advance after showing it briefly
        setTimeout(() => {
          setLastAnswerCorrect(null); // Clear feedback
          if (!gameEnded && sessionCards.length > 0) {
            // Reset card state for next card
            setShowAnswer(false);
            setUserAnswer('');
            setTimeLeft(settings.timePerCard);
            setCardStartTime(Date.now());
            setIsActive(true);
          }
        }, 1500);

      } catch (error) {
        console.error('Error updating card:', error);
        // Still advance even if database update fails
        setTimeout(() => {
          setLastAnswerCorrect(null);
          nextCard();
        }, 1500);
      }
    } else {
      // For non-difficulty based answers, use the original nextCard logic
      setTimeout(() => {
        setLastAnswerCorrect(null); // Clear feedback
        if (!gameEnded && sessionCards.length > 0) {
          nextCard();
        }
      }, 1500);
    }
  };

  // FIXED: Next card function with proper state reset
  const nextCard = () => {
    const nextIndex = currentIndex + 1;
    
    if (sessionCards.length === 0 || nextIndex >= sessionCards.length) {
      endGame();
      return;
    }
    
    // FIXED: Reset ALL card-specific state before moving to next card
    setCurrentIndex(nextIndex);
    setShowAnswer(false);           // Reset answer visibility
    setUserAnswer('');              // Clear typed answer
    setLastAnswerCorrect(null);     // Clear feedback state
    setTimeLeft(settings.timePerCard); // Reset timer
    setCardStartTime(Date.now());   // Reset timer start
    setIsActive(true);              // Restart timer
  };

  const endGame = () => {
    setIsActive(false);
    setGameEnded(true);
  };

  const getAccuracy = () => {
    return totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
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

  const currentCard = sessionCards.length > 0 && currentIndex < sessionCards.length ? sessionCards[currentIndex] : null;

  if (sessionCards.length === 0 && allCards.length === 0) {
    return (
      <div className="speed-focus-container">
        <div className="loading">Loading flashcards...</div>
      </div>
    );
  }

  const isImageOcclusionCard = currentCard && (currentCard.front?.includes('image-occlusion-card') || 
                              currentCard.front?.includes('occlusion-'));

  // Settings Screen
  if (!gameStarted) {
    return (
      <div className="speed-focus-container">
        <div className="speed-focus-setup">
          <div className="setup-header">
            <h1>⚡ Speed Focus Mode</h1>
            <p>Test your knowledge under time pressure!</p>
          </div>
          
          <div className="speed-goal">
            <h3>🎯 Goal: Mark all cards as "Easy"</h3>
            <p>Cards will cycle until you're confident enough to mark them as "Easy"!</p>
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
              <div className="stat-number">{sessionCards.length}</div>
              <div className="stat-label">Cards</div>
            </div>
            <div className="info-stat">
              <div className="stat-number">{Math.round(sessionCards.length * settings.timePerCard / 60)}</div>
              <div className="stat-label">Est. Minutes</div>
            </div>
          </div>
          
          <button className="start-game-btn" onClick={startGame}>
            🚀 Start Speed Challenge
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
            <h1>🎉 Speed Challenge Complete!</h1>
            <div className="final-score">{score.toLocaleString()} points</div>
            <div className="completion-message">
              You marked all {easyCount} cards as "Easy" under time pressure!
            </div>
          </div>
          
          <div className="final-stats">
            <div className="stat-card">
              <div className="stat-value">{getAccuracy()}%</div>
              <div className="stat-label">Accuracy</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{bestStreak}</div>
              <div className="stat-label">Best Streak</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{easyCount}</div>
              <div className="stat-label">Cards Mastered</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{correctAnswers}/{totalAnswers}</div>
              <div className="stat-label">Correct</div>
            </div>
          </div>
          
          <div className="achievements">
            {getAccuracy() >= 90 && <div className="achievement">🎯 Accuracy Master</div>}
            {bestStreak >= 10 && <div className="achievement">🔥 Streak Champion</div>}
            {score >= 5000 && <div className="achievement">⚡ Speed Demon</div>}
            {easyCount === allCards.length && getAccuracy() === 100 && (
              <div className="achievement">👑 Perfect Speed Run</div>
            )}
            {easyCount >= 20 && <div className="achievement">🧠 Master Scholar</div>}
          </div>
          
          <div className="game-over-actions">
            <button className="play-again-btn" onClick={resetGame}>
              🔄 Challenge Again
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
          <div className="score">Score: {score.toLocaleString()}</div>
          <div className="streak">🔥 {streak}</div>
        </div>
        <div className="hud-center">
          <div className="card-progress">
            {currentIndex + 1} / {sessionCards.length} cards
          </div>
          <div className="cards-learned">
            ⭐ {easyCount} Cards Learned
          </div>
        </div>
        <div className="hud-right">
          <div className="cards-remaining">
            📚 {sessionCards.length - easyCount} Cards to Learn
          </div>
          <div className="accuracy">Accuracy: {getAccuracy()}%</div>
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

      {/* Answer Feedback */}
      {lastAnswerCorrect !== null && (
        <div className={`answer-feedback ${lastAnswerCorrect ? 'correct' : 'incorrect'}`}>
          {lastAnswerCorrect ? (
            <>
              <div className="feedback-icon">✅</div>
              <div className="feedback-text">
                <div>Correct! +{Math.round(100 * speedBonus)}</div>
                {streak > 1 && <div className="bonus">Streak Bonus: +{Math.min(streak * 10, 200)}</div>}
              </div>
            </>
          ) : (
            <>
              <div className="feedback-icon">❌</div>
              <div className="feedback-text">Incorrect</div>
            </>
          )}
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
            ) : (deckType === "Cloze") ? (
              <div dangerouslySetInnerHTML={{ 
                __html: processClozeText(currentCard.front, showAnswer, 1) 
              }} />
            ) : (
              <div dangerouslySetInnerHTML={{ __html: currentCard.front }} />
            )}
          </div>

          {/* Type Answer Input */}
          {deckType === 'Basic-Type' && !showAnswer && lastAnswerCorrect === null && (
            <div className="speed-input-section">
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder="Type your answer..."
                className="speed-answer-input"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && userAnswer.trim()) {
                    handleSubmitTypedAnswer();
                  }
                }}
                autoFocus
              />
              <button 
                className="speed-submit-btn" 
                onClick={handleSubmitTypedAnswer}
                disabled={!userAnswer.trim()}
              >
                Submit
              </button>
            </div>
          )}

          {/* Regular Show Answer */}
          {deckType !== 'Basic-Type' && !showAnswer && lastAnswerCorrect === null && (
            <button className="speed-reveal-btn" onClick={handleReveal}>
              Show Answer
            </button>
          )}

          {/* Answer Display */}
          {showAnswer && (
            <div className="card-back">
              {isImageOcclusionCard ? (
                <div dangerouslySetInnerHTML={{ 
                  __html: currentCard.back 
                }} />
              ) : (deckType === "Cloze") ? (
                <div dangerouslySetInnerHTML={{ 
                  __html: processClozeText(currentCard.front, true, 1) 
                }} />
              ) : (
                <div dangerouslySetInnerHTML={{ __html: currentCard.back }} />
              )}
              <div className="speed-difficulty-buttons">
                <button className="speed-btn again" onClick={() => handleDifficultyChoice('again')}>
                  Again
                </button>
                <button className="speed-btn hard" onClick={() => handleDifficultyChoice('hard')}>
                  Hard
                </button>
                <button className="speed-btn good" onClick={() => handleDifficultyChoice('good')}>
                  Good
                </button>
                <button className="speed-btn easy" onClick={() => handleDifficultyChoice('easy')}>
                  Easy ⭐
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}