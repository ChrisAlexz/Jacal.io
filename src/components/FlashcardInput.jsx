// src/components/FlashcardInput.jsx - COMPLETE WITH ENHANCED IMAGE OCCLUSION
import React, { useState, useContext } from 'react';
import SimpleRichTextEditor from './SimpleRichTextEditor';
import ImageOcclusionEditor from './ImageOcclusionEditor';
import UserAuthContext from './context/UserAuthContext';
import "../styles/FlashcardInput.css";

export default function FlashcardInput({ addFlashcard, disabled, type, isPerCardMode = false }) {
  const { user } = useContext(UserAuthContext);
  const [frontContent, setFrontContent] = useState('');
  const [backContent, setBackContent] = useState('');
  const [currentCardType, setCurrentCardType] = useState(type || 'Basic');
  const [frontAudioUrl, setFrontAudioUrl] = useState(null);
  const [backAudioUrl, setBackAudioUrl] = useState(null);

  // Use per-card type if in per-card mode, otherwise use set type
  const activeType = isPerCardMode ? currentCardType : (type || 'Basic');

  // Ensure we always have a valid card type
  const getValidCardType = (cardType) => {
    const validTypes = ['Basic', 'Basic-Type', 'Cloze', 'Image-Occlusion'];
    return validTypes.includes(cardType) ? cardType : 'Basic';
  };

  const handleCloze = () => {
    if (activeType !== 'Cloze') return;
    
    const selection = window.getSelection();
    
    if (selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      
      if (selectedText.trim()) {
        const clozeText = `{{c1::${selectedText}}}`;
        range.deleteContents();
        const textNode = document.createTextNode(clozeText);
        range.insertNode(textNode);
        selection.removeAllRanges();
        
        setTimeout(() => {
          const frontEditor = document.querySelector('.front-editor .editor-content');
          if (frontEditor) {
            setFrontContent(frontEditor.innerHTML);
          }
        }, 10);
      }
    } else {
      alert('Please select some text first to create a cloze deletion.');
    }
  };

  const clearContent = () => {
    console.log('🧹 Clearing content...');
    setFrontContent('');
    setBackContent('');
    setFrontAudioUrl(null);
    setBackAudioUrl(null);
    
    if (isPerCardMode) {
      setCurrentCardType(type || 'Basic');
    }
    
    setTimeout(() => {
      const frontEditor = document.querySelector('.front-editor .editor-content');
      const backEditor = document.querySelector('.back-editor .editor-content');
      
      if (frontEditor) {
        frontEditor.innerHTML = '';
      }
      if (backEditor) {
        backEditor.innerHTML = '';
      }
    }, 100);
    
    console.log('✅ Content cleared successfully');
  };

  const handleAdd = () => {
    const finalCardType = getValidCardType(activeType);
    
    console.log('🔄 handleAdd called with:', {
      finalCardType,
      frontContent: (frontContent || '').substring(0, 50),
      backContent: (backContent || '').substring(0, 50),
      frontAudio: frontAudioUrl ? 'Yes' : 'No',
      backAudio: backAudioUrl ? 'Yes' : 'No'
    });

    // FIXED: Ensure frontContent and backContent are strings before calling replace
    const cleanFront = (frontContent || '').replace(/<[^>]*>/g, '').trim();
    const cleanBack = (backContent || '').replace(/<[^>]*>/g, '').trim();

    // Validation based on card type - allow audio-only cards
    if (finalCardType === 'Cloze') {
      if (!cleanFront && !frontAudioUrl) {
        alert('Please add front content or audio for Cloze cards.');
        return;
      }
      const finalBack = cleanBack || frontContent;
      addFlashcard(frontContent, finalBack, finalCardType, frontAudioUrl, backAudioUrl);
    } else if (finalCardType === 'Basic-Type') {
      if ((!cleanFront && !frontAudioUrl) || (!cleanBack && !backAudioUrl)) {
        alert('Please add content or audio for both front and back sides of Basic-Type cards.');
        return;
      }
      addFlashcard(frontContent, backContent, finalCardType, frontAudioUrl, backAudioUrl);
    } else if (finalCardType === 'Image-Occlusion') {
      console.warn('⚠️ Image occlusion cards should be handled by ImageOcclusionEditor');
      return;
    } else {
      // Basic or other types - allow audio-only cards
      if ((!cleanFront && !frontAudioUrl) || (!cleanBack && !backAudioUrl)) {
        alert('Please add content or audio for both front and back sides.');
        return;
      }
      addFlashcard(frontContent, backContent, finalCardType, frontAudioUrl, backAudioUrl);
    }

    clearContent();
  };

  const handleImageOcclusionSave = (cards) => {
    console.log('🖼️ Image occlusion save called with', cards.length, 'cards');
    
    cards.forEach((card, index) => {
      console.log(`🃏 Adding image occlusion card ${index + 1}:`, card.title);
      
      const canvas = document.querySelector('.image-occlusion-editor canvas');
      if (!canvas) {
        console.error('❌ Canvas not found for image occlusion');
        return;
      }
      
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
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

  // FIXED: Check if content is valid based on type - handle undefined values
  const isContentValid = () => {
    if (activeType === 'Image-Occlusion') {
      return false; // Handled by ImageOcclusionEditor
    }
    
    // FIXED: Ensure content is a string before calling replace
    const safeFrontContent = frontContent || '';
    const safeBackContent = backContent || '';
    
    const hasFrontContent = safeFrontContent.replace(/<[^>]*>/g, '').trim() !== '';
    const hasBackContent = safeBackContent.replace(/<[^>]*>/g, '').trim() !== '';
    const hasFrontAudio = !!frontAudioUrl;
    const hasBackAudio = !!backAudioUrl;
    
    if (activeType === 'Cloze') {
      return hasFrontContent || hasFrontAudio;
    } else {
      return (hasFrontContent || hasFrontAudio) && (hasBackContent || hasBackAudio);
    }
  };

  // Get placeholder text based on type
  const getPlaceholders = () => {
    switch (activeType) {
      case 'Cloze':
        return {
          front: "Enter text with content to be hidden, or add audio...",
          back: "Enter additional info (optional), or add audio..."
        };
      case 'Basic-Type':
        return {
          front: "Enter your question, or add audio...",
          back: "Enter the exact answer to type, or add audio..."
        };
      case 'Image-Occlusion':
        return {
          front: "Image occlusion cards are created using the editor below",
          back: "Image occlusion cards are created using the editor below"
        };
      default:
        return {
          front: "Enter front side, or add audio...",
          back: "Enter back side, or add audio..."
        };
    }
  };

  const placeholders = getPlaceholders();

  return (
    <div className="flashcard-input">
      {/* Per-card type selector */}
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
          {/* Front Side Editor with Audio Toolbar */}
          <h4>Front Side {activeType === 'Cloze' && <span>(Required)</span>}</h4>
          
          <div className="flashcard-box front-editor">
            <SimpleRichTextEditor
              value={frontContent}
              onChange={setFrontContent}
              placeholder={placeholders.front}
              readOnly={disabled}
              onAudioChange={setFrontAudioUrl}
              initialAudioUrl={frontAudioUrl}
              user={user}
            />
          </div>

          {/* Back Side Editor with Audio Toolbar */}
          <h4>
            Back Side {activeType === 'Cloze' && <span>(Optional)</span>}
            {activeType === 'Basic-Type' && <span>(Exact Answer)</span>}
          </h4>
          
          <div className="flashcard-box back-editor">
            <SimpleRichTextEditor
              value={backContent}
              onChange={setBackContent}
              placeholder={placeholders.back}
              readOnly={disabled}
              onAudioChange={setBackAudioUrl}
              initialAudioUrl={backAudioUrl}
              user={user}
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
            Add Flashcard ({getValidCardType(activeType)})
          </button>
        </>
      )}
    </div>
  );
}