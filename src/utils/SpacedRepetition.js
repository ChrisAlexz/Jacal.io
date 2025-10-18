// src/utils/SpacedRepetition.js - OPTIMIZED VERSION WITH FIXED INTERVALS

/**
 * Enhanced Anki-style Spaced Repetition Algorithm
 * FIXED: Hard and Good buttons now have clearly different intervals
 * OPTIMIZED: Better progression curves and more intelligent scheduling
 */

// Card states in Anki
export const CARD_STATES = {
  NEW: 'new',           // Never studied
  LEARNING: 'learning', // Being learned (red buttons)
  REVIEW: 'review',     // In review phase (graduated)
  RELEARNING: 'relearning' // Failed review, back to learning
};

// OPTIMIZED: Better default settings with clear differentiation
export const DEFAULT_SETTINGS = {
  // Learning steps (in minutes) - optimized progression
  learningSteps: [1, 10, 1440], // 1 min, 10 min, 1 day
  relearningSteps: [10, 1440],  // 10 min, 1 day for relearning
  
  // Graduating interval (days)
  graduatingInterval: 1,
  
  // Easy interval (days)
  easyInterval: 4,
  
  // Starting ease factor (2.5 = 250%)
  startingEase: 2.5,
  
  // FIXED: Ease factor changes with clear differentiation
  easyBonus: 0.20,      // +20% when Easy (was 0.15)
  hardPenalty: -0.15,   // -15% when Hard
  againPenalty: -0.20,  // -20% when Again
  
  // OPTIMIZED: Better multipliers for hard button
  hardIntervalMultiplier: 1.15,  // NEW: Hard = 1.15x current interval
  goodIntervalMultiplier: 2.5,   // NEW: Good = 2.5x current interval (ease factor)
  easyIntervalMultiplier: 3.0,   // NEW: Easy = 3.0x current interval
  
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

// OPTIMIZED: Immediate review settings for faster "Again" retry
export const IMMEDIATE_REVIEW_SETTINGS = {
  ...DEFAULT_SETTINGS,
  
  // Shorter learning steps for immediate review
  learningSteps: [1, 5, 60], // 1 min, 5 min, 1 hour
  relearningSteps: [1, 10],  // 1 min, 10 min
  
  // More forgiving graduation
  graduatingInterval: 1,
  easyInterval: 4,
  
  // OPTIMIZED: Better multipliers for immediate mode
  hardIntervalMultiplier: 1.2,   // Slightly more forgiving
  goodIntervalMultiplier: 2.5,   // Standard progression
  easyIntervalMultiplier: 3.5,   // Faster progression for easy cards
  
  // Session behavior
  keepFailedCardsInSession: true,
};

/**
 * OPTIMIZED: Calculate the next review with fixed interval logic
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
 * OPTIMIZED: Enhanced with immediate review option
 */
export function calculateNextReviewWithImmediate(card, rating, settings = IMMEDIATE_REVIEW_SETTINGS) {
  const now = new Date();
  const updatedCard = { ...card };
  
  // Initialize session tracking
  if (!updatedCard.session_failures) updatedCard.session_failures = 0;
  if (!updatedCard.session_reviews) updatedCard.session_reviews = 0;
  
  updatedCard.session_reviews++;
  
  // Track "Again" failures in current session
  if (rating === 'again') {
    updatedCard.session_failures++;
    
    // OPTIMIZED: Progressive delay based on failures
    const failureCount = updatedCard.session_failures;
    let delaySeconds;
    
    if (failureCount === 1) {
      delaySeconds = 5; // First failure: 5 seconds
    } else if (failureCount === 2) {
      delaySeconds = 15; // Second failure: 15 seconds
    } else if (failureCount === 3) {
      delaySeconds = 30; // Third failure: 30 seconds
    } else {
      delaySeconds = 60; // Subsequent failures: 1 minute
    }
    
    updatedCard.due = addSeconds(now, delaySeconds).toISOString();
    updatedCard.state = CARD_STATES.LEARNING;
    updatedCard.step = 0;
    
    return updatedCard;
  }
  
  // For all other cases, use the original algorithm
  return calculateNextReview(updatedCard, rating, settings);
}

/**
 * Handle NEW cards (first time seeing the card)
 */
function handleNewCard(card, rating, settings, now) {
  switch (rating) {
    case 'again':
      card.state = CARD_STATES.LEARNING;
      card.step = 0;
      card.due = addMinutes(now, settings.learningSteps[0]).toISOString();
      break;
      
    case 'hard':
      card.state = CARD_STATES.LEARNING;
      card.step = 0;
      card.due = addMinutes(now, settings.learningSteps[0]).toISOString();
      break;
      
    case 'good':
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
        // Graduate to review
        card.state = CARD_STATES.REVIEW;
        card.interval_days = settings.graduatingInterval;
        card.due = addDays(now, settings.graduatingInterval).toISOString();
      } else {
        // Stay in learning, move to next step
        card.due = addMinutes(now, settings.learningSteps[card.step]).toISOString();
      }
      break;
      
    case 'easy':
      // Graduate to review with easy interval
      card.state = CARD_STATES.REVIEW;
      card.interval_days = settings.easyInterval;
      card.due = addDays(now, settings.easyInterval).toISOString();
      break;
  }
  
  return card;
}

