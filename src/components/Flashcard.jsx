// src/components/Flashcard.jsx - FIXED VERSION WITH PER-CARD TYPE SUPPORT
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from '../supabase';

import FlashcardTitle from "./FlashcardTitle";
import FlashcardType from "./FlashcardType";
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
  const [isPerCardMode, setIsPerCardMode] = useState(false);

  useEffect(() => {
    if (id) {
      fetchExistingSet(id);
    }
  }, [id]);

  const fetchExistingSet = async (theId) => {
    const { data, error } = await supabase
      .from("flashcard_sets")
      .select(`*, flashcard_cards!set_id(*)`)
      .eq("id", theId)
      .single();

    if (error) {
      console.error("Error fetching deck:", error);
    } else if (data) {
      setSetId(data.id);
      setTitle(data.title);
      setType(data.type);
      setFlashcards(data.flashcard_cards || []);
      
      // Check if cards have different types - if so, enable per-card mode
      const cardTypes = new Set(data.flashcard_cards?.map(card => card.card_type).filter(Boolean));
      if (cardTypes.size > 1 || (cardTypes.size === 1 && !cardTypes.has(data.type))) {
        setIsPerCardMode(true);
      }
    }
  };

  useEffect(() => {
    const updateSetDetails = async () => {
      if (setId && !isPerCardMode) {
        const { error } = await supabase
          .from('flashcard_sets')
          .update({ title, type })
          .eq('id', setId);
        if (error) {
          console.error("Error updating set details:", error);
        }
      } else if (setId && isPerCardMode) {
        // Only update title in per-card mode
        const { error } = await supabase
          .from('flashcard_sets')
          .update({ title })
          .eq('id', setId);
        if (error) {
          console.error("Error updating set title:", error);
        }
      }
    };

    const timer = setTimeout(() => {
      if (setId) {
        updateSetDetails();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [title, type, setId, isPerCardMode]);

  const addFlashcard = async (front, back, cardType = null) => {
    const finalCardType = cardType || type;
    
    if (finalCardType === 'Basic' && (!front.trim() || !back.trim())) return;
    if (finalCardType === 'Basic-Type' && (!front.trim() || !back.trim())) return;
    if (finalCardType === 'Cloze' && !front.trim()) return;

    setShowSuccess(true);

    try {
      if (setId) {
        const { data, error } = await supabase
          .from('flashcard_cards')
          .insert({ 
            set_id: setId, 
            front, 
            back,
            card_type: finalCardType // Store the specific card type
          })
          .select();

        if (error) return;

        setFlashcards([...flashcards, data[0]]);
      } else {
        const { data: newSetData, error: newSetErr } = await supabase
          .from('flashcard_sets')
          .insert({ title, type: isPerCardMode ? 'Mixed' : type })
          .select()
          .single();

        if (newSetErr) return;

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

        if (cardErr) return;

        setFlashcards([insertedCard]);
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

  const handlePerCardToggle = (enabled) => {
    setIsPerCardMode(enabled);
    
    if (enabled) {
      // When enabling per-card mode, update set type to 'Mixed'
      if (setId) {
        supabase
          .from('flashcard_sets')
          .update({ type: 'Mixed' })
          .eq('id', setId)
          .then(({ error }) => {
            if (error) console.error("Error updating set type:", error);
          });
      }
    } else {
      // When disabling per-card mode, update all cards to use the set type
      if (setId && flashcards.length > 0) {
        // Update all existing cards to use the current set type
        const updatePromises = flashcards.map(card => 
          supabase
            .from('flashcard_cards')
            .update({ card_type: type })
            .eq('id', card.id)
        );
        
        Promise.all(updatePromises).then(() => {
          // Update the local state
          setFlashcards(prev => prev.map(card => ({
            ...card,
            card_type: type
          })));
          
          // Update set type back to the selected type
          supabase
            .from('flashcard_sets')
            .update({ type })
            .eq('id', setId);
        });
      }
    }
  };

  return (
    <div className="flashcard-page">
      <div className="flashcard-container">
        <div className="flashcard-header">
          <h2>{setId ? "Edit Flashcards" : "Create Flashcards"}</h2>
        </div>

        <div className="flashcard-header-row">
          <FlashcardTitle title={title} setTitle={setTitle} />
          <FlashcardType 
            type={type} 
            setType={setType} 
            disabled={!title.trim()}
            isPerCard={isPerCardMode}
            onPerCardToggle={handlePerCardToggle}
          />
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