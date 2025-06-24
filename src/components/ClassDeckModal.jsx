// src/components/ClassDeckModal.jsx - WITH DECK LIMITS
import React, { useState, useContext, useEffect } from 'react';
import { supabase } from '../supabase';
import UserAuthContext from './context/UserAuthContext';
import { useNavigate } from 'react-router-dom';
import { validateLimits, LIMIT_MESSAGES } from '../utils/LimitValidation';
import '../styles/ClassDeckModal.css';

const ClassDeckModal = ({ onClose, onSuccess, preselectedClassId }) => {
  const { user } = useContext(UserAuthContext);
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [selectedOption, setSelectedOption] = useState('new');
  const [className, setClassName] = useState('');
  const [deckName, setDeckName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [limitInfo, setLimitInfo] = useState({ folders: null, decks: null });

  // Fetch existing classes for the user
  useEffect(() => {
    if (!user) return;
    const fetchClasses = async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (!error && data) {
        setClasses(data);
      }
    };
    fetchClasses();
  }, [user]);

  // Check limits when component mounts
  useEffect(() => {
    if (!user) return;
    const checkLimits = async () => {
      const [folderCheck, deckCheck] = await Promise.all([
        validateLimits.canCreateFolder(user.id),
        validateLimits.canCreateDeck(user.id)
      ]);
      
      setLimitInfo({ folders: folderCheck, decks: deckCheck });
      
      // If deck limit is reached, show error immediately
      if (!deckCheck.canCreate) {
        setError(deckCheck.message || LIMIT_MESSAGES.DECK_LIMIT_REACHED);
      }
    };
    checkLimits();
  }, [user]);

  // Auto-select preselected class
  useEffect(() => {
    if (preselectedClassId) {
      setSelectedOption(preselectedClassId);
    }
  }, [preselectedClassId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!user) {
        throw new Error('User is not logged in or session has expired.');
      }
      if (!deckName.trim()) {
        throw new Error('Deck name is required.');
      }

      // Check deck limits again before creating
      const deckLimitCheck = await validateLimits.canCreateDeck(user.id);
      if (!deckLimitCheck.canCreate) {
        setError(deckLimitCheck.message || LIMIT_MESSAGES.DECK_LIMIT_REACHED);
        setLoading(false);
        return;
      }

      let classId;
      if (selectedOption === 'new') {
        if (!className.trim()) {
          throw new Error('Folder name is required when creating a new folder.');
        }
        
        // Check folder limits before creating
        const folderLimitCheck = await validateLimits.canCreateFolder(user.id);
        if (!folderLimitCheck.canCreate) {
          setError(folderLimitCheck.message || LIMIT_MESSAGES.FOLDER_LIMIT_REACHED);
          setLoading(false);
          return;
        }
        
        console.log('🏗️ Creating new class:', className);
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .insert([{ name: className.trim(), user_id: user.id }])
          .select()
          .single();
          
        if (classError) {
          console.error('❌ Error creating class:', classError);
          throw new Error(`Failed to create folder: ${classError.message}`);
        }
        
        classId = classData.id;
        console.log('✅ Class created with ID:', classId);
      } else {
        classId = selectedOption;
        console.log('✅ Using existing class ID:', classId);
      }

      console.log('🃏 Creating flashcard set...');
      const { data: deckData, error: deckError } = await supabase
        .from('flashcard_sets')
        .insert([
          {
            title: deckName.trim(),
            class_id: classId,
            user_id: user.id,
            type: 'Mixed'
          }
        ])
        .select()
        .single();

      if (deckError) {
        console.error('❌ Error creating deck:', deckError);
        throw new Error(`Failed to create flashcard set: ${deckError.message}`);
      }

      const setId = deckData.id;
      console.log('✅ Flashcard set created with ID:', setId);

      onClose();
      
      if (onSuccess) {
        onSuccess(setId);
      }

      setTimeout(() => {
        navigate(`/flashcards/${setId}`);
      }, 300);

    } catch (err) {
      console.error('💥 Creation failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isAddingToFolder = Boolean(preselectedClassId);
  const selectedClass = classes.find(cls => cls.id === preselectedClassId);

  // Don't render if deck limits are exceeded
  if (limitInfo.decks && !limitInfo.decks.canCreate) {
    return (
      <div className="modal-overlay">
        <div className="modal-content limit-reached-modal">
          <div className="modal-header">
            <h2>⚠️ Deck Limit Reached</h2>
          </div>
          <div className="modal-body">
            <p>{limitInfo.decks.message || LIMIT_MESSAGES.DECK_LIMIT_REACHED}</p>
            <p>Please delete an existing deck before creating a new one.</p>
          </div>
          <div className="modal-footer">
            <button 
              type="button" 
              onClick={onClose}
              className="modal-btn primary"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>📚 Create New Deck</h2>
          {isAddingToFolder && selectedClass && (
            <p className="modal-subtitle">Adding to "{selectedClass.name}"</p>
          )}
        </div>

        {/* Limit Information */}
        {limitInfo.decks && (
          <div className="limit-info">
            <div className="limit-item">
              <span className="limit-label">Decks:</span>
              <span className="limit-count">
                {limitInfo.decks.currentCount}/{limitInfo.decks.limit} used
              </span>
              <span className="limit-remaining">
                ({limitInfo.decks.limit - limitInfo.decks.currentCount} remaining)
              </span>
            </div>
            {selectedOption === 'new' && limitInfo.folders && (
              <div className="limit-item">
                <span className="limit-label">Folders:</span>
                <span className="limit-count">
                  {limitInfo.folders.currentCount}/{limitInfo.folders.limit} used
                </span>
                <span className="limit-remaining">
                  ({limitInfo.folders.limit - limitInfo.folders.currentCount} remaining)
                </span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            <div className="error-content">
              <div className="error-text">{error}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Folder Selection */}
          {!isAddingToFolder && (
            <div className="form-group">
              <label>Folder</label>
              <div className="select-container">
                <select
                  value={selectedOption}
                  onChange={(e) => setSelectedOption(e.target.value)}
                  disabled={loading}
                >
                  <option value="new">Create New Folder</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedOption === 'new' && limitInfo.folders && !limitInfo.folders.canCreate && (
                <div className="field-warning">
                  ⚠️ {limitInfo.folders.message}
                </div>
              )}
            </div>
          )}

          {/* Folder Name (if creating new) */}
          {(selectedOption === 'new' && !isAddingToFolder) && (
            <div className="form-group">
              <label>Folder Name</label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g., Spanish Class, Biology"
                disabled={loading || (limitInfo.folders && !limitInfo.folders.canCreate)}
                required
              />
            </div>
          )}

          {/* Deck Name */}
          <div className="form-group">
            <label>Deck Name</label>
            <input
              type="text"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="e.g., Chapter 1 Vocabulary, Math Formulas"
              disabled={loading}
              required
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="create-btn"
              disabled={
                loading || 
                !deckName.trim() || 
                (selectedOption === 'new' && !isAddingToFolder && (!className.trim() || (limitInfo.folders && !limitInfo.folders.canCreate))) ||
                (limitInfo.decks && !limitInfo.decks.canCreate)
              }
            >
              {loading ? (
                <>
                  <span className="loading-spinner"></span>
                  Creating...
                </>
              ) : (
                <>
                  <span className="btn-icon">📚</span>
                  Create Deck
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClassDeckModal;