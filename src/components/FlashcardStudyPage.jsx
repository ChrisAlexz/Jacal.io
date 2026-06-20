// src/components/FlashcardStudyPage.jsx - Modular study page using hook + sub-components
import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useStudySession } from '../hooks/useStudySession';
import {
  StudyHeader, StudyCard, TypeAnswerSection, DifficultyButtons,
  CompletionScreen, LoadingStudy, BatchCompletionModal,
  getCardType, processClozeText, checkIsImageOcclusionCard, hasCustomBackContent
} from './study';
import ResetSessionModal from './ResetSessionModal';
import '../styles/FlashcardStudyPage.css';

export default function FlashcardStudyPage() {
  const { id } = useParams();
  const study = useStudySession(id);

  useEffect(() => {
    if (id) study.fetchFlashcardSet();
  }, [id]);

  // Batch completion modal
  if (study.batchCompletionModal) {
    return (
      <BatchCompletionModal
        batchCompletionModal={study.batchCompletionModal}
        masteredCount={study.masteredCardIds.size}
        onBackToSets={study.handleBackToSetsFromModal}
        onContinue={study.continueToNextBatch}
        onMasterAgain={study.handleMasterAgain}
      />
    );
  }

  // Loading state
  if (study.loading || !study.isInitialized || !study.hasRestoredProgress) {
    return (
      <div className="study-container">
        <LoadingStudy />
      </div>
    );
  }

  // Completion state
  if (study.sessionCards.length === 0 && study.allCards.length > 0) {
    if (study.spacedLearningEnabled && study.currentBatchIndex + 1 < study.spacedLearningBatches.length) {
      return (
        <div className="study-container">
          <LoadingStudy message="Preparing next session..." />
        </div>
      );
    }

    return (
      <div className="study-container">
        <CompletionScreen
          allCards={study.allCards}
          handleMasterAgain={study.handleMasterAgain}
          masteredCount={study.masteredCardIds.size}
          spacedLearningEnabled={study.spacedLearningEnabled}
          spacedLearningBatches={study.spacedLearningBatches}
        />
      </div>
    );
  }

  const currentCard = study.sessionCards[study.currentIndex];
  if (!currentCard) {
    return (
      <div className="study-container">
        <LoadingStudy />
      </div>
    );
  }

  const currentCardType = getCardType(currentCard, study.deckType);
  const isImageOcclusion = checkIsImageOcclusionCard(currentCard);
  const hasBackContent = hasCustomBackContent(currentCard, currentCardType);
  const intervalPreviews = study.getIntervalPreviewsForCard();

  return (
    <div className="study-container">
      <StudyHeader
        setTitle={study.setTitle}
        currentIndex={study.currentIndex}
        sessionCards={study.sessionCards}
        allCards={study.allCards}
        masteredCount={study.masteredCardIds.size}
        studySessionId={study.studySessionId}
        spacedLearningEnabled={study.spacedLearningEnabled}
        currentBatchIndex={study.currentBatchIndex}
        spacedLearningBatches={study.spacedLearningBatches}
        onResetSession={study.handleResetSession}
      />

      <StudyCard
        card={currentCard}
        showBack={study.showBack}
        deckType={study.deckType}
        currentIndex={study.currentIndex}
        isImageOcclusionCard={isImageOcclusion}
        hasCustomBackContent={hasBackContent}
        processClozeText={processClozeText}
        getCardType={getCardType}
      />

      {currentCardType === 'Basic-Type' && (
        <TypeAnswerSection
          userAnswer={study.userAnswer}
          setUserAnswer={study.setUserAnswer}
          handleSubmitAnswer={study.handleSubmitAnswer}
          showCorrectAnswer={study.showCorrectAnswer}
          isAnswerCorrect={study.isAnswerCorrect}
          card={currentCard}
          currentIndex={study.currentIndex}
          intervalPreviews={intervalPreviews}
          handleDifficultyChoice={study.handleDifficultyChoice}
        />
      )}

      {currentCardType !== 'Basic-Type' && !study.showBack && (
        <button className="show-answer-btn" onClick={study.handleShowAnswer}>
          Show Answer
        </button>
      )}

      {currentCardType !== 'Basic-Type' && study.showBack && (
        <DifficultyButtons
          intervalPreviews={intervalPreviews}
          handleDifficultyChoice={study.handleDifficultyChoice}
        />
      )}

      <ResetSessionModal
        isOpen={study.showResetModal}
        onClose={study.handleCloseResetModal}
        onConfirm={study.confirmResetSession}
        isLoading={study.resetLoading}
      />
    </div>
  );
}
