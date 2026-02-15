// src/components/set/CreateFolderModal.jsx - Modal for creating new folders
import React, { useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFolder } from '@fortawesome/free-solid-svg-icons';

const CreateFolderModal = React.memo(({ onClose, onSuccess, parentFolderId }) => {
  const [folderName, setFolderName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    setLoading(true);
    setError('');
    try {
      await onSuccess(folderName);
    } catch (err) {
      setError(err.message || 'Failed to create folder');
      setLoading(false);
    }
  }, [folderName, onSuccess]);

  return (
    <div className="modal-overlay">
      <div className="modal-content create-folder-modal">
        <div className="modal-header">
          <h3>Create New Folder</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {parentFolderId && (
            <div className="current-location">
              <span className="location-label">Creating in folder:</span>
              <div className="location-path">
                <FontAwesomeIcon icon={faFolder} />
                <span>Selected Folder</span>
              </div>
            </div>
          )}

          {error && (
            <div className="error-message">
              <span className="error-icon">&#9888;&#65039;</span>
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="folderName">Folder Name</label>
            <input
              type="text" id="folderName" value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Enter folder name..." autoFocus maxLength={50}
              className="folder-name-input" disabled={loading}
            />
          </div>
        </form>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="modal-btn secondary" disabled={loading}>Cancel</button>
          <button type="submit" onClick={handleSubmit} disabled={!folderName.trim() || loading} className="modal-btn primary">
            {loading ? (<><span className="loading-spinner-small"></span>Creating...</>) : 'Create Folder'}
          </button>
        </div>
      </div>
    </div>
  );
});

export default CreateFolderModal;
