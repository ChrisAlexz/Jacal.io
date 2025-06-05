// src/components/AudioToolbar.jsx
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMicrophone,
  faFileAudio,
  faPlay,
  faPause,
  faTrash,
  faStop
} from '@fortawesome/free-solid-svg-icons';

const AudioToolbar = ({ 
  audioUrl, 
  isRecording, 
  isPlaying, 
  recordingTime, 
  isUploading, 
  disabled = false,
  onStartRecording,
  onStopRecording,
  onTogglePlayback,
  onRemoveAudio,
  onFileUpload,
  fileInputRef
}) => {
  // Format recording time
  const formatRecordingTime = (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {!audioUrl && !isRecording && (
        <button
          type="button"
          className="toolbar-btn audio-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || disabled}
          title="Upload Audio File"
        >
          <FontAwesomeIcon icon={faFileAudio} />
        </button>
      )}

      {!audioUrl && !isRecording && (
        <button
          type="button"
          className="toolbar-btn audio-btn"
          onClick={onStartRecording}
          disabled={isUploading || disabled}
          title="Start Recording"
        >
          <FontAwesomeIcon icon={faMicrophone} />
        </button>
      )}

      {isRecording && (
        <>
          <button
            type="button"
            className="toolbar-btn recording-btn"
            onClick={onStopRecording}
            disabled={disabled}
            title="Stop Recording"
          >
            <FontAwesomeIcon icon={faStop} />
          </button>
          <span className="recording-time">{formatRecordingTime(recordingTime)}</span>
        </>
      )}

      {audioUrl && !isRecording && (
        <>
          <button
            type="button"
            className="toolbar-btn audio-btn"
            onClick={onTogglePlayback}
            disabled={isUploading || disabled}
            title={isPlaying ? "Pause" : "Play"}
          >
            <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
          </button>
          
          <button
            type="button"
            className="toolbar-btn audio-btn delete-audio"
            onClick={onRemoveAudio}
            disabled={disabled}
            title="Remove Audio"
          >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </>
      )}

      {isUploading && (
        <span className="uploading-indicator">Uploading...</span>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={onFileUpload}
        style={{ display: 'none' }}
        disabled={disabled}
      />
    </>
  );
};

export default AudioToolbar;