// src/components/Flashcard.jsx - FIXED VERSION WITH BETTER LOADING AND ERROR HANDLING
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from '../supabase';

import FlashcardTitle from "./FlashcardTitle";
import FlashcardInput from "./FlashcardInput";
import FlashcardList from "./FlashcardList";
import SuccessPopup from "./SuccessPopup";

import "../styles/Flashcard.css";

export default function Flashcard() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [title, setTitle] = useState("");
  const [type, setType] = useState("Basic");
  const [flashcards, setFlashcards] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [setId, setSetId] = useState(null);
  const [isPerCardMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // *** CRITICAL FIX: Enhanced useEffect with better error handling and loading states ***
  useEffect(() => {
    const loadData = async () => {
      if (id) {
        console.log('Loading flashcard set with ID:', id);
        setLoading(true);
        setError(null);
        
        try {
          await fetchExistingSet(id);
        } catch (err) {
          console.error('Error loading flashcard set:', err);
          setError('Failed to load flashcard set. Please try again.');
        } finally {
          setLoading(false);
        }
      } else {
        // No ID - new set
        setLoading(false);
      }
    };

    loadData();
  }, [id]); // Only depend on id

  const fetchExistingSet = async (theId) => {
    console.log('Fetching existing set with ID:', theId);
    
    try {
      // First, try to get just the set info to verify it exists
      const { data: setData, error: setError } = await supabase
        .from("flashcard_sets")
        .select("*")
        .eq("id", theId)
        .single();

      if (setError) {
        console.error("Error fetching set:", setError);
        if (setError.code === 'PGRST116') {
          throw new Error('Flashcard set not found');
        }
        throw new Error(`Database error: ${setError.message}`);
      }

      if (!setData) {
        throw new Error('Flashcard set not found');
      }

      console.log('Set data loaded:', setData);

      // Set the basic info first
      setSetId(setData.id);
      setTitle(setData.title);
      setType(setData.type || 'Basic');

      // Now fetch the cards separately with a small delay to ensure database consistency
      console.log('Fetching cards for set:', setData.id);
      
      // Add a small delay to ensure database writes have settled
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { data: cardsData, error: cardsError } = await supabase
        .from("flashcard_cards")
        .select("*")
        .eq("set_id", setData.id)
        .order('created_at', { ascending: true });

      if (cardsError) {
        console.error("Error fetching cards:", cardsError);
        // Don't throw here - just log and continue with empty cards
        setFlashcards([]);
      } else {
        console.log('Cards loaded:', cardsData?.length || 0, 'cards');
        setFlashcards(cardsData || []);
      }

      // Always set deck type to 'Mixed' since we're always in per-card mode
      if (setData.type !== 'Mixed') {
        console.log('Updating deck type to Mixed...');
        const { error: updateError } = await supabase
          .from('flashcard_sets')
          .update({ type: 'Mixed' })
          .eq('id', setData.id);
          
        if (updateError) {
          console.error("Error updating set type:", updateError);
        }
      }

    } catch (error) {
      console.error('Error in fetchExistingSet:', error);
      throw error; // Re-throw to be handled by the calling function
    }
  };

  // *** ENHANCED: Better debounced title update ***
  useEffect(() => {
    const updateSetDetails = async () => {
      if (setId && title.trim()) {
        console.log('Updating set title to:', title);
        const { error } = await supabase
          .from('flashcard_sets')
          .update({ title: title.trim() })
          .eq('id', setId);
        if (error) {
          console.error("Error updating set title:", error);
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

  const addFlashcard = async (front, back, cardType = null) => {
    const finalCardType = cardType || type;
    
    if (finalCardType === 'Basic' && (!front.trim() || !back.trim())) return;
    if (finalCardType === 'Basic-Type' && (!front.trim() || !back.trim())) return;
    if (finalCardType === 'Cloze' && !front.trim()) return;

    setShowSuccess(true);

    try {
      if (setId) {
        console.log('Adding card to existing set:', setId);
        const { data, error } = await supabase
          .from('flashcard_cards')
          .insert({ 
            set_id: setId, 
            front, 
            back,
            card_type: finalCardType
          })
          .select();

        if (error) {
          console.error('Error adding card:', error);
          return;
        }

        console.log('Card added successfully:', data[0]);
        setFlashcards(prev => [...prev, data[0]]);
      } else {
        console.log('Creating new set and adding first card...');
        const { data: newSetData, error: newSetErr } = await supabase
          .from('flashcard_sets')
          .insert({ title: title.trim() || 'New Flashcard Set', type: 'Mixed' })
          .select()
          .single();

        if (newSetErr) {
          console.error('Error creating set:', newSetErr);
          return;
        }

        console.log('New set created:', newSetData);
        setSetId(newSetData.id);

        const { data: insertedCard, error: cardErr } = await supabase
          .from('flashcard_cards')
          .insert({ 
            set_id: newSetData.id, 
            front, 
            back,
            card_type: finalCardType
          })
          .select()
          .single();

        if (cardErr) {
          console.error('Error adding first card:', cardErr);
          return;
        }

        console.log('First card added successfully:', insertedCard);
        setFlashcards([insertedCard]);
        
        // Update URL to include the new set ID
        navigate(`/flashcards/${newSetData.id}`, { replace: true });
      }
    } catch (err) {
      console.error("Unexpected error saving flashcard:", err);
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
      }
    }
  };

  // *** ENHANCED: Show loading and error states ***
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
        <div className="flashcard-header">
          <h2>{setId ? "Edit Flashcards" : "Create Flashcards"}</h2>
        </div>

        <div className="flashcard-header-row">
          <FlashcardTitle title={title} setTitle={setTitle} />
          {setId && (
            <button className="study-button" onClick={() => navigate(`/study/${setId}`)}>
              Study
            </button>
          )}
        </div>

        <FlashcardInput
          addFlashcard={addFlashcard}
          disabled={!title.trim()}
          type={type}
          isPerCardMode={isPerCardMode}
        />

        {showSuccess && (
          <SuccessPopup onClose={() => setShowSuccess(false)} />
        )}
      </div>

      <FlashcardList
        flashcards={flashcards}
        updateFlashcard={updateFlashcard}
        onDelete={handleDelete}
        isPerCardMode={isPerCardMode}
      />
    </div>
  );
}