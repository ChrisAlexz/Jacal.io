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
            id={card.id}
            index={index}
            front={card.front}
            back={card.back}
            cardType={card.card_type}
            frontAudioUrl={card.front_audio_url}
            backAudioUrl={card.back_audio_url}
            updateFlashcard={updateFlashcard}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );
};

export default FlashcardList;