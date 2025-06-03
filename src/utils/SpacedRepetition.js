// src/utils/SpacedRepetition.js - ENHANCED VERSION WITH PROPER CARD ORDERING

/**
 * Enhanced Anki-style Spaced Repetition Algorithm
 * Now includes proper card ordering and prioritization
 */

// Card states in Anki
export const CARD_STATES = {
  NEW: 'new',           // Never studied
  LEARNING: 'learning', // Being learned (red buttons)
  REVIEW: 'review',     // In review phase (graduated)
  RELEARNING: 'relearning' // Failed review, back to learning
};

// Default settings (can be customized)
export const DEFAULT_SETTINGS = {
  // Learning steps (in minutes)
  learningSteps: [1, 10], // 1 minute, then 10 minutes
  relearningSteps: [10],  // 10 minutes for relearning
  
  // Graduating interval (days) - when card moves from learning to review
  graduatingInterval: 1,
  
  // Easy interval (days) - when "Easy" is pressed on new card
  easyInterval: 4,
  
  // Starting ease factor (2.5 = 250%)
  startingEase: 2.5,
  
  // Ease factor changes
  easyBonus: 0.15,    // +15% when Easy is pressed
  hardPenalty: -0.15, // -15% when Hard is pressed
  againPenalty: -0.20, // -20% when Again is pressed
  
  // Minimum ease factor
  minimumEase: 1.3,
  
  // Maximum interval (days)
  maximumInterval: 36500, // ~100 years
  
  // Interval modifier (global multiplier)
  intervalModifier: 1.0,
  
  // Session settings
  maxNewCardsPerSession: 20,
  maxReviewCardsPerSession: 100,
  shuffleCards: true
};

/**
 * Calculate the next review based on the button pressed
 * @param {Object} card - Current card data
 * @param {string} rating - 'again', 'hard', 'good', 'easy'
 * @param {Object} settings - Spaced repetition settings
 * @returns {Object} Updated card data with new scheduling
 */
export function calculateNextReview(card, rating, settings = DEFAULT_SETTINGS) {
  const now = new Date();
  const updatedCard = { ...card };
  
  // Initialize card if it's new
  if (!updatedCard.state) {
    updatedCard.state = CARD_STATES.NEW;
    updatedCard.ease_factor = settings.startingEase;
    updatedCard.interval_days = 0;
    updatedCard.step = 0;
    updatedCard.reviews = 0;
    updatedCard.lapses = 0;
  }
  
  updatedCard.reviews++;
  updatedCard.last_reviewed = now.toISOString();
  
  switch (updatedCard.state) {
    case CARD_STATES.NEW:
      return handleNewCard(updatedCard, rating, settings, now);
    
    case CARD_STATES.LEARNING:
      return handleLearningCard(updatedCard, rating, settings, now);
    
    case CARD_STATES.REVIEW:
      return handleReviewCard(updatedCard, rating, settings, now);
    
    case CARD_STATES.RELEARNING:
      return handleRelearningCard(updatedCard, rating, settings, now);
    
    default:
      return updatedCard;
  }
}

/**
 * Handle NEW cards (first time seeing the card)
 */
function handleNewCard(card, rating, settings, now) {
  switch (rating) {
    case 'again':
      // Stay in learning, start at step 0
      card.state = CARD_STATES.LEARNING;
      card.step = 0;
      card.due = addMinutes(now, settings.learningSteps[0]).toISOString();
      break;
      
    case 'hard':
      // Go to learning, start at step 0
      card.state = CARD_STATES.LEARNING;
      card.step = 0;
      card.due = addMinutes(now, settings.learningSteps[0]).toISOString();
      break;
      
    case 'good':
      // Go to learning, start at step 0
      card.state = CARD_STATES.LEARNING;
      card.step = 0;
      card.due = addMinutes(now, settings.learningSteps[0]).toISOString();
      break;
      
    case 'easy':
      // Skip learning phase, go directly to review
      card.state = CARD_STATES.REVIEW;
      card.interval_days = settings.easyInterval;
      card.due = addDays(now, settings.easyInterval).toISOString();
      break;
      
    default:
      // Default case for unknown ratings
      card.state = CARD_STATES.LEARNING;
      card.step = 0;
      card.due = addMinutes(now, settings.learningSteps[0]).toISOString();
      break;
  }
  
  return card;
}

