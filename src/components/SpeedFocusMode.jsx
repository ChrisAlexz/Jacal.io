// src/components/SpeedFocusMode.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import '../styles/SpeedFocusMode.css';

export default function SpeedFocusMode() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Game State
  const [flashcards, setFlashcards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deckType, setDeckType] = useState("Basic");
  const [isActive, setIsActive] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  
  // Timer & Speed
  const [timeLimit, setTimeLimit] = useState(10); // seconds per card
  const [timeLeft, setTimeLeft] = useState(10);
  const [cardStartTime, setCardStartTime] = useState(null);
  
  // Scoring & Stats
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswers, setTotalAnswers] = useState(0);
  const [speedBonus, setSpeedBonus] = useState(1);
  
  // Card State
  const [showAnswer, setShowAnswer] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(null);
  
  // Settings
  const [settings, setSettings] = useState({
    timePerCard: 10,
    soundEnabled: true,
    autoAdvance: true,
    showTimer: true
  });

  // Fetch flashcards on component mount
  useEffect(() => {
    if (id) {
      fetchFlashcardSet(id);
    }
  }, [id]);

  // Timer effect
  useEffect(() => {
    let interval;
    if (isActive && timeLeft > 0 && !showAnswer) {
      interval = setInterval(() => {
        setTimeLeft(time => {
          if (time <= 1) {
            handleTimeOut();
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, showAnswer]);

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
      setFlashcards(data || []);
    } catch (error) {
      console.error("Error fetching flashcards:", error);
    }
  };

  // Process cloze text for Speed Focus Mode (same logic as study page)
  const processClozeText = (text, isRevealed, activeClozeDeletion = 1) => {
    if (deckType !== "Cloze" && deckType !== "Image-Occlusion") return text;
    
    // Replace all cloze deletions with appropriate styling
    let processedText = text;
    
    // Find all cloze deletions (c1, c2, c3, etc.)
    const clozePattern = /{{c(\d+)::(.*?)}}/g;
    
    processedText = processedText.replace(clozePattern, (match, clozeNumber, clozeText) => {
      const clozeNum = parseInt(clozeNumber);
      
      if (deckType === "Image-Occlusion") {
        // IMAGE OCCLUSION TYPE
        if (isRevealed) {
          // When answer is revealed, only show the active one, keep others hidden
          if (clozeNum === activeClozeDeletion) {
            return `<span class="cloze-revealed-active">${clozeText}</span>`;
          } else {
            return `<span class="cloze-hidden-inactive">[...]</span>`;
          }
        } else {
          // When question is shown, all are hidden but active one has different color
          if (clozeNum === activeClozeDeletion) {
            return `<span class="cloze-question-active">[...]</span>`;
          } else {
            return `<span class="cloze-hidden-inactive">[...]</span>`;
          }
        }
      } else {
        // REGULAR CLOZE TYPE (existing behavior)
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
      }
    });
    
    return processedText;
  };

  const startGame = () => {
    setGameStarted(true);
    setIsActive(true);
    setTimeLeft(settings.timePerCard);
    setCardStartTime(Date.now());
    resetStats();
  };

  const resetStats = () => {
    setScore(0);
    setStreak(0);
    setCorrectAnswers(0);
    setTotalAnswers(0);
    setCurrentIndex(0);
    setSpeedBonus(1);
    setGameEnded(false);
  };

  const handleTimeOut = () => {
    playSound('timeout');
    handleAnswer(false, 0); // Wrong answer, 0 speed
  };

  const handleReveal = () => {
    if (deckType !== 'Basic-Type') {
      setShowAnswer(true);
      setIsActive(false);
    }
  };

  const handleSubmitTypedAnswer = () => {
    if (deckType === 'Basic-Type' && userAnswer.trim()) {
      const currentCard = flashcards[currentIndex];
      const correctAnswer = currentCard.back.replace(/<[^>]*>/g, '').trim().toLowerCase();
      const userAnswerClean = userAnswer.trim().toLowerCase();
      const isCorrect = correctAnswer === userAnswerClean;
      
      const responseTime = (Date.now() - cardStartTime) / 1000;
      handleAnswer(isCorrect, responseTime);
    }
  };

  const handleDifficultyChoice = (difficulty) => {
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
    
    const responseTime = (Date.now() - cardStartTime) / 1000;
    handleAnswer(isCorrect, responseTime);
  };

  const handleAnswer = (isCorrect, responseTime) => {
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
      
      // Calculate speed bonus (faster = more points)
      const speedMultiplier = Math.max(0.5, (settings.timePerCard - responseTime) / settings.timePerCard);
      const basePoints = 100;
      const streakBonus = Math.min(streak * 10, 200); // Max 200 bonus
      const speedPoints = Math.round(basePoints * speedMultiplier);
      const totalPoints = speedPoints + streakBonus;
      
      setScore(prev => prev + totalPoints);
      setSpeedBonus(speedMultiplier);
      playSound('correct');
    } else {
      setStreak(0);
      setSpeedBonus(1);
      playSound('incorrect');
    }

    // Auto advance to next card after showing feedback
    setTimeout(() => {
      nextCard();
    }, 1500);
  };

  const nextCard = () => {
    if (currentIndex >= flashcards.length - 1) {
      endGame();
      return;
    }
    
    setCurrentIndex(prev => prev + 1);
    setShowAnswer(false);
    setUserAnswer('');
    setTimeLeft(settings.timePerCard);
    setCardStartTime(Date.now());
    setIsActive(true);
    setLastAnswerCorrect(null);
  };

  const endGame = () => {
    setIsActive(false);
    setGameEnded(true);
    playSound('gameEnd');
  };

  const playSound = (type) => {
    if (!settings.soundEnabled) return;
    
    // Create simple beep sounds using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    let frequency, duration;
    switch (type) {
      case 'correct':
        frequency = 800;
        duration = 0.2;
        break;
      case 'incorrect':
        frequency = 300;
        duration = 0.3;
        break;
      case 'timeout':
        frequency = 200;
        duration = 0.5;
        break;
      case 'gameEnd':
        frequency = 600;
        duration = 0.8;
        break;
      default:
        frequency = 400;
        duration = 0.1;
    }
    
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
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

  const currentCard = flashcards[currentIndex];

  if (flashcards.length === 0) {
    return (
      <div className="speed-focus-container">
        <div className="loading">Loading flashcards...</div>
      </div>
    );
  }

  // Settings Screen
  if (!gameStarted) {
    return (
      <div className="speed-focus-container">
        <div className="speed-focus-setup">
          <div className="setup-header">
            <h1>⚡ Speed Focus Mode</h1>
            <p>Test your knowledge under time pressure!</p>
          </div>
          
          <div className="setup-options">
            <div className="option-group">
              <label>Time per card:</label>
              <select 
                value={settings.timePerCard} 
                onChange={(e) => {
                  const newTime = parseInt(e.target.value);
                  setSettings(prev => ({...prev, timePerCard: newTime}));
                  setTimeLimit(newTime);
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
                  checked={settings.soundEnabled}
                  onChange={(e) => setSettings(prev => ({...prev, soundEnabled: e.target.checked}))}
                />
                Sound effects
              </label>
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
              <div className="stat-number">{flashcards.length}</div>
              <div className="stat-label">Cards</div>
            </div>
            <div className="info-stat">
              <div className="stat-number">{Math.round(flashcards.length * settings.timePerCard / 60)}</div>
              <div className="stat-label">Minutes</div>
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
            <h1>🎉 Challenge Complete!</h1>
            <div className="final-score">{score.toLocaleString()} points</div>
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
              <div className="stat-value">{correctAnswers}/{totalAnswers}</div>
              <div className="stat-label">Correct</div>
            </div>
          </div>
          
          <div className="achievements">
            {getAccuracy() >= 90 && <div className="achievement">🎯 Accuracy Master</div>}
            {bestStreak >= 10 && <div className="achievement">🔥 Streak Champion</div>}
            {score >= 5000 && <div className="achievement">⭐ Speed Demon</div>}
            {totalAnswers === flashcards.length && getAccuracy() === 100 && (
              <div className="achievement">👑 Perfect Game</div>
            )}
          </div>
          
          <div className="game-over-actions">
            <button className="play-again-btn" onClick={() => {
              setGameStarted(false);
              setGameEnded(false);
            }}>
              🔄 Play Again
            </button>
            <button className="back-btn" onClick={() => navigate(-1)}>
              ← Back to Study
            </button>
          </div>
        </div>
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
            {currentIndex + 1} / {flashcards.length}
          </div>
        </div>
        <div className="hud-right">
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
            {(deckType === "Cloze" || deckType === "Image-Occlusion") ? (
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
              {(deckType === "Cloze" || deckType === "Image-Occlusion") ? (
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
                  Easy
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}