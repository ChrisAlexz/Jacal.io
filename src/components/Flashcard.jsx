// src/components/Flashcard.jsx - SECURE VERSION WITH CARD LIMITS
import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from '../supabase';
import UserAuthContext from './context/UserAuthContext';
import { validateLimits, LIMIT_MESSAGES } from '../utils/limitValidation';

import FlashcardTitle from "./FlashcardTitle";
import FlashcardInput from "./FlashcardInput";
import FlashcardList from "./FlashcardList";
import SuccessPopup from "./SuccessPopup";

import "../styles/Flashcard.css";

export default function Flashcard() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useContext(UserAuthContext);

  const [title, setTitle] = useState("");
  const [type, setType] = useState("Basic");
  const [flashcards, setFlashcards] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [setId, setSetId] = useState(null);
  const [isPerCardMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Enhanced useEffect with better error handling and minimal logging
  useEffect(() => {
    const loadData = async () => {
      if (id) {
        setLoading(true);
        setError(null);
        
        try {
          await fetchExistingSet(id);
        } catch (err) {
          console.error('Error loading flashcard set');
          setError('Failed to load flashcard set. Please try again.');
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    loadData();
  }, [id]);

  const fetchExistingSet = async (theId) => {
    try {
      // First, try to get just the set info to verify it exists
      const { data: setData, error: setError } = await supabase
        .from("flashcard_sets")
        .select("*")
        .eq("id", theId)
        .single();

      if (setError) {
        if (setError.code === 'PGRST116') {
          throw new Error('Flashcard set not found');
        }
        throw new Error(`Database error: ${setError.message}`);
      }

      if (!setData) {
        throw new Error('Flashcard set not found');
      }

      // Set the basic info first
      setSetId(setData.id);
      setTitle(setData.title);
      setType(setData.type || 'Basic');

      // Now fetch the cards separately with a small delay to ensure database consistency
      // Add a small delay to ensure database writes have settled
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: cardsData, error: cardsError } = await supabase
        .from("flashcard_cards")
        .select("*")
        .eq("set_id", setData.id)
        .order('created_at', { ascending: true });

      if (cardsError) {
        console.error("Error fetching cards");
        setFlashcards([]);
      } else {
        setFlashcards(cardsData || []);
      }

      // Always set deck type to 'Mixed' since we're always in per-card mode
      if (setData.type !== 'Mixed') {
        const { error: updateError } = await supabase
          .from('flashcard_sets')
          .update({ type: 'Mixed' })
          .eq('id', setData.id);
          
        if (updateError) {
          console.error("Error updating set type");
        }
      }

    } catch (error) {
      console.error('Error in fetchExistingSet');
      throw error;
    }
  };

  // Enhanced debounced title update
  useEffect(() => {
    const updateSetDetails = async () => {
      if (setId && title.trim()) {
        const { error } = await supabase
          .from('flashcard_sets')
          .update({ title: title.trim() })
          .eq('id', setId);
        if (error) {
          console.error("Error updating set title");
        }
      }
    };

    const timer = setTimeout(() => {
      if (setId && title.trim()) {
        updateSetDetails();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [title, setId]);

  const addFlashcard = async (front, back, cardType = null, frontAudioUrl = null, backAudioUrl = null) => {
    const finalCardType = cardType || type;
    
    // Enhanced validation: Better content checking including audio
    const cleanFront = (front || '').replace(/<[^>]*>/g, '').trim();
    const cleanBack = (back || '').replace(/<[^>]*>/g, '').trim();
    
    // Type-specific validation with audio support
    if (finalCardType === 'Basic' && (!cleanFront && !frontAudioUrl) || (!cleanBack && !backAudioUrl)) {
      console.warn('Basic card validation failed');
      alert('Please fill in both front and back content or add audio for Basic cards.');
      return;
    }
    if (finalCardType === 'Basic-Type' && (!cleanFront && !frontAudioUrl) || (!cleanBack && !backAudioUrl)) {
      console.warn('Basic-Type card validation failed');
      alert('Please fill in both front and back content or add audio for Basic-Type cards.');
      return;
    }
    if (finalCardType === 'Cloze' && (!cleanFront && !frontAudioUrl)) {
      console.warn('Cloze card validation failed');
      alert('Please add front content or audio for Cloze cards.');
      return;
    }

    // NEW: Check card limits before adding
    if (setId) {
      const cardLimitCheck = await validateLimits.canAddCards(setId, 1);
      if (!cardLimitCheck.canAdd) {
        alert(cardLimitCheck.message || LIMIT_MESSAGES.CARD_LIMIT_REACHED);
        return;
      }
    }

    setShowSuccess(true);

    try {
      if (setId) {
        const cardData = { 
          set_id: setId, 
          front: front || '', 
          back: back || '',
          card_type: finalCardType,
          front_audio_url: frontAudioUrl,
          back_audio_url: backAudioUrl,
          user_id: user?.id || null
        };
        
        const { data, error } = await supabase
          .from('flashcard_cards')
          .insert(cardData)
          .select();

        if (error) {
          console.error('Error adding card');
          alert(`Failed to add card: ${error.message}`);
          return;
        }

        if (!data || data.length === 0) {
          console.error('No data returned from insert');
          alert('Card may not have been saved properly. Please refresh and try again.');
          return;
        }
        
        // Update flashcards state
        setFlashcards(prev => {
          const newList = [...prev, data[0]];
          return newList;
        });
        
      } else {
        // NEW: Check deck limits before creating new set
        if (!user) {
          alert('Please log in to create flashcard sets.');
          return;
        }

        const deckLimitCheck = await validateLimits.canCreateDeck(user.id);
        if (!deckLimitCheck.canCreate) {
          alert(deckLimitCheck.message || LIMIT_MESSAGES.DECK_LIMIT_REACHED);
          return;
        }
        
        const setData = { 
          title: title?.trim() || 'New Flashcard Set', 
          type: 'Mixed',
          user_id: user.id
        };
        
        const { data: newSetData, error: newSetErr } = await supabase
          .from('flashcard_sets')
          .insert(setData)
          .select()
          .single();

        if (newSetErr) {
          console.error('Error creating set');
          alert(`Failed to create flashcard set: ${newSetErr.message}`);
          return;
        }

        setSetId(newSetData.id);

        const cardData = { 
          set_id: newSetData.id, 
          front: front || '', 
          back: back || '',
          card_type: finalCardType,
          front_audio_url: frontAudioUrl,
          back_audio_url: backAudioUrl,
          user_id: user.id
        };

        const { data: insertedCard, error: cardErr } = await supabase
          .from('flashcard_cards')
          .insert(cardData)
          .select()
          .single();

        if (cardErr) {
          console.error('Error adding first card');
          alert(`Failed to add first card: ${cardErr.message}`);
          return;
        }

        setFlashcards([insertedCard]);
        
        // Update URL to include the new set ID
        navigate(`/flashcards/${newSetData.id}`, { replace: true });
      }
    } catch (err) {
      console.error("Unexpected error saving flashcard");
      alert(`An unexpected error occurred: ${err.message}`);
    }
  };

  const updateFlashcard = async (index, updated) => {
    const cardId = flashcards[index].id;

    const newArray = flashcards.map((fc, i) =>
      i === index ? { ...fc, ...updated } : fc
    );
    setFlashcards(newArray);

    if (cardId) {
      const { error } = await supabase
        .from('flashcard_cards')
        .update(updated)
        .eq('id', cardId);

      if (error) {
        console.error("Error updating flashcard");
      } 
    }
  };

  const handleDelete = async (index) => {
    const cardToDelete = flashcards[index];
    const updatedFlashcards = flashcards.filter((_, i) => i !== index);
    setFlashcards(updatedFlashcards);

    if (cardToDelete.id) {
      const { error } = await supabase
        .from('flashcard_cards')
        .delete()
        .eq('id', cardToDelete.id);
      
      if (error) {
        console.error("Error deleting card");
      }
    }
  };

  // Show loading and error states
  if (loading) {
    return (
      <div className="flashcard-page">
        <div className="flashcard-container">
          <div className="loading-section">
            <div className="loading-spinner"></div>
            <p>Loading flashcard set...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flashcard-page">
        <div className="flashcard-container">
          <div className="error-section">
            <h3>Error Loading Flashcard Set</h3>
            <p>{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="retry-button"
            >
              Try Again
            </button>
            <button 
              onClick={() => navigate('/set')}
              className="back-button"
            >
              Back to Sets
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flashcard-page">
      <div className="flashcard-container">
        {/* Header Row with Title and Study Button */}
        <div className="flashcard-header-row">
          <FlashcardTitle title={title} setTitle={setTitle} />
          
          {/* Study Button - Only show if we have a set ID */}
          {setId && (
            <button
              className="study-button"
              onClick={() => navigate(`/study/${setId}`)}
              disabled={loading}
            >
              Study
            </button>
          )}
        </div>

        {/* Flashcard Input Section */}
        <FlashcardInput 
          addFlashcard={addFlashcard} 
          disabled={loading}
          type={type} 
          isPerCardMode={isPerCardMode}
          setId={setId}
          currentCardCount={flashcards.length}
        />
        
        {/* Flashcard List */}
        <FlashcardList 
          flashcards={flashcards} 
          updateFlashcard={updateFlashcard} 
          onDelete={handleDelete}
        />
        
        {/* Success Popup */}
        {showSuccess && (
          <SuccessPopup 
            message="Flashcard added successfully!" 
            onClose={() => setShowSuccess(false)} 
          />
        )}
      </div>
    </div>
  );
}