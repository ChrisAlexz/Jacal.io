// src/components/Flashcard.jsx - UPDATED WITH AUDIO SUPPORT AND FIXED EVENTS
import React, { useState, useEffect, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from '../supabase';
import UserAuthContext from './context/UserAuthContext';

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

  // CRITICAL FIX: Enhanced useEffect with better error handling and logging
  useEffect(() => {
    const loadData = async () => {
      if (id) {
        console.log('🔄 Loading flashcard set with ID:', id);
        setLoading(true);
        setError(null);
        
        try {
          await fetchExistingSet(id);
        } catch (err) {
          console.error('❌ Error loading flashcard set:', err);
          setError('Failed to load flashcard set. Please try again.');
        } finally {
          setLoading(false);
        }
      } else {
        // No ID - new set
        console.log('🆕 Creating new flashcard set');
        setLoading(false);
      }
    };

    loadData();
  }, [id]); // Only depend on id

  const fetchExistingSet = async (theId) => {
    console.log('📦 Fetching existing set with ID:', theId);
    
    try {
      // First, try to get just the set info to verify it exists
      const { data: setData, error: setError } = await supabase
        .from("flashcard_sets")
        .select("*")
        .eq("id", theId)
        .single();

      if (setError) {
        console.error("❌ Error fetching set:", setError);
        if (setError.code === 'PGRST116') {
          throw new Error('Flashcard set not found');
        }
        throw new Error(`Database error: ${setError.message}`);
      }

      if (!setData) {
        throw new Error('Flashcard set not found');
      }

      console.log('✅ Set data loaded:', setData);

      // Set the basic info first
      setSetId(setData.id);
      setTitle(setData.title);
      setType(setData.type || 'Basic');

      // Now fetch the cards separately with a small delay to ensure database consistency
      console.log('🃏 Fetching cards for set:', setData.id);
      
      // Add a small delay to ensure database writes have settled
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: cardsData, error: cardsError } = await supabase
        .from("flashcard_cards")
        .select("*")
        .eq("set_id", setData.id)
        .order('created_at', { ascending: true });

      if (cardsError) {
        console.error("❌ Error fetching cards:", cardsError);
        // Don't throw here - just log and continue with empty cards
        setFlashcards([]);
      } else {
        console.log('✅ Cards loaded:', cardsData?.length || 0, 'cards');
        setFlashcards(cardsData || []);
      }

      // Always set deck type to 'Mixed' since we're always in per-card mode
      if (setData.type !== 'Mixed') {
        console.log('🔄 Updating deck type to Mixed...');
        const { error: updateError } = await supabase
          .from('flashcard_sets')
          .update({ type: 'Mixed' })
          .eq('id', setData.id);
          
        if (updateError) {
          console.error("❌ Error updating set type:", updateError);
        }
      }

    } catch (error) {
      console.error('💥 Error in fetchExistingSet:', error);
      throw error; // Re-throw to be handled by the calling function
    }
  };

  // ENHANCED: Better debounced title update
  useEffect(() => {
    const updateSetDetails = async () => {
      if (setId && title.trim()) {
        console.log('📝 Updating set title to:', title);
        const { error } = await supabase
          .from('flashcard_sets')
          .update({ title: title.trim() })
          .eq('id', setId);
        if (error) {
          console.error("❌ Error updating set title:", error);
        }
      }
    };

    const timer = setTimeout(() => {
      if (setId && title.trim()) {
        updateSetDetails();
      }
    }, 1000); // Increased debounce time

    return () => clearTimeout(timer);
  }, [title, setId]);

  const addFlashcard = async (front, back, cardType = null, frontAudioUrl = null, backAudioUrl = null) => {
    console.log('🚀 addFlashcard called with:', {
      front: front?.substring(0, 50) + '...',
      back: back?.substring(0, 50) + '...',
      cardType,
      frontAudio: frontAudioUrl ? 'Yes' : 'No',
      backAudio: backAudioUrl ? 'Yes' : 'No',
      setId,
      title: title?.substring(0, 30),
      userId: user?.id
    });

    const finalCardType = cardType || type;
    
    // ENHANCED VALIDATION: Better content checking including audio
    const cleanFront = (front || '').replace(/<[^>]*>/g, '').trim();
    const cleanBack = (back || '').replace(/<[^>]*>/g, '').trim();
    
    console.log('📝 Content validation:', {
      finalCardType,
      cleanFront: cleanFront.substring(0, 50),
      cleanBack: cleanBack.substring(0, 50),
      frontLength: cleanFront.length,
      backLength: cleanBack.length,
      frontAudio: frontAudioUrl ? 'Yes' : 'No',
      backAudio: backAudioUrl ? 'Yes' : 'No'
    });

    // Type-specific validation with audio support
    if (finalCardType === 'Basic' && (!cleanFront && !frontAudioUrl) || (!cleanBack && !backAudioUrl)) {
      console.warn('❌ Basic card validation failed');
      alert('Please fill in both front and back content or add audio for Basic cards.');
      return;
    }
    if (finalCardType === 'Basic-Type' && (!cleanFront && !frontAudioUrl) || (!cleanBack && !backAudioUrl)) {
      console.warn('❌ Basic-Type card validation failed');
      alert('Please fill in both front and back content or add audio for Basic-Type cards.');
      return;
    }
    if (finalCardType === 'Cloze' && (!cleanFront && !frontAudioUrl)) {
      console.warn('❌ Cloze card validation failed');
      alert('Please add front content or audio for Cloze cards.');
      return;
    }

    setShowSuccess(true);

    try {
      if (setId) {
        console.log('📦 Adding card to existing set:', setId);
        
        const cardData = { 
          set_id: setId, 
          front: front || '', 
          back: back || '',
          card_type: finalCardType,
          front_audio_url: frontAudioUrl,
          back_audio_url: backAudioUrl,
          user_id: user?.id || null // CRITICAL: Add user_id for better data integrity
        };
        
        console.log('📋 Inserting card data:', cardData);
        
        const { data, error } = await supabase
          .from('flashcard_cards')
          .insert(cardData)
          .select();

        if (error) {
          console.error('❌ Error adding card:', error);
          alert(`Failed to add card: ${error.message}`);
          return;
        }

        if (!data || data.length === 0) {
          console.error('❌ No data returned from insert');
          alert('Card may not have been saved properly. Please refresh and try again.');
          return;
        }

        console.log('✅ Card added successfully:', data[0]);
        
        // CRITICAL FIX: Force re-render by creating new array
        setFlashcards(prev => {
          console.log('📊 Current flashcards count:', prev.length);
          const newList = [...prev, data[0]];
          console.log('📊 New flashcards count:', newList.length);
          console.log('🔄 Flashcards state updated');
          return newList;
        });

        // CRITICAL FIX: Fire heatmap update event immediately after successful card creation
        if (user?.id) {
          const now = new Date().toISOString();
          console.log('🎯 [CARD_CREATION] Firing heatmap update event for card creation');
          
          window.dispatchEvent(new CustomEvent('flashcard-reviewed', {
            detail: {
              cardId: data[0].id,
              userId: user.id,
              reviewedAt: now,
              difficulty: 'created', // Special flag for card creation
              sessionType: 'card-creation',
              setId: setId,
              timestamp: Date.now(),
              cardCreated: true
            }
          }));

          // Fire backup event for reliability
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('flashcard-reviewed', {
              detail: {
                cardId: data[0].id,
                userId: user.id,
                reviewedAt: now,
                difficulty: 'created',
                sessionType: 'card-creation',
                setId: setId,
                timestamp: Date.now(),
                cardCreated: true,
                backup: true
              }
            }));
          }, 200);
        }
        
      } else {
        console.log('🆕 Creating new set and adding first card...');
        
        if (!user) {
          alert('Please log in to create flashcard sets.');
          return;
        }
        
        const setData = { 
          title: title?.trim() || 'New Flashcard Set', 
          type: 'Mixed',
          user_id: user.id // CRITICAL: Add user_id
        };
        
        console.log('📋 Creating set with data:', setData);
        
        const { data: newSetData, error: newSetErr } = await supabase
          .from('flashcard_sets')
          .insert(setData)
          .select()
          .single();

        if (newSetErr) {
          console.error('❌ Error creating set:', newSetErr);
          alert(`Failed to create flashcard set: ${newSetErr.message}`);
          return;
        }

        console.log('✅ New set created:', newSetData);
        setSetId(newSetData.id);

        const cardData = { 
          set_id: newSetData.id, 
          front: front || '', 
          back: back || '',
          card_type: finalCardType,
          front_audio_url: frontAudioUrl,
          back_audio_url: backAudioUrl,
          user_id: user.id // CRITICAL: Add user_id
        };
        
        console.log('📋 Inserting first card:', cardData);

        const { data: insertedCard, error: cardErr } = await supabase
          .from('flashcard_cards')
          .insert(cardData)
          .select()
          .single();

        if (cardErr) {
          console.error('❌ Error adding first card:', cardErr);
          alert(`Failed to add first card: ${cardErr.message}`);
          return;
        }

        console.log('✅ First card added successfully:', insertedCard);
        setFlashcards([insertedCard]);

        // CRITICAL FIX: Fire heatmap update event for first card creation
        if (user?.id) {
          const now = new Date().toISOString();
          console.log('🎯 [FIRST_CARD] Firing heatmap update event for first card creation');
          
          window.dispatchEvent(new CustomEvent('flashcard-reviewed', {
            detail: {
              cardId: insertedCard.id,
              userId: user.id,
              reviewedAt: now,
              difficulty: 'created',
              sessionType: 'first-card-creation',
              setId: newSetData.id,
              timestamp: Date.now(),
              cardCreated: true,
              firstCard: true
            }
          }));

          // Fire backup event
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('flashcard-reviewed', {
              detail: {
                cardId: insertedCard.id,
                userId: user.id,
                reviewedAt: now,
                difficulty: 'created',
                sessionType: 'first-card-creation',
                setId: newSetData.id,
                timestamp: Date.now(),
                cardCreated: true,
                firstCard: true,
                backup: true
              }
            }));
          }, 200);
        }
        
        // Update URL to include the new set ID
        navigate(`/flashcards/${newSetData.id}`, { replace: true });
      }
    } catch (err) {
      console.error("💥 Unexpected error saving flashcard:", err);
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
        console.error("Error updating flashcard:", error);
      } else {
        // CRITICAL FIX: Fire heatmap update event for card updates
        if (user?.id) {
          const now = new Date().toISOString();
          console.log('🎯 [CARD_UPDATE] Firing heatmap update event for card update');
          
          window.dispatchEvent(new CustomEvent('flashcard-reviewed', {
            detail: {
              cardId: cardId,
              userId: user.id,
              reviewedAt: now,
              difficulty: 'updated',
              sessionType: 'card-update',
              setId: setId,
              timestamp: Date.now(),
              cardUpdated: true
            }
          }));
        }
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
        console.error("Error deleting card:", error);
      } else {
        // CRITICAL FIX: Fire heatmap update event for card deletion
        if (user?.id) {
          const now = new Date().toISOString();
          console.log('🎯 [CARD_DELETE] Firing heatmap update event for card deletion');
          
          window.dispatchEvent(new CustomEvent('flashcard-reviewed', {
            detail: {
              cardId: cardToDelete.id,
              userId: user.id,
              reviewedAt: now,
              difficulty: 'deleted',
              sessionType: 'card-deletion',
              setId: setId,
              timestamp: Date.now(),
              cardDeleted: true
            }
          }));
        }
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

  // Updated return statement for your Flashcard component
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