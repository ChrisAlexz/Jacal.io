// src/components/SimpleRichTextEditor.jsx - FIXED: Complete Audio Functionality
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faTrash } from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../supabase';

// Import toolbar components from organized folder
import {
  FormattingToolbar,
  AudioToolbar
} from './toolbar';

// Import editor components from organized folder
import { EditorContentHandler } from './editor';

// UPDATED: Import split CSS files (removed MathDropdown and MathStructures)
import '../styles/SimpleRichTextEditor.css';
import '../styles/EditorToolbar.css';
import '../styles/AudioPlayerEmbedded.css';

const SimpleRichTextEditor = ({ 
  value = '', 
  onChange, 
  placeholder = '', 
  readOnly = false,
  onAudioChange = null,
  initialAudioUrl = null,
  user = null,
  hideAudioPlayer = false // NEW: Option to hide the embedded audio player
}) => {
  const editorRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const changeTimeoutRef = useRef(null);
  const lastContentRef = useRef('');

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

  // Format time for audio player - Fixed for NaN/Infinity
  const formatAudioTime = (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0 || !isFinite(seconds)) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Simple onChange that doesn't need math handling
  const safeOnChange = useCallback((content) => {
    if (content === lastContentRef.current) {
      return;
    }
    
    lastContentRef.current = content;
    
    clearTimeout(changeTimeoutRef.current);
    changeTimeoutRef.current = setTimeout(() => {
      if (onChange) {
        onChange(content);
      }
    }, 150);
  }, [onChange]);

  // Get editor content handlers (simplified without math)
  const { handleEditorClick, handleEditorKeyDown } = EditorContentHandler({ 
    editorRef, 
    onChange: safeOnChange,
    readOnly, 
    setActiveFormats 
  });

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
      if (editorRef.current) {
        safeOnChange(editorRef.current.innerHTML);
      }
    }, 10);
  }, [activeFormats, safeOnChange, readOnly]);

  // Handle input (simplified without math handling)
  const handleInput = useCallback((e) => {
    if (!editorRef.current) return;
    
    const content = editorRef.current.innerHTML;
    safeOnChange(content);
  }, [safeOnChange]);

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
        
        await uploadAudioFile(audioBlob, true);
        
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop());
          audioStreamRef.current = null;
        }
      };
      
      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Auto-stop at 10 seconds
          if (newTime >= 10) {
            console.log('🔴 Auto-stopping recording at 10 seconds');
            // Stop the recording immediately
            setTimeout(() => {
              if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
                setIsRecording(false);
                
                if (recordingTimerRef.current) {
                  clearInterval(recordingTimerRef.current);
                  recordingTimerRef.current = null;
                }
                
                if (audioStreamRef.current) {
                  audioStreamRef.current.getTracks().forEach(track => track.stop());
                  audioStreamRef.current = null;
                }
              }
            }, 0);
            return 10;
          }
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
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

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

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/webm'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid audio file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    // Check audio duration before uploading
    try {
      const audioDuration = await getAudioDuration(file);
      if (audioDuration > 10) {
        setError('Audio must be 10 seconds or less');
        return;
      }
    } catch (err) {
      console.warn('Could not check audio duration:', err);
      // Continue with upload if duration check fails
    }

    await uploadAudioFile(file, false);
  };

  // Helper function to get audio duration
  const getAudioDuration = (file) => {
    return new Promise((resolve, reject) => {
      const audio = document.createElement('audio');
      audio.preload = 'metadata';
      
      audio.onloadedmetadata = () => {
        window.URL.revokeObjectURL(audio.src);
        resolve(audio.duration);
      };
      
      audio.onerror = () => {
        window.URL.revokeObjectURL(audio.src);
        reject(new Error('Could not load audio'));
      };
      
      audio.src = URL.createObjectURL(file);
    });
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl || hideAudioPlayer) return;

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
      const current = audioRef.current.currentTime;
      // Only update if currentTime is valid
      if (Number.isFinite(current) && current >= 0) {
        setCurrentTime(current);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration;
      console.log('Metadata loaded, duration:', dur);
      // Only set duration if it's a valid finite number
      if (Number.isFinite(dur) && dur > 0) {
        setDuration(dur);
      } else {
        setDuration(0); // Use 0 for unknown duration
        // Try to get duration later for WebM files
        setTimeout(() => {
          if (audioRef.current) {
            const laterDur = audioRef.current.duration;
            if (Number.isFinite(laterDur) && laterDur > 0) {
              console.log('Got duration later:', laterDur);
              setDuration(laterDur);
            }
          }
        }, 1000);
      }
    }
  };

  const handleCanPlay = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration;
      console.log('Can play, duration:', dur);
      if (Number.isFinite(dur) && dur > 0 && duration === 0) {
        setDuration(dur);
      }
    }
  };

  const handleDurationChange = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration;
      console.log('Duration changed:', dur);
      if (Number.isFinite(dur) && dur > 0) {
        setDuration(dur);
      }
    }
  };

  const handleProgressClick = (e) => {
    if (!audioRef.current || duration <= 0) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    // Only seek if we have valid duration
    if (Number.isFinite(newTime) && newTime >= 0 && newTime <= duration) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

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
  useEffect(() => {
    if (editorRef.current && value !== lastContentRef.current) {
      editorRef.current.innerHTML = value;
      lastContentRef.current = value;
    }
  }, [value]);

  useEffect(() => {
    if (initialAudioUrl && initialAudioUrl !== audioUrl) {
      setAudioUrl(initialAudioUrl);
    }
  }, [initialAudioUrl]);

  // Add event listeners
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    
    editor.addEventListener('click', handleEditorClick);
    editor.addEventListener('keydown', handleEditorKeyDown);
    
    return () => {
      editor.removeEventListener('click', handleEditorClick);
      editor.removeEventListener('keydown', handleEditorKeyDown);
    };
  }, [handleEditorClick, handleEditorKeyDown]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (changeTimeoutRef.current) {
        clearTimeout(changeTimeoutRef.current);
        changeTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <div className="simple-rich-text-editor">
      {!readOnly && (
        <div className="editor-toolbar">
          <FormattingToolbar
            activeFormats={activeFormats}
            onFormatCommand={execCommand}
            disabled={readOnly}
          />

          <div className="toolbar-divider"></div>

          <AudioToolbar
            audioUrl={audioUrl}
            isRecording={isRecording}
            isPlaying={!hideAudioPlayer ? isPlaying : false}
            recordingTime={recordingTime}
            isUploading={isUploading}
            disabled={readOnly}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onTogglePlayback={hideAudioPlayer ? () => {} : togglePlayback}
            onRemoveAudio={removeAudio}
            onFileUpload={handleFileUpload}
            fileInputRef={fileInputRef}
            maxRecordingTime={10}
          />
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

      {/* CONDITIONAL: Show different audio displays based on hideAudioPlayer */}
      {audioUrl && !hideAudioPlayer && (
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
                onCanPlay={handleCanPlay}
                onDurationChange={handleDurationChange}
                preload="metadata"
              />
              
              <div className="audio-progress-bar" onClick={handleProgressClick}>
                <div 
                  className="audio-progress-fill" 
                  style={{ width: `${(duration > 0 && currentTime > 0) ? (currentTime / duration) * 100 : 0}%` }}
                ></div>
              </div>
              
              <div className="audio-time">
                <span>{formatAudioTime(currentTime)}</span>
                {duration > 0 && (
                  <>
                    <span>/</span>
                    <span>{formatAudioTime(duration)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simple indicator when hideAudioPlayer is true */}
      {audioUrl && hideAudioPlayer && (
        <div className="editor-audio-simple">
          <div className="audio-indicator">
            <span className="audio-icon">🎵</span>
            <span className="audio-label">Audio attached</span>
            <button
              type="button"
              className="remove-audio-btn"
              onClick={removeAudio}
              title="Remove audio"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="audio-error">
          <small>{error}</small>
        </div>
      )}

      {/* Show recording time limit hint */}
      {!readOnly && !audioUrl && !isRecording && (
        <div style={{ 
          fontSize: '0.8rem', 
          color: '#888', 
          textAlign: 'center', 
          marginTop: '8px',
          fontStyle: 'italic'
        }}>
          💡 Audio recordings are limited to 10 seconds
        </div>
      )}
    </div>
  );
};

export default SimpleRichTextEditor;