import React, { useRef, useEffect, useContext, useCallback } from 'react';
import SimpleRichTextEditor from './SimpleRichTextEditor';
import AudioPlayer from './AudioPlayer';
import UserAuthContext from './context/UserAuthContext';
import '../styles/FlashcardList.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { sanitizeHTML } from '../utils/sanitize';

const DEBOUNCE_MS = 400;

function FlashcardItem({
  id,
  index,
  front,
  back,
  updateFlashcard,
  onDelete,
  cardType,
  frontAudioUrl,
  backAudioUrl,
  isStudyMode = false,
}) {
  const { user } = useContext(UserAuthContext);

  // One debounce timer per field — cleared before each new keystroke so we
  // persist once the user pauses instead of on every change.
  const frontTimer = useRef(null);
  const backTimer = useRef(null);

  const debounce = (timerRef, patch) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => updateFlashcard(id, patch), DEBOUNCE_MS);
  };

  const handleFrontChange = useCallback(
    (content) => debounce(frontTimer, { front: content }),
    [id, updateFlashcard]
  );
  const handleBackChange = useCallback(
    (content) => debounce(backTimer, { back: content }),
    [id, updateFlashcard]
  );

  // Audio attach/remove is a discrete action — persist immediately.
  const handleFrontAudioChange = useCallback(
    (url) => updateFlashcard(id, { front_audio_url: url }),
    [id, updateFlashcard]
  );
  const handleBackAudioChange = useCallback(
    (url) => updateFlashcard(id, { back_audio_url: url }),
    [id, updateFlashcard]
  );

  useEffect(
    () => () => {
      clearTimeout(frontTimer.current);
      clearTimeout(backTimer.current);
    },
    []
  );

  const isImageOcclusionCard =
    cardType === 'Image-Occlusion' ||
    (front && (front.includes('image-occlusion-card') || front.includes('occlusion-')));

  const renderContent = (content, isBack = false, audioUrl = null) => {
    if (isImageOcclusionCard) {
      return (
        <div className="image-occlusion-preview">
          <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(content) }} />
          <div className="edit-overlay">
            <span className="edit-notice">
              {isBack ? 'Back: Answer revealed' : 'Front: Question view'}
            </span>
          </div>
          {audioUrl && !isStudyMode && (
            <div className="audio-in-image-card">
              <AudioPlayer audioUrl={audioUrl} compact={true} />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="content-with-audio">
        <div className="editor-container">
          <SimpleRichTextEditor
            value={content}
            onChange={isBack ? handleBackChange : handleFrontChange}
            onAudioChange={isBack ? handleBackAudioChange : handleFrontAudioChange}
            initialAudioUrl={audioUrl}
            user={user}
            hideAudioPlayer={false}
          />
        </div>
      </div>
    );
  };

  return (
    <div className={`flashcard-item ${isImageOcclusionCard ? 'image-occlusion-item' : ''}`}>
      <div className="flashcard-top-row">
        <div className="index-num">{index + 1}</div>
        {isImageOcclusionCard && <div className="card-type-badge">Image Occlusion</div>}
        {(frontAudioUrl || backAudioUrl) && !isImageOcclusionCard && !isStudyMode && (
          <div className="audio-indicator">Audio</div>
        )}
        {!isStudyMode && (
          <button className="delete-btn" onClick={() => onDelete(id)} aria-label="Delete card">
            <FontAwesomeIcon icon={faTrash} />
          </button>
        )}
      </div>

      <div className="front-back">
        <div className="front">
          <label>Front</label>
          {renderContent(front, false, frontAudioUrl)}
        </div>

        <div className="back">
          <label>Back</label>
          {renderContent(back, true, backAudioUrl)}
        </div>
      </div>

      {isImageOcclusionCard && !isStudyMode && (
        <div className="image-occlusion-info">
          <div className="info-item">
            <span className="info-text">
              Image Occlusion cards are not editable here. To modify, delete and recreate using the
              Image Occlusion Editor.
            </span>
          </div>
          {(frontAudioUrl || backAudioUrl) && (
            <div className="info-item">
              <span className="info-text">This card has audio content.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Only re-render a card when its own data actually changes (the parent passes
// stable id-based callbacks), so editing one card doesn't re-render the rest.
export default React.memo(FlashcardItem);
