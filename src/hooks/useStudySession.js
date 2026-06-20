// src/hooks/useStudySession.js - Full study session management with persistence
import { useState, useCallback, useContext } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../supabase';
import UserAuthContext from '../components/context/UserAuthContext';
import { trackReview } from '../utils/heatmapTracking';
import {
  IMMEDIATE_REVIEW_SETTINGS,
  getIntervalPreviewsFixed
} from '../utils/SpacedRepetition';
import { getCardType } from '../components/study/studyUtils';

export const useStudySession = (setId) => {
  const router = useRouter();
  const { user } = useContext(UserAuthContext);

  // Card state
  const [allCards, setAllCards] = useState([]);
  const [sessionCards, setSessionCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deckType, setDeckType] = useState('Basic');
  const [setTitle, setSetTitle] = useState('');

  // UI state
  const [showBack, setShowBack] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState(null);
  const [isMasterAgainSession, setIsMasterAgainSession] = useState(false);
  const [sessionReviewCount, setSessionReviewCount] = useState(0);

  // Spaced learning state
  const [spacedLearningBatches, setSpacedLearningBatches] = useState([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [spacedLearningEnabled, setSpacedLearningEnabled] = useState(false);
  const [batchCompletionModal, setBatchCompletionModal] = useState(null);

  // Session persistence state
  const [studySessionId, setStudySessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [masteredCardIds, setMasteredCardIds] = useState(new Set());
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasRestoredProgress, setHasRestoredProgress] = useState(false);

  // --- Persistence helpers ---

  const loadStudyProgress = useCallback(async () => {
    if (!user?.id || !setId) return null;
    try {
      const { data, error } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('set_id', setId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      if (error && error.code !== 'PGRST116') return null;
      return data;
    } catch {
      return null;
    }
  }, [user?.id, setId]);

  const saveStudyProgress = useCallback(async (cards, currentIdx, masteredIds = null) => {
    if (!user?.id || !setId || !isInitialized) return;
    try {
      const currentMasteredIds = masteredIds || Array.from(masteredCardIds);
      const progressData = {
        user_id: user.id,
        set_id: setId,
        session_cards: cards.map(card => card.id),
        current_index: currentIdx,
        completed_cards: currentMasteredIds,
        batch_index: currentBatchIndex,
        is_spaced_learning: spacedLearningEnabled,
        mastered_cards: currentMasteredIds,
        updated_at: new Date().toISOString()
      };

      if (studySessionId) {
        await supabase.from('study_sessions').update(progressData).eq('id', studySessionId);
      } else {
        const { data } = await supabase.from('study_sessions').insert([progressData]).select().single();
        if (data) setStudySessionId(data.id);
      }
    } catch { /* silent */ }
  }, [user?.id, setId, currentBatchIndex, spacedLearningEnabled, masteredCardIds, studySessionId, isInitialized]);

  const clearStudyProgress = useCallback(async () => {
    if (!studySessionId) return;
    try {
      await supabase.from('study_sessions').delete().eq('id', studySessionId);
      setStudySessionId(null);
    } catch { /* silent */ }
  }, [studySessionId]);

  // --- Helper to create batches ---
  const createBatches = (cards) => {
    const batches = [];
    for (let i = 0; i < cards.length; i += 20) {
      batches.push(cards.slice(i, i + 20));
    }
    return batches;
  };

  // --- Fetch & initialize ---

  const fetchFlashcardSet = useCallback(async () => {
    if (!setId || !user?.id) return;
    try {
      setLoading(true);
      setIsInitialized(false);

      const { data: setData, error: setError } = await supabase
        .from('flashcard_sets').select('*').eq('id', setId).single();
      if (setError) return;

      setDeckType(setData.type);
      setSetTitle(setData.title);

      const { data, error } = await supabase
        .from('flashcard_cards').select('*').eq('set_id', setId);
      if (error) return;

      const cards = data || [];
      const savedProgress = await loadStudyProgress();

      if (savedProgress && savedProgress.session_cards?.length > 0) {
        const savedMasteredCards = new Set(savedProgress.mastered_cards || []);
        setMasteredCardIds(savedMasteredCards);
        setHasRestoredProgress(true);

        const restoredAllCards = cards.map(card => ({
          ...card, _mastered: savedMasteredCards.has(card.id), _isImported: true
        }));
        const unmastered = restoredAllCards.filter(card => !savedMasteredCards.has(card.id));
        const savedSessionCards = unmastered.filter(card =>
          savedProgress.session_cards.includes(card.id)
        );

        setAllCards(restoredAllCards);
        setSessionCards(savedSessionCards);
        setCurrentIndex(Math.min(savedProgress.current_index || 0, Math.max(0, savedSessionCards.length - 1)));
        setStudySessionId(savedProgress.id);

        if (savedProgress.is_spaced_learning) {
          setSpacedLearningEnabled(true);
          setCurrentBatchIndex(savedProgress.batch_index || 0);
          setSpacedLearningBatches(createBatches(unmastered));
        }
      } else {
        const cardsWithMasteryStatus = cards.map(card => ({
          ...card, _mastered: false, _isImported: true
        }));
        setMasteredCardIds(new Set());
        setHasRestoredProgress(true);
        setAllCards(cardsWithMasteryStatus);

        if (cardsWithMasteryStatus.length >= 20) {
          setSpacedLearningEnabled(true);
          const batches = createBatches(cardsWithMasteryStatus);
          setSpacedLearningBatches(batches);
          setCurrentBatchIndex(0);
          setSessionCards(batches[0]);
        } else {
          setSessionCards(cardsWithMasteryStatus);
        }
        setCurrentIndex(0);
      }

      setIsInitialized(true);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [setId, user?.id, loadStudyProgress]);

  // --- Actions ---

  const resetUIState = useCallback(() => {
    setShowBack(false);
    setShowCorrectAnswer(false);
    setIsAnswerCorrect(null);
    setUserAnswer('');
  }, []);

  const handleResetSession = useCallback(() => setShowResetModal(true), []);
  const handleCloseResetModal = useCallback(() => setShowResetModal(false), []);

  const confirmResetSession = useCallback(async () => {
    setResetLoading(true);
    try {
      await clearStudyProgress();
      const resetCards = allCards.map(card => ({
        ...card, _mastered: false, _isImported: true, session_failures: 0, session_reviews: 0, _masterAgainSession: false
      }));
      setAllCards(resetCards);
      setMasteredCardIds(new Set());

      if (spacedLearningEnabled) {
        const batches = createBatches(resetCards);
        setSpacedLearningBatches(batches);
        setCurrentBatchIndex(0);
        setSessionCards(batches[0]);
      } else {
        setSessionCards(resetCards);
      }

      setCurrentIndex(0);
      resetUIState();
      setSessionReviewCount(0);
      setIsMasterAgainSession(false);
      setBatchCompletionModal(null);
      setStudySessionId(null);
      setShowResetModal(false);
    } catch {
      alert('Failed to reset session. Please try again.');
    } finally {
      setResetLoading(false);
    }
  }, [allCards, spacedLearningEnabled, clearStudyProgress, resetUIState]);

  const handleMasterAgain = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user?.id || allCards.length === 0) return;

    await clearStudyProgress();
    const resetCards = allCards.map(card => ({
      ...card, _masterAgainSession: true, _mastered: false, session_failures: 0, session_reviews: 0
    }));
    setAllCards(resetCards);
    setMasteredCardIds(new Set());

    if (spacedLearningEnabled) {
      const batches = createBatches(resetCards);
      setSpacedLearningBatches(batches);
      setCurrentBatchIndex(0);
      setSessionCards(batches[0]);
    } else {
      setSessionCards(resetCards);
    }

    setIsMasterAgainSession(true);
    setCurrentIndex(0);
    resetUIState();
    setSessionReviewCount(0);
    setBatchCompletionModal(null);
  }, [user?.id, allCards, spacedLearningEnabled, clearStudyProgress, resetUIState]);

  const getIntervalPreviewsForCard = useCallback(() => {
    if (sessionCards.length === 0 || currentIndex >= sessionCards.length || !sessionCards[currentIndex]) {
      return { again: '30s', hard: '10m', good: '1d', easy: '4d' };
    }
    return getIntervalPreviewsFixed(sessionCards[currentIndex], IMMEDIATE_REVIEW_SETTINGS);
  }, [sessionCards, currentIndex]);

  const handleShowAnswer = useCallback(() => setShowBack(true), []);

  const handleSubmitAnswer = useCallback(() => {
    const currentCard = sessionCards[currentIndex];
    const currentCardType = getCardType(currentCard, deckType);
    if (currentCardType !== 'Basic-Type' || !currentCard) return;

    const correctAnswer = currentCard.back.replace(/<[^>]*>/g, '').trim().toLowerCase();
    const userAnswerClean = userAnswer.trim().toLowerCase();
    setIsAnswerCorrect(correctAnswer === userAnswerClean);
    setShowCorrectAnswer(true);
  }, [sessionCards, currentIndex, deckType, userAnswer]);

  const handleDifficultyChoice = useCallback(async (difficulty) => {
    if (!sessionCards[currentIndex] || !user?.id || !isInitialized) return;

    // Reset UI immediately to prevent flash of next card's back
    setShowBack(false);
    setShowCorrectAnswer(false);
    setIsAnswerCorrect(null);
    setUserAnswer('');

    const currentCardData = sessionCards[currentIndex];
    const now = new Date().toISOString();

    try {
      const basicUpdate = { last_reviewed: now, reviews: (currentCardData.reviews || 0) + 1 };
      const { error: basicError } = await supabase
        .from('flashcard_cards').update(basicUpdate).eq('id', currentCardData.id);

      if (!basicError) {
        try {
          const trackingSuccess = await trackReview(user.id, isMasterAgainSession);
          if (trackingSuccess) setSessionReviewCount(prev => prev + 1);
        } catch { /* silent */ }
      }

      const updatedCard = { ...currentCardData, last_reviewed: now, reviews: (currentCardData.reviews || 0) + 1 };

      if (difficulty === 'easy') {
        const newMasteredCardIds = new Set(masteredCardIds);
        newMasteredCardIds.add(currentCardData.id);
        const masteredArray = Array.from(newMasteredCardIds);

        const newAllCards = allCards.map(card =>
          card.id === currentCardData.id ? { ...updatedCard, _mastered: true } : card
        );
        const newSessionCards = sessionCards.filter((_, index) => index !== currentIndex);

        setMasteredCardIds(newMasteredCardIds);
        setAllCards(newAllCards);
        setSessionCards(newSessionCards);
        await saveStudyProgress(newSessionCards, Math.min(currentIndex, newSessionCards.length - 1), masteredArray);

        if (newSessionCards.length === 0) {
          if (spacedLearningEnabled && currentBatchIndex + 1 < spacedLearningBatches.length) {
            setBatchCompletionModal({ completed: currentBatchIndex + 1, total: spacedLearningBatches.length });
          } else {
            await clearStudyProgress();
          }
          return;
        }
        setCurrentIndex(currentIndex >= newSessionCards.length ? 0 : currentIndex);

      } else if (difficulty === 'again') {
        const newSessionCards = [...sessionCards];
        const moveToPosition = Math.min(currentIndex + 3, newSessionCards.length - 1);
        if (moveToPosition !== currentIndex && newSessionCards.length > 3) {
          const [cardToMove] = newSessionCards.splice(currentIndex, 1);
          newSessionCards.splice(moveToPosition, 0, cardToMove);
        }
        setSessionCards(newSessionCards);
        const nextIndex = currentIndex >= newSessionCards.length ? 0 : currentIndex;
        setCurrentIndex(nextIndex);
        await saveStudyProgress(newSessionCards, nextIndex);

      } else {
        const nextIndex = (currentIndex + 1) % sessionCards.length;
        setCurrentIndex(nextIndex);
        await saveStudyProgress(sessionCards, nextIndex);
      }

      setAllCards(prev => prev.map(card =>
        card.id === currentCardData.id ? updatedCard : card
      ));

    } catch {
      alert('There was an error processing your answer.');
    }
  }, [sessionCards, currentIndex, user?.id, isInitialized, isMasterAgainSession, masteredCardIds,
      allCards, spacedLearningEnabled, currentBatchIndex, spacedLearningBatches,
      saveStudyProgress, clearStudyProgress]);

  const continueToNextBatch = useCallback(async () => {
    const nextBatchIndex = currentBatchIndex + 1;
    setCurrentBatchIndex(nextBatchIndex);
    setSessionCards(spacedLearningBatches[nextBatchIndex]);
    setCurrentIndex(0);
    resetUIState();
    setBatchCompletionModal(null);
    await saveStudyProgress(spacedLearningBatches[nextBatchIndex], 0, Array.from(masteredCardIds));
  }, [currentBatchIndex, spacedLearningBatches, masteredCardIds, saveStudyProgress, resetUIState]);

  const handleBackToSetsFromModal = useCallback(async () => {
    await clearStudyProgress();
    router.back();
  }, [clearStudyProgress, router]);

  return {
    // Card state
    allCards, sessionCards, currentIndex, deckType, setTitle,
    // UI state
    showBack, userAnswer, setUserAnswer, showCorrectAnswer, isAnswerCorrect,
    isMasterAgainSession, sessionReviewCount,
    // Spaced learning
    spacedLearningEnabled, spacedLearningBatches, currentBatchIndex, batchCompletionModal,
    // Session persistence
    studySessionId, loading, isInitialized, hasRestoredProgress,
    showResetModal, resetLoading, masteredCardIds,
    // Actions
    fetchFlashcardSet,
    handleShowAnswer, handleSubmitAnswer, handleDifficultyChoice,
    handleMasterAgain, handleResetSession, handleCloseResetModal, confirmResetSession,
    getIntervalPreviewsForCard,
    continueToNextBatch, handleBackToSetsFromModal,
  };
};
