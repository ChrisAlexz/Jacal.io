// src/components/study/BatchCompletionModal.jsx - Batch completion modal for spaced learning
import React from 'react';

const BatchCompletionModal = ({ batchCompletionModal, masteredCount, onBackToSets, onContinue, onMasterAgain }) => {
  const isLast = batchCompletionModal.completed >= batchCompletionModal.total;

  return (
    <div className="batch-completion-overlay">
      <div className="batch-completion-modal">
        <h2>
          {isLast ? 'All Sessions Complete!' : `Session ${batchCompletionModal.completed} Complete!`}
        </h2>
        <p>
          {isLast
            ? `You've completed all ${batchCompletionModal.total} sessions! Mastered ${masteredCount} cards.`
            : `Session ${batchCompletionModal.completed} of ${batchCompletionModal.total} complete. Mastered ${masteredCount} cards so far. Ready for the next 20 cards?`
          }
        </p>

        <div className="batch-completion-actions">
          <button className="batch-btn-secondary" onClick={onBackToSets}>
            Back to Sets
          </button>
          {!isLast && (
            <button className="batch-btn-primary" onClick={onContinue}>
              Continue to Next Session
            </button>
          )}
          {isLast && (
            <button className="batch-btn-success" onClick={onMasterAgain}>
              Study Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BatchCompletionModal;
