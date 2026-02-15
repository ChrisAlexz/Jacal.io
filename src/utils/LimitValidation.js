// src/utils/LimitValidation.js - LIMIT VALIDATION UTILITY - UPDATED LIMITS
import { logger } from './logger';
import { supabase } from '../supabase';

// User limits configuration - UPDATED LIMITS
export const USER_LIMITS = {
  FOLDERS: 2,        // Changed from 25 to 2
  DECKS: 5,          // Changed from 100 to 5
  CARDS_PER_DECK: 30, // Changed from 50 to 30
  IMPORTED_CARDS: 30  // Changed from 50 to 30 (matching CARDS_PER_DECK)
};

// Limit warning messages - UPDATED
export const LIMIT_MESSAGES = {
  FOLDER_LIMIT_REACHED: `You've reached the maximum of ${USER_LIMITS.FOLDERS} folders. Please delete some folders to create new ones.`,
  DECK_LIMIT_REACHED: `You've reached the maximum of ${USER_LIMITS.DECKS} decks. Please delete some decks to create new ones.`,
  CARD_LIMIT_REACHED: `This deck has reached the maximum of ${USER_LIMITS.CARDS_PER_DECK} cards. Please delete some cards to add new ones.`,
  IMPORT_TRUNCATED: `Files with more than ${USER_LIMITS.IMPORTED_CARDS} cards will be limited to the first ${USER_LIMITS.IMPORTED_CARDS} cards.`,
  FOLDER_LIMIT_WARNING: `You're approaching the folder limit. You have {remaining} folder{s} remaining.`,
  DECK_LIMIT_WARNING: `You're approaching the deck limit. You have {remaining} deck{s} remaining.`,
  CARD_LIMIT_WARNING: `This deck is approaching the card limit. You can add {remaining} more card{s}.`
};

// Helper function to create warning messages with proper pluralization
export const createLimitWarningMessage = (type, remaining) => {
  const message = LIMIT_MESSAGES[`${type.toUpperCase()}_LIMIT_WARNING`];
  if (!message) return '';
  
  return message
    .replace('{remaining}', remaining.toString())
    .replace('{s}', remaining === 1 ? '' : 's');
};