/**
 * Handle LEARNING cards (in the learning phase)
 */
function handleLearningCard(card, rating, settings, now) {
  switch (rating) {
    case 'again':
      // Reset to first learning step
      card.step = 0;
      card.due = addMinutes(now, settings.learningSteps[0]).toISOString();
      break;
      
    case 'hard':
      // Repeat current step (don't advance)
      const currentStep = Math.min(card.step, settings.learningSteps.length - 1);
      card.due = addMinutes(now, settings.learningSteps[currentStep]).toISOString();
      break;
      
    case 'good':
      // Advance to next step or graduate
      card.step++;
      if (card.step >= settings.learningSteps.length) {
        // Graduate to review ONLY after completing ALL learning steps
        card.state = CARD_STATES.REVIEW;
        card.interval_days = settings.graduatingInterval;
        card.due = addDays(now, settings.graduatingInterval).toISOString();
      } else {
        // Stay in learning, move to next step
        card.due = addMinutes(now, settings.learningSteps[card.step]).toISOString();
      }
      break;
      
    case 'easy':
      // Graduate to review with easy interval (skip remaining learning steps)
      card.state = CARD_STATES.REVIEW;
      card.interval_days = settings.easyInterval;
      card.due = addDays(now, settings.easyInterval).toISOString();
      break;
      
    default:
      // Default case - repeat current step
      const fallbackStep = Math.min(card.step, settings.learningSteps.length - 1);
      card.due = addMinutes(now, settings.learningSteps[fallbackStep]).toISOString();
      break;
  }
  
  return card;
}

/**
 * Handle REVIEW cards (graduated cards being reviewed)
 */
function handleReviewCard(card, rating, settings, now) {
  const currentInterval = card.interval_days || 1;
  
  switch (rating) {
    case 'again':
      // Failed review - go to relearning
      card.state = CARD_STATES.RELEARNING;
      card.step = 0;
      card.lapses++;
      card.ease_factor = Math.max(
        settings.minimumEase, 
        card.ease_factor + settings.againPenalty
      );
      card.due = addMinutes(now, settings.relearningSteps[0]).toISOString();
      break;
      
    case 'hard':
      // Reduce ease and set shorter interval
      card.ease_factor = Math.max(
        settings.minimumEase, 
        card.ease_factor + settings.hardPenalty
      );
      card.interval_days = Math.max(1, Math.round(currentInterval * 1.2));
      card.interval_days = Math.min(card.interval_days, settings.maximumInterval);
      card.due = addDays(now, card.interval_days).toISOString();
      break;
      
    case 'good':
      // Normal review - use ease factor
      card.interval_days = Math.round(currentInterval * card.ease_factor * settings.intervalModifier);
      card.interval_days = Math.min(card.interval_days, settings.maximumInterval);
      card.due = addDays(now, card.interval_days).toISOString();
      break;
      
    case 'easy':
      // Increase ease and set longer interval
      card.ease_factor += settings.easyBonus;
      card.interval_days = Math.round(currentInterval * card.ease_factor * settings.intervalModifier * 1.3);
      card.interval_days = Math.min(card.interval_days, settings.maximumInterval);
      card.due = addDays(now, card.interval_days).toISOString();
      break;
      
    default:
      // Default case - treat as 'good'
      card.interval_days = Math.round(currentInterval * card.ease_factor * settings.intervalModifier);
      card.interval_days = Math.min(card.interval_days, settings.maximumInterval);
      card.due = addDays(now, card.interval_days).toISOString();
      break;
  }
  
  return card;
}