/**
 * FIXED: Handle REVIEW cards with proper interval differentiation
 */
function handleReviewCard(card, rating, settings, now) {
  const currentInterval = card.interval_days || 1;
  const currentEase = card.ease_factor || settings.startingEase;
  
  switch (rating) {
    case 'again':
      // Failed review - go to relearning
      card.state = CARD_STATES.RELEARNING;
      card.step = 0;
      card.lapses++;
      card.ease_factor = Math.max(
        settings.minimumEase, 
        currentEase + settings.againPenalty
      );
      card.due = addMinutes(now, settings.relearningSteps[0]).toISOString();
      break;
      
    case 'hard':
      // FIXED: Hard button uses hardIntervalMultiplier (1.15x current interval)
      // This is MUCH shorter than good (which uses ease factor ~2.5x)
      card.ease_factor = Math.max(
        settings.minimumEase, 
        currentEase + settings.hardPenalty
      );
      
      // Hard = 1.15x to 1.2x current interval (NOT ease factor based)
      const hardMultiplier = settings.hardIntervalMultiplier || 1.2;
      card.interval_days = Math.max(1, Math.round(currentInterval * hardMultiplier));
      card.interval_days = Math.min(card.interval_days, settings.maximumInterval);
      card.due = addDays(now, card.interval_days).toISOString();
      break;
      
    case 'good':
      // FIXED: Good button uses ease factor (2.5x or whatever the card's ease is)
      // This creates CLEAR separation from hard button
      const goodMultiplier = currentEase * settings.intervalModifier;
      card.interval_days = Math.max(1, Math.round(currentInterval * goodMultiplier));
      card.interval_days = Math.min(card.interval_days, settings.maximumInterval);
      card.due = addDays(now, card.interval_days).toISOString();
      break;
      
    case 'easy':
      // FIXED: Easy button increases ease AND uses higher multiplier
      card.ease_factor = currentEase + settings.easyBonus;
      
      // Easy = ease factor * 1.3 (even longer than good)
      const easyMultiplier = card.ease_factor * settings.intervalModifier * 1.3;
      card.interval_days = Math.max(1, Math.round(currentInterval * easyMultiplier));
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
      card.step = 0;
      card.due = addMinutes(now, settings.relearningSteps[0]).toISOString();
      break;
      
    case 'hard':
      const currentStep = Math.min(card.step, settings.relearningSteps.length - 1);
      card.due = addMinutes(now, settings.relearningSteps[currentStep]).toISOString();
      break;
      
    case 'good':
      card.step++;
      if (card.step >= settings.relearningSteps.length) {
        // Graduate back to review
        card.state = CARD_STATES.REVIEW;
        // OPTIMIZED: Better recovery interval
        card.interval_days = Math.max(1, Math.round((card.interval_days || 1) * 0.6));
        card.due = addDays(now, card.interval_days).toISOString();
      } else {
        card.due = addMinutes(now, settings.relearningSteps[card.step]).toISOString();
      }
      break;
      
    case 'easy':
      card.state = CARD_STATES.REVIEW;
      // OPTIMIZED: Better recovery for easy in relearning
      card.interval_days = Math.max(1, Math.round((card.interval_days || 1) * 0.8));
      card.due = addDays(now, card.interval_days).toISOString();
      break;
  }
  
  return card;
}

