// src/utils/SpacedRepetition.js - FIXED Anki-style Spaced Repetition Algorithm

/**
 * Anki-style Spaced Repetition Algorithm
 * Based on the SM-2 algorithm with Anki's modifications
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
  intervalModifier: 1.0
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
 * Get cards that are due for review in the current session
 * All cards stay in session until marked as "Easy"
 * @param {Array} cards - Array of card objects
 * @returns {Array} Cards that should be shown in the current session
 */
export function getDueCards(cards) {
  const now = new Date();
  
  return cards.filter(card => {
    // All cards are included in session until they're marked as "Easy"
    // We can't determine "Easy" status from card data alone, so include all cards
    // The session management will handle removing cards when "Easy" is pressed
    
    // Always include new cards
    if (!card.due || !card.state) return true;
    
    // Include all other cards - they'll be managed by the session logic
    return true;
  });
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
 * Get study statistics
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
    overdue: 0
  };
  
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
  });
  
  return stats;
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
  shouldRemoveFromSession,
  CARD_STATES,
  DEFAULT_SETTINGS
};

export default SpacedRepetitionUtils;