// Validation functions
export const validateLimits = {
  // Check if user can create a new folder
  canCreateFolder: async (userId) => {
    try {
      const { count, error } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) {
        logger.error('Error checking folder limit:', error);
        return { canCreate: true, currentCount: 0, limit: USER_LIMITS.FOLDERS, message: null };
      }

      const currentCount = count || 0;
      const canCreate = currentCount < USER_LIMITS.FOLDERS;
      const remaining = USER_LIMITS.FOLDERS - currentCount;

      let message = null;
      if (!canCreate) {
        message = LIMIT_MESSAGES.FOLDER_LIMIT_REACHED;
      } else if (remaining <= 1) { // Changed from 5 to 1 since limit is only 2
        message = createLimitWarningMessage('folder', remaining);
      }

      return {
        canCreate,
        currentCount,
        limit: USER_LIMITS.FOLDERS,
        remaining,
        percentage: Math.round((currentCount / USER_LIMITS.FOLDERS) * 100),
        message
      };
    } catch (error) {
      logger.error('Error in canCreateFolder:', error);
      return { canCreate: true, currentCount: 0, limit: USER_LIMITS.FOLDERS, message: null };
    }
  },

  // Check if user can create a new deck
  canCreateDeck: async (userId) => {
    try {
      const { count, error } = await supabase
        .from('flashcard_sets')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) {
        logger.error('Error checking deck limit:', error);
        return { canCreate: true, currentCount: 0, limit: USER_LIMITS.DECKS, message: null };
      }

      const currentCount = count || 0;
      const canCreate = currentCount < USER_LIMITS.DECKS;
      const remaining = USER_LIMITS.DECKS - currentCount;

      let message = null;
      if (!canCreate) {
        message = LIMIT_MESSAGES.DECK_LIMIT_REACHED;
      } else if (remaining <= 2) { // Changed from 10 to 2 since limit is only 5
        message = createLimitWarningMessage('deck', remaining);
      }

      return {
        canCreate,
        currentCount,
        limit: USER_LIMITS.DECKS,
        remaining,
        percentage: Math.round((currentCount / USER_LIMITS.DECKS) * 100),
        message
      };
    } catch (error) {
      logger.error('Error in canCreateDeck:', error);
      return { canCreate: true, currentCount: 0, limit: USER_LIMITS.DECKS, message: null };
    }
  },

  // Check if user can add cards to a specific deck
  canAddCards: async (setId, cardCount = 1) => {
    try {
      const { count, error } = await supabase
        .from('flashcard_cards')
        .select('*', { count: 'exact', head: true })
        .eq('set_id', setId);

      if (error) {
        logger.error('Error checking card limit:', error);
        return { canAdd: true, currentCount: 0, limit: USER_LIMITS.CARDS_PER_DECK, message: null };
      }

      const currentCount = count || 0;
      const canAdd = (currentCount + cardCount) <= USER_LIMITS.CARDS_PER_DECK;
      const availableSlots = USER_LIMITS.CARDS_PER_DECK - currentCount;

      let message = null;
      if (!canAdd) {
        message = LIMIT_MESSAGES.CARD_LIMIT_REACHED;
      } else if (availableSlots <= 5) { // Keep at 5 since 30 card limit is reasonable for this warning threshold
        message = createLimitWarningMessage('card', availableSlots);
      }

      return {
        canAdd,
        currentCount,
        limit: USER_LIMITS.CARDS_PER_DECK,
        availableSlots,
        percentage: Math.round((currentCount / USER_LIMITS.CARDS_PER_DECK) * 100),
        message
      };
    } catch (error) {
      logger.error('Error in canAddCards:', error);
      return { canAdd: true, currentCount: 0, limit: USER_LIMITS.CARDS_PER_DECK, message: null };
    }
  },

  // Get comprehensive limits overview for a user
  getUserLimitsOverview: async (userId) => {
    try {
      const [folderCheck, deckCheck] = await Promise.all([
        validateLimits.canCreateFolder(userId),
        validateLimits.canCreateDeck(userId)
      ]);

      return {
        folders: folderCheck,
        decks: deckCheck,
        hasWarnings: !!(folderCheck.message || deckCheck.message),
        hasLimits: !folderCheck.canCreate || !deckCheck.canCreate
      };
    } catch (error) {
      logger.error('Error getting user limits overview:', error);
      return {
        folders: { canCreate: true, currentCount: 0, limit: USER_LIMITS.FOLDERS },
        decks: { canCreate: true, currentCount: 0, limit: USER_LIMITS.DECKS },
        hasWarnings: false,
        hasLimits: false
      };
    }
  },

  // FIXED: Added limitImportedCards to validateLimits object
  limitImportedCards: (cards) => {
    if (!Array.isArray(cards)) return [];
    
    if (cards.length > USER_LIMITS.IMPORTED_CARDS) {
      logger.warn(`Limiting imported cards from ${cards.length} to ${USER_LIMITS.IMPORTED_CARDS}`);
      return cards.slice(0, USER_LIMITS.IMPORTED_CARDS);
    }
    
    return cards;
  }
};

// Utility functions for import limits (keep as standalone exports too for backwards compatibility)
export const limitImportedCards = (cards) => {
  if (!Array.isArray(cards)) return [];
  
  if (cards.length > USER_LIMITS.IMPORTED_CARDS) {
    logger.warn(`Limiting imported cards from ${cards.length} to ${USER_LIMITS.IMPORTED_CARDS}`);
    return cards.slice(0, USER_LIMITS.IMPORTED_CARDS);
  }
  
  return cards;
};

// Check if import file exceeds limits
export const checkImportLimits = (cardCount) => {
  return {
    exceedsLimit: cardCount > USER_LIMITS.IMPORTED_CARDS,
    willImport: Math.min(cardCount, USER_LIMITS.IMPORTED_CARDS),
    originalCount: cardCount,
    limit: USER_LIMITS.IMPORTED_CARDS
  };
};

// Format limit status for UI display
export const formatLimitStatus = (current, limit, type = 'items') => {
  const percentage = (current / limit) * 100;
  const remaining = limit - current;
  
  return {
    current,
    limit,
    remaining,
    percentage: Math.round(percentage),
    status: percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'ok',
    displayText: `${current}/${limit} ${type}`,
    remainingText: remaining > 0 ? `${remaining} remaining` : 'Limit reached'
  };
};

export default validateLimits;