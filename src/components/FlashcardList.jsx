// src/components/FlashcardList.jsx - UPDATED WITH CARD TYPE SUPPORT
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
            updateFlashcard={updateFlashcard}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );
};

export default FlashcardList;