/**
 * Handle RELEARNING cards (failed reviews)
 */
function handleRelearningCard(card, rating, settings, now) {
  switch (rating) {
    case 'again':
      // Reset to first relearning step
      card.step = 0;
      card.due = addMinutes(now, settings.relearningSteps[0]).toISOString();
      break;
      
    case 'hard':
      // Repeat current relearning step
      const currentStep = Math.min(card.step, settings.relearningSteps.length - 1);
      card.due = addMinutes(now, settings.relearningSteps[currentStep]).toISOString();
      break;
      
    case 'good':
      // Advance in relearning or graduate back to review
      card.step++;
      if (card.step >= settings.relearningSteps.length) {
        // Graduate back to review
        card.state = CARD_STATES.REVIEW;
        card.interval_days = Math.max(1, Math.round((card.interval_days || 1) * 0.5)); // Reduced interval after lapse
        card.due = addDays(now, card.interval_days).toISOString();
      } else {
        // Next relearning step
        card.due = addMinutes(now, settings.relearningSteps[card.step]).toISOString();
      }
      break;
      
    case 'easy':
      // Graduate back to review with normal interval
      card.state = CARD_STATES.REVIEW;
      card.interval_days = Math.max(1, Math.round((card.interval_days || 1) * 0.7)); // Slightly reduced interval
      card.due = addDays(now, card.interval_days).toISOString();
      break;
      
    default:
      // Default case - repeat current step
      const fallbackStep = Math.min(card.step, settings.relearningSteps.length - 1);
      card.due = addMinutes(now, settings.relearningSteps[fallbackStep]).toISOString();
      break;
  }
  
  return card;
}

/**
 * Enhanced function to get cards for the current study session
 * Cards are properly ordered by priority and shuffled within each category
 * @param {Array} cards - Array of card objects
 * @param {Object} settings - Settings object
 * @returns {Array} Properly ordered cards for the study session
 */
