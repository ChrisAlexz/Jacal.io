// src/hooks/useStudySession.js - Custom hook for study session management
import { useState, useEffect, useContext } from 'react';
import { supabase } from '../supabase';
import UserAuthContext from '../components/context/UserAuthContext';
import { trackReview } from '../utils/heatmapTracking';

export const useStudySession = (setId) => {
  const { user } = useContext(UserAuthContext);
  
  // Core state
  const [allCards, setAllCards] = useState([]);
  const [sessionCards, setSessionCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deckType, setDeckType] = useState("Basic");
  const [setTitle, setSetTitle] = useState("");
  
  // UI state
  const [showBack, setShowBack] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState(null);
  const [showCompletionPopup, setShowCompletionPopup] = useState(false);
  
  // Session tracking
  const [isMasterAgainSession, setIsMasterAgainSession] = useState(false);
  const [sessionReviewCount, setSessionReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch flashcard set data
  useEffect(() => {
    if (setId) {
      fetchFlashcardSet(setId);
    }
  }, [setId]);

  const fetchFlashcardSet = async (id) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: setData, error: setError } = await supabase
        .from("flashcard_sets")
        .select("*")
        .eq("id", id)
        .single();

      if (setError) {
        throw new Error('Failed to fetch flashcard set');
      }

      if (setData) {
        setDeckType(setData.type);
        setSetTitle(setData.title);
      }

      const { data, error } = await supabase
        .from("flashcard_cards")
        .select("*")
        .eq("set_id", id);

      if (error) {
        throw new Error('Failed to fetch flashcards');
      }

      const cards = data || [];
      
      // Initialize imported cards properly
      const cardsWithMasteryStatus = cards.map(card => ({
        ...card,
        _mastered: false,
        _isImported: true
      }));
      
      setAllCards(cardsWithMasteryStatus);
      setSessionCards(cardsWithMasteryStatus);
      setCurrentIndex(0);
      
    } catch (err) {
      console.error("Error in fetchFlashcardSet:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetUIState = () => {
    setShowBack(false);
    setShowCorrectAnswer(false);
    setIsAnswerCorrect(null);
    setUserAnswer('');
  };

  const handleMasterAgain = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user?.id || allCards.length === 0) {
      return;
    }
    
    const resetCards = allCards.map(card => ({
      ...card,
      _masterAgainSession: true,
      _mastered: false,
      session_failures: 0,
      session_reviews: 0
    }));
    
    setSessionCards(resetCards);
    setIsMasterAgainSession(true);
    setCurrentIndex(0);
    setSessionReviewCount(0);
    resetUIState();
  };

  const handleShowAnswer = () => {
    setShowBack(true);
  };

  const handleSubmitAnswer = (currentCard, currentCardType) => {
    if (currentCardType !== 'Basic-Type' || !currentCard) return;
    
    const correctAnswer = currentCard.back.replace(/<[^>]*>/g, '').trim().toLowerCase();
    const userAnswerClean = userAnswer.trim().toLowerCase();
    
    const isCorrect = correctAnswer === userAnswerClean;
    setIsAnswerCorrect(isCorrect);
    setShowCorrectAnswer(true);
  };

  const handleDifficultyChoice = async (difficulty) => {
    if (!sessionCards[currentIndex] || !user?.id) {
      console.error('Missing card or user for difficulty choice');
      return;
    }
    
    const currentCardData = sessionCards[currentIndex];
    const now = new Date().toISOString();
    
    try {
      // Update card in database
      const basicUpdate = {
        last_reviewed: now,
        reviews: (currentCardData.reviews || 0) + 1
      };

      const { error: basicError } = await supabase
        .from('flashcard_cards')
        .update(basicUpdate)
        .eq('id', currentCardData.id);

      if (basicError) {
        console.error('Database update failed');
      } else {
        // Track in heatmap
        try {
          const trackingSuccess = await trackReview(user.id, isMasterAgainSession);
          if (trackingSuccess) {
            setSessionReviewCount(prev => prev + 1);
          }
        } catch (trackingError) {
          console.error('Heatmap tracking error');
        }
      }

      // Update card data
      const updatedCard = {
        ...currentCardData,
        last_reviewed: now,
        reviews: (currentCardData.reviews || 0) + 1
      };

      const newAllCards = allCards.map(card => 
        card.id === currentCardData.id ? updatedCard : card
      );
      setAllCards(newAllCards);

      // Handle different difficulty choices
      if (difficulty === 'easy') {
        // Mark card as mastered and remove from session
        const newSessionCards = sessionCards.filter((_, index) => index !== currentIndex);
        setSessionCards(newSessionCards);
        
        const finalAllCards = allCards.map(card => 
          card.id === currentCardData.id ? { ...updatedCard, _mastered: true } : card
        );
        setAllCards(finalAllCards);
        
        if (newSessionCards.length === 0) {
          setShowCompletionPopup(true);
          setTimeout(() => setShowCompletionPopup(false), 2000);
          return;
        }
        
        const nextIndex = currentIndex >= newSessionCards.length ? 0 : currentIndex;
        setCurrentIndex(nextIndex);
        
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
        
      } else {
        const nextIndex = (currentIndex + 1) % sessionCards.length;
        setCurrentIndex(nextIndex);
      }

      resetUIState();

    } catch (error) {
      console.error('Error in handleDifficultyChoice');
      throw error;
    }
  };

  return {
    // State
    allCards,
    sessionCards,
    currentIndex,
    deckType,
    setTitle,
    showBack,
    userAnswer,
    showCorrectAnswer,
    isAnswerCorrect,
    showCompletionPopup,
    isMasterAgainSession,
    sessionReviewCount,
    loading,
    error,
    
    // Setters
    setUserAnswer,
    
    // Actions
    handleMasterAgain,
    handleShowAnswer,
    handleSubmitAnswer,
    handleDifficultyChoice,
    
    // Computed
    currentCard: sessionCards[currentIndex] || null,
    isCompleted: sessionCards.length === 0 && allCards.length > 0,
    isLoading: loading || (sessionCards.length === 0 && allCards.length === 0),
  };
};