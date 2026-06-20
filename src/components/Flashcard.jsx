// src/components/Flashcard.jsx - NO LIMITS VERSION
import { logger } from '../utils/logger';
import React, { useState, useEffect, useContext } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from '../supabase';
import UserAuthContext from './context/UserAuthContext';

import FlashcardTitle from "./FlashcardTitle";
import FlashcardInput from "./FlashcardInput";
import FlashcardList from "./FlashcardList";
import SuccessPopup from "./SuccessPopup";

import "../styles/Flashcard.css";

export default function Flashcard() {
  const router = useRouter();
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

  useEffect(() => {
    const loadData = async () => {
      if (id) {
        setLoading(true);
        setError(null);
        
        try {
          await fetchExistingSet(id);
        } catch (err) {
          logger.error('Error loading flashcard set');
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

      setSetId(setData.id);
      setTitle(setData.title);
      setType(setData.type || 'Basic');

      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: cardsData, error: cardsError } = await supabase
        .from("flashcard_cards")
        .select("*")
        .eq("set_id", setData.id)
        .order('created_at', { ascending: true });

      if (cardsError) {
        logger.error("Error fetching cards");
        setFlashcards([]);
      } else {
        setFlashcards(cardsData || []);
      }

      if (setData.type !== 'Mixed') {
        const { error: updateError } = await supabase
          .from('flashcard_sets')
          .update({ type: 'Mixed' })
          .eq('id', setData.id);
          
        if (updateError) {
          logger.error("Error updating set type");
        }
      }

    } catch (error) {
      logger.error('Error in fetchExistingSet');
      throw error;
    }
  };

  useEffect(() => {
    const updateSetDetails = async () => {
      if (setId && title.trim()) {
        const { error } = await supabase
          .from('flashcard_sets')
          .update({ title: title.trim() })
          .eq('id', setId);
        if (error) {
          logger.error("Error updating set title");
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
    
    // Skip validation for Image Occlusion cards
    if (finalCardType !== 'Image-Occlusion') {
      const cleanFront = (front || '').replace(/<[^>]*>/g, '').trim();
      const cleanBack = (back || '').replace(/<[^>]*>/g, '').trim();
      
      // Type-specific validation with audio support
      if (finalCardType === 'Basic' && ((!cleanFront && !frontAudioUrl) || (!cleanBack && !backAudioUrl))) {
        logger.warn('Basic card validation failed');
        alert('Please fill in both front and back content or add audio for Basic cards.');
        return;
      }
      if (finalCardType === 'Basic-Type' && ((!cleanFront && !frontAudioUrl) || (!cleanBack && !backAudioUrl))) {
        logger.warn('Basic-Type card validation failed');
        alert('Please fill in both front and back content or add audio for Basic-Type cards.');
        return;
      }
      if (finalCardType === 'Cloze' && (!cleanFront && !frontAudioUrl)) {
        logger.warn('Cloze card validation failed');
        alert('Please add front content or audio for Cloze cards.');
        return;
      }
    }

    // NO LIMIT CHECKS - Removed all limit validation

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
          logger.error('Error adding card');
          alert(`Failed to add card: ${error.message}`);
          return;
        }

        if (!data || data.length === 0) {
          logger.error('No data returned from insert');
          alert('Card may not have been saved properly. Please refresh and try again.');
          return;
        }
        
        setFlashcards(prev => {
          const newList = [...prev, data[0]];
          return newList;
        });
        
      } else {
        // NO LIMIT CHECKS - Removed deck limit validation
        
        if (!user) {
          alert('Please log in to create flashcard sets.');
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
          logger.error('Error creating set');
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
          logger.error('Error adding first card');
          alert(`Failed to add first card: ${cardErr.message}`);
          return;
        }

        setFlashcards([insertedCard]);
        
        router.replace(`/flashcards/${newSetData.id}`);
      }
    } catch (err) {
      logger.error("Unexpected error saving flashcard");
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
        logger.error("Error updating flashcard");
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
        logger.error("Error deleting card");
      }
    }
  };

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
              onClick={() => router.push('/set')}
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
        <div className="flashcard-header-row">
          <FlashcardTitle title={title} setTitle={setTitle} />
          
          {setId && (
            <button
              className="study-button"
              onClick={() => router.push(`/study/${setId}`)}
              disabled={loading}
            >
              Study
            </button>
          )}
        </div>

        <FlashcardInput 
          addFlashcard={addFlashcard} 
          disabled={loading}
          type={type} 
          isPerCardMode={isPerCardMode}
          setId={setId}
          currentCardCount={flashcards.length}
        />
        
        <FlashcardList 
          flashcards={flashcards} 
          updateFlashcard={updateFlashcard} 
          onDelete={handleDelete}
        />
        
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