export function getDueCards(cards, settings = DEFAULT_SETTINGS) {
  const now = new Date();
  
  // Categorize cards by their current status
  const categorizedCards = {
    overdueReview: [],      // Review cards that are overdue (highest priority)
    dueReview: [],          // Review cards that are due today
    learningDue: [],        // Learning/relearning cards that are due
    newCards: [],           // Brand new cards
    futureReview: []        // Review cards not yet due (shouldn't appear in session)
  };
  
  cards.forEach(card => {
    const cardState = card.state || CARD_STATES.NEW;
    const dueDate = card.due ? new Date(card.due) : null;
    
    switch (cardState) {
      case CARD_STATES.NEW:
      case null:
      case undefined:
        categorizedCards.newCards.push(card);
        break;
        
      case CARD_STATES.LEARNING:
      case CARD_STATES.RELEARNING:
        // Learning cards are due if their due time has passed
        if (!dueDate || dueDate <= now) {
          categorizedCards.learningDue.push(card);
        }
        break;
        
      case CARD_STATES.REVIEW:
        if (!dueDate) {
          // No due date means it should be reviewed
          categorizedCards.dueReview.push(card);
        } else if (dueDate <= now) {
          // Check if it's overdue (more than 1 day past due)
          const daysPastDue = (now - dueDate) / (1000 * 60 * 60 * 24);
          if (daysPastDue > 1) {
            categorizedCards.overdueReview.push(card);
          } else {
            categorizedCards.dueReview.push(card);
          }
        } else {
          // Future review - don't include in session
          categorizedCards.futureReview.push(card);
        }
        break;
        
      default:
        // Unknown state - treat as new
        categorizedCards.newCards.push(card);
        break;
    }
  });
  
  // Apply session limits
  const limitedNew = categorizedCards.newCards.slice(0, settings.maxNewCardsPerSession || 20);
  const limitedReview = [
    ...categorizedCards.overdueReview,
    ...categorizedCards.dueReview
  ].slice(0, settings.maxReviewCardsPerSession || 100);
  
  // Order cards by priority:
  // 1. Overdue review cards (sorted by how overdue they are - most overdue first)
  // 2. Learning/relearning cards that are due (sorted by due time)
  // 3. Regular review cards due today (shuffled)
  // 4. New cards (shuffled)
  
  const sessionCards = [];
  
  // 1. Overdue review cards (most overdue first)
  const sortedOverdue = categorizedCards.overdueReview.sort((a, b) => {
    const aOverdue = new Date(a.due) || new Date(0);
    const bOverdue = new Date(b.due) || new Date(0);
    return aOverdue - bOverdue; // Oldest due date first
  });
  
  // 2. Learning cards that are due (soonest due time first)
  const sortedLearning = categorizedCards.learningDue.sort((a, b) => {
    const aDue = new Date(a.due) || now;
    const bDue = new Date(b.due) || now;
    return aDue - bDue; // Soonest due time first
  });
  
  // 3. Regular review cards (shuffled for variety)
  const shuffledReview = settings.shuffleCards 
    ? shuffleArray([...categorizedCards.dueReview])
    : categorizedCards.dueReview;
  
  // 4. New cards (shuffled for variety)
  const shuffledNew = settings.shuffleCards 
    ? shuffleArray([...limitedNew])
    : limitedNew;
  
  // Combine in priority order, but interleave for better study experience
  const totalCards = [
    ...sortedOverdue,
    ...sortedLearning,
    ...shuffledReview.slice(0, settings.maxReviewCardsPerSession || 100),
    ...shuffledNew
  ];
  
  // For better user experience, interleave new cards with review cards
  // instead of showing all new cards at the end
  const finalSessionCards = interleaveCards(
    [...sortedOverdue, ...sortedLearning, ...shuffledReview.slice(0, settings.maxReviewCardsPerSession || 100)],
    shuffledNew,
    0.3 // 30% new cards mixed in
  );
  
  console.log('📊 Session card breakdown:', {
    overdue: sortedOverdue.length,
    learning: sortedLearning.length,
    review: shuffledReview.length,
    new: shuffledNew.length,
    total: finalSessionCards.length
  });
  
  return finalSessionCards;
}

/**
 * Interleave new cards with review cards for better study experience
 * @param {Array} reviewCards - Review/learning cards
 * @param {Array} newCards - New cards
 * @param {number} newCardRatio - Ratio of new cards to mix in (0.0 to 1.0)
 * @returns {Array} Interleaved cards
 */
