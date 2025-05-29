import React, { useState } from 'react';
import SimpleRichTextEditor from './SimpleRichTextEditor';
import "../styles/FlashcardInput.css";

export default function FlashcardInput({ addFlashcard, disabled, type }) {
  const [frontContent, setFrontContent] = useState('');
  const [backContent, setBackContent] = useState('');

  const handleCloze = () => {
    if (type !== 'Cloze') return;
    
    const selection = window.getSelection();
    
    // Check if there's selected text
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      
      if (selectedText.trim()) {
        // Create the cloze deletion
        const clozeText = `{{c1::${selectedText}}}`;
        
        // Replace the selected text with cloze format
        range.deleteContents();
        const textNode = document.createTextNode(clozeText);
        range.insertNode(textNode);
        
        // Clear selection
        selection.removeAllRanges();
        
        // Update the content state
        // We need to get the updated HTML from the editor
        setTimeout(() => {
          const frontEditor = document.querySelector('.front-editor .editor-content');
          if (frontEditor) {
            setFrontContent(frontEditor.innerHTML);
          }
        }, 10);
      }
    } else {
      // No text selected - show alert or add placeholder
      alert('Please select some text first to create a cloze deletion.');
    }
  };

  const clearContent = () => {
    setFrontContent('');
    setBackContent('');
  };

  const handleAdd = () => {
    if (type === 'Cloze') {
      if (!frontContent.trim()) return;
      addFlashcard(frontContent, backContent.trim() || frontContent);
    } else if (type === 'Basic-Type') {
      if (!frontContent.trim() || !backContent.trim()) return;
      addFlashcard(frontContent, backContent);
    } else {
      if (!frontContent.trim() || !backContent.trim()) return;
      addFlashcard(frontContent, backContent);
    }

    clearContent();
  };

  // Check if content is valid based on type
  const isContentValid = () => {
    const hasFrontContent = frontContent.replace(/<[^>]*>/g, '').trim() !== '';
    const hasBackContent = backContent.replace(/<[^>]*>/g, '').trim() !== '';
    
    if (type === 'Cloze') {
      return hasFrontContent;
    } else {
      return hasFrontContent && hasBackContent;
    }
  };

  // Get placeholder text based on type
  const getPlaceholders = () => {
    switch (type) {
      case 'Cloze':
        return {
          front: "Enter text with content to be hidden...",
          back: "Enter additional info (optional)..."
        };
      case 'Basic-Type':
        return {
          front: "Enter your question...",
          back: "Enter the exact answer to type..."
        };
      default:
        return {
          front: "Enter front side...",
          back: "Enter back side..."
        };
    }
  };

  const placeholders = getPlaceholders();

  return (
    <div className="flashcard-input">
      <h4>Front Side {type === 'Cloze' && <span>(Required)</span>}</h4>
      
      <div className="flashcard-box front-editor">
        <SimpleRichTextEditor
          value={frontContent}
          onChange={setFrontContent}
          placeholder={placeholders.front}
          readOnly={disabled}
        />
      </div>

      <h4>
        Back Side {type === 'Cloze' && <span>(Optional)</span>}
        {type === 'Basic-Type' && <span>(Exact Answer)</span>}
      </h4>
      
      <div className="flashcard-box">
        <SimpleRichTextEditor
          value={backContent}
          onChange={setBackContent}
          placeholder={placeholders.back}
          readOnly={disabled}
        />
      </div>

      {type === 'Basic-Type' && (
        <div style={{ marginBottom: '10px' }}>
          <small style={{ color: '#888', fontStyle: 'italic' }}>
            💡 Tip: Enter the exact answer users should type. Matching will be case-insensitive with trimmed spaces.
          </small>
        </div>
      )}

      {type === 'Cloze' && (
        <div style={{ marginBottom: '10px' }}>
          <button onClick={handleCloze} disabled={disabled} type="button">
            [c] Cloze
          </button>
          <small style={{ marginLeft: '10px', color: '#666' }}>
            Select text first, then click [c] to create cloze deletion
          </small>
        </div>
      )}

      <button 
        className="add-flashcard-btn" 
        onClick={handleAdd} 
        disabled={disabled || !isContentValid()}
      >
        Add Flashcard
      </button>
    </div>
  );
}