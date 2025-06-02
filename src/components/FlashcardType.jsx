// src/components/FlashcardType.jsx - AUTO MIXED MODE VERSION
import React, { useEffect } from 'react';

export default function FlashcardType({ type, setType, disabled, isPerCard = false, onPerCardToggle }) {
  
  // Automatically enable per-card mode when component mounts
  useEffect(() => {
    if (onPerCardToggle && !isPerCard) {
      onPerCardToggle(true);
    }
  }, [onPerCardToggle, isPerCard]);

  return (
    <div className="flashcard-type-container">
      <label className="flashcard-type-label">Default Type:</label>
      
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        disabled={disabled}
        style={{ 
          color: 'black',
          opacity: 0.8
        }}
        title="Default type for new cards - you can change the type for each individual card when adding them"
      >
        <option value="Basic">Basic</option>
        <option value="Basic-Type">Basic (Type Answer)</option>
        <option value="Cloze">Cloze</option>
        <option value="Image-Occlusion">Image Occlusion</option>
      </select>
      
      <small style={{ color: '#888', fontSize: '0.75rem', display: 'block', marginTop: '4px' }}>
        You can choose the type for each individual flashcard when adding them
      </small>
    </div>
  );
}