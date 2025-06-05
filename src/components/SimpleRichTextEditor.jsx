// src/components/SimpleRichTextEditor.jsx - FINAL REFACTORED WITH ORGANIZED FOLDER STRUCTURE
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { supabase } from '../supabase';

// Import toolbar components from organized folder
import {
  FormattingToolbar,
  MathSymbolsDropdown,
  AudioToolbar,
  AudioPlayerDisplay
} from './toolbar';

// Import editor components from organized folder
import { EditorContentHandler } from './editor';

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
  const recordingTimerRef = useRef(null);

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

  // Get editor content handlers
  const { handleEditorClick, handleEditorKeyDown, mathHandler } = EditorContentHandler({ 
    editorRef, 
    onChange, 
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
      if (onChange && editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }, 10);
  }, [activeFormats, onChange, readOnly]);

  // Insert math symbol using the math handler
  const insertMathSymbol = useCallback((symbol) => {
    if (readOnly) return;
    
    editorRef.current?.focus();
    const selection = window.getSelection();
    
    mathHandler.insertMathSymbol(symbol, selection, editorRef);
  }, [readOnly, mathHandler]);

  // Handle content changes
  const handleInput = useCallback(() => {
    if (onChange && editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

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
      setRecordingTime(0);
      
      // Clear any existing timer before starting new one
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
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
      
      // Clear timer properly
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
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  // Set initial audio URL
  useEffect(() => {
    if (initialAudioUrl && initialAudioUrl !== audioUrl) {
      setAudioUrl(initialAudioUrl);
    }
  }, [initialAudioUrl]);

  // Add event listeners for math structure handling
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    
    // Add both click and keyboard event listeners
    editor.addEventListener('click', handleEditorClick);
    editor.addEventListener('keydown', handleEditorKeyDown);
    
    return () => {
      editor.removeEventListener('click', handleEditorClick);
      editor.removeEventListener('keydown', handleEditorKeyDown);
    };
  }, [handleEditorClick, handleEditorKeyDown]);

  // Cleanup function to properly clear timer
  useEffect(() => {
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
          <FormattingToolbar
            activeFormats={activeFormats}
            onFormatCommand={execCommand}
            disabled={readOnly}
          />

          {/* Divider */}
          <div className="toolbar-divider"></div>

          {/* Math Symbols Dropdown */}
          <MathSymbolsDropdown
            onInsertSymbol={insertMathSymbol}
            disabled={readOnly}
          />

          {/* Divider */}
          <div className="toolbar-divider"></div>

          {/* Audio buttons */}
          <AudioToolbar
            audioUrl={audioUrl}
            isRecording={isRecording}
            isPlaying={isPlaying}
            recordingTime={recordingTime}
            isUploading={isUploading}
            disabled={readOnly}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onTogglePlayback={togglePlayback}
            onRemoveAudio={removeAudio}
            onFileUpload={handleFileUpload}
            fileInputRef={fileInputRef}
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

      {/* Audio Player Display */}
      <AudioPlayerDisplay
        audioUrl={audioUrl}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onTogglePlayback={togglePlayback}
        onProgressClick={handleProgressClick}
        onRemoveAudio={removeAudio}
        audioRef={audioRef}
        onPlay={handleAudioPlay}
        onPause={handleAudioPause}
        onEnded={handleAudioEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
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