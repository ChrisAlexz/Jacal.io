import React, { useState, useEffect } from 'react';
import SimpleRichTextEditor from './SimpleRichTextEditor';
import '../styles/FlashcardList.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';

const FlashcardItem = ({ index, front, back, updateFlashcard, onDelete }) => {
  const [frontContent, setFrontContent] = useState('');
  const [backContent, setBackContent] = useState('');

  // Initialize content when component mounts or props change
  useEffect(() => {
    if (typeof front === 'string') {
      setFrontContent(front);
    }
    if (typeof back === 'string') {
      setBackContent(back);
    }
  }, [front, back]);

  // Handle content changes with debouncing to avoid too many updates
  const handleFrontChange = (content) => {
    setFrontContent(content);
    // Debounce the update to avoid excessive API calls
    const timeoutId = setTimeout(() => {
      updateFlashcard(index, { front: content });
    }, 500);
    
    // Store timeout ID for cleanup
    handleFrontChange.timeoutId = timeoutId;
  };

  const handleBackChange = (content) => {
    setBackContent(content);
    // Debounce the update to avoid excessive API calls
    const timeoutId = setTimeout(() => {
      updateFlashcard(index, { back: content });
    }, 500);
    
    // Store timeout ID for cleanup
    handleBackChange.timeoutId = timeoutId;
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (handleFrontChange.timeoutId) {
        clearTimeout(handleFrontChange.timeoutId);
      }
      if (handleBackChange.timeoutId) {
        clearTimeout(handleBackChange.timeoutId);
      }
    };
  }, []);

  return (
    <div className="flashcard-item">
      <div className="flashcard-top-row">
        <div className="index-num">{index + 1}</div>
        <button className="delete-btn" onClick={() => onDelete(index)}>
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>

      <div className="front-back">
        <div className="front">
          <label>Front</label>
          <div className="editor-container">
            <SimpleRichTextEditor
              value={frontContent}
              onChange={handleFrontChange}
            />
          </div>
        </div>

        <div className="back">
          <label>Back</label>
          <div className="editor-container">
            <SimpleRichTextEditor
              value={backContent}
              onChange={handleBackChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlashcardItem;