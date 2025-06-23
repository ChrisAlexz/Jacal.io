// src/components/ResetSessionModal.jsx - Standalone Reset Modal Component
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
          <div className="reset-warning-box">
            <div className="warning-icon">🔄</div>
            <div className="warning-text">
              <p><strong>What will be reset:</strong></p>
              <ul className="reset-list">
                <li>All mastered cards will be unmarked</li>
                <li>Session statistics will be cleared</li>
                <li>You'll return to the first card</li>
                <li>Saved progress will be deleted</li>
              </ul>
            </div>
          </div>
          
          <div className="reset-confirm-text">
            <strong>This action cannot be undone.</strong> Are you sure you want to reset your study session?
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