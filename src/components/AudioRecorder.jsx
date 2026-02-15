// src/components/AudioRecorder.jsx
import { logger } from '../utils/logger';
import React, { useState, useRef, useEffect, useContext } from 'react';
import { supabase } from '../supabase';
import UserAuthContext from './context/UserAuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMicrophone, 
  faStop, 
  faPlay, 
  faPause, 
  faTrash, 
  faUpload,
  faFileAudio,
  faSpinner,
  faCheckCircle,
  faExclamationTriangle
} from '@fortawesome/free-solid-svg-icons';
import '../styles/AudioRecorder.css';

const AudioRecorder = ({ onAudioSave, initialAudioUrl = null, disabled = false }) => {
  const { user } = useContext(UserAuthContext);
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl);
  
  // Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  
  // File input state
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Refs
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // Update audio source when initialAudioUrl changes
  useEffect(() => {
    if (initialAudioUrl && initialAudioUrl !== audioUrl) {
      setAudioUrl(initialAudioUrl);
      setAudioBlob(null); // Clear any local blob when using external URL
    }
  }, [initialAudioUrl]);

  // Start recording
  const startRecording = async () => {
    try {
      setError('');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType || 'audio/webm' 
        });
        setAudioBlob(audioBlob);
        
        // Create local URL for immediate playback
        const localUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(localUrl);
        
        // Stop all tracks
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop());
          audioStreamRef.current = null;
        }
      };
      
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      logger.error('Error starting recording:', err);
      setError('Could not access microphone. Please check permissions.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // Pause/Resume recording
  const toggleRecordingPause = () => {
    if (mediaRecorderRef.current) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        recordingTimerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }
      }
      setIsPaused(!isPaused);
    }
  };

  // Upload audio file to Supabase Storage
  const uploadAudioFile = async (file, isRecording = false) => {
    if (!user || !file) return null;

    setIsUploading(true);
    setUploadProgress(0);
    setError('');

    try {
      // Generate unique filename
      const fileExt = isRecording ? 'webm' : file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('flashcard-audio')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('flashcard-audio')
        .getPublicUrl(fileName);

      setUploadProgress(100);
      logger.debug('Audio uploaded successfully:', publicUrl);
      
      return publicUrl;
    } catch (error) {
      logger.error('Error uploading audio:', error);
      setError(`Upload failed: ${error.message}`);
      return null;
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 2000);
    }
  };

  // Save audio (either recorded or uploaded)
  const handleSaveAudio = async () => {
    if (!audioBlob && !audioUrl) {
      setError('No audio to save');
      return;
    }

    try {
      let finalAudioUrl = audioUrl;

      // If we have a blob (recorded audio), upload it
      if (audioBlob) {
        finalAudioUrl = await uploadAudioFile(audioBlob, true);
        if (!finalAudioUrl) return; // Upload failed
      }

      // Call the parent component's save function
      if (onAudioSave) {
        onAudioSave(finalAudioUrl);
      }

      // Clear local state
      setAudioBlob(null);
      setRecordingTime(0);

    } catch (error) {
      logger.error('Error saving audio:', error);
      setError('Failed to save audio');
    }
  };

  // Handle file upload
  const handleFileUpload = async (file) => {
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/webm'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid audio file (MP3, WAV, OGG, M4A, WEBM)');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    const uploadedUrl = await uploadAudioFile(file, false);
    if (uploadedUrl) {
      setAudioUrl(uploadedUrl);
      setAudioBlob(null); // Clear any recorded audio
      if (onAudioSave) {
        onAudioSave(uploadedUrl);
      }
    }
  };

  // File input change handler
  const handleFileInputChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const audioFile = files.find(file => file.type.startsWith('audio/'));
    
    if (audioFile) {
      handleFileUpload(audioFile);
    } else {
      setError('Please drop an audio file');
    }
  };

  // Audio playback handlers
  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleAudioLoad = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleAudioPlay = () => setIsPlaying(true);
  const handleAudioPause = () => setIsPlaying(false);
  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Delete audio
  const handleDeleteAudio = () => {
    setAudioUrl(null);
    setAudioBlob(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setRecordingTime(0);
    
    if (onAudioSave) {
      onAudioSave(null); // Clear audio in parent
    }
  };

  // Format time
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="audio-recorder">
      <div className="audio-recorder-header">
        <h4>Audio</h4>
        <span className="audio-recorder-subtitle">Record or upload audio for this card</span>
      </div>

      {error && (
        <div className="audio-error">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Section */}
      {!audioUrl && !isRecording && (
        <div 
          className={`audio-upload-zone ${isDragOver ? 'drag-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <FontAwesomeIcon icon={faFileAudio} className="upload-icon" />
          <p>Drag & drop an audio file or click to browse</p>
          <small>Supports MP3, WAV, OGG, M4A, WEBM (max 10MB)</small>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
            disabled={disabled || isUploading}
          />
        </div>
      )}

      {/* Recording Controls */}
      {!audioUrl && (
        <div className="recording-controls">
          <div className="recording-buttons">
            {!isRecording ? (
              <button
                className="record-btn"
                onClick={startRecording}
                disabled={disabled || isUploading}
                title="Start Recording"
              >
                <FontAwesomeIcon icon={faMicrophone} />
                <span>Record</span>
              </button>
            ) : (
              <div className="recording-active">
                <button
                  className="pause-btn"
                  onClick={toggleRecordingPause}
                  disabled={disabled}
                  title={isPaused ? "Resume Recording" : "Pause Recording"}
                >
                  <FontAwesomeIcon icon={isPaused ? faPlay : faPause} />
                </button>
                
                <button
                  className="stop-btn"
                  onClick={stopRecording}
                  disabled={disabled}
                  title="Stop Recording"
                >
                  <FontAwesomeIcon icon={faStop} />
                  <span>Stop</span>
                </button>
                
                <div className="recording-timer">
                  <div className="recording-indicator"></div>
                  <span>{formatTime(recordingTime)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <div className="progress-text">
            <FontAwesomeIcon icon={faSpinner} spin />
            <span>Uploading... {uploadProgress}%</span>
          </div>
        </div>
      )}

      {/* Audio Playback */}
      {audioUrl && (
        <div className="audio-playback">
          <audio
            ref={audioRef}
            src={audioUrl}
            onLoadedData={handleAudioLoad}
            onTimeUpdate={handleAudioTimeUpdate}
            onPlay={handleAudioPlay}
            onPause={handleAudioPause}
            onEnded={handleAudioEnded}
            preload="metadata"
          />
          
          <div className="playback-controls">
            <button
              className="play-btn"
              onClick={togglePlayback}
              disabled={disabled}
              title={isPlaying ? "Pause" : "Play"}
            >
              <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
            </button>
            
            <div className="audio-progress">
              <span className="time-current">{formatTime(currentTime)}</span>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                ></div>
              </div>
              <span className="time-duration">{formatTime(duration)}</span>
            </div>
            
            <button
              className="delete-btn"
              onClick={handleDeleteAudio}
              disabled={disabled}
              title="Delete Audio"
            >
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>

          {/* Save button for recorded audio */}
          {audioBlob && (
            <div className="audio-actions">
              <button
                className="save-audio-btn"
                onClick={handleSaveAudio}
                disabled={disabled || isUploading}
              >
                <FontAwesomeIcon icon={faCheckCircle} />
                <span>Save Recording</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;