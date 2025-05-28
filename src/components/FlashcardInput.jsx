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

  return (
    <div className="flashcard-input">
      <h4>Front Side {type === 'Cloze' && <span>(Required)</span>}</h4>
      
      <div className="flashcard-box front-editor">
        <SimpleRichTextEditor
          value={frontContent}
          onChange={setFrontContent}
          placeholder={type === 'Cloze' 
            ? "Enter text with content to be hidden..." 
            : "Enter front side..."}
          readOnly={disabled}
        />
      </div>

      <h4>Back Side {type === 'Cloze' && <span>(Optional)</span>}</h4>
      
      <div className="flashcard-box">
        <SimpleRichTextEditor
          value={backContent}
          onChange={setBackContent}
          placeholder={type === 'Cloze' 
            ? "Enter additional info (optional)..." 
            : "Enter back side..."}
          readOnly={disabled}
        />
      </div>

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