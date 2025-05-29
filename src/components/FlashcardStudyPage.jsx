// src/pages/FlashcardStudyPage.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import "../styles/FlashcardStudyPage.css";

export default function FlashcardStudyPage() {
  const { id } = useParams(); // ID of the flashcard set
  const navigate = useNavigate();
  const [flashcards, setFlashcards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [deckType, setDeckType] = useState("Basic");
  const [setTitle, setSetTitle] = useState("");
  
  // State for type-in-answer functionality
  const [userAnswer, setUserAnswer] = useState('');
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState(null);

  useEffect(() => {
    if (id) {
      fetchFlashcardSet(id);
    }
  }, [id]);

  const fetchFlashcardSet = async (setId) => {
    // First, get the flashcard set to determine its type
    const { data: setData, error: setError } = await supabase
      .from("flashcard_sets")
      .select("*")
      .eq("id", setId)
      .single();

    if (setError) {
      console.error("Error fetching flashcard set:", setError);
      return;
    }

    if (setData) {
      setDeckType(setData.type);
      setSetTitle(setData.title);
    }

    // Then, get the cards
    const { data, error } = await supabase
      .from("flashcard_cards")
      .select("*")
      .eq("set_id", setId);

    if (error) {
      console.error("Error fetching flashcards:", error);
      return;
    }

    setFlashcards(data || []);
  };

  const handleShowAnswer = () => setShowBack(true);

  const handleSubmitAnswer = () => {
    if (deckType !== 'Basic-Type') return;
    
    const currentCard = flashcards[currentIndex];
    const correctAnswer = currentCard.back.replace(/<[^>]*>/g, '').trim().toLowerCase();
    const userAnswerClean = userAnswer.trim().toLowerCase();
    
    const isCorrect = correctAnswer === userAnswerClean;
    setIsAnswerCorrect(isCorrect);
    setShowCorrectAnswer(true);
  };

  const handleNextCard = () => {
    // Reset all states for next card
    setShowBack(false);
    setShowCorrectAnswer(false);
    setIsAnswerCorrect(null);
    setUserAnswer('');
    setCurrentIndex((prevIndex) => (prevIndex + 1) % flashcards.length);
  };

  // For Image Occlusion, just display the content as-is
  // The HTML structure is already correct from the editor

  // Process cloze text for different card types
  const processClozeText = (text, isRevealed, activeClozeDeletion = 1) => {
    if (deckType !== "Cloze") return text;
    
    // Replace all cloze deletions with appropriate styling
    let processedText = text;
    
    // Find all cloze deletions (c1, c2, c3, etc.)
    const clozePattern = /{{c(\d+)::(.*?)}}/g;
    
    processedText = processedText.replace(clozePattern, (match, clozeNumber, clozeText) => {
      const clozeNum = parseInt(clozeNumber);
      
      if (isRevealed) {
        // When answer is revealed, show all cloze deletions with highlighting
        if (clozeNum === activeClozeDeletion) {
          return `<span class="cloze-revealed-active">${clozeText}</span>`;
        } else {
          return `<span class="cloze-revealed-inactive">${clozeText}</span>`;
        }
      } else {
        // When question is shown
        if (clozeNum === activeClozeDeletion) {
          // The active cloze deletion being tested - show as blue question
          return `<span class="cloze-question">[...]</span>`;
        } else {
          // Other cloze deletions - show the actual text but dimmed
          return `<span class="cloze-other">${clozeText}</span>`;
        }
      }
    });
    
    return processedText;
  };

  if (flashcards.length === 0) {
    return (
      <div className="study-container">
        <div className="loading-study">
          <div className="loading-spinner"></div>
          <p>Loading flashcards...</p>
        </div>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];
  const hasCustomBackContent =
    deckType === "Cloze" &&
    currentCard.back !== currentCard.front &&
    currentCard.back.trim() !== "";

  return (
    <div className="study-container">
      {/* Study Mode Options */}
      <div className="study-mode-selector">
        <button 
          className="speed-focus-btn"
          onClick={() => navigate(`/speed/${id}`)}
          title="Speed Focus Mode - Test your knowledge under time pressure!"
        >
          ⚡ Speed Focus Mode
        </button>
      </div>

      <div className="flashcard-study-box">
        {/* Progress indicator */}
        <div className="study-progress">
          {currentIndex + 1} / {flashcards.length}
        </div>

        <div className="flashcard-front">
          {deckType === "Image-Occlusion" ? (
            // For Image Occlusion, show front for question, back for answer
            <div
              dangerouslySetInnerHTML={{
                __html: showBack ? currentCard.back : currentCard.front
              }}
            />
          ) : deckType === "Cloze" ? (
            <div
              dangerouslySetInnerHTML={{
                __html: processClozeText(currentCard.front, showBack, 1),
              }}
            />
          ) : (
            <div dangerouslySetInnerHTML={{ __html: currentCard.front }} />
          )}
        </div>

        {/* Basic Type Answer Input */}
        {deckType === 'Basic-Type' && !showCorrectAnswer && (
          <div className="type-answer-section">
            <input
              type="text"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Type your answer here..."
              className="answer-input"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && userAnswer.trim()) {
                  handleSubmitAnswer();
                }
              }}
              autoFocus
            />
            <button 
              className="submit-answer-btn" 
              onClick={handleSubmitAnswer}
              disabled={!userAnswer.trim()}
            >
              Submit Answer
            </button>
          </div>
        )}

        {/* Show results for Basic-Type */}
        {deckType === 'Basic-Type' && showCorrectAnswer && (
          <div className="answer-results">
            <div className={`answer-feedback ${isAnswerCorrect ? 'correct' : 'incorrect'}`}>
              <span>{isAnswerCorrect ? '✅' : '❌'}</span>
              <span>{isAnswerCorrect ? 'Correct!' : 'Incorrect'}</span>
            </div>
            <div className="answer-comparison">
              <div className="user-answer">
                <strong>Your answer:</strong>
                <div>{userAnswer}</div>
              </div>
              <div className="correct-answer">
                <strong>Correct answer:</strong> 
                <div dangerouslySetInnerHTML={{ __html: currentCard.back }} />
              </div>
            </div>
            <div className="difficulty-buttons">
              <button className="again-btn" onClick={handleNextCard}>Again</button>
              <button className="hard-btn" onClick={handleNextCard}>Hard</button>
              <button className="good-btn" onClick={handleNextCard}>Good</button>
              <button className="easy-btn" onClick={handleNextCard}>Easy</button>
            </div>
          </div>
        )}

        {/* Regular Basic and Cloze flow */}
        {deckType !== 'Basic-Type' && !showBack && (
          <button className="show-answer-btn" onClick={handleShowAnswer}>
            Show Answer
          </button>
        )}

        {deckType !== 'Basic-Type' && showBack && (
          <>
            {/* For Image Occlusion, don't show back content separately since it's handled above */}
            {deckType !== "Image-Occlusion" && (deckType !== "Cloze" || hasCustomBackContent) && (
              <div className="flashcard-back">
                <div dangerouslySetInnerHTML={{ __html: currentCard.back }} />
              </div>
            )}

            <div className="difficulty-buttons">
              <button className="again-btn" onClick={handleNextCard}>Again</button>
              <button className="hard-btn" onClick={handleNextCard}>Hard</button>
              <button className="good-btn" onClick={handleNextCard}>Good</button>
              <button className="easy-btn" onClick={handleNextCard}>Easy</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}