// src/components/ResetSessionModal.jsx - REDESIGNED: Card-Based Layout
import React, { useEffect } from 'react';
import '../styles/ResetSessionModal.css';

const ResetSessionModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isLoading = false 
}) => {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      // Restore body scroll
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="reset-modal-backdrop" onClick={handleBackdropClick}>
      <div className="reset-modal-container">
        {/* Header */}
        <div className="reset-modal-header">
          <div className="reset-modal-icon">⚠️</div>
          <h2 className="reset-modal-title">Reset Study Session</h2>
          <p className="reset-modal-subtitle">
            This will permanently reset your progress
          </p>
        </div>

        {/* Body */}
        <div className="reset-modal-body">
          {/* Info Cards */}
          <div className="reset-info-cards">
            <div className="reset-info-card">
              <div className="reset-info-icon">🎯</div>
              <p className="reset-info-text">All mastered cards will be unmarked</p>
            </div>
            
            <div className="reset-info-card">
              <div className="reset-info-icon">📊</div>
              <p className="reset-info-text">Session statistics will be cleared</p>
            </div>
            
            <div className="reset-info-card">
              <div className="reset-info-icon">🔄</div>
              <p className="reset-info-text">You'll return to the first card</p>
            </div>
            
            <div className="reset-info-card">
              <div className="reset-info-icon">💾</div>
              <p className="reset-info-text">Saved progress will be deleted</p>
            </div>
          </div>
          
          {/* Warning Section */}
          <div className="reset-warning-section">
            <div className="reset-warning-header">
              <div className="reset-warning-icon">⚠️</div>
              <h3 className="reset-warning-title">Important</h3>
            </div>
            <p className="reset-warning-text">
              This action cannot be undone. Are you sure you want to reset your study session?
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="reset-modal-footer">
          <button 
            className="reset-cancel-btn"
            onClick={onClose}
            disabled={isLoading}
            type="button"
          >
            Cancel
          </button>
          <button 
            className="reset-confirm-btn"
            onClick={onConfirm}
            disabled={isLoading}
            type="button"
          >
            {isLoading ? (
              <>
                <span className="reset-spinner"></span>
                Resetting...
              </>
            ) : (
              <>
                <span className="reset-icon">🔄</span>
                Reset Session
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetSessionModal;