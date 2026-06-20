// src/components/ImportModal.jsx - Import modal using useImportParser hook
import React, { useState, useContext } from 'react';
import { supabase } from '../supabase';
import UserAuthContext from './context/UserAuthContext';
import { useRouter } from 'next/navigation';
import { validateLimits, LIMIT_MESSAGES } from '../utils/LimitValidation';
import { useImportParser } from '../hooks/useImportParser';
import '../styles/ImportModal.css';

const ImportModal = ({ onClose, onSuccess, preselectedClassId }) => {
  const { user } = useContext(UserAuthContext);
  const router = useRouter();
  const parser = useImportParser();

  const [classes, setClasses] = useState([]);
  const [selectedOption, setSelectedOption] = useState('new');
  const [className, setClassName] = useState('');
  const [deckName, setDeckName] = useState('');
  const [importLoading, setImportLoading] = useState(false);

  // Fetch existing classes
  React.useEffect(() => {
    if (!user) return;
    const fetchClasses = async () => {
      const { data, error } = await supabase
        .from('classes').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (!error && data) setClasses(data);
    };
    fetchClasses();
  }, [user]);

  // Auto-select preselected class
  React.useEffect(() => {
    if (preselectedClassId) setSelectedOption(preselectedClassId);
  }, [preselectedClassId]);

  const handleFileChange = async (e) => {
    const preview = await parser.handleFileChange(e);
    if (preview) {
      setDeckName(preview.deckName || e.target.files[0]?.name.replace(/\.[^/.]+$/, '') || '');
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    parser.setError('');
    setImportLoading(true);
    parser.setParseProgress(0);

    try {
      if (!user) throw new Error('User is not logged in or session has expired.');
      if (!parser.file) throw new Error('Please select a file to import.');
      if (!deckName.trim()) throw new Error('Deck name is required.');
      if (!parser.importPreview || !parser.importPreview.cards || parser.importPreview.cards.length === 0) {
        throw new Error('No valid cards found in the file. Please check the file format and try again.');
      }

      parser.setParseProgress(10);

      const parsedData = {
        cards: parser.importPreview.cards,
        deckName: parser.importPreview.deckName
      };

      if (!parsedData.cards || parsedData.cards.length === 0) {
        throw new Error('No cards found in the file after full parsing.');
      }

      parser.setParseProgress(40);

      // Create or select class
      let classId;
      if (selectedOption === 'new') {
        if (!className.trim()) throw new Error('Set name is required when creating a new set.');
        const folderLimitCheck = await validateLimits.canCreateFolder(user.id);
        if (!folderLimitCheck.canCreate) throw new Error(folderLimitCheck.message || LIMIT_MESSAGES.FOLDER_LIMIT_REACHED);

        const { data: classData, error: classError } = await supabase
          .from('classes').insert([{ name: className.trim(), user_id: user.id }]).select().single();
        if (classError) throw new Error(`Failed to create set: ${classError.message}`);
        classId = classData.id;
      } else {
        classId = selectedOption;
      }

      parser.setParseProgress(50);

      const deckLimitCheck = await validateLimits.canCreateDeck(user.id);
      if (!deckLimitCheck.canCreate) throw new Error(deckLimitCheck.message || LIMIT_MESSAGES.DECK_LIMIT_REACHED);

      const { data: deckData, error: deckError } = await supabase
        .from('flashcard_sets').insert([{ title: deckName.trim(), class_id: classId, user_id: user.id, type: 'Mixed' }])
        .select().single();
      if (deckError) throw new Error(`Failed to create flashcard set: ${deckError.message}`);

      const setId = deckData.id;
      parser.setParseProgress(60);

      const cardsToInsert = parsedData.cards.map((card, index) => ({
        set_id: setId,
        front: (card.front || '').toString().trim() || `Card ${index + 1} Front`,
        back: (card.back || '').toString().trim() || `Card ${index + 1} Back`,
        card_type: card.cardType || 'Basic',
        user_id: user.id
      }));

      const batchSize = 20;
      let totalInserted = 0;

      for (let i = 0; i < cardsToInsert.length; i += batchSize) {
        const batch = cardsToInsert.slice(i, i + batchSize);
        try {
          const { data: insertedCards, error: cardError } = await supabase
            .from('flashcard_cards').insert(batch).select('id');
          if (!cardError) totalInserted += insertedCards?.length || 0;
        } catch { /* silent */ }

        parser.setParseProgress(60 + Math.round(((i + batch.length) / cardsToInsert.length) * 30));
        if (i + batchSize < cardsToInsert.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      parser.setParseProgress(95);
      if (totalInserted === 0) throw new Error('No cards were successfully inserted. Please check your file format and try again.');

      await new Promise(resolve => setTimeout(resolve, 500));
      parser.setParseProgress(100);

      onClose();
      if (onSuccess) onSuccess(setId);
      setTimeout(() => router.push(`/flashcards/${setId}`), 300);

    } catch (err) {
      parser.setError(err.message);
    } finally {
      setImportLoading(false);
      parser.setParseProgress(0);
    }
  };

  const isLoading = importLoading || parser.loading;
  const isAddingToDeck = Boolean(preselectedClassId);
  const selectedClass = classes.find(cls => cls.id === preselectedClassId);

  return (
    <div className="modal-overlay">
      <div className="import-modal">
        <div className="modal-header">
          <h2>Import Flashcards</h2>
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
            <h3>How to Export Your Cards</h3>
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
                <li>Click the <strong>3 dots menu</strong> (...) next to "Study"</li>
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
                <li>Go to <strong>File &rarr; Export</strong></li>
                <li>Choose <strong>"Notes in Plain Text (.txt)"</strong></li>
                <li>Uncheck "Include HTML and media references"</li>
                <li>Click <strong>"Export"</strong> and save the .txt file</li>
              </ol>
            </div>
          </div>

          <div className="format-requirements">
            <div className="requirement-header">
              <span className="requirement-icon">&#9888;&#65039;</span>
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

        {parser.error && (
          <div className="error-message">
            <span className="error-icon">&#9888;&#65039;</span>
            <div className="error-content">
              <div className="error-text">{parser.error}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleImport}>
          <div className="form-group">
            <label>Select Your .txt File</label>
            <div className="file-upload-container">
              <input type="file" accept=".txt,.csv" onChange={handleFileChange} disabled={isLoading} className="file-input" />
              <div className="file-upload-info">
                <span className="supported-formats">Supported: .txt files (recommended) or .csv files</span>
                <div className="format-note">
                  <strong>Best practice:</strong> Export as .txt from Quizlet/Anki using instructions above
                </div>
                {parser.file && (
                  <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#ccc' }}>
                    File: {parser.file.name} ({parser.file.size} bytes)
                  </div>
                )}
              </div>
            </div>
          </div>

          {parser.importPreview && parser.importPreview.totalCards > 0 && (
            <div className="import-preview">
              <h4>Preview ({parser.importPreview.totalCards} cards will be imported)</h4>
              {parser.importPreview.wasLimited && (
                <div className="limit-warning">
                  <span className="warning-icon">&#9888;&#65039;</span>
                  <span>Original file had {parser.importPreview.originalCardCount} cards. Limited to first {parser.importPreview.totalCards} cards.</span>
                </div>
              )}
              <div className="preview-cards">
                {parser.importPreview.preview && parser.importPreview.preview.map((card, index) => (
                  <div key={index} className="preview-card">
                    <div className="preview-front">
                      <strong>Front:</strong> {card.front.substring(0, 100)}{card.front.length > 100 && '...'}
                    </div>
                    <div className="preview-back">
                      <strong>Back:</strong> {card.back.substring(0, 100)}{card.back.length > 100 && '...'}
                    </div>
                  </div>
                ))}
                {parser.importPreview.totalCards > 5 && (
                  <div className="preview-more">+ {parser.importPreview.totalCards - 5} more cards...</div>
                )}
              </div>
            </div>
          )}

          {!isAddingToDeck && (
            <div className="form-group">
              <label>Folder</label>
              <div className="select-container">
                <select value={selectedOption} onChange={(e) => setSelectedOption(e.target.value)} disabled={isLoading}>
                  <option value="new">Create New Folder</option>
                  {classes.map((cls) => (<option key={cls.id} value={cls.id}>{cls.name}</option>))}
                </select>
              </div>
            </div>
          )}

          {(selectedOption === 'new' && !isAddingToDeck) && (
            <div className="form-group">
              <label>Folder Name</label>
              <input type="text" value={className} onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g., Imported Decks, Spanish Class" disabled={isLoading} />
            </div>
          )}

          <div className="form-group">
            <label>Deck Name</label>
            <input type="text" value={deckName} onChange={(e) => setDeckName(e.target.value)}
              placeholder="e.g., Spanish Vocabulary, Biology Terms" disabled={isLoading} required />
          </div>

          {isLoading && parser.parseProgress > 0 && (
            <div className="progress-container">
              <div className="progress-label">
                {parser.parseProgress < 40 ? 'Parsing file...' :
                 parser.parseProgress < 60 ? 'Creating flashcard set...' :
                 parser.parseProgress < 90 ? 'Importing cards...' : 'Finalizing import...'}
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${parser.parseProgress}%` }}></div>
              </div>
              <div className="progress-text">{parser.parseProgress}%</div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose} disabled={isLoading}>Cancel</button>
            <button type="submit" className="import-btn"
              disabled={isLoading || !parser.file || !deckName.trim() || (!parser.importPreview || parser.importPreview.totalCards === 0)}>
              {isLoading ? (
                <><span className="loading-spinner"></span>{parser.parseProgress > 0 ? `Importing... ${parser.parseProgress}%` : 'Processing...'}</>
              ) : (
                <>Import {parser.importPreview?.totalCards ? `${parser.importPreview.totalCards} Cards` : 'Cards'}{parser.importPreview?.wasLimited && ' (Limited)'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ImportModal;
