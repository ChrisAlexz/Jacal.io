// src/components/study/StudyCard.jsx - Modular study card component
import React from 'react';
import { sanitizeHTML } from '../../utils/validation';

const StudyCard = ({ 
  card, 
  showBack, 
  deckType, 
  currentIndex,
  isImageOcclusionCard,
  hasCustomBackContent,
  processClozeText,
  getCardType 
}) => {
  const currentCardType = getCardType(card, deckType);

  return (
    <div className="flashcard-study-box">
      <div className="flashcard-front">
        {isImageOcclusionCard ? (
          <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(card.front) }} />
        ) : currentCardType === "Cloze" ? (
          <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(processClozeText(card.front, showBack, 1)) }} />
        ) : (
          <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(card.front) }} />
        )}
      </div>

      {card.front_audio_url && (
        <div className="card-audio front-audio" key={`front-audio-${card.id}-${currentIndex}`}>
          <div style={{ padding: '12px', background: 'rgba(79, 172, 254, 0.1)', borderRadius: '8px' }}>
            <div style={{ marginBottom: '8px', color: '#4facfe', fontWeight: '600', fontSize: '0.9rem' }}>
              🎵 Front Audio
            </div>
            <audio controls style={{ width: '100%' }}>
              <source src={card.front_audio_url} type="audio/webm" />
              <source src={card.front_audio_url} type="audio/mp4" />
              <source src={card.front_audio_url} type="audio/mpeg" />
              Your browser does not support audio playback.
            </audio>
          </div>
        </div>
      )}

      {showBack && (
        <>
          {isImageOcclusionCard && (
            <div className="flashcard-back">
              <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(card.back) }} />
            </div>
          )}

          {!isImageOcclusionCard && (currentCardType !== "Cloze" || hasCustomBackContent) && (
            <div className="flashcard-back">
              <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(card.back) }} />
            </div>
          )}

          {card.back_audio_url && (
            <div className="card-audio back-audio" key={`back-audio-${card.id}-${currentIndex}`}>
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
        </>
      )}
    </div>
  );
};

export default StudyCard;