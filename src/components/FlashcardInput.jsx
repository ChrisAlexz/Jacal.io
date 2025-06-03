// src/components/FlashcardInput.jsx - FIXED VERSION WITH PROPER STRUCTURE
import React, { useState } from 'react';
import SimpleRichTextEditor from './SimpleRichTextEditor';
import ImageOcclusionEditor from './ImageOcclusionEditor';
import "../styles/FlashcardInput.css";

export default function FlashcardInput({ addFlashcard, disabled, type, isPerCardMode = false }) {
  const [frontContent, setFrontContent] = useState('');
  const [backContent, setBackContent] = useState('');
  const [currentCardType, setCurrentCardType] = useState(type);

  // Use per-card type if in per-card mode, otherwise use set type
  const activeType = isPerCardMode ? currentCardType : type;

  const handleCloze = () => {
    if (activeType !== 'Cloze') return;
    
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
    console.log('🧹 Clearing content...');
    setFrontContent('');
    setBackContent('');
    
    // Reset to default type if in per-card mode
    if (isPerCardMode) {
      setCurrentCardType(type);
    }
    
    // Force clear the rich text editors by directly manipulating DOM
    setTimeout(() => {
      const frontEditor = document.querySelector('.front-editor .editor-content');
      const backEditor = document.querySelector('.flashcard-box .editor-content');
      
      if (frontEditor) {
        frontEditor.innerHTML = '';
        console.log('🧹 Front editor cleared');
      }
      if (backEditor) {
        backEditor.innerHTML = '';
        console.log('🧹 Back editor cleared');
      }
    }, 100);
    
    console.log('✅ Content cleared successfully');
  };

  const handleAdd = () => {
    console.log('🔄 handleAdd called with:', {
      activeType,
      frontContent: frontContent.substring(0, 50),
      backContent: backContent.substring(0, 50),
      frontLength: frontContent.length,
      backLength: backContent.length
    });

    // CRITICAL FIX: Better content validation
    const cleanFront = frontContent.replace(/<[^>]*>/g, '').trim();
    const cleanBack = backContent.replace(/<[^>]*>/g, '').trim();

    console.log('📝 Cleaned content:', {
      cleanFront: cleanFront.substring(0, 50),
      cleanBack: cleanBack.substring(0, 50),
      cleanFrontLength: cleanFront.length,
      cleanBackLength: cleanBack.length
    });

    // Validation based on card type
    if (activeType === 'Cloze') {
      if (!cleanFront) {
        console.warn('❌ Cloze card missing front content');
        alert('Please add front content for Cloze cards.');
        return;
      }
      // For cloze, back is optional but if empty, use front content
      const finalBack = cleanBack || frontContent;
      console.log('✅ Adding Cloze card');
      addFlashcard(frontContent, finalBack, activeType);
    } else if (activeType === 'Basic-Type') {
      if (!cleanFront || !cleanBack) {
        console.warn('❌ Basic-Type card missing required content:', { 
          cleanFront: !!cleanFront, 
          cleanBack: !!cleanBack 
        });
        alert('Please fill in both front and back content for Basic-Type cards.');
        return;
      }
      console.log('✅ Adding Basic-Type card');
      addFlashcard(frontContent, backContent, activeType);
    } else if (activeType === 'Image-Occlusion') {
      console.warn('⚠️ Image occlusion cards should be handled by ImageOcclusionEditor');
      return;
    } else {
      // Basic or other types
      if (!cleanFront || !cleanBack) {
        console.warn('❌ Basic card missing required content:', { 
          cleanFront: !!cleanFront, 
          cleanBack: !!cleanBack 
        });
        alert('Please fill in both front and back content.');
        return;
      }
      console.log('✅ Adding Basic card');
      addFlashcard(frontContent, backContent, activeType);
    }

    // Clear content after successful add
    console.log('🧹 Clearing input content...');
    clearContent();
  };

  const handleImageOcclusionSave = (cards) => {
    console.log('🖼️ Image occlusion save called with', cards.length, 'cards');
    
    // Add each image occlusion card
    cards.forEach((card, index) => {
      console.log(`🃏 Adding image occlusion card ${index + 1}:`, card.title);
      
      // Get canvas dimensions for percentage calculations
      const canvas = document.querySelector('.image-occlusion-editor canvas');
      if (!canvas) {
        console.error('❌ Canvas not found for image occlusion');
        return;
      }
      
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      // FRONT CARD: All areas masked, active question has different styling
      const frontHTML = `
        <div class="image-occlusion-card">
          <img src="${card.imageUrl}" alt="${card.title}" class="occlusion-image" />
          <div class="occlusion-overlay">
            ${card.occlusions.map(occlusion => {
              const isActive = occlusion.id === card.revealedId;
              const leftPercent = (occlusion.x / canvasWidth) * 100;
              const topPercent = (occlusion.y / canvasHeight) * 100;
              const widthPercent = (occlusion.width / canvasWidth) * 100;
              const heightPercent = (occlusion.height / canvasHeight) * 100;
              const fontSize = Math.max(12, Math.min(18, (occlusion.width / canvasWidth) * 150));
              
              if (isActive) {
                return `<div class="occlusion-question-active" style="
                  left: ${leftPercent}%; 
                  top: ${topPercent}%; 
                  width: ${widthPercent}%; 
                  height: ${heightPercent}%; 
                  font-size: ${fontSize}px;
                ">${occlusion.id}</div>`;
              } else {
                return `<div class="occlusion-blocked" style="
                  left: ${leftPercent}%; 
                  top: ${topPercent}%; 
                  width: ${widthPercent}%; 
                  height: ${heightPercent}%; 
                  font-size: ${Math.max(10, fontSize * 0.8)}px;
                ">${occlusion.id}</div>`;
              }
            }).join('')}
          </div>
        </div>
      `;
      
      // BACK CARD: Only reveal the active answer, keep ALL others blocked
      const backHTML = `
        <div class="image-occlusion-card">
          <img src="${card.imageUrl}" alt="${card.title}" class="occlusion-image" />
          <div class="occlusion-overlay">
            ${card.occlusions.map(occlusion => {
              const isActive = occlusion.id === card.revealedId;
              const leftPercent = (occlusion.x / canvasWidth) * 100;
              const topPercent = (occlusion.y / canvasHeight) * 100;
              const widthPercent = (occlusion.width / canvasWidth) * 100;
              const heightPercent = (occlusion.height / canvasHeight) * 100;
              const fontSize = Math.max(12, Math.min(18, (occlusion.width / canvasWidth) * 150));
              
              if (isActive) {
                return `<div class="occlusion-answer-revealed" style="
                  left: ${leftPercent}%; 
                  top: ${topPercent}%; 
                  width: ${widthPercent}%; 
                  height: ${heightPercent}%; 
                  font-size: 0px;
                "></div>`;
              } else {
                return `<div class="occlusion-blocked" style="
                  left: ${leftPercent}%; 
                  top: ${topPercent}%; 
                  width: ${widthPercent}%; 
                  height: ${heightPercent}%; 
                  font-size: ${Math.max(10, fontSize * 0.8)}px;
                ">${occlusion.id}</div>`;
              }
            }).join('')}
          </div>
        </div>
      `;
      
      addFlashcard(frontHTML, backHTML, 'Image-Occlusion');
    });
  };

  // Check if content is valid based on type
  const isContentValid = () => {
    if (activeType === 'Image-Occlusion') {
      return false; // Handled by ImageOcclusionEditor
    }
    
    const hasFrontContent = frontContent.replace(/<[^>]*>/g, '').trim() !== '';
    const hasBackContent = backContent.replace(/<[^>]*>/g, '').trim() !== '';
    
    if (activeType === 'Cloze') {
      return hasFrontContent;
    } else {
      return hasFrontContent && hasBackContent;
    }
  };

  // Get placeholder text based on type
  const getPlaceholders = () => {
    switch (activeType) {
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
          front: "Image occlusion cards are created using the editor below",
          back: "Image occlusion cards are created using the editor below"
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
      {/* Per-card type selector - ALWAYS VISIBLE when in per-card mode */}
      {isPerCardMode && (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: 'white', fontWeight: 600, marginBottom: '8px' }}>
            Card Type:
          </label>
          <select
            value={currentCardType}
            onChange={(e) => setCurrentCardType(e.target.value)}
            disabled={disabled}
            style={{
              padding: '8px 12px',
              background: '#2a2a2a',
              border: '2px solid #333',
              borderRadius: '8px',
              color: 'white',
              fontSize: '1rem'
            }}
          >
            <option value="Basic">Basic</option>
            <option value="Basic-Type">Basic (Type Answer)</option>
            <option value="Cloze">Cloze</option>
            <option value="Image-Occlusion">Image Occlusion</option>
          </select>
        </div>
      )}

      {/* Render Image Occlusion Editor for Image-Occlusion type */}
      {activeType === 'Image-Occlusion' ? (
        <ImageOcclusionEditor 
          onSave={handleImageOcclusionSave} 
          disabled={disabled}
        />
      ) : (
        <>
          {/* Regular card input fields for non-Image-Occlusion types */}
          <h4>Front Side {activeType === 'Cloze' && <span>(Required)</span>}</h4>
          
          <div className="flashcard-box front-editor">
            <SimpleRichTextEditor
              value={frontContent}
              onChange={setFrontContent}
              placeholder={placeholders.front}
              readOnly={disabled}
            />
          </div>

          <h4>
            Back Side {activeType === 'Cloze' && <span>(Optional)</span>}
            {activeType === 'Basic-Type' && <span>(Exact Answer)</span>}
          </h4>
          
          <div className="flashcard-box">
            <SimpleRichTextEditor
              value={backContent}
              onChange={setBackContent}
              placeholder={placeholders.back}
              readOnly={disabled}
            />
          </div>

          {activeType === 'Basic-Type' && (
            <div style={{ marginBottom: '10px' }}>
              <small style={{ color: '#888', fontStyle: 'italic' }}>
                💡 Tip: Enter the exact answer users should type. Matching will be case-insensitive with trimmed spaces.
              </small>
            </div>
          )}

          {activeType === 'Cloze' && (
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
            Add Flashcard ({activeType})
          </button>
        </>
      )}
    </div>
  );
}