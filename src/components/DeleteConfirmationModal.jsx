// src/components/DeleteConfirmationModal.jsx
import React from 'react';
import '../styles/DeleteConfirmationModal.css';

const DeleteConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Delete Item", 
  message = "Are you sure you want to delete this item?",
  itemName = "",
  type = "item" // "deck", "class", "card", etc.
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  // Get appropriate icon and colors based on type
  const getTypeInfo = () => {
    switch (type) {
      case 'deck':
        return { icon: '📚', color: '#4facfe' };
      case 'class':
        return { icon: '📁', color: '#ffc107' };
      case 'card':
        return { icon: '📄', color: '#28a745' };
      default:
        return { icon: '🗑️', color: '#dc3545' };
    }
  };

  const typeInfo = getTypeInfo();

  return (
    <div className="delete-modal-overlay" onClick={handleCancel}>
      <div className="delete-modal" onClick={(e) => e.stopPropagation()}>
        <div className="delete-modal-header">
          <div className="delete-icon-container">
            <div className="delete-icon" style={{ backgroundColor: `${typeInfo.color}20` }}>
              <span className="type-icon">{typeInfo.icon}</span>
              <span className="trash-icon">🗑️</span>
            </div>
          </div>
          <h2 className="delete-title">{title}</h2>
        </div>
        
        <div className="delete-modal-body">
          <p className="delete-message">{message}</p>
          {itemName && (
            <div className="delete-item-name">
              <strong>"{itemName}"</strong>
            </div>
          )}
          <div className="delete-warning">
            <span className="warning-icon">⚠️</span>
            <span>This action cannot be undone.</span>
          </div>
        </div>
        
        <div className="delete-modal-actions">
          <button 
            className="delete-cancel-btn" 
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button 
            className="delete-confirm-btn" 
            onClick={handleConfirm}
          >
            <span className="btn-icon">🗑️</span>
            Delete {type}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;