function interleaveCards(reviewCards, newCards, newCardRatio = 0.3) {
  if (newCards.length === 0) return reviewCards;
  if (reviewCards.length === 0) return newCards;
  
  const result = [];
  const totalCards = reviewCards.length + newCards.length;
  const newCardInterval = Math.max(1, Math.floor(1 / newCardRatio));
  
  let reviewIndex = 0;
  let newIndex = 0;
  
  for (let i = 0; i < totalCards; i++) {
    // Decide whether to add a new card or review card
    const shouldAddNew = (i > 0 && i % newCardInterval === 0) && newIndex < newCards.length;
    
    if (shouldAddNew) {
      result.push(newCards[newIndex]);
      newIndex++;
    } else if (reviewIndex < reviewCards.length) {
      result.push(reviewCards[reviewIndex]);
      reviewIndex++;
    } else if (newIndex < newCards.length) {
      // If we've run out of review cards, add remaining new cards
      result.push(newCards[newIndex]);
      newIndex++;
    }
  }
  
  return result;
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Check if a card should be removed from current session
 * Cards only graduate when marked as "Easy"
 * @param {Object} card - Card object
 * @param {string} lastRating - The rating that was just applied
 * @returns {boolean} True if card should be removed from session
 */
export function shouldRemoveFromSession(card, lastRating = null) {
  // Only remove if the last rating was "Easy"
  return lastRating === 'easy';
}

/**
 * Get enhanced study statistics
 * @param {Array} cards - Array of card objects
 * @returns {Object} Study statistics
 */
export function getStudyStats(cards) {
  const now = new Date();
  
  const stats = {
    total: cards.length,
    new: 0,
    learning: 0,
    review: 0,
    due: 0,
    overdue: 0,
    mature: 0,      // Cards with interval >= 21 days
    young: 0,       // Cards with interval < 21 days
    suspended: 0,   // If you add suspended cards later
    averageEase: 0,
    totalLapses: 0
  };
  
  let totalEase = 0;
  let easeCount = 0;
  
  cards.forEach(card => {
    // Count by state
    switch (card.state) {
      case CARD_STATES.NEW:
      case null:
      case undefined:
        stats.new++;
        break;
      case CARD_STATES.LEARNING:
      case CARD_STATES.RELEARNING:
        stats.learning++;
        break;
      case CARD_STATES.REVIEW:
        stats.review++;
        // Count mature vs young cards
        if (card.interval_days >= 21) {
          stats.mature++;
        } else {
          stats.young++;
        }
        break;
      default:
        stats.new++;
        break;
    }
    
    // Count due cards
    if (!card.due || new Date(card.due) <= now) {
      stats.due++;
      
      // Count overdue (more than 1 day past due date)
      if (card.due && new Date(card.due) < addDays(now, -1)) {
        stats.overdue++;
      }
    }
    
    // Calculate average ease
    if (card.ease_factor) {
      totalEase += card.ease_factor;
      easeCount++;
    }
    
    // Count lapses
    if (card.lapses) {
      stats.totalLapses += card.lapses;
    }
  });
  
  // Calculate average ease
  stats.averageEase = easeCount > 0 ? (totalEase / easeCount) : 2.5;
  
  return stats;
}

/**
 * Get next review times for interval preview
 * @param {Object} card - Current card
 * @param {Object} settings - Spaced repetition settings
 * @returns {Object} Preview intervals for each rating
 */
export function getIntervalPreviews(card, settings = DEFAULT_SETTINGS) {
  const previews = {};
  
  ['again', 'hard', 'good', 'easy'].forEach(rating => {
    try {
      const tempCard = calculateNextReview({ ...card }, rating, settings);
      
      let intervalText = "New";
      
      if (tempCard.due) {
        const now = new Date();
        const dueDate = new Date(tempCard.due);
        
        if (!isNaN(dueDate.getTime())) {
          const diffMs = dueDate.getTime() - now.getTime();
          const diffMinutes = Math.round(diffMs / (1000 * 60));
          
          if (diffMinutes <= 1) {
            intervalText = "1m";
          } else if (diffMinutes < 60) {
            intervalText = `${diffMinutes}m`;
          } else if (diffMinutes < 1440) {
            const hours = Math.round(diffMinutes / 60);
            intervalText = `${hours}h`;
          } else {
            const days = Math.round(diffMinutes / 1440);
            if (days >= 365) {
              const years = Math.round(days / 365);
              intervalText = `${years}y`;
            } else if (days >= 30) {
              const months = Math.round(days / 30);
              intervalText = `${months}mo`;
            } else {
              intervalText = `${days}d`;
            }
          }
        }
      }
      
      previews[rating] = intervalText;
    } catch (error) {
      console.error(`Error calculating interval for ${rating}:`, error);
      const fallbacks = { again: "1m", hard: "10m", good: "1d", easy: "4d" };
      previews[rating] = fallbacks[rating];
    }
  });
  
  return previews;
}

// Helper functions
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

const SpacedRepetitionUtils = {
  calculateNextReview,
  getDueCards,
  getStudyStats,
  getIntervalPreviews,
  shouldRemoveFromSession,
  shuffleArray,
  interleaveCards,
  CARD_STATES,
  DEFAULT_SETTINGS
};

export default SpacedRepetitionUtils;