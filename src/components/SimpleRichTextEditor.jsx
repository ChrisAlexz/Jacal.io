'use client';
// src/components/SimpleRichTextEditor.jsx - TipTap-based rich text editor (replaces execCommand)
import { logger } from '../utils/logger';
import React, {
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit'; // includes Underline in v3
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import Placeholder from '@tiptap/extension-placeholder';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause, faTrash } from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../supabase';

import { FormattingToolbar, AudioToolbar } from './toolbar';

import '../styles/SimpleRichTextEditor.css';
import '../styles/EditorToolbar.css';
import '../styles/AudioPlayerEmbedded.css';

const SimpleRichTextEditor = forwardRef(function SimpleRichTextEditor(
  {
    value = '',
    onChange,
    placeholder = '',
    readOnly = false,
    onAudioChange = null,
    initialAudioUrl = null,
    user = null,
    hideAudioPlayer = false,
  },
  ref
) {
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);
  const recordingTimerRef = useRef(null);

  // Keep the latest onChange without re-creating the editor.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Guards a programmatic setContent so it doesn't echo back through onUpdate.
  const isSyncingRef = useRef(false);

  // Audio states
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');

  // ── TipTap editor ──────────────────────────────────────────────────
  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit,
      Superscript,
      Subscript,
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: `editor-content${readOnly ? ' readonly' : ''}`,
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => {
      if (isSyncingRef.current) return;
      const html = editor.isEmpty ? '' : editor.getHTML();
      onChangeRef.current?.(html);
    },
  });

  // Keep editable in sync without rebuilding the editor (preserves content).
  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  // Sync external value changes (e.g. loading a card, clearing the form).
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? '' : editor.getHTML();
    if ((value || '') !== current) {
      isSyncingRef.current = true;
      editor.commands.setContent(value || '', false);
      isSyncingRef.current = false;
    }
  }, [value, editor]);

  // Imperative API used by the parent (cloze insertion, clearing, focus).
  useImperativeHandle(
    ref,
    () => ({
      insertCloze: () => {
        if (!editor) return false;
        const { from, to, empty } = editor.state.selection;
        if (empty) return false;
        const text = editor.state.doc.textBetween(from, to, ' ');
        if (!text.trim()) return false;
        editor
          .chain()
          .focus()
          .insertContentAt({ from, to }, `{{c1::${text}}}`)
          .run();
        return true;
      },
      clear: () => editor?.commands.clearContent(true),
      focus: () => editor?.commands.focus(),
      getHTML: () => (editor ? (editor.isEmpty ? '' : editor.getHTML()) : ''),
    }),
    [editor]
  );

  // ── Audio: time formatting ─────────────────────────────────────────
  const formatAudioTime = (seconds) => {
    if (
      typeof seconds !== 'number' ||
      isNaN(seconds) ||
      seconds < 0 ||
      !isFinite(seconds)
    ) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ── Audio: recording ───────────────────────────────────────────────
  const startRecording = async () => {
    try {
      setError('');

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4',
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });

        await uploadAudioFile(audioBlob, true);

        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
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
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= 10) {
            setTimeout(() => {
              if (
                mediaRecorderRef.current &&
                mediaRecorderRef.current.state === 'recording'
              ) {
                mediaRecorderRef.current.stop();
                setIsRecording(false);

                if (recordingTimerRef.current) {
                  clearInterval(recordingTimerRef.current);
                  recordingTimerRef.current = null;
                }

                if (audioStreamRef.current) {
                  audioStreamRef.current
                    .getTracks()
                    .forEach((track) => track.stop());
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
      logger.error('Error starting recording:', err);
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
      const fileName = `${user.id}/${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}.${fileExt}`;

      const { error } = await supabase.storage
        .from('flashcard-audio')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from('flashcard-audio').getPublicUrl(fileName);

      setAudioUrl(publicUrl);
      if (onAudioChange) {
        onAudioChange(publicUrl);
      }

      return publicUrl;
    } catch (error) {
      logger.error('Error uploading audio:', error);
      setError(`Upload failed: ${error.message}`);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const validTypes = [
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/m4a',
      'audio/webm',
    ];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid audio file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    try {
      const audioDuration = await getAudioDuration(file);
      if (audioDuration > 10) {
        setError('Audio must be 10 seconds or less');
        return;
      }
    } catch (err) {
      logger.warn('Could not check audio duration:', err);
    }

    await uploadAudioFile(file, false);
  };

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

  // ── Audio: playback ────────────────────────────────────────────────
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
      if (Number.isFinite(current) && current >= 0) {
        setCurrentTime(current);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration;
      if (Number.isFinite(dur) && dur > 0) {
        setDuration(dur);
      } else {
        setDuration(0);
        setTimeout(() => {
          if (audioRef.current) {
            const laterDur = audioRef.current.duration;
            if (Number.isFinite(laterDur) && laterDur > 0) {
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
      if (Number.isFinite(dur) && dur > 0 && duration === 0) {
        setDuration(dur);
      }
    }
  };

  const handleDurationChange = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration;
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

  useEffect(() => {
    if (initialAudioUrl && initialAudioUrl !== audioUrl) {
      setAudioUrl(initialAudioUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAudioUrl]);

  // Cleanup timers / streams on unmount.
  useEffect(() => {
    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, []);

  const MusicIcon = (
    <svg
      className="audio-note-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );

  return (
    <div className={`simple-rich-text-editor${readOnly ? ' readonly' : ''}`}>
      {!readOnly && (
        <div className="editor-toolbar">
          <FormattingToolbar editor={editor} disabled={readOnly} />

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

      <EditorContent editor={editor} />

      {/* Full audio player */}
      {audioUrl && !hideAudioPlayer && (
        <div className="editor-audio-player">
          <div className="audio-player-header">
            <span className="audio-icon">{MusicIcon}</span>
            <span className="audio-label">Audio attached</span>
            <button
              type="button"
              className="remove-audio-btn"
              onClick={removeAudio}
              title="Remove audio"
              aria-label="Remove audio"
            >
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>

          <div className="audio-player-controls">
            <button
              type="button"
              className="play-pause-btn"
              onClick={togglePlayback}
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
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
                  style={{
                    width: `${
                      duration > 0 && currentTime > 0
                        ? (currentTime / duration) * 100
                        : 0
                    }%`,
                  }}
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

      {/* Compact indicator when the inline player is hidden */}
      {audioUrl && hideAudioPlayer && (
        <div className="editor-audio-simple">
          <div className="audio-indicator">
            <span className="audio-icon">{MusicIcon}</span>
            <span className="audio-label">Audio attached</span>
            <button
              type="button"
              className="remove-audio-btn"
              onClick={removeAudio}
              title="Remove audio"
              aria-label="Remove audio"
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

      {!readOnly && !audioUrl && !isRecording && (
        <div className="editor-audio-hint">
          Audio recordings are limited to 10 seconds
        </div>
      )}
    </div>
  );
});

export default SimpleRichTextEditor;
