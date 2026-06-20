// src/components/study/TypeAnswerSection.jsx - Component for Basic-Type cards
import React from 'react';
import { sanitizeHTML } from '../../utils/validation';

const TypeAnswerSection = ({
  userAnswer,
  setUserAnswer,
  handleSubmitAnswer,
  showCorrectAnswer,
  isAnswerCorrect,
  card,
  currentIndex,
  intervalPreviews,
  handleDifficultyChoice
}) => {
  if (showCorrectAnswer) {
    return (
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
            <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(card.back) }} />
          </div>
        </div>
        
        {card.back_audio_url && (
          <div className="card-audio back-audio" key={`back-audio-basic-${card.id}-${currentIndex}`}>
            <div style={{ padding: '12px', background: 'rgba(40, 167, 69, 0.1)', borderRadius: '8px' }}>
              <div style={{ marginBottom: '8px', color: '#28a745', fontWeight: '600', fontSize: '0.9rem' }}>
                🎵 Back Audio
              </div>
              <audio controls style={{ width: '100%' }}>
                <source src={card.back_audio_url} type="audio/webm" />
                <source src={card.back_audio_url} type="audio/mp4" />
                <source src={card.back_audio_url} type="audio/mpeg" />
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
    );
  }

  return (
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
  );
};

export default TypeAnswerSection;