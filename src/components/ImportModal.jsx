// src/components/ImportModal.jsx - FIXED: Import button shows total cards, not preview count
import React, { useState, useContext } from 'react';
import { supabase } from '../supabase';
import UserAuthContext from './context/UserAuthContext';
import { useNavigate } from 'react-router-dom';
import '../styles/ImportModal.css';

// Import parsers
import { parseAnkiFileWithFallback } from '../utils/AnkiParser';
import { parseQuizletFile } from '../utils/QuizletParser';

const ImportModal = ({ onClose, onSuccess, preselectedClassId }) => {
  const { user } = useContext(UserAuthContext);
  const navigate = useNavigate();

  const [classes, setClasses] = useState([]);
  const [selectedOption, setSelectedOption] = useState('new');
  const [className, setClassName] = useState('');
  const [deckName, setDeckName] = useState('');
  const [file, setFile] = useState(null);
  const [importType, setImportType] = useState('quizlet');
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
      setError('');
      return;
    }

    console.log('File selected:', {
      name: selectedFile.name,
      size: selectedFile.size,
      type: selectedFile.type
    });

    setFile(selectedFile);
    setError('');
    
    // Validate file type - UPDATED: Only accept .txt and .csv
    const fileName = selectedFile.name.toLowerCase();
    if (!fileName.endsWith('.txt') && !fileName.endsWith('.csv')) {
      setError('Please upload a .txt or .csv file. Use .txt files for best compatibility - see export instructions above.');
      setFile(null);
      return;
    }
    
    // Auto-detect file type - UPDATED: Default to quizlet for text files
    setImportType('quizlet');

    // Generate preview
    try {
      setLoading(true);
      setParseProgress(0);
      let preview;
      
      // FIXED: Parse the entire file to get accurate total count, but only show 5 cards in preview
      try {
        const fullParse = await parseQuizletFile(selectedFile, { 
          previewOnly: false, // Parse the full file to get accurate count
          onProgress: setParseProgress
        });
        
        // Create preview object with accurate total count but limited preview cards
        preview = {
          totalCards: fullParse.cards?.length || 0,
          preview: fullParse.cards?.slice(0, 5) || [], // Only show first 5 for preview
          cards: fullParse.cards, // Keep all cards for import
          deckName: fullParse.deckName
        };
      } catch (quizletError) {
        console.error('Text file preview failed:', quizletError);
        setError(`File parsing failed: ${quizletError.message}`);
        setImportPreview(null);
        setLoading(false);
        return;
      }
      
      setImportPreview(preview);
      
      // Auto-fill deck name from file
      if (preview && preview.deckName) {
        setDeckName(preview.deckName);
      } else {
        setDeckName(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }

    } catch (err) {
      console.error('Error during preview generation:', err);
      setError(`Preview generation failed: ${err.message}`);
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

    console.log('🚀 Starting import process...');

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
      if (!importPreview || !importPreview.cards || importPreview.cards.length === 0) {
        throw new Error('No valid cards found in the file. Please check the file format and try again.');
      }

      console.log('✅ Validation passed, starting full parse...');
      setParseProgress(10);

      // Parse the full file - FIXED: Use the already parsed data from preview
      let parsedData;
      if (importPreview && importPreview.cards && importPreview.cards.length > 0) {
        // Use the already parsed data from the preview
        parsedData = {
          cards: importPreview.cards,
          deckName: importPreview.deckName
        };
        console.log(`📊 Using cached parsed data: ${parsedData.cards.length} cards`);
      } else {
        // Fallback: Parse again if no cached data
        parsedData = await parseQuizletFile(file, {
          onProgress: (progress) => setParseProgress(10 + (progress * 0.3)) // 10-40%
        });
      }

      if (!parsedData.cards || parsedData.cards.length === 0) {
        throw new Error('No cards found in the file after full parsing.');
      }

      console.log(`📊 Parsed ${parsedData.cards.length} cards successfully`);
      setParseProgress(40);

      // Create or select class
      let classId;
      if (selectedOption === 'new') {
        if (!className.trim()) {
          throw new Error('Set name is required when creating a new set.');
        }
        
        console.log('🏗️ Creating new class:', className);
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .insert([{ name: className.trim(), user_id: user.id }])
          .select()
          .single();
          
        if (classError) {
          console.error('❌ Error creating class:', classError);
          throw new Error(`Failed to create set: ${classError.message}`);
        }
        
        classId = classData.id;
        console.log('✅ Class created with ID:', classId);
      } else {
        classId = selectedOption;
        console.log('✅ Using existing class ID:', classId);
      }

      setParseProgress(50);

      // Create the flashcard set
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
      setParseProgress(60);

      // Prepare cards for insertion
      const cardsToInsert = parsedData.cards.map((card, index) => {
        const frontContent = (card.front || '').toString().trim();
        const backContent = (card.back || '').toString().trim();
        
        if (!frontContent || !backContent) {
          console.warn(`⚠️ Card ${index + 1} has empty content:`, { front: frontContent, back: backContent });
        }
        
        return {
          set_id: setId,
          front: frontContent || `Card ${index + 1} Front`,
          back: backContent || `Card ${index + 1} Back`,
          card_type: card.cardType || 'Basic',
          user_id: user.id
        };
      });

      console.log(`📝 Prepared ${cardsToInsert.length} cards for insertion`);

      // Insert cards in batches
      const batchSize = 20;
      let totalInserted = 0;

      for (let i = 0; i < cardsToInsert.length; i += batchSize) {
        const batch = cardsToInsert.slice(i, i + batchSize);
        
        try {
          const { data: insertedCards, error: cardError } = await supabase
            .from('flashcard_cards')
            .insert(batch)
            .select('id');

          if (cardError) {
            console.error(`❌ Batch insertion error:`, cardError);
          } else {
            totalInserted += insertedCards?.length || 0;
          }
        } catch (batchError) {
          console.error(`💥 Batch threw error:`, batchError);
        }

        // Update progress
        const progress = 60 + Math.round(((i + batch.length) / cardsToInsert.length) * 30);
        setParseProgress(progress);
        
        // Small delay between batches
        if (i + batchSize < cardsToInsert.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      setParseProgress(95);
      
      if (totalInserted === 0) {
        throw new Error('No cards were successfully inserted. Please check your file format and try again.');
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      setParseProgress(100);

      console.log('🎉 Import completed successfully!');

      // Close modal and navigate
      onClose();
      
      if (onSuccess) {
        onSuccess(setId);
      }

      setTimeout(() => {
        navigate(`/flashcards/${setId}`);
      }, 300);

    } catch (err) {
      console.error('💥 Import failed:', err);
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
          <h2>📁 Import Flashcards</h2>
          {isAddingToDeck && selectedClass && (
            <p className="modal-subtitle">Importing to "{selectedClass.name}"</p>
          )}
          <p className="import-description">
            Import your existing flashcards from Quizlet or Anki. <strong>Important:</strong> Export as .txt files for best compatibility.
          </p>
        </div>

        {/* Export Instructions Section */}
        <div className="export-instructions">
          <div className="instruction-header">
            <h3>📋 How to Export Your Cards</h3>
            <p>Follow these steps to create compatible .txt files:</p>
          </div>
          
          <div className="export-guides">
            <div className="export-guide quizlet">
              <div className="guide-header">
                <div className="platform-logo">Q</div>
                <h4>From Quizlet</h4>
              </div>
              <ol className="guide-steps">
                <li>Go to your Quizlet study set</li>
                <li>Click the <strong>3 dots menu</strong> (⋯) next to "Study"</li>
                <li>Select <strong>"Export"</strong></li>
                <li>Choose <strong>"Copy text"</strong> and save to a .txt file</li>
                <li>Format: <code>Term [TAB] Definition</code> per line</li>
              </ol>
            </div>

            <div className="export-guide anki">
              <div className="guide-header">
                <div className="platform-logo">A</div>
                <h4>From Anki</h4>
              </div>
              <ol className="guide-steps">
                <li>Open Anki and select your deck</li>
                <li>Go to <strong>File → Export</strong></li>
                <li>Choose <strong>"Notes in Plain Text (.txt)"</strong></li>
                <li>Uncheck "Include HTML and media references"</li>
                <li>Click <strong>"Export"</strong> and save the .txt file</li>
              </ol>
            </div>
          </div>

          <div className="format-requirements">
            <div className="requirement-header">
              <span className="requirement-icon">⚠️</span>
              <h4>File Requirements</h4>
            </div>
            <ul className="requirements-list">
              <li><strong>File type:</strong> Must be .txt (not .apkg, .csv, or other formats)</li>
              <li><strong>Format:</strong> Each line: <code>Front[TAB]Back</code> or <code>Front,Back</code></li>
              <li><strong>Encoding:</strong> UTF-8 text encoding (standard for exports)</li>
              <li><strong>Content:</strong> One flashcard per line, no empty lines</li>
            </ul>
          </div>
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            <div className="error-content">
              <div className="error-text">{error}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleImport}>
          {/* File Upload */}
          <div className="form-group">
            <label>Select Your .txt File</label>
            <div className="file-upload-container">
              <input
                type="file"
                accept=".txt,.csv"
                onChange={handleFileChange}
                disabled={loading}
                className="file-input"
              />
              <div className="file-upload-info">
                <span className="supported-formats">
                  Supported: .txt files (recommended) or .csv files
                </span>
                <div className="format-note">
                  💡 <strong>Best practice:</strong> Export as .txt from Quizlet/Anki using instructions above
                </div>
                {file && (
                  <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#ccc' }}>
                    File: {file.name} ({file.size} bytes)
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preview */}
          {importPreview && importPreview.totalCards > 0 && (
            <div className="import-preview">
              <h4>✅ Preview ({importPreview.totalCards} cards found)</h4>
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
            </div>
          )}

          {/* Folder Name (if creating new) */}
          {(selectedOption === 'new' && !isAddingToDeck) && (
            <div className="form-group">
              <label>Folder Name</label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g., Imported Decks, Spanish Class"
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
                {parseProgress < 40 ? 'Parsing file...' : 
                 parseProgress < 60 ? 'Creating flashcard set...' : 
                 parseProgress < 90 ? 'Importing cards...' :
                 'Finalizing import...'}
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
              disabled={loading || !file || !deckName.trim() || (!importPreview || importPreview.totalCards === 0)}
            >
              {loading ? (
                <>
                  <span className="loading-spinner"></span>
                  {parseProgress > 0 ? `Importing... ${parseProgress}%` : 'Processing...'}
                </>
              ) : (
                <>
                  <span className="btn-icon">📁</span>
                  {/* FIXED: Use totalCards instead of preview count */}
                  Import {importPreview?.totalCards ? `${importPreview.totalCards} Cards` : 'Cards'}
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