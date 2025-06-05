// src/components/AudioPlayerDisplay.jsx
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faTrash } from '@fortawesome/free-solid-svg-icons';

const AudioPlayerDisplay = ({ 
  audioUrl,
  isPlaying,
  currentTime,
  duration,
  onTogglePlayback,
  onProgressClick,
  onRemoveAudio,
  audioRef,
  onPlay,
  onPause,
  onEnded,
  onTimeUpdate,
  onLoadedMetadata
}) => {
  // Format time for audio player
  const formatAudioTime = (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!audioUrl) return null;

  return (
    <div className="editor-audio-player">
      <div className="audio-player-header">
        <span className="audio-icon">🎵</span>
        <span className="audio-label">Audio attached</span>
        <button
          type="button"
          className="remove-audio-btn"
          onClick={onRemoveAudio}
          title="Remove audio"
        >
          <FontAwesomeIcon icon={faTrash} />
        </button>
      </div>
      
      <div className="audio-player-controls">
        <button
          type="button"
          className="play-pause-btn"
          onClick={onTogglePlayback}
          title={isPlaying ? "Pause" : "Play"}
        >
          <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
        </button>
        
        <div className="audio-progress-container">
          <audio
            ref={audioRef}
            src={audioUrl}
            onPlay={onPlay}
            onPause={onPause}
            onEnded={onEnded}
            onTimeUpdate={onTimeUpdate}
            onLoadedMetadata={onLoadedMetadata}
            preload="metadata"
          />
          
          <div className="audio-progress-bar" onClick={onProgressClick}>
            <div 
              className="audio-progress-fill" 
              style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
            ></div>
          </div>
          
          <div className="audio-time">
            <span>{formatAudioTime(currentTime)}</span>
            <span>/</span>
            <span>{formatAudioTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayerDisplay;