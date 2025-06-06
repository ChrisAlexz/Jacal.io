// src/components/SimpleStudyAudioPlayer.jsx - Ultra Simple Audio Player for Study Mode
import React, { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faPause } from '@fortawesome/free-solid-svg-icons';

const SimpleStudyAudioPlayer = ({ audioUrl, label = "Audio" }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);
  const [canPlay, setCanPlay] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    console.log('🎵 SimpleStudyAudioPlayer loading:', audioUrl);
    
    // Reset states
    setIsPlaying(false);
    setError(null);
    setCanPlay(false);

    const handleCanPlay = () => {
      console.log('✅ Audio can play');
      setCanPlay(true);
      setError(null);
    };

    const handlePlay = () => {
      console.log('▶️ Audio playing');
      setIsPlaying(true);
    };

    const handlePause = () => {
      console.log('⏸️ Audio paused');
      setIsPlaying(false);
    };

    const handleEnded = () => {
      console.log('🏁 Audio ended');
      setIsPlaying(false);
    };

    const handleError = (e) => {
      console.error('💥 Audio error:', e);
      setError('Audio failed to load');
      setCanPlay(false);
      setIsPlaying(false);
    };

    // Add listeners
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('canplaythrough', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    // Simple load
    audio.load();

    // Timeout fallback
    const timeout = setTimeout(() => {
      if (!canPlay && !error) {
        console.log('⏰ Timeout - allowing play attempt');
        setCanPlay(true);
      }
    }, 3000);

    return () => {
      clearTimeout(timeout);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('canplaythrough', handleCanPlay);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioUrl]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !canPlay) {
      console.log('❌ Cannot play - not ready');
      return;
    }

    try {
      if (audio.paused) {
        console.log('🎯 Playing audio');
        await audio.play();
      } else {
        console.log('🎯 Pausing audio');
        audio.pause();
      }
    } catch (err) {
      console.error('🚨 Play error:', err);
      setError('Playback failed');
    }
  };

  if (!audioUrl) return null;

  if (error) {
    return (
      <div style={{
        padding: '12px',
        background: 'rgba(220, 53, 69, 0.1)',
        border: '1px solid rgba(220, 53, 69, 0.3)',
        borderRadius: '8px',
        color: '#dc3545',
        fontSize: '0.9rem',
        textAlign: 'center'
      }}>
        ❌ {error}
      </div>
    );
  }

  return (
    <div style={{
      padding: '12px',
      background: 'rgba(155, 89, 182, 0.1)',
      border: '1px solid rgba(155, 89, 182, 0.3)',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }}>
      <audio ref={audioRef} src={audioUrl} preload="auto" />
      
      <button
        onClick={togglePlay}
        disabled={!canPlay}
        style={{
          background: canPlay ? 'linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%)' : '#666',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: canPlay ? 'pointer' : 'not-allowed',
          fontSize: '1rem',
          transition: 'all 0.3s ease'
        }}
        title={isPlaying ? "Pause" : "Play"}
      >
        {!canPlay ? (
          <span style={{ fontSize: '0.8rem' }}>⏳</span>
        ) : (
          <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
        )}
      </button>
      
      <div style={{
        flex: 1,
        color: '#9b59b6',
        fontWeight: '600',
        fontSize: '0.9rem'
      }}>
        🎵 {label}
        {!canPlay && !error && <span style={{ marginLeft: '8px', fontSize: '0.8rem' }}>Loading...</span>}
      </div>
    </div>
  );
};

export default SimpleStudyAudioPlayer;