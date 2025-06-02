// src/components/FlashcardType.jsx - FIXED VERSION
import React from 'react';

export default function FlashcardType({ type, setType, disabled, isPerCard = false, onPerCardToggle }) {
  return (
    <div className="flashcard-type-container">
      <label className="flashcard-type-label">Type:</label>
      
      {/* Toggle between set-wide and per-card typing */}
      <div className="type-mode-toggle" style={{ marginBottom: '8px' }}>
        <label style={{ fontSize: '0.8rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="checkbox"
            checked={isPerCard}
            onChange={(e) => onPerCardToggle && onPerCardToggle(e.target.checked)}
            style={{ transform: 'scale(0.9)' }}
          />
          Allow different types per card
        </label>
      </div>

      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        disabled={disabled || isPerCard}
        style={{ 
          color: 'black',
          opacity: isPerCard ? 0.6 : 1
        }}
        title={isPerCard ? "Per-card mode enabled - select type when adding each card" : ""}
      >
        <option value="Basic">Basic</option>
        <option value="Basic-Type">Basic (Type Answer)</option>
        <option value="Cloze">Cloze</option>
        <option value="Image-Occlusion">Image Occlusion</option>
      </select>
      
      {isPerCard && (
        <small style={{ color: '#888', fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>
          You can choose the type for each individual flashcard when adding them
        </small>
      )}
    </div>
  );
}