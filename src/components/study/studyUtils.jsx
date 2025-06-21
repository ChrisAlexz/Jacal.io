// src/components/study/studyUtils.js - Utility functions for study logic
export const getCardType = (card, deckType) => {
  return card.card_type || deckType;
};

export const processClozeText = (text, isRevealed, activeClozeDeletion = 1) => {
  if (!text) return '';
  
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
  return card.front && (
    card.front.includes('image-occlusion-card') || 
    card.front.includes('occlusion-') ||
    card.card_type === 'Image-Occlusion'
  );
};

export const hasCustomBackContent = (card, cardType) => {
  return cardType === "Cloze" &&
    card.back !== card.front &&
    card.back.trim() !== "";
};