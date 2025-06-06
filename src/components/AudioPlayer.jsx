// src/components/AudioPlayer.jsx - SIMPLIFIED: Stable Audio Player
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlay, 
  faPause, 
  faVolumeUp, 
  faVolumeMute,
  faRedo,
  faForward,
  faBackward
} from '@fortawesome/free-solid-svg-icons';
import '../styles/AudioPlayer.css';

const AudioPlayer = ({ 
  audioUrl, 
  autoPlay = false, 
  showControls = true, 
  compact = false,
  className = '',
  onPlay = null,
  onPause = null,
  onEnded = null
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [canPlay, setCanPlay] = useState(false);
  
  const audioRef = useRef(null);
  const progressRef = useRef(null);
  const mountedRef = useRef(true);
  const lastStateRef = useRef(null);

  const formatTime = (seconds) => {
    const num = Number(seconds);
    if (!Number.isFinite(num) || num < 0 || num === Infinity) return '0:00';
    const mins = Math.floor(num / 60);
    const secs = Math.floor(num % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Debounced state setter to prevent rapid changes
  const setPlayingState = useCallback((playing) => {
    if (!mountedRef.current) return;
    
    // Only update if state actually changed
    if (lastStateRef.current !== playing) {
      lastStateRef.current = playing;
      setIsPlaying(playing);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    console.log('🎵 Loading audio:', audioUrl);
    
    // Reset all states
    setCurrentTime(0);
    setDuration(0);
    setIsLoading(true);
    setError(null);
    setCanPlay(false);
    setPlayingState(false);
    lastStateRef.current = false;

    // Simple event handlers that don't over-complicate things
    const handleCanPlay = () => {
      if (!mountedRef.current) return;
      console.log('✅ Audio can play');
      setCanPlay(true);
      setIsLoading(false);
      setError(null);
    };

    const handleLoadedMetadata = () => {
      if (!mountedRef.current) return;
      const dur = audio.duration;
      if (Number.isFinite(dur) && dur > 0) {
        console.log('📏 Duration loaded:', dur);
        setDuration(dur);
      } else {
        console.log('⚠️ No duration available');
        setDuration(0); // Allow playback without duration
      }
    };

    const handleTimeUpdate = () => {
      if (!mountedRef.current) return;
      const current = audio.currentTime;
      if (Number.isFinite(current)) {
        setCurrentTime(current);
      }
    };

    const handlePlay = () => {
      if (!mountedRef.current) return;
      console.log('▶️ Audio started playing');
      setPlayingState(true);
      onPlay?.();
    };

    const handlePause = () => {
      if (!mountedRef.current) return;
      console.log('⏸️ Audio paused');
      setPlayingState(false);
      onPause?.();
    };

    const handleEnded = () => {
      if (!mountedRef.current) return;
      console.log('🏁 Audio ended');
      setPlayingState(false);
      setCurrentTime(0);
      onEnded?.();
    };

    const handleError = (e) => {
      if (!mountedRef.current) return;
      console.error('💥 Audio error:', e);
      setError('Failed to load audio');
      setIsLoading(false);
      setCanPlay(false);
      setPlayingState(false);
    };

    const handleWaiting = () => {
      if (!mountedRef.current) return;
      console.log('⏳ Audio waiting...');
      // Don't change playing state, just show it's buffering
    };

    const handleStalled = () => {
      if (!mountedRef.current) return;
      console.log('🔄 Audio stalled');
      // Don't change playing state
    };

    // Add event listeners
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('stalled', handleStalled);

    // Set up audio
    audio.preload = 'metadata';
    audio.volume = volume;
    audio.playbackRate = playbackRate;
    
    // Load the audio
    audio.load();

    // Simple timeout for loading
    const loadTimeout = setTimeout(() => {
      if (mountedRef.current && isLoading) {
        console.log('⏰ Load timeout - trying anyway');
        setIsLoading(false);
        setCanPlay(true); // Allow user to try
      }
    }, 5000);

    return () => {
      clearTimeout(loadTimeout);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('stalled', handleStalled);
    };
  }, [audioUrl, volume, playbackRate, onPlay, onPause, onEnded, isLoading, setPlayingState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !canPlay || isLoading) {
      console.log('❌ Cannot toggle playback - not ready');
      return;
    }

    try {
      if (audio.paused) {
        console.log('🎯 Attempting to play');
        await audio.play();
      } else {
        console.log('🎯 Attempting to pause');
        audio.pause();
      }
    } catch (err) {
      console.error('🚨 Playback error:', err);
      setError('Playback failed');
      setPlayingState(false);
    }
  }, [canPlay, isLoading, setPlayingState]);

  const handleProgressClick = useCallback((e) => {
    const audio = audioRef.current;
    if (!audio || !progressRef.current || !canPlay || duration <= 0) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, [canPlay, duration]);

  const skipTime = useCallback((seconds) => {
    const audio = audioRef.current;
    if (!audio || !canPlay) return;
    
    const newTime = Math.max(0, currentTime + seconds);
    if (duration > 0) {
      audio.currentTime = Math.min(newTime, duration);
    } else {
      audio.currentTime = newTime;
    }
  }, [canPlay, currentTime, duration]);

  if (!audioUrl) return null;

  if (error) {
    return (
      <div className={`audio-player error ${className}`}>
        <div className="audio-error">
          <span>❌ {error}</span>
          <button 
            onClick={() => {
              setError(null);
              setIsLoading(true);
              setCanPlay(false);
              if (audioRef.current) {
                audioRef.current.load();
              }
            }}
            style={{ 
              marginLeft: '10px', 
              padding: '4px 8px', 
              background: '#4facfe', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const progressPercentage = canPlay && duration > 0 
    ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) 
    : 0;

  return (
    <div className={`audio-player ${compact ? 'compact' : ''} ${className}`}>
      <audio 
        ref={audioRef} 
        src={audioUrl} 
        preload="metadata"
        muted={isMuted}
      />

      {compact ? (
        <div className="audio-player-compact">
          <button
            className="play-btn-compact"
            onClick={togglePlayback}
            disabled={isLoading || !canPlay}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <div className="loading-spinner-small"></div>
            ) : (
              <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
            )}
          </button>
          
          <div className="audio-info-compact">
            <div className="progress-bar-compact">
              <div 
                className="progress-fill-compact" 
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <span className="time-compact">
              {isLoading ? 'Loading...' : `${formatTime(currentTime)}${duration > 0 ? ` / ${formatTime(duration)}` : ''}`}
            </span>
          </div>
        </div>
      ) : (
        <div className="audio-player-full">
          <div className="main-controls">
            <button
              className="skip-btn"
              onClick={() => skipTime(-10)}
              disabled={isLoading || !canPlay}
              title="Skip backward 10s"
            >
              <FontAwesomeIcon icon={faBackward} />
              <span className="skip-text">10</span>
            </button>

            <button
              className="play-btn-main"
              onClick={togglePlayback}
              disabled={isLoading || !canPlay}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isLoading ? (
                <div className="loading-spinner"></div>
              ) : (
                <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
              )}
            </button>

            <button
              className="skip-btn"
              onClick={() => skipTime(10)}
              disabled={isLoading || !canPlay}
              title="Skip forward 10s"
            >
              <FontAwesomeIcon icon={faForward} />
              <span className="skip-text">10</span>
            </button>
          </div>

          <div className="progress-section">
            <span className="time-current">{formatTime(currentTime)}</span>
            
            <div 
              className="progress-bar-full"
              ref={progressRef}
              onClick={handleProgressClick}
            >
              <div 
                className="progress-fill-full" 
                style={{ width: `${progressPercentage}%` }}
              />
              {duration > 0 && (
                <div 
                  className="progress-thumb" 
                  style={{ left: `${progressPercentage}%` }}
                />
              )}
            </div>
            
            <span className="time-duration">{duration > 0 ? formatTime(duration) : '--:--'}</span>
          </div>

          {showControls && (
            <div className="additional-controls">
              <div className="volume-control">
                <button
                  className="volume-btn"
                  onClick={() => {
                    if (audioRef.current) {
                      if (isMuted) {
                        audioRef.current.volume = volume;
                        audioRef.current.muted = false;
                        setIsMuted(false);
                      } else {
                        audioRef.current.volume = 0;
                        audioRef.current.muted = true;
                        setIsMuted(true);
                      }
                    }
                  }}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  <FontAwesomeIcon icon={isMuted ? faVolumeMute : faVolumeUp} />
                </button>
                
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const newVolume = parseFloat(e.target.value);
                    setVolume(newVolume);
                    if (audioRef.current) {
                      audioRef.current.volume = newVolume;
                      audioRef.current.muted = newVolume === 0;
                    }
                    setIsMuted(newVolume === 0);
                  }}
                  className="volume-slider"
                />
              </div>

              <div className="speed-control">
                <select
                  value={playbackRate}
                  onChange={(e) => {
                    const rate = parseFloat(e.target.value);
                    if (audioRef.current) {
                      audioRef.current.playbackRate = rate;
                    }
                    setPlaybackRate(rate);
                  }}
                  className="speed-select"
                  title="Playback speed"
                >
                  <option value={0.5}>0.5x</option>
                  <option value={0.75}>0.75x</option>
                  <option value={1}>1x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2x</option>
                </select>
              </div>

              <button
                className="repeat-btn"
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    if (!isPlaying) {
                      audioRef.current.play().catch(() => {});
                    }
                  }
                }}
                disabled={isLoading || !canPlay}
                title="Repeat"
              >
                <FontAwesomeIcon icon={faRedo} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AudioPlayer;