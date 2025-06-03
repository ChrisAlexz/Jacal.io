// src/components/AudioPlayer.jsx - WebM COMPATIBLE VERSION
import React, { useState, useRef, useEffect } from 'react';
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
  const [hasValidDuration, setHasValidDuration] = useState(false);
  
  const audioRef = useRef(null);
  const progressRef = useRef(null);
  const durationCheckInterval = useRef(null);

  const formatTime = (seconds) => {
    const num = Number(seconds);
    if (!Number.isFinite(num) || num < 0 || num === Infinity) return '0:00';
    const mins = Math.floor(num / 60);
    const secs = Math.floor(num % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Aggressive duration checking for WebM files
  const checkDuration = (audio) => {
    if (!audio) return;
    
    const dur = audio.duration;
    if (Number.isFinite(dur) && dur > 0 && dur !== Infinity) {
      setDuration(dur);
      setHasValidDuration(true);
      setIsLoading(false);
      if (durationCheckInterval.current) {
        clearInterval(durationCheckInterval.current);
        durationCheckInterval.current = null;
      }
      return true;
    }
    return false;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    // Reset states
    setCurrentTime(0);
    setDuration(0);
    setIsLoading(true);
    setError(null);
    setIsPlaying(false);
    setHasValidDuration(false);

    // Clear any existing interval
    if (durationCheckInterval.current) {
      clearInterval(durationCheckInterval.current);
      durationCheckInterval.current = null;
    }

    const handleLoadedMetadata = () => {
      checkDuration(audio);
    };

    const handleLoadedData = () => {
      if (!checkDuration(audio)) {
        // If duration is still invalid, start aggressive checking
        durationCheckInterval.current = setInterval(() => {
          if (checkDuration(audio)) {
            return; // Duration found, interval will be cleared in checkDuration
          }
          
          // Try seeking to a small position to force metadata loading
          if (audio.readyState >= 2) {
            try {
              const originalTime = audio.currentTime;
              audio.currentTime = 0.1;
              setTimeout(() => {
                audio.currentTime = originalTime;
              }, 50);
            } catch (e) {
              // Ignore seek errors
            }
          }
        }, 100);
        
        // Stop trying after 10 seconds
        setTimeout(() => {
          if (durationCheckInterval.current) {
            clearInterval(durationCheckInterval.current);
            durationCheckInterval.current = null;
            setIsLoading(false);
            // If we still don't have duration, show error
            if (!hasValidDuration) {
              setError('Unable to read audio duration');
            }
          }
        }, 10000);
      }
      
      if (autoPlay && hasValidDuration) {
        audio.play().catch(() => {});
      }
    };

    const handleCanPlay = () => {
      checkDuration(audio);
    };

    const handleCanPlayThrough = () => {
      checkDuration(audio);
    };

    const handleDurationChange = () => {
      checkDuration(audio);
    };

    const handleTimeUpdate = () => {
      const current = Number(audio.currentTime);
      if (Number.isFinite(current) && current >= 0) {
        setCurrentTime(current);
      }
    };

    const handlePlay = () => {
      setIsPlaying(true);
      onPlay?.();
    };

    const handlePause = () => {
      setIsPlaying(false);
      onPause?.();
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      onEnded?.();
    };

    const handleError = (e) => {
      console.error('Audio error:', e);
      setError('Failed to load audio');
      setIsLoading(false);
      if (durationCheckInterval.current) {
        clearInterval(durationCheckInterval.current);
        durationCheckInterval.current = null;
      }
    };

    const handleProgress = () => {
      checkDuration(audio);
    };

    // Add all event listeners
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('progress', handleProgress);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    // Load the audio
    audio.load();

    // Fallback timeout
    const fallbackTimeout = setTimeout(() => {
      if (isLoading && !hasValidDuration) {
        setIsLoading(false);
        setError('Audio loading timeout');
      }
    }, 15000);

    return () => {
      clearTimeout(fallbackTimeout);
      if (durationCheckInterval.current) {
        clearInterval(durationCheckInterval.current);
      }
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('progress', handleProgress);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl, autoPlay, onPlay, onPause, onEnded, hasValidDuration, isLoading]);

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.error('Playback failed:', err);
        setError('Playback failed');
      });
    }
  };

  const handleProgressClick = (e) => {
    if (!audioRef.current || !progressRef.current || !hasValidDuration || duration <= 0) return;
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const skipTime = (seconds) => {
    if (!audioRef.current || !hasValidDuration || duration <= 0) return;
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  if (!audioUrl) return null;

  if (error) {
    return (
      <div className={`audio-player error ${className}`}>
        <div className="audio-error">
          <span>❌ {error}</span>
        </div>
      </div>
    );
  }

  const progressPercentage = hasValidDuration && duration > 0 
    ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) 
    : 0;

  return (
    <div className={`audio-player ${compact ? 'compact' : ''} ${className}`}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {compact ? (
        <div className="audio-player-compact">
          <button
            className="play-btn-compact"
            onClick={togglePlayback}
            disabled={isLoading || !hasValidDuration}
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
              {isLoading ? 'Loading...' : `${formatTime(currentTime)} / ${formatTime(duration)}`}
            </span>
          </div>
        </div>
      ) : (
        <div className="audio-player-full">
          <div className="main-controls">
            <button
              className="skip-btn"
              onClick={() => skipTime(-10)}
              disabled={isLoading || !hasValidDuration}
              title="Skip backward 10s"
            >
              <FontAwesomeIcon icon={faBackward} />
              <span className="skip-text">10</span>
            </button>

            <button
              className="play-btn-main"
              onClick={togglePlayback}
              disabled={isLoading || !hasValidDuration}
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
              disabled={isLoading || !hasValidDuration}
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
              <div 
                className="progress-thumb" 
                style={{ left: `${progressPercentage}%` }}
              />
            </div>
            
            <span className="time-duration">{formatTime(duration)}</span>
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
                        setIsMuted(false);
                      } else {
                        audioRef.current.volume = 0;
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
                    audioRef.current.play().catch(() => {});
                  }
                }}
                disabled={isLoading || !hasValidDuration}
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