// src/components/FlashcardList.jsx - UPDATED WITH AUDIO SUPPORT
import React from 'react';
import FlashcardItem from './FlashcardItem';
import '../styles/FlashcardList.css';

const FlashcardList = ({ flashcards, updateFlashcard, onDelete }) => {
  return (
    <div className="flashcard-list">
      {flashcards.length === 0 ? (
        <p>No flashcards added yet.</p>
      ) : (
        flashcards.map((card, index) => (
          <FlashcardItem
            key={card.id || index}
            index={index}
            front={card.front}
            back={card.back}
            cardType={card.card_type} // Pass the card type
            frontAudioUrl={card.front_audio_url} // Pass front audio URL
            backAudioUrl={card.back_audio_url} // Pass back audio URL
            updateFlashcard={updateFlashcard}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );
};

export default FlashcardList;