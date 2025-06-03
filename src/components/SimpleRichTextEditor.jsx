// src/components/SimpleRichTextEditor.jsx - FIXED RECORDING TIMER
import React, { useRef, useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBold, 
  faItalic, 
  faUnderline, 
  faSuperscript, 
  faSubscript, 
  faEraser,
  faMicrophone,
  faFileAudio,
  faPlay,
  faPause,
  faTrash,
  faStop
} from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../supabase';
import '../styles/SimpleRichTextEditor.css';

const SimpleRichTextEditor = ({ 
  value = '', 
  onChange, 
  placeholder = '', 
  readOnly = false,
  onAudioChange = null, // Callback for when audio is added/removed
  initialAudioUrl = null,
  user = null
}) => {
  const editorRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    superscript: false,
    subscript: false
  });

  // Audio states
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');

  // Recording timer
  const recordingTimerRef = useRef(null);

  // Execute formatting command
  const execCommand = useCallback((command, value = null) => {
    if (readOnly) return;
    
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    
    const newFormats = { ...activeFormats };
    
    switch (command) {
      case 'bold':
        newFormats.bold = !activeFormats.bold;
        break;
      case 'italic':
        newFormats.italic = !activeFormats.italic;
        break;
      case 'underline':
        newFormats.underline = !activeFormats.underline;
        break;
      case 'superscript':
        if (activeFormats.subscript) {
          document.execCommand('subscript', false, null);
          newFormats.subscript = false;
        }
        newFormats.superscript = !activeFormats.superscript;
        break;
      case 'subscript':
        if (activeFormats.superscript) {
          document.execCommand('superscript', false, null);
          newFormats.superscript = false;
        }
        newFormats.subscript = !activeFormats.subscript;
        break;
      case 'removeFormat':
        newFormats.bold = false;
        newFormats.italic = false;
        newFormats.underline = false;
        newFormats.superscript = false;
        newFormats.subscript = false;
        break;
    }
    
    setActiveFormats(newFormats);
    
    setTimeout(() => {
      if (onChange && editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }, 10);
  }, [activeFormats, onChange, readOnly]);

  // Handle content changes
  const handleInput = useCallback(() => {
    if (onChange && editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  // FIXED: Format time function for recording timer
  const formatRecordingTime = (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Audio recording functions
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
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType || 'audio/webm' 
        });
        
        // Upload immediately after recording
        await uploadAudioFile(audioBlob, true);
        
        // Stop all tracks
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop());
          audioStreamRef.current = null;
        }
      };
      
      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0); // FIXED: Reset to 0 at start
      
      // FIXED: Clear any existing timer before starting new one
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          console.log('Recording time updated:', newTime); // Debug log
          return newTime;
        });
      }, 1000);
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // FIXED: Clear timer properly
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // Upload audio file
  const uploadAudioFile = async (file, isRecording = false) => {
    if (!user || !file) return null;

    setIsUploading(true);
    setError('');

    try {
      const fileExt = isRecording ? 'webm' : file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('flashcard-audio')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('flashcard-audio')
        .getPublicUrl(fileName);

      setAudioUrl(publicUrl);
      if (onAudioChange) {
        onAudioChange(publicUrl);
      }
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading audio:', error);
      setError(`Upload failed: ${error.message}`);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/webm'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid audio file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    await uploadAudioFile(file, false);
  };

  // Audio playback
  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleAudioPlay = () => setIsPlaying(true);
  const handleAudioPause = () => setIsPlaying(false);
  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleProgressClick = (e) => {
    if (!audioRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // FIXED: Format time for audio player - separate from recording timer
  const formatAudioTime = (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Remove audio
  const removeAudio = () => {
    setAudioUrl(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (onAudioChange) {
      onAudioChange(null);
    }
  };

  // Set initial content
  React.useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  // Set initial audio URL
  React.useEffect(() => {
    if (initialAudioUrl && initialAudioUrl !== audioUrl) {
      setAudioUrl(initialAudioUrl);
    }
  }, [initialAudioUrl]);

  // FIXED: Cleanup function to properly clear timer
  React.useEffect(() => {
    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="simple-rich-text-editor">
      {!readOnly && (
        <div className="editor-toolbar">
          {/* Text formatting buttons */}
          <button
            type="button"
            className={`toolbar-btn ${activeFormats.bold ? 'active' : ''}`}
            onClick={() => execCommand('bold')}
            title="Bold"
          >
            <FontAwesomeIcon icon={faBold} />
          </button>
          
          <button
            type="button"
            className={`toolbar-btn ${activeFormats.italic ? 'active' : ''}`}
            onClick={() => execCommand('italic')}
            title="Italic"
          >
            <FontAwesomeIcon icon={faItalic} />
          </button>
          
          <button
            type="button"
            className={`toolbar-btn ${activeFormats.underline ? 'active' : ''}`}
            onClick={() => execCommand('underline')}
            title="Underline"
          >
            <FontAwesomeIcon icon={faUnderline} />
          </button>
          
          <button
            type="button"
            className={`toolbar-btn ${activeFormats.superscript ? 'active' : ''}`}
            onClick={() => execCommand('superscript')}
            title="Superscript"
          >
            <FontAwesomeIcon icon={faSuperscript} />
          </button>
          
          <button
            type="button"
            className={`toolbar-btn ${activeFormats.subscript ? 'active' : ''}`}
            onClick={() => execCommand('subscript')}
            title="Subscript"
          >
            <FontAwesomeIcon icon={faSubscript} />
          </button>
          
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => execCommand('removeFormat')}
            title="Clear Formatting"
          >
            <FontAwesomeIcon icon={faEraser} />
          </button>

          {/* Divider */}
          <div className="toolbar-divider"></div>

          {/* Audio buttons */}
          {!audioUrl && !isRecording && (
            <>
              <button
                type="button"
                className="toolbar-btn audio-btn"
                onClick={startRecording}
                disabled={isUploading}
                title="Record Audio"
              >
                <FontAwesomeIcon icon={faMicrophone} />
              </button>
              
              <button
                type="button"
                className="toolbar-btn audio-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                title="Upload Audio File"
              >
                <FontAwesomeIcon icon={faFileAudio} />
              </button>
            </>
          )}

          {isRecording && (
            <>
              <button
                type="button"
                className="toolbar-btn recording-btn"
                onClick={stopRecording}
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
                onClick={togglePlayback}
                disabled={isUploading}
                title={isPlaying ? "Pause" : "Play"}
              >
                <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
              </button>
              
              <button
                type="button"
                className="toolbar-btn audio-btn delete-audio"
                onClick={removeAudio}
                title="Remove Audio"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </>
          )}

          {isUploading && (
            <span className="uploading-indicator">Uploading...</span>
          )}
        </div>
      )}
      
      <div
        ref={editorRef}
        className={`editor-content ${readOnly ? 'readonly' : ''}`}
        contentEditable={!readOnly}
        onInput={handleInput}
        data-placeholder={placeholder}
        suppressContentEditableWarning={true}
      />

      {/* Audio Player Display - Shows when audio is attached */}
      {audioUrl && (
        <div className="editor-audio-player">
          <div className="audio-player-header">
            <span className="audio-icon">🎵</span>
            <span className="audio-label">Audio attached</span>
            <button
              type="button"
              className="remove-audio-btn"
              onClick={removeAudio}
              title="Remove audio"
            >
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>
          
          <div className="audio-player-controls">
            <button
              type="button"
              className="play-pause-btn"
              onClick={togglePlayback}
              title={isPlaying ? "Pause" : "Play"}
            >
              <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
            </button>
            
            <div className="audio-progress-container">
              <audio
                ref={audioRef}
                src={audioUrl}
                onPlay={handleAudioPlay}
                onPause={handleAudioPause}
                onEnded={handleAudioEnded}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                preload="metadata"
              />
              
              <div className="audio-progress-bar" onClick={handleProgressClick}>
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
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {/* Error display */}
      {error && (
        <div className="audio-error">
          <small>{error}</small>
        </div>
      )}
    </div>
  );
};

export default SimpleRichTextEditor;