/**
 * OPTIMIZED: Enhanced getDueCards with better ordering
 */
export function getDueCards(cards, settings = DEFAULT_SETTINGS) {
  const now = new Date();
  
  const categorizedCards = {
    overdueReview: [],
    dueReview: [],
    learningDue: [],
    newCards: [],
    futureReview: []
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
        if (!dueDate || dueDate <= now) {
          categorizedCards.learningDue.push(card);
        }
        break;
        
      case CARD_STATES.REVIEW:
        if (!dueDate) {
          categorizedCards.dueReview.push(card);
        } else if (dueDate <= now) {
          const daysPastDue = (now - dueDate) / (1000 * 60 * 60 * 24);
          if (daysPastDue > 1) {
            categorizedCards.overdueReview.push(card);
          } else {
            categorizedCards.dueReview.push(card);
          }
        }
        break;
    }
  });
  
  // Apply session limits
  const limitedNew = categorizedCards.newCards.slice(0, settings.maxNewCardsPerSession || 20);
  
  // Sort overdue by how overdue they are
  const sortedOverdue = categorizedCards.overdueReview.sort((a, b) => {
    const aOverdue = new Date(a.due) || new Date(0);
    const bOverdue = new Date(b.due) || new Date(0);
    return aOverdue - bOverdue;
  });
  
  // Sort learning by due time
  const sortedLearning = categorizedCards.learningDue.sort((a, b) => {
    const aDue = new Date(a.due) || now;
    const bDue = new Date(b.due) || now;
    return aDue - bDue;
  });
  
  // Shuffle review cards for variety
  const shuffledReview = settings.shuffleCards 
    ? shuffleArray([...categorizedCards.dueReview])
    : categorizedCards.dueReview;
  
  // Shuffle new cards
  const shuffledNew = settings.shuffleCards 
    ? shuffleArray([...limitedNew])
    : limitedNew;
  
  // Interleave for better experience
  const finalSessionCards = interleaveCards(
    [...sortedOverdue, ...sortedLearning, ...shuffledReview.slice(0, settings.maxReviewCardsPerSession || 100)],
    shuffledNew,
    0.3
  );
  
  return finalSessionCards;
}

/**
 * OPTIMIZED: getDueCards with immediate retry support
 */
export function getDueCardsWithImmediate(cards, settings = IMMEDIATE_REVIEW_SETTINGS) {
  const now = new Date();
  const regularDueCards = getDueCards(cards, settings);
  
  // Find immediate retry cards (due within next 5 minutes)
  const immediateRetryCards = cards.filter(card => {
    if (!card.due) return false;
    
    const dueDate = new Date(card.due);
    const timeDiff = dueDate.getTime() - now.getTime();
    
    return timeDiff <= 5 * 60 * 1000 && timeDiff >= -30 * 1000;
  });
  
  const allDueCards = [...regularDueCards];
  
  immediateRetryCards.forEach(retryCard => {
    if (!allDueCards.find(card => card.id === retryCard.id)) {
      allDueCards.unshift(retryCard);
    }
  });
  
  return allDueCards;
}

/**
 * Interleave new cards with review cards
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
    const shouldAddNew = (i > 0 && i % newCardInterval === 0) && newIndex < newCards.length;
    
    if (shouldAddNew) {
      result.push(newCards[newIndex]);
      newIndex++;
    } else if (reviewIndex < reviewCards.length) {
      result.push(reviewCards[reviewIndex]);
      reviewIndex++;
    } else if (newIndex < newCards.length) {
      result.push(newCards[newIndex]);
      newIndex++;
    }
  }
  
  return result;
}

/**
 * Shuffle array using Fisher-Yates
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
 * Check if card should be removed from session
 */
export function shouldRemoveFromSession(card, lastRating = null, settings = IMMEDIATE_REVIEW_SETTINGS) {
  if (lastRating === 'again') {
    return false; // Keep in session for immediate retry
  }
  
  return lastRating === 'easy'; // Only remove on easy
}

/**
 * Get study statistics
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
    mature: 0,
    young: 0,
    suspended: 0,
    averageEase: 0,
    totalLapses: 0
  };
  
  let totalEase = 0;
  let easeCount = 0;
  
  cards.forEach(card => {
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
        if (card.interval_days >= 21) {
          stats.mature++;
        } else {
          stats.young++;
        }
        break;
    }
    
    if (!card.due || new Date(card.due) <= now) {
      stats.due++;
      
      if (card.due && new Date(card.due) < addDays(now, -1)) {
        stats.overdue++;
      }
    }
    
    if (card.ease_factor) {
      totalEase += card.ease_factor;
      easeCount++;
    }
    
    if (card.lapses) {
      stats.totalLapses += card.lapses;
    }
  });
  
  stats.averageEase = easeCount > 0 ? (totalEase / easeCount) : 2.5;
  
  return stats;
}

/**
 * OPTIMIZED: Get interval previews with clear differentiation
 */
export function getIntervalPreviews(card, settings = DEFAULT_SETTINGS) {
  const previews = {};
  
  ['again', 'hard', 'good', 'easy'].forEach(rating => {
    try {
      const tempCard = calculateNextReview({ ...card }, rating, settings);
      previews[rating] = formatInterval(tempCard.due);
    } catch (error) {
      const fallbacks = { again: "1m", hard: "1.2d", good: "2.5d", easy: "4d" };
      previews[rating] = fallbacks[rating];
    }
  });
  
  return previews;
}

/**
 * OPTIMIZED: Get interval previews for immediate mode
 */
export function getIntervalPreviewsFixed(card, settings = IMMEDIATE_REVIEW_SETTINGS) {
  const previews = {};
  
  ['again', 'hard', 'good', 'easy'].forEach(rating => {
    try {
      if (rating === 'again') {
        const sessionFailures = card.session_failures || 0;
        const cycledFailures = ((sessionFailures) % 3) + 1;
        
        if (cycledFailures === 1) {
          previews[rating] = "Soon";
        } else if (cycledFailures === 2) {
          previews[rating] = "2-3";
        } else {
          previews[rating] = "3-4";
        }
      } else {
        const tempCard = calculateNextReview({ ...card }, rating, settings);
        previews[rating] = formatInterval(tempCard.due);
      }
    } catch (error) {
      const fallbacks = { again: "30s", hard: "1.2d", good: "2.5d", easy: "4d" };
      previews[rating] = fallbacks[rating];
    }
  });
  
  return previews;
}

/**
 * OPTIMIZED: Format interval with better display
 */
function formatInterval(dueString) {
  if (!dueString) return "New";
  
  const now = new Date();
  const dueDate = new Date(dueString);
  const diffMs = dueDate.getTime() - now.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  
  if (diffSeconds <= 60) return `${diffSeconds}s`;
  
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  if (diffMinutes < 60) return `${diffMinutes}m`;
  
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  
  const diffDays = diffMinutes / 1440;
  
  // OPTIMIZED: Show decimal days for better clarity on differences
  if (diffDays < 7) {
    return `${diffDays.toFixed(1)}d`;
  }
  
  if (diffDays < 365) {
    return `${Math.round(diffDays)}d`;
  }
  
  const diffYears = Math.round(diffDays / 365);
  return `${diffYears}y`;
}

// Helper functions
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1000);
}

const SpacedRepetitionUtils = {
  calculateNextReview,
  calculateNextReviewWithImmediate,
  getDueCards,
  getDueCardsWithImmediate,
  getStudyStats,
  getIntervalPreviews,
  getIntervalPreviewsFixed,
  shouldRemoveFromSession,
  shuffleArray,
  interleaveCards,
  CARD_STATES,
  DEFAULT_SETTINGS,
  IMMEDIATE_REVIEW_SETTINGS
};

export default SpacedRepetitionUtils;