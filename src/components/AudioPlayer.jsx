// src/components/AudioPlayer.jsx
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
  
  const audioRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleError = (e) => {
      setError('Failed to load audio');
      setIsLoading(false);
      console.error('Audio loading error:', e);
    };
    
    const handleLoadedData = () => {
      setDuration(audio.duration);
      setIsLoading(false);
      if (autoPlay) {
        audio.play().catch(e => console.error('Auto-play failed:', e));
      }
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const handlePlay = () => {
      setIsPlaying(true);
      if (onPlay) onPlay();
    };
    
    const handlePause = () => {
      setIsPlaying(false);
      if (onPause) onPause();
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (onEnded) onEnded();
    };

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl, autoPlay, onPlay, onPause, onEnded]);

  const togglePlayback = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => {
        console.error('Playback failed:', e);
        setError('Playback failed');
      });
    }
  };

  const handleProgressClick = (e) => {
    if (!audioRef.current || !progressRef.current) return;

    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;

    if (isMuted) {
      audioRef.current.volume = volume;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const skipTime = (seconds) => {
    if (!audioRef.current) return;
    
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handlePlaybackRateChange = (rate) => {
    if (!audioRef.current) return;
    
    audioRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!audioUrl) {
    return null;
  }

  if (error) {
    return (
      <div className={`audio-player error ${className}`}>
        <div className="audio-error">
          <span>❌ {error}</span>
        </div>
      </div>
    );
  }

  const progressPercentage = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`audio-player ${compact ? 'compact' : ''} ${className}`}>
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
      />

      {/* Simple compact version */}
      {compact ? (
        <div className="audio-player-compact">
          <button
            className="play-btn-compact"
            onClick={togglePlayback}
            disabled={isLoading}
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
              ></div>
            </div>
            <span className="time-compact">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      ) : (
        /* Full player version */
        <div className="audio-player-full">
          {/* Main Controls */}
          <div className="main-controls">
            <button
              className="skip-btn"
              onClick={() => skipTime(-10)}
              disabled={isLoading}
              title="Skip backward 10s"
            >
              <FontAwesomeIcon icon={faBackward} />
              <span className="skip-text">10</span>
            </button>

            <button
              className="play-btn-main"
              onClick={togglePlayback}
              disabled={isLoading}
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
              disabled={isLoading}
              title="Skip forward 10s"
            >
              <FontAwesomeIcon icon={faForward} />
              <span className="skip-text">10</span>
            </button>
          </div>

          {/* Progress Bar */}
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
              ></div>
              <div 
                className="progress-thumb" 
                style={{ left: `${progressPercentage}%` }}
              ></div>
            </div>
            
            <span className="time-duration">{formatTime(duration)}</span>
          </div>

          {/* Additional Controls */}
          {showControls && (
            <div className="additional-controls">
              {/* Volume Control */}
              <div className="volume-control">
                <button
                  className="volume-btn"
                  onClick={toggleMute}
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
                  onChange={handleVolumeChange}
                  className="volume-slider"
                />
              </div>

              {/* Playback Speed */}
              <div className="speed-control">
                <select
                  value={playbackRate}
                  onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
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

              {/* Repeat Button */}
              <button
                className="repeat-btn"
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.play();
                  }
                }}
                disabled={isLoading}
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