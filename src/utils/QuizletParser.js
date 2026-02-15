// src/utils/QuizletParser.js - FIXED VERSION FOR TAB-DELIMITED FILES
import { logger } from './logger';

/**
 * Parse Quizlet export files (.txt, .csv)
 * Quizlet typically exports in tab-delimited or comma-delimited format
 */

export async function parseQuizletFile(file, options = {}) {
  const { previewOnly = false, maxCards = null, onProgress = null } = options;

  try {
    onProgress && onProgress(10);

    // Read the file as text
    const content = await readFileAsText(file);
    
    onProgress && onProgress(30);

    // Debug: Log the first few characters to see what we're getting
    logger.debug('File content preview:', content.substring(0, 200));
    logger.debug('First line:', content.split('\n')[0]);
    logger.debug('Has tabs:', content.includes('\t'));
    logger.debug('Has commas:', content.includes(','));

    // Detect the format and parse accordingly
    const parsedData = detectAndParseFormat(content);
    
    onProgress && onProgress(70);

    // Process the cards
    const cards = processQuizletCards(parsedData, previewOnly ? 5 : maxCards);

    onProgress && onProgress(100);

    const result = {
      deckName: file.name.replace(/\.[^/.]+$/, ""),
      totalCards: cards.length,
      cards: cards
    };

    if (previewOnly) {
      result.preview = cards.slice(0, Math.min(5, cards.length));
    }

    return result;

  } catch (error) {
    logger.error('Error parsing Quizlet file:', error);
    throw new Error(`Failed to parse Quizlet file: ${error.message}`);
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      resolve(e.target.result);
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    // Try to detect encoding - use UTF-8 first, fallback to Latin-1 if needed
    reader.readAsText(file, 'UTF-8');
  });
}

function detectAndParseFormat(content) {
  // Clean up the content first
  content = content.trim();
  
  if (!content) {
    throw new Error('The file appears to be empty');
  }

  // Split into lines and filter out empty lines
  const allLines = content.split('\n');
  const lines = allLines.map(line => line.trim()).filter(line => line.length > 0);
  
  logger.debug('Total lines after filtering:', lines.length);
  logger.debug('Sample lines:', lines.slice(0, 3));
  
  if (lines.length === 0) {
    throw new Error('No valid content found in the file');
  }

  // Test the first few lines to determine format
  const testLines = lines.slice(0, Math.min(5, lines.length));
  
  // More robust delimiter detection
  let bestDelimiter = '\t'; // Default to tab since that's what was requested
  let maxValidLines = 0;

  const delimiters = ['\t', ',', ';', '|'];
  
  for (const delimiter of delimiters) {
    let validLines = 0;
    for (const line of testLines) {
      const fields = splitLine(line, delimiter);
      if (fields.length >= 2 && fields[0].trim() && fields[1].trim()) {
        validLines++;
      }
    }
    
    logger.debug(`Delimiter "${delimiter === '\t' ? 'TAB' : delimiter}" valid lines: ${validLines}`);
    
    if (validLines > maxValidLines) {
      maxValidLines = validLines;
      bestDelimiter = delimiter;
    }
  }

  logger.debug(`Best delimiter: "${bestDelimiter === '\t' ? 'TAB' : bestDelimiter}"`);

  // Parse all lines with the best delimiter
  const parsedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const fields = splitLine(line, bestDelimiter);
    
    logger.debug(`Line ${i + 1}:`, fields);
    
    // Accept lines that have at least 2 non-empty fields
    if (fields.length >= 2) {
      const front = fields[0].trim();
      const back = fields[1].trim();
      
      if (front && back) {
        parsedLines.push(fields);
      } else {
        logger.debug(`Skipping line ${i + 1} - empty front or back:`, { front, back });
      }
    } else {
      logger.debug(`Skipping line ${i + 1} - insufficient fields:`, fields);
    }
  }

  logger.debug('Parsed lines count:', parsedLines.length);

  if (parsedLines.length === 0) {
    throw new Error(`No valid card data found. Please check that your file is formatted correctly:
    
Expected format for tab-delimited:
Front Side[TAB]Back Side
Another Term[TAB]Another Definition

Expected format for comma-delimited:
"Front Side","Back Side"
"Another Term","Another Definition"

Your file had ${lines.length} lines but none could be parsed as valid flashcard pairs.`);
  }

  return {
    lines: parsedLines,
    delimiter: bestDelimiter
  };
}

function splitLine(line, delimiter) {
  if (delimiter === '\t') {
    // For tab-delimited, simple split should work
    return line.split('\t').map(field => field.trim());
  } else if (delimiter === ',') {
    // For comma-delimited, handle quoted fields
    return parseCSVLine(line, delimiter);
  } else {
    // For other delimiters, simple split
    return line.split(delimiter).map(field => field.trim());
  }
}

