// src/components/ClassDeckModal.jsx - FIXED VERSION (keeping original functionality)
import React, { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabase';
import UserAuthContext from './context/UserAuthContext';
import { useNavigate } from 'react-router-dom';
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

  // Determine modal type and content
  const isAddingToDeck = Boolean(preselectedClassId);
  const selectedClass = classes.find(cls => cls.id === preselectedClassId);

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

  // If the user wants to create a deck for an existing class
  // that was "preselected", auto-select it
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

      // If "Create New Set" is selected, we also create a new class row
      let classId;
      if (selectedOption === 'new') {
        if (!className.trim()) {
          throw new Error('Set name is required when creating a new set.');
        }
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .insert([{ name: className, user_id: user.id }])
          .select()
          .single();
        if (classError) throw classError;
        classId = classData.id;
      } else {
        classId = selectedOption;
      }

      // Create the new flashcard set with the chosen class_id
      const { data: deckData, error: deckError } = await supabase
        .from('flashcard_sets')
        .insert([
          {
            title: deckName,
            class_id: classId,
            user_id: user.id,
            type: 'Basic'
          }
        ])
        .select()
        .single();

      if (deckError) throw deckError;

      // Inform parent about success
      onSuccess && onSuccess(deckData.id);

      // Close modal
      onClose();

      // Navigate to the edit flashcards page
      navigate(`/flashcards/${deckData.id}`);

    } catch (err) {
      setError(err.message);
      console.error('Error creating deck:', err);
    } finally {
      setLoading(false);
    }
  };

  const getModalTitle = () => {
    if (isAddingToDeck) {
      return 'Add New Deck';
    } else {
      return selectedOption === 'new' ? 'Create New Set' : 'Create New Deck';
    }
  };

  return (
    <div className="modal-overlay">
      <div className="class-deck-modal">
        <div className="modal-header">
          <h2>{getModalTitle()}</h2>
          {isAddingToDeck && selectedClass && (
            <p className="modal-subtitle">Adding to "{selectedClass.name}"</p>
          )}
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isAddingToDeck && (
            <div className="form-group">
              <label>Set</label>
              <div className="select-container">
                <select
                  value={selectedOption}
                  onChange={(e) => setSelectedOption(e.target.value)}
                  disabled={loading}
                >
                  <option value="new">Create New Set</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {(selectedOption === 'new' && !isAddingToDeck) && (
            <div className="form-group">
              <label>Set Name</label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g., Spanish Vocabulary, Biology Chapter 1"
                disabled={loading}
              />
            </div>
          )}

          <div className="form-group">
            <label>Deck Name</label>
            <input
              type="text"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="e.g., Basic Vocabulary, Unit 1 Terms"
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
              disabled={loading || !deckName.trim()}
            >
              {loading ? (
                <>
                  <span className="loading-spinner"></span>
                  Creating...
                </>
              ) : (
                <>
                  <span className="btn-icon"></span>
                  {isAddingToDeck ? 'Add Deck' : 'Create'}
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