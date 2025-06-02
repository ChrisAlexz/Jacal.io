// src/components/ImportModal.jsx - DEBUG VERSION WITH ENHANCED LOGGING
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
  const [importType, setImportType] = useState('quizlet'); // Changed default to quizlet for your test
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

    console.log('File selected:', {
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type,
      lastModified: selectedFile.lastModified
    });

    setFile(selectedFile);
    setError('');
    
    // Auto-detect file type based on extension
    const fileName = selectedFile.name.toLowerCase();
    if (fileName.endsWith('.apkg') || fileName.endsWith('.colpkg')) {
      setImportType('anki');
      console.log('Auto-detected: Anki format');
    } else if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
      setImportType('quizlet');
      console.log('Auto-detected: Quizlet format');
    }

    // Generate preview
    try {
      setLoading(true);
      let preview;
      
      console.log('Starting preview generation with import type:', importType);
      
      if (importType === 'anki' && (fileName.endsWith('.apkg') || fileName.endsWith('.colpkg'))) {
        console.log('Attempting Anki parse...');
        preview = await parseAnkiFile(selectedFile, { previewOnly: true, maxCards: 5 });
      } else if (importType === 'quizlet') {
        console.log('Attempting Quizlet parse...');
        preview = await parseQuizletFile(selectedFile, { 
          previewOnly: true, 
          maxCards: 5,
          onProgress: (progress) => {
            console.log('Parse progress:', progress);
            setParseProgress(progress);
          }
        });
        console.log('Quizlet parse result:', preview);
      }
      
      console.log('Preview generated:', preview);
      setImportPreview(preview);
      
      // Auto-fill deck name from file
      if (preview && preview.deckName) {
        console.log('Setting deck name from preview:', preview.deckName);
        setDeckName(preview.deckName);
      } else {
        const fallbackName = selectedFile.name.replace(/\.[^/.]+$/, "");
        console.log('Setting fallback deck name:', fallbackName);
        setDeckName(fallbackName);
      }
    } catch (err) {
      console.error('Error during preview generation:', err);
      console.error('Error stack:', err.stack);
      setError(`Error parsing file: ${err.message}`);
      setImportPreview(null);
    } finally {
      setLoading(false);
      setParseProgress(0);
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setParseProgress(0);

    console.log('Starting full import process...');
    console.log('Import configuration:', {
      file: file?.name,
      importType,
      deckName,
      selectedOption,
      className,
      user: user?.id
    });

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
      
      console.log('Beginning full file parse...');
      
      if (importType === 'anki' && (fileName.endsWith('.apkg') || fileName.endsWith('.colpkg'))) {
        console.log('Full Anki parse starting...');
        parsedData = await parseAnkiFile(file, {
          onProgress: (progress) => {
            console.log('Anki parse progress:', progress);
            setParseProgress(progress);
          }
        });
      } else if (importType === 'quizlet') {
        console.log('Full Quizlet parse starting...');
        parsedData = await parseQuizletFile(file, {
          onProgress: (progress) => {
            console.log('Quizlet parse progress:', progress);
            setParseProgress(progress);
          }
        });
      } else {
        throw new Error('Unsupported file type. Please select an .apkg, .colpkg, .txt, or .csv file.');
      }

      console.log('Full parse completed:', {
        totalCards: parsedData?.cards?.length || 0,
        deckName: parsedData?.deckName,
        sampleCard: parsedData?.cards?.[0]
      });

      if (!parsedData.cards || parsedData.cards.length === 0) {
        throw new Error(`No cards found in the file. 
        
Debug info:
- File size: ${file.size} bytes
- Import type: ${importType}
- Parsed data: ${JSON.stringify(parsedData, null, 2)}`);
      }

      console.log(`Successfully parsed ${parsedData.cards.length} cards`);

      // Create or select class
      let classId;
      if (selectedOption === 'new') {
        if (!className.trim()) {
          throw new Error('Set name is required when creating a new set.');
        }
        console.log('Creating new class:', className);
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .insert([{ name: className, user_id: user.id }])
          .select()
          .single();
        if (classError) {
          console.error('Error creating class:', classError);
          throw classError;
        }
        classId = classData.id;
        console.log('New class created with ID:', classId);
      } else {
        classId = selectedOption;
        console.log('Using existing class ID:', classId);
      }

      // Create the flashcard set
      console.log('Creating flashcard set...');
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

      if (deckError) {
        console.error('Error creating deck:', deckError);
        throw deckError;
      }

      console.log('Flashcard set created:', deckData);

      // Import cards in batches to avoid timeouts
      const batchSize = 50;
      const cards = parsedData.cards;
      let totalInserted = 0;
      
      console.log(`Importing ${cards.length} cards in batches of ${batchSize}...`);
      
      for (let i = 0; i < cards.length; i += batchSize) {
        const batch = cards.slice(i, i + batchSize);
        const cardsToInsert = batch.map(card => ({
          set_id: deckData.id,
          front: card.front,
          back: card.back,
          card_type: card.cardType || 'Basic',
          user_id: user.id
        }));

        console.log(`Inserting batch ${Math.floor(i / batchSize) + 1}:`, cardsToInsert.length, 'cards');
        console.log('Sample card from batch:', cardsToInsert[0]);

        const { data: insertedCards, error: cardError } = await supabase
          .from('flashcard_cards')
          .insert(cardsToInsert)
          .select();

        if (cardError) {
          console.error('Error inserting card batch:', cardError);
          console.error('Failed batch data:', cardsToInsert);
          // Continue with remaining batches even if one fails
        } else {
          totalInserted += insertedCards?.length || 0;
          console.log(`Batch inserted successfully. Cards in this batch: ${insertedCards?.length || 0}`);
        }

        // Update progress
        const progress = Math.round(((i + batch.length) / cards.length) * 100);
        setParseProgress(progress);
        console.log(`Import progress: ${progress}%`);
      }

      console.log(`Import completed! Total cards inserted: ${totalInserted} out of ${cards.length}`);

      // Success
      onSuccess && onSuccess(deckData.id);
      onClose();
      navigate(`/flashcards/${deckData.id}`);

    } catch (err) {
      console.error('Import error:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        file: file?.name,
        importType,
        user: user?.id
      });
      setError(err.message);
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
          <h2>📁 Import Flashcards (DEBUG MODE)</h2>
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
                {file && (
                  <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#ccc' }}>
                    File: {file.name} ({file.size} bytes)
                  </div>
                )}
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
                    onChange={(e) => {
                      setImportType(e.target.value);
                      console.log('Import type changed to:', e.target.value);
                    }}
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
                    onChange={(e) => {
                      setImportType(e.target.value);
                      console.log('Import type changed to:', e.target.value);
                    }}
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
              <div style={{ marginBottom: '10px', fontSize: '0.8rem', color: '#aaa' }}>
                Debug: Deck name = "{importPreview.deckName}", Cards = {importPreview.totalCards}
              </div>
              <div className="preview-cards">
                {importPreview.preview && importPreview.preview.map((card, index) => (
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