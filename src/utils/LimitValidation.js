// src/utils/limitValidation.js - LIMIT VALIDATION UTILITIES
import { supabase } from '../supabase';

// Define the limits
export const LIMITS = {
  MAX_FOLDERS: 2,
  MAX_DECKS: 2,
  MAX_CARDS_PER_DECK: 50
};

// Validation functions
export const validateLimits = {
  // Check if user can create another folder
  async canCreateFolder(userId) {
    try {
      const { count, error } = await supabase
        .from('classes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) {
        console.error('Error checking folder count:', error);
        return { canCreate: false, error: 'Failed to check folder limit' };
      }

      const currentCount = count || 0;
      const canCreate = currentCount < LIMITS.MAX_FOLDERS;

      return {
        canCreate,
        currentCount,
        limit: LIMITS.MAX_FOLDERS,
        message: canCreate 
          ? `You can create ${LIMITS.MAX_FOLDERS - currentCount} more folder${LIMITS.MAX_FOLDERS - currentCount !== 1 ? 's' : ''}`
          : `You've reached the maximum of ${LIMITS.MAX_FOLDERS} folders`
      };
    } catch (error) {
      console.error('Exception in canCreateFolder:', error);
      return { canCreate: false, error: 'Failed to validate folder limit' };
    }
  },

  // Check if user can create another deck
  async canCreateDeck(userId) {
    try {
      const { count, error } = await supabase
        .from('flashcard_sets')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (error) {
        console.error('Error checking deck count:', error);
        return { canCreate: false, error: 'Failed to check deck limit' };
      }

      const currentCount = count || 0;
      const canCreate = currentCount < LIMITS.MAX_DECKS;

      return {
        canCreate,
        currentCount,
        limit: LIMITS.MAX_DECKS,
        message: canCreate 
          ? `You can create ${LIMITS.MAX_DECKS - currentCount} more deck${LIMITS.MAX_DECKS - currentCount !== 1 ? 's' : ''}`
          : `You've reached the maximum of ${LIMITS.MAX_DECKS} decks`
      };
    } catch (error) {
      console.error('Exception in canCreateDeck:', error);
      return { canCreate: false, error: 'Failed to validate deck limit' };
    }
  },

  // Check if user can add more cards to a specific deck
  async canAddCards(setId, numberOfCards = 1) {
    try {
      const { count, error } = await supabase
        .from('flashcard_cards')
        .select('*', { count: 'exact', head: true })
        .eq('set_id', setId);

      if (error) {
        console.error('Error checking card count:', error);
        return { canAdd: false, error: 'Failed to check card limit' };
      }

      const currentCount = count || 0;
      const wouldExceedLimit = (currentCount + numberOfCards) > LIMITS.MAX_CARDS_PER_DECK;
      const canAdd = !wouldExceedLimit;

      return {
        canAdd,
        currentCount,
        limit: LIMITS.MAX_CARDS_PER_DECK,
        requestedCards: numberOfCards,
        availableSlots: Math.max(0, LIMITS.MAX_CARDS_PER_DECK - currentCount),
        message: canAdd 
          ? `You can add ${Math.max(0, LIMITS.MAX_CARDS_PER_DECK - currentCount)} more card${Math.max(0, LIMITS.MAX_CARDS_PER_DECK - currentCount) !== 1 ? 's' : ''} to this deck`
          : `This deck has reached the maximum of ${LIMITS.MAX_CARDS_PER_DECK} cards`
      };
    } catch (error) {
      console.error('Exception in canAddCards:', error);
      return { canAdd: false, error: 'Failed to validate card limit' };
    }
  },

  // Utility function to limit imported cards to first 50
  limitImportedCards(cards) {
    if (!Array.isArray(cards)) {
      return [];
    }
    
    if (cards.length <= LIMITS.MAX_CARDS_PER_DECK) {
      return cards;
    }
    
    console.log(`Limiting imported cards from ${cards.length} to ${LIMITS.MAX_CARDS_PER_DECK}`);
    return cards.slice(0, LIMITS.MAX_CARDS_PER_DECK);
  }
};

// UI Helper functions
export const createLimitWarningMessage = (type, currentCount, limit) => {
  const remaining = Math.max(0, limit - currentCount);
  
  switch (type) {
    case 'folder':
      return remaining > 0 
        ? `You can create ${remaining} more folder${remaining !== 1 ? 's' : ''} (${currentCount}/${limit} used)`
        : `You've reached the maximum of ${limit} folders`;
    case 'deck':
      return remaining > 0 
        ? `You can create ${remaining} more deck${remaining !== 1 ? 's' : ''} (${currentCount}/${limit} used)`
        : `You've reached the maximum of ${limit} decks`;
    case 'card':
      return remaining > 0 
        ? `You can add ${remaining} more card${remaining !== 1 ? 's' : ''} to this deck (${currentCount}/${limit} used)`
        : `This deck has reached the maximum of ${limit} cards`;
    default:
      return '';
  }
};

// Error messages for different scenarios
export const LIMIT_MESSAGES = {
  FOLDER_LIMIT_REACHED: `You can only have up to ${LIMITS.MAX_FOLDERS} folders. Please delete a folder before creating a new one.`,
  DECK_LIMIT_REACHED: `You can only have up to ${LIMITS.MAX_DECKS} decks. Please delete a deck before creating a new one.`,
  CARD_LIMIT_REACHED: `Each deck can only have up to ${LIMITS.MAX_CARDS_PER_DECK} cards. Please delete some cards or create a new deck.`,
  IMPORT_TRUNCATED: `Your import contained more than ${LIMITS.MAX_CARDS_PER_DECK} cards. Only the first ${LIMITS.MAX_CARDS_PER_DECK} cards were imported.`,
  GENERIC_LIMIT_ERROR: 'You have reached a usage limit. Please upgrade your account or delete some items.'
};

export default validateLimits;