function parseCSVLine(line, delimiter = ',') {
  const fields = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i += 2;
        continue;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
        continue;
      }
    }

    if (!inQuotes && char === delimiter) {
      // End of field
      fields.push(current.trim());
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  // Add the last field
  fields.push(current.trim());

  // Clean up quoted fields
  return fields.map(field => {
    if (field.startsWith('"') && field.endsWith('"')) {
      return field.slice(1, -1).replace(/""/g, '"');
    }
    return field;
  });
}

function processQuizletCards(parsedData, maxCards = null) {
  const cards = [];
  const lines = parsedData.lines;

  logger.debug('Processing cards from', lines.length, 'parsed lines');

  for (let i = 0; i < lines.length; i++) {
    if (maxCards && cards.length >= maxCards) {
      break;
    }

    const fields = lines[i];
    
    if (fields.length < 2) {
      logger.debug(`Skipping line ${i + 1} - insufficient fields:`, fields);
      continue;
    }

    let front = fields[0].trim();
    let back = fields[1].trim();

    // Skip empty cards
    if (!front && !back) {
      logger.debug(`Skipping line ${i + 1} - both front and back are empty`);
      continue;
    }

    // Clean and process the content
    front = cleanQuizletText(front);
    back = cleanQuizletText(back);

    // Skip if cleaning resulted in empty content
    if (!front.trim() || !back.trim()) {
      logger.debug(`Skipping line ${i + 1} - empty after cleaning:`, { front, back });
      continue;
    }

    // Determine card type
    let cardType = 'Basic';
    
    // Check for cloze deletions (some Quizlet exports include these)
    if (front.includes('[...]') || front.includes('___')) {
      cardType = 'Cloze';
      // Convert Quizlet-style cloze to our format
      front = front.replace(/\[\.\.\.]/g, '{{c1::[...]}}');
      front = front.replace(/___+/g, '{{c1::___}}');
    }

    // Handle multiple definitions (separated by semicolons or newlines)
    if (back.includes(';') && back.split(';').length > 1) {
      const definitions = back.split(';').map(def => def.trim()).filter(def => def);
      if (definitions.length > 1) {
        back = definitions.join('<br>');
      }
    }

    // Handle additional fields (tags, notes, etc.)
    let tags = '';
    let notes = '';
    
    if (fields.length > 2) {
      // Third field could be tags or additional notes
      const thirdField = fields[2].trim();
      if (thirdField) {
        // If it looks like tags (comma-separated words), treat as tags
        if (thirdField.includes(',') || thirdField.split(' ').length <= 5) {
          tags = thirdField;
        } else {
          // Otherwise, append to back as additional notes
          back += '<br><br><small><em>' + cleanQuizletText(thirdField) + '</em></small>';
        }
      }
    }

    if (fields.length > 3) {
      // Fourth field for notes or comments
      const fourthField = fields[3].trim();
      if (fourthField) {
        notes = cleanQuizletText(fourthField);
        back += '<br><br><small>' + notes + '</small>';
      }
    }

    const card = {
      front: front,
      back: back,
      cardType: cardType,
      tags: tags,
      source: 'Quizlet'
    };

    cards.push(card);
    logger.debug(`Added card ${cards.length}:`, { front: front.substring(0, 50), back: back.substring(0, 50) });
  }

  logger.debug('Final cards count:', cards.length);
  return cards;
}

function cleanQuizletText(text) {
  if (!text) return '';
  
  let cleaned = text;
  
  // Remove common Quizlet formatting artifacts
  cleaned = cleaned.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/\r/g, '\n');
  
  // Convert newlines to HTML breaks for multi-line content
  if (cleaned.includes('\n')) {
    cleaned = cleaned.replace(/\n/g, '<br>');
  }
  
  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Remove leading/trailing quotes if they wrap the entire text
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  
  // Handle special Quizlet formatting
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'); // Bold
  cleaned = cleaned.replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italic
  cleaned = cleaned.replace(/_(.*?)_/g, '<u>$1</u>'); // Underline
  
  // Clean up any remaining artifacts
  cleaned = cleaned.replace(/^\s*["']|["']\s*$/g, ''); // Remove quotes at start/end
  
  return cleaned;
}

// Alternative parser for CSV files with headers
export async function parseQuizletCSV(file, options = {}) {
  const { previewOnly = false, maxCards = null, onProgress = null } = options;

  try {
    onProgress && onProgress(10);

    const content = await readFileAsText(file);
    
    onProgress && onProgress(30);

    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('The CSV file appears to be empty');
    }

    // Check if first line is a header
    const firstLine = lines[0].toLowerCase();
    const hasHeader = (
      firstLine.includes('term') || 
      firstLine.includes('definition') || 
      firstLine.includes('front') || 
      firstLine.includes('back') ||
      firstLine.includes('question') ||
      firstLine.includes('answer')
    );

    const dataLines = hasHeader ? lines.slice(1) : lines;
    
    onProgress && onProgress(50);

    const cards = [];
    
    for (let i = 0; i < dataLines.length; i++) {
      if (maxCards && cards.length >= maxCards) break;
      
      const line = dataLines[i];
      const fields = parseCSVLine(line, ',');
      
      if (fields.length >= 2) {
        const front = cleanQuizletText(fields[0]);
        const back = cleanQuizletText(fields[1]);
        
        if (front.trim() || back.trim()) {
          cards.push({
            front: front,
            back: back,
            cardType: 'Basic',
            tags: fields.length > 2 ? fields[2] : '',
            source: 'Quizlet CSV'
          });
        }
      }
    }

    onProgress && onProgress(100);

    const result = {
      deckName: file.name.replace(/\.[^/.]+$/, ""),
      totalCards: cards.length,
      cards: cards
    };

    if (previewOnly) {
      result.preview = cards.slice(0, Math.min(5, cards.length));
    }

    return result;

  } catch (error) {
    logger.error('Error parsing Quizlet CSV:', error);
    throw new Error(`Failed to parse Quizlet CSV: ${error.message}`);
  }
}

