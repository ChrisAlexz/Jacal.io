import React, { useState } from 'react';
import SimpleRichTextEditor from './SimpleRichTextEditor';
import ImageOcclusionEditor from './ImageOcclusionEditor';
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
    } else if (type === 'Image-Occlusion') {
      // Image occlusion cards are handled by the ImageOcclusionEditor
      return;
    } else {
      if (!frontContent.trim() || !backContent.trim()) return;
      addFlashcard(frontContent, backContent);
    }

    clearContent();
  };

  const handleImageOcclusionSave = (cards) => {
    // Add each image occlusion card
    cards.forEach(card => {
      // Get canvas dimensions for percentage calculations
      const canvas = document.querySelector('.image-occlusion-editor canvas');
      if (!canvas) return;
      
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      // FRONT CARD: Hide ONLY the target answer, show others as context
      const frontHTML = `
        <div class="image-occlusion-card">
          <img src="${card.imageUrl}" alt="${card.title}" class="occlusion-image" />
          <div class="occlusion-overlay">
            ${card.occlusions.map(occlusion => 
              occlusion.id === card.revealedId
                ? `<div class="occlusion-mask" style="
                    position: absolute; 
                    left: ${(occlusion.x / canvasWidth) * 100}%; 
                    top: ${(occlusion.y / canvasHeight) * 100}%; 
                    width: ${(occlusion.width / canvasWidth) * 100}%; 
                    height: ${(occlusion.height / canvasHeight) * 100}%; 
                    background: rgba(0, 0, 0, 0.95);
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #4facfe;
                    font-weight: bold;
                    font-size: min(18px, ${Math.max(14, (occlusion.width / canvasWidth) * 200)}px);
                    border: 2px solid #4facfe;
                  ">${occlusion.id}</div>`
                : `<div class="occlusion-visible" style="
                    position: absolute; 
                    left: ${(occlusion.x / canvasWidth) * 100}%; 
                    top: ${(occlusion.y / canvasHeight) * 100}%; 
                    width: ${(occlusion.width / canvasWidth) * 100}%; 
                    height: ${(occlusion.height / canvasHeight) * 100}%; 
                    border: 2px solid rgba(255, 255, 255, 0.4);
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: rgba(255, 255, 255, 0.6);
                    font-weight: bold;
                    font-size: min(14px, ${Math.max(12, (occlusion.width / canvasWidth) * 150)}px);
                    background: rgba(255, 255, 255, 0.08);
                  ">${occlusion.id}</div>`
            ).join('')}
          </div>
        </div>
      `;
      
      // BACK CARD: Highlight the answer, dim others
      const backHTML = `
        <div class="image-occlusion-card">
          <img src="${card.imageUrl}" alt="${card.title}" class="occlusion-image" />
          <div class="occlusion-overlay">
            ${card.occlusions.map(occlusion => 
              occlusion.id === card.revealedId
                ? `<div class="occlusion-answer" style="
                    position: absolute; 
                    left: ${(occlusion.x / canvasWidth) * 100}%; 
                    top: ${(occlusion.y / canvasHeight) * 100}%; 
                    width: ${(occlusion.width / canvasWidth) * 100}%; 
                    height: ${(occlusion.height / canvasHeight) * 100}%; 
                    border: 3px solid #4facfe;
                    background: rgba(79, 172, 254, 0.25);
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #4facfe;
                    font-weight: bold;
                    font-size: min(18px, ${Math.max(14, (occlusion.width / canvasWidth) * 200)}px);
                    box-shadow: 0 0 10px rgba(79, 172, 254, 0.5);
                  ">${occlusion.id}</div>`
                : `<div class="occlusion-other" style="
                    position: absolute; 
                    left: ${(occlusion.x / canvasWidth) * 100}%; 
                    top: ${(occlusion.y / canvasHeight) * 100}%; 
                    width: ${(occlusion.width / canvasWidth) * 100}%; 
                    height: ${(occlusion.height / canvasHeight) * 100}%; 
                    border: 2px solid rgba(255, 255, 255, 0.25);
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: rgba(255, 255, 255, 0.5);
                    font-weight: bold;
                    font-size: min(14px, ${Math.max(12, (occlusion.width / canvasWidth) * 150)}px);
                    background: rgba(255, 255, 255, 0.05);
                  ">${occlusion.id}</div>`
            ).join('')}
          </div>
        </div>
      `;
      
      addFlashcard(frontHTML, backHTML);
    });
  };

  // Check if content is valid based on type
  const isContentValid = () => {
    if (type === 'Image-Occlusion') {
      return false; // Handled by ImageOcclusionEditor
    }
    
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
      case 'Image-Occlusion':
        return {
          front: "Image occlusion cards are created using the editor above",
          back: "Image occlusion cards are created using the editor above"
        };
      default:
        return {
          front: "Enter front side...",
          back: "Enter back side..."
        };
    }
  };

  const placeholders = getPlaceholders();

  // Render Image Occlusion Editor for Image-Occlusion type
  if (type === 'Image-Occlusion') {
    return (
      <div className="flashcard-input">
        <ImageOcclusionEditor 
          onSave={handleImageOcclusionSave} 
          disabled={disabled}
        />
      </div>
    );
  }

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