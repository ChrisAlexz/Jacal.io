// src/components/study/CompletionScreen.jsx - Study completion screen
import React from 'react';
import { useRouter } from 'next/navigation';

const CompletionScreen = ({ allCards, handleMasterAgain, masteredCount, spacedLearningEnabled, spacedLearningBatches }) => {
  const router = useRouter();
  const sessionCount = spacedLearningEnabled ? spacedLearningBatches.length : 1;

  return (
    <div className="study-completion">
      <div className="completion-icon">🎉</div>
      <h2>Perfect! All Cards Mastered!</h2>
      <p>
        Congratulations! You've completed ALL sessions and marked every single card as "Easy" - you've truly mastered this entire deck!
        All {allCards.length} cards across {sessionCount} session{sessionCount > 1 ? 's' : ''} have been successfully completed.
        You mastered {masteredCount} cards total!
      </p>

      <div className="completion-actions">
        <button type="button" className="back-button" onClick={() => router.back()}>
          Back to Sets
        </button>
        <button type="button" className="restart-button" onClick={handleMasterAgain}>
          Master Again
        </button>
      </div>
    </div>
  );
};

export default CompletionScreen;
