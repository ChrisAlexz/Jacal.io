import React from 'react';

export default function FlashcardType({ type, setType, disabled }) {
  return (
    <div className="flashcard-type-container">
      <label className="flashcard-type-label">Type:</label>
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        disabled={disabled}
        style={{ color: 'black' }}
      >
        <option value="Basic">Basic</option>
        <option value="Basic-Type">Basic (Type Answer)</option>
        <option value="Cloze">Cloze</option>
        <option value="Image-Occlusion">Image Occlusion</option>
      </select>
    </div>
  );
}