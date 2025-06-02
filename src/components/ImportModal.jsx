// src/components/ImportModal.jsx
import React, { useState, useContext } from 'react';
import { supabase } from '../supabase';
import UserAuthContext from './context/UserAuthContext';
import { useNavigate } from 'react-router-dom';
import '../styles/ImportModal.css';

// Import parsers
import { parseAnkiFile } from '../utils/AnkiParser';
import { parseQuizletFile } from '../utils/QuizletParser';

const ImportModal = ({ onClose, onSuccess, preselectedClassId }) => {
  const { user } = useContext(UserAuthContext);
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [selectedOption, setSelectedOption] = useState('new');
  const [className, setClassName] = useState('');
  const [deckName, setDeckName] = useState('');
  const [file, setFile] = useState(null);
  const [importType, setImportType] = useState('anki');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parseProgress, setParseProgress] = useState(0);
  const [importPreview, setImportPreview] = useState(null);

  // Fetch existing classes for the user
  React.useEffect(() => {
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

  // Auto-select preselected class
  React.useEffect(() => {
    if (preselectedClassId) {
      setSelectedOption(preselectedClassId);
    }
  }, [preselectedClassId]);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) {
      setFile(null);
      setImportPreview(null);
      return;
    }

    setFile(selectedFile);
    setError('');
    
    // Auto-detect file type based on extension
    const fileName = selectedFile.name.toLowerCase();
    if (fileName.endsWith('.apkg') || fileName.endsWith('.colpkg')) {
      setImportType('anki');
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
      setImportType('quizlet');
    }

    // Generate preview
    try {
      setLoading(true);
      let preview;
      
      if (importType === 'anki' && (fileName.endsWith('.apkg') || fileName.endsWith('.colpkg'))) {
        preview = await parseAnkiFile(selectedFile, { previewOnly: true, maxCards: 5 });
      } else if (importType === 'quizlet') {
        preview = await parseQuizletFile(selectedFile, { previewOnly: true, maxCards: 5 });
      }
      
      setImportPreview(preview);
      
      // Auto-fill deck name from file
      if (preview && preview.deckName) {
        setDeckName(preview.deckName);
      } else {
        setDeckName(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
    } catch (err) {
      setError(`Error parsing file: ${err.message}`);
      setImportPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setParseProgress(0);

    try {
      if (!user) {
        throw new Error('User is not logged in or session has expired.');
      }
      if (!file) {
        throw new Error('Please select a file to import.');
      }
      if (!deckName.trim()) {
        throw new Error('Deck name is required.');
      }

      // Parse the full file
      let parsedData;
      const fileName = file.name.toLowerCase();
      
      if (importType === 'anki' && (fileName.endsWith('.apkg') || fileName.endsWith('.colpkg'))) {
        parsedData = await parseAnkiFile(file, {
          onProgress: setParseProgress
        });
      } else if (importType === 'quizlet') {
        parsedData = await parseQuizletFile(file, {
          onProgress: setParseProgress
        });
      } else {
        throw new Error('Unsupported file type. Please select an .apkg, .colpkg, .txt, or .csv file.');
      }

      if (!parsedData.cards || parsedData.cards.length === 0) {
        throw new Error('No cards found in the file.');
      }

      // Create or select class
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

      // Create the flashcard set
      const { data: deckData, error: deckError } = await supabase
        .from('flashcard_sets')
        .insert([
          {
            title: deckName,
            class_id: classId,
            user_id: user.id,
            type: 'Mixed' // Use Mixed type for imported cards
          }
        ])
        .select()
        .single();

      if (deckError) throw deckError;

      // Import cards in batches to avoid timeouts
      const batchSize = 50;
      const cards = parsedData.cards;
      
      for (let i = 0; i < cards.length; i += batchSize) {
        const batch = cards.slice(i, i + batchSize);
        const cardsToInsert = batch.map(card => ({
          set_id: deckData.id,
          front: card.front,
          back: card.back,
          card_type: card.cardType || 'Basic',
          user_id: user.id
        }));

        const { error: cardError } = await supabase
          .from('flashcard_cards')
          .insert(cardsToInsert);

        if (cardError) {
          console.error('Error inserting card batch:', cardError);
          // Continue with remaining batches even if one fails
        }

        // Update progress
        setParseProgress(Math.round(((i + batch.length) / cards.length) * 100));
      }

      // Success
      onSuccess && onSuccess(deckData.id);
      onClose();
      navigate(`/flashcards/${deckData.id}`);

    } catch (err) {
      setError(err.message);
      console.error('Error importing file:', err);
    } finally {
      setLoading(false);
      setParseProgress(0);
    }
  };

  const isAddingToDeck = Boolean(preselectedClassId);
  const selectedClass = classes.find(cls => cls.id === preselectedClassId);

  return (
    <div className="modal-overlay">
      <div className="import-modal">
        <div className="modal-header">
          <h2>📁 Import Flashcards</h2>
          {isAddingToDeck && selectedClass && (
            <p className="modal-subtitle">Importing to "{selectedClass.name}"</p>
          )}
          <p className="import-description">
            Import your existing flashcards from Anki (.apkg, .colpkg) or Quizlet (.txt, .csv) files
          </p>
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        <form onSubmit={handleImport}>
          {/* File Upload */}
          <div className="form-group">
            <label>Select File</label>
            <div className="file-upload-container">
              <input
                type="file"
                accept=".apkg,.colpkg,.txt,.csv"
                onChange={handleFileChange}
                disabled={loading}
                className="file-input"
              />
              <div className="file-upload-info">
                <span className="supported-formats">
                  Supported: Anki (.apkg, .colpkg), Quizlet (.txt, .csv)
                </span>
              </div>
            </div>
          </div>

          {/* Import Type Selector */}
          {file && (
            <div className="form-group">
              <label>Import Type</label>
              <div className="import-type-container">
                <label className="radio-option">
                  <input
                    type="radio"
                    value="anki"
                    checked={importType === 'anki'}
                    onChange={(e) => setImportType(e.target.value)}
                    disabled={loading}
                  />
                  <span className="radio-label">
                    <span className="format-icon">🅰️</span>
                    Anki Format
                    <small>(.apkg, .colpkg files)</small>
                  </span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    value="quizlet"
                    checked={importType === 'quizlet'}
                    onChange={(e) => setImportType(e.target.value)}
                    disabled={loading}
                  />
                  <span className="radio-label">
                    <span className="format-icon">🇶</span>
                    Quizlet Format
                    <small>(.txt, .csv files with "front,back" or "front\tback" format)</small>
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Preview */}
          {importPreview && (
            <div className="import-preview">
              <h4>Preview ({importPreview.totalCards} cards found)</h4>
              <div className="preview-cards">
                {importPreview.preview.map((card, index) => (
                  <div key={index} className="preview-card">
                    <div className="preview-front">
                      <strong>Front:</strong> {card.front.substring(0, 100)}
                      {card.front.length > 100 && '...'}
                    </div>
                    <div className="preview-back">
                      <strong>Back:</strong> {card.back.substring(0, 100)}
                      {card.back.length > 100 && '...'}
                    </div>
                    {card.cardType && (
                      <div className="preview-type">
                        <span className="card-type-badge">{card.cardType}</span>
                      </div>
                    )}
                  </div>
                ))}
                {importPreview.totalCards > 5 && (
                  <div className="preview-more">
                    + {importPreview.totalCards - 5} more cards...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Set Selection */}
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

          {/* Set Name (if creating new) */}
          {(selectedOption === 'new' && !isAddingToDeck) && (
            <div className="form-group">
              <label>Set Name</label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g., Imported Anki Deck, Quizlet Set"
                disabled={loading}
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
              placeholder="e.g., Spanish Vocabulary, Biology Terms"
              disabled={loading}
              required
            />
          </div>

          {/* Progress Bar */}
          {loading && parseProgress > 0 && (
            <div className="progress-container">
              <div className="progress-label">
                {parseProgress < 50 ? 'Parsing file...' : 'Importing cards...'}
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${parseProgress}%` }}
                ></div>
              </div>
              <div className="progress-text">{parseProgress}%</div>
            </div>
          )}

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
              className="import-btn"
              disabled={loading || !file || !deckName.trim()}
            >
              {loading ? (
                <>
                  <span className="loading-spinner"></span>
                  {parseProgress > 0 ? `Importing... ${parseProgress}%` : 'Processing...'}
                </>
              ) : (
                <>
                  <span className="btn-icon">📁</span>
                  Import {importPreview ? `${importPreview.totalCards} Cards` : 'File'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ImportModal;