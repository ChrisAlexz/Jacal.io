// src/components/study/studyUtils.js - FIXED: Null Safe Utility Functions
export const getCardType = (card, deckType) => {
  // FIXED: Null safety check
  if (!card || typeof card !== 'object') {
    return deckType || 'Basic';
  }
  
  return card.card_type || deckType || 'Basic';
};

export const processClozeText = (text, isRevealed, activeClozeDeletion = 1) => {
  // FIXED: Null safety check
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  let processedText = text;
  const clozePattern = /{{c(\d+)::(.*?)}}/g;
  
  processedText = processedText.replace(clozePattern, (match, clozeNumber, clozeText) => {
    const clozeNum = parseInt(clozeNumber);
    
    if (isRevealed) {
      if (clozeNum === activeClozeDeletion) {
        return `<span class="cloze-revealed-active">${clozeText}</span>`;
      } else {
        return `<span class="cloze-revealed-inactive">${clozeText}</span>`;
      }
    } else {
      if (clozeNum === activeClozeDeletion) {
        return `<span class="cloze-question">[...]</span>`;
      } else {
        return `<span class="cloze-other">${clozeText}</span>`;
      }
    }
  });
  
  return processedText;
};

export const checkIsImageOcclusionCard = (card) => {
  // FIXED: Null safety check
  if (!card || typeof card !== 'object') {
    return false;
  }
  
  const front = card.front || '';
  const cardType = card.card_type || '';
  
  return front.includes('image-occlusion-card') || 
         front.includes('occlusion-') ||
         cardType === 'Image-Occlusion';
};

export const hasCustomBackContent = (card, cardType) => {
  // FIXED: Null safety check
  if (!card || typeof card !== 'object' || !cardType) {
    return false;
  }
  
  const front = card.front || '';
  const back = card.back || '';
  
  return cardType === "Cloze" &&
         back !== front &&
         back.trim() !== "";
};