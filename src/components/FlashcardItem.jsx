import React, { useState, useEffect } from 'react';
import SimpleRichTextEditor from './SimpleRichTextEditor';
import AudioPlayer from './AudioPlayer';
import AudioRecorder from './AudioRecorder';
import '../styles/FlashcardList.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';

const FlashcardItem = ({ index, front, back, updateFlashcard, onDelete, cardType, frontAudioUrl, backAudioUrl }) => {
  const [frontContent, setFrontContent] = useState('');
  const [backContent, setBackContent] = useState('');
  const [frontAudio, setFrontAudio] = useState(frontAudioUrl || null);
  const [backAudio, setBackAudio] = useState(backAudioUrl || null);
  const [showAudioControls, setShowAudioControls] = useState(false);

  // Initialize content when component mounts or props change
  useEffect(() => {
    if (typeof front === 'string') {
      setFrontContent(front);
    }
    if (typeof back === 'string') {
      setBackContent(back);
    }
    if (frontAudioUrl) {
      setFrontAudio(frontAudioUrl);
    }
    if (backAudioUrl) {
      setBackAudio(backAudioUrl);
    }
  }, [front, back, frontAudioUrl, backAudioUrl]);

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

  // Handle audio changes
  const handleFrontAudioChange = (audioUrl) => {
    setFrontAudio(audioUrl);
    updateFlashcard(index, { front_audio_url: audioUrl });
  };

  const handleBackAudioChange = (audioUrl) => {
    setBackAudio(audioUrl);
    updateFlashcard(index, { back_audio_url: audioUrl });
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

  // Check if this is an image occlusion card
  const isImageOcclusionCard = cardType === 'Image-Occlusion' || 
    (frontContent && (frontContent.includes('image-occlusion-card') || frontContent.includes('occlusion-')));

  // Render content based on card type
  const renderContent = (content, isBack = false, audioUrl = null) => {
    if (isImageOcclusionCard) {
      return (
        <div className="image-occlusion-preview">
          <div dangerouslySetInnerHTML={{ __html: content }} />
          <div className="edit-overlay">
            <span className="edit-notice">
              {isBack ? '🖼️ Back: Answer revealed' : '🖼️ Front: Question view'}
            </span>
          </div>
          {audioUrl && (
            <div className="audio-in-image-card">
              <AudioPlayer audioUrl={audioUrl} compact={true} />
            </div>
          )}
        </div>
      );
    } else {
      // Regular rich text editor for non-image cards
      return (
        <div className="content-with-audio">
          <div className="editor-container">
            <SimpleRichTextEditor
              value={content}
              onChange={isBack ? handleBackChange : handleFrontChange}
            />
          </div>
          
          {/* Audio Player/Recorder */}
          <div className="audio-section">
            {audioUrl ? (
              <div className="audio-player-section">
                <AudioPlayer audioUrl={audioUrl} compact={true} />
                <button 
                  className="remove-audio-btn"
                  onClick={() => isBack ? handleBackAudioChange(null) : handleFrontAudioChange(null)}
                  title="Remove audio"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            ) : showAudioControls ? (
              <div className="audio-recorder-section">
                <AudioRecorder
                  onAudioSave={isBack ? handleBackAudioChange : handleFrontAudioChange}
                  initialAudioUrl={null}
                  disabled={false}
                />
                <button 
                  className="cancel-audio-btn"
                  onClick={() => setShowAudioControls(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button 
                className="add-audio-btn"
                onClick={() => setShowAudioControls(true)}
                title="Add audio"
              >
                🎵 Add Audio
              </button>
            )}
          </div>
        </div>
      );
    }
  };

  return (
    <div className={`flashcard-item ${isImageOcclusionCard ? 'image-occlusion-item' : ''}`}>
      <div className="flashcard-top-row">
        <div className="index-num">{index + 1}</div>
        {isImageOcclusionCard && (
          <div className="card-type-badge">Image Occlusion</div>
        )}
        {(frontAudio || backAudio) && !isImageOcclusionCard && (
          <div className="audio-indicator">
            🎵 Audio
          </div>
        )}
        <button className="delete-btn" onClick={() => onDelete(index)}>
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>

      <div className="front-back">
        <div className="front">
          <label>Front</label>
          {renderContent(frontContent, false, frontAudio)}
        </div>

        <div className="back">
          <label>Back</label>
          {renderContent(backContent, true, backAudio)}
        </div>
      </div>

      {isImageOcclusionCard && (
        <div className="image-occlusion-info">
          <div className="info-item">
            <span className="info-icon">⚠️</span>
            <span className="info-text">
              Image Occlusion cards are not editable here. To modify, delete and recreate using the Image Occlusion Editor.
            </span>
          </div>
          {(frontAudio || backAudio) && (
            <div className="info-item">
              <span className="info-icon">🎵</span>
              <span className="info-text">
                This card has audio content.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FlashcardItem;