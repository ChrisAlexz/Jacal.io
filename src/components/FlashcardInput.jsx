// src/components/FlashcardInput.jsx - NO LIMITS VERSION
import { logger } from '../utils/logger';
import React, { useState, useContext, useRef } from 'react';
import SimpleRichTextEditor from './SimpleRichTextEditor';
import ImageOcclusionEditor from './ImageOcclusionEditor';
import UserAuthContext from './context/UserAuthContext';
import "../styles/FlashcardInput.css";

export default function FlashcardInput({ addFlashcard, disabled, type, isPerCardMode = false, setId, currentCardCount = 0 }) {
  const { user } = useContext(UserAuthContext);
  const [frontContent, setFrontContent] = useState('');
  const [backContent, setBackContent] = useState('');
  const [currentCardType, setCurrentCardType] = useState(type || 'Basic');
  const [frontAudioUrl, setFrontAudioUrl] = useState(null);
  const [backAudioUrl, setBackAudioUrl] = useState(null);

  // Imperative handles to the rich-text editors (cloze insertion, clearing).
  const frontEditorRef = useRef(null);
  const backEditorRef = useRef(null);

  const activeType = isPerCardMode ? currentCardType : (type || 'Basic');

  const getValidCardType = (cardType) => {
    const validTypes = ['Basic', 'Basic-Type', 'Cloze', 'Image-Occlusion'];
    return validTypes.includes(cardType) ? cardType : 'Basic';
  };

  const handleCloze = () => {
    if (activeType !== 'Cloze') return;

    const inserted = frontEditorRef.current?.insertCloze();
    if (!inserted) {
      alert('Please select some text first to create a cloze deletion.');
    }
  };

  const clearContent = () => {
    logger.debug('Clearing content...');
    setFrontContent('');
    setBackContent('');
    setFrontAudioUrl(null);
    setBackAudioUrl(null);

    if (isPerCardMode) {
      setCurrentCardType(type || 'Basic');
    }

    frontEditorRef.current?.clear();
    backEditorRef.current?.clear();

    logger.debug('Content cleared successfully');
  };

  const handleAdd = () => {
    const finalCardType = getValidCardType(activeType);
    
    logger.debug('🔄 handleAdd called with:', {
      finalCardType,
      frontContent: (frontContent || '').substring(0, 50),
      backContent: (backContent || '').substring(0, 50),
      frontAudio: frontAudioUrl ? 'Yes' : 'No',
      backAudio: backAudioUrl ? 'Yes' : 'No'
    });

    const cleanFront = (frontContent || '').replace(/<[^>]*>/g, '').trim();
    const cleanBack = (backContent || '').replace(/<[^>]*>/g, '').trim();

    // Validation based on card type
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
      logger.warn('⚠️ Image occlusion cards should be handled by ImageOcclusionEditor');
      return;
    } else {
      if ((!cleanFront && !frontAudioUrl) || (!cleanBack && !backAudioUrl)) {
        alert('Please add content or audio for both front and back sides.');
        return;
      }
      addFlashcard(frontContent, backContent, finalCardType, frontAudioUrl, backAudioUrl);
    }

    clearContent();
  };

  const handleImageOcclusionSave = (cards) => {
    // The editor produces ready-to-store front/back HTML (one card per masked box).
    logger.debug('Image occlusion save:', cards.length, 'cards');
    cards.forEach((card) => {
      addFlashcard(card.front, card.back, 'Image-Occlusion');
    });
  };

  const isContentValid = () => {
    if (activeType === 'Image-Occlusion') {
      return false;
    }
    
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
      {/* NO LIMIT INFORMATION - All removed */}

      {/* Per-card type selector */}
      {isPerCardMode && (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', color: 'white', fontWeight: 600, marginBottom: '8px' }}>
            Card Type:
          </label>
          <select
            className="card-type-select"
            value={currentCardType}
            onChange={(e) => setCurrentCardType(e.target.value)}
            disabled={disabled}
          >
            <option value="Basic">Basic</option>
            <option value="Basic-Type">Basic (Type Answer)</option>
            <option value="Cloze">Cloze</option>
            <option value="Image-Occlusion">Image Occlusion</option>
          </select>
        </div>
      )}

      {activeType === 'Image-Occlusion' ? (
        <>
          {/* NO LIMIT WARNINGS - All removed */}
          <ImageOcclusionEditor 
            onSave={handleImageOcclusionSave} 
            disabled={disabled}
          />
        </>
      ) : (
        <>
          <h4>Front Side {activeType === 'Cloze' && <span>(Required)</span>}</h4>
          
          <div className="flashcard-box front-editor">
            <SimpleRichTextEditor
              ref={frontEditorRef}
              value={frontContent}
              onChange={setFrontContent}
              placeholder={placeholders.front}
              readOnly={disabled}
              onAudioChange={setFrontAudioUrl}
              initialAudioUrl={frontAudioUrl}
              user={user}
            />
          </div>

          <h4>
            Back Side {activeType === 'Cloze' && <span>(Optional)</span>}
            {activeType === 'Basic-Type' && <span>(Exact Answer)</span>}
          </h4>
          
          <div className="flashcard-box back-editor">
            <SimpleRichTextEditor
              ref={backEditorRef}
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
                Tip: Enter the exact answer users should type. Matching will be case-insensitive with trimmed spaces.
              </small>
            </div>
          )}

          {activeType === 'Cloze' && (
            <div style={{ marginBottom: '10px' }}>
              <button
                className="cloze-btn"
                onClick={handleCloze}
                disabled={disabled}
                type="button"
              >
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
            style={{
              opacity: (disabled || !isContentValid()) ? 0.6 : 1,
              cursor: (disabled || !isContentValid()) ? 'not-allowed' : 'pointer'
            }}
          >
            {`Add Flashcard (${getValidCardType(activeType)})`}
          </button>
        </>
      )}
    </div>
  );
}