// Parse Quizlet Study Set export format
export async function parseQuizletStudySet(file, options = {}) {
  const { previewOnly = false, maxCards = null, onProgress = null } = options;

  try {
    onProgress && onProgress(10);

    const content = await readFileAsText(file);
    
    onProgress && onProgress(30);

    // Quizlet study set format often has this structure:
    // Term: [term]
    // Definition: [definition]
    // (blank line)
    // Term: [term]
    // Definition: [definition]

    const blocks = content.split(/\n\s*\n/); // Split by blank lines
    const cards = [];

    onProgress && onProgress(50);

    for (let i = 0; i < blocks.length; i++) {
      if (maxCards && cards.length >= maxCards) break;

      const block = blocks[i].trim();
      if (!block) continue;

      const lines = block.split('\n');
      let front = '';
      let back = '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.toLowerCase().startsWith('term:')) {
          front = trimmedLine.substring(5).trim();
        } else if (trimmedLine.toLowerCase().startsWith('definition:')) {
          back = trimmedLine.substring(11).trim();
        }
      }

      if (front && back) {
        cards.push({
          front: cleanQuizletText(front),
          back: cleanQuizletText(back),
          cardType: 'Basic',
          source: 'Quizlet Study Set'
        });
      }
    }

    onProgress && onProgress(100);

    const result = {
      deckName: file.name.replace(/\.[^/.]+$/, ""),
      totalCards: cards.length,
      cards: cards
    };

    if (previewOnly) {
      result.preview = cards.slice(0, Math.min(5, cards.length));
    }

    return result;

  } catch (error) {
    logger.error('Error parsing Quizlet study set:', error);
    throw new Error(`Failed to parse Quizlet study set: ${error.message}`);
  }
}

// Detect file format and use appropriate parser
export async function parseQuizletFileAuto(file, options = {}) {
  const fileName = file.name.toLowerCase();
  const { onProgress = null } = options;

  try {
    // Try different parsing strategies based on file name and content
    if (fileName.endsWith('.csv')) {
      onProgress && onProgress(5);
      try {
        return await parseQuizletCSV(file, options);
      } catch (error) {
        logger.warn('CSV parsing failed, trying generic parser:', error);
        return await parseQuizletFile(file, options);
      }
    } else {
      // For .txt files, try to detect the format
      onProgress && onProgress(5);
      const content = await readFileAsText(file);
      
      // Check if it looks like a study set format
      if (content.toLowerCase().includes('term:') && content.toLowerCase().includes('definition:')) {
        return await parseQuizletStudySet(file, options);
      } else {
        // Use regular delimited parser
        return await parseQuizletFile(file, options);
      }
    }
  } catch (error) {
    logger.error('All Quizlet parsing strategies failed:', error);
    throw new Error(`Unable to parse Quizlet file. Please ensure it's in a supported format: tab-delimited, comma-delimited, or Quizlet study set format.

Debug info: File size: ${file.size} bytes, File type: ${file.type}, File name: ${file.name}`);
  }
}

// Utility function to validate Quizlet file before parsing
export function validateQuizletFile(file) {
  const validExtensions = ['.txt', '.csv'];
  const fileName = file.name.toLowerCase();
  
  if (!validExtensions.some(ext => fileName.endsWith(ext))) {
    throw new Error('Invalid file type. Please select a .txt or .csv file exported from Quizlet.');
  }
  
  if (file.size > 50 * 1024 * 1024) { // 50MB limit
    throw new Error('File is too large. Please select a file smaller than 50MB.');
  }
  
  if (file.size === 0) {
    throw new Error('File appears to be empty.');
  }
  
  return true;
}

// Export the main function (keeping backward compatibility)
export { parseQuizletFile as default };