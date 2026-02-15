// src/hooks/useImportParser.js - File parsing/validation for import
import { useState, useCallback } from 'react';
import { parseQuizletFile } from '../utils/QuizletParser';
import { validateLimits, LIMIT_MESSAGES } from '../utils/LimitValidation';

export const useImportParser = () => {
  const [file, setFile] = useState(null);
  const [importType, setImportType] = useState('quizlet');
  const [importPreview, setImportPreview] = useState(null);
  const [parseProgress, setParseProgress] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = useCallback(async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) {
      setFile(null);
      setImportPreview(null);
      setError('');
      return;
    }

    setFile(selectedFile);
    setError('');

    const fileName = selectedFile.name.toLowerCase();
    if (!fileName.endsWith('.txt') && !fileName.endsWith('.csv')) {
      setError('Please upload a .txt or .csv file. Use .txt files for best compatibility - see export instructions above.');
      setFile(null);
      return;
    }

    setImportType('quizlet');

    try {
      setLoading(true);
      setParseProgress(0);

      const fullParse = await parseQuizletFile(selectedFile, {
        previewOnly: false,
        onProgress: setParseProgress
      });

      const limitedCards = validateLimits.limitImportedCards(fullParse.cards || []);
      const wasLimited = (fullParse.cards?.length || 0) > limitedCards.length;

      const preview = {
        totalCards: limitedCards.length,
        originalCardCount: fullParse.cards?.length || 0,
        preview: limitedCards.slice(0, 5),
        cards: limitedCards,
        deckName: fullParse.deckName,
        wasLimited
      };

      if (wasLimited) {
        setError(`${LIMIT_MESSAGES.IMPORT_TRUNCATED} (${fullParse.cards.length} cards found, ${limitedCards.length} will be imported)`);
      }

      setImportPreview(preview);
      return preview;
    } catch (err) {
      setError(`File parsing failed: ${err.message}`);
      setImportPreview(null);
      return null;
    } finally {
      setLoading(false);
      setParseProgress(0);
    }
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setImportType('quizlet');
    setImportPreview(null);
    setParseProgress(0);
    setError('');
    setLoading(false);
  }, []);

  return {
    file, importType, importPreview, parseProgress, error, loading,
    setError, setParseProgress,
    handleFileChange, reset,
  };
};
