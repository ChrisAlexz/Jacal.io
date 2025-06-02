// src/utils/QuizletParser.js

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
    console.error('Error parsing Quizlet file:', error);
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
    
    // Try to detect encoding
    reader.readAsText(file, 'UTF-8');
  });
}

function detectAndParseFormat(content) {
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('The file appears to be empty');
  }

  // Test the first few lines to determine format
  const testLines = lines.slice(0, Math.min(5, lines.length));
  
  // Count separators in test lines
  const tabCounts = testLines.map(line => (line.match(/\t/g) || []).length);
  const commaCounts = testLines.map(line => (line.match(/,/g) || []).length);
  const semicolonCounts = testLines.map(line => (line.match(/;/g) || []).length);
  
  // Calculate average counts
  const avgTabs = tabCounts.reduce((a, b) => a + b, 0) / tabCounts.length;
  const avgCommas = commaCounts.reduce((a, b) => a + b, 0) / commaCounts.length;
  const avgSemicolons = semicolonCounts.reduce((a, b) => a + b, 0) / semicolonCounts.length;

  let delimiter = '\t'; // Default to tab
  
  // Determine the most likely delimiter
  if (avgCommas > avgTabs && avgCommas > avgSemicolons) {
    delimiter = ',';
  } else if (avgSemicolons > avgTabs && avgSemicolons > avgCommas) {
    delimiter = ';';
  }

  // Parse lines with detected delimiter
  const parsedLines = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const fields = parseCSVLine(line, delimiter);
    
    // Skip lines that don't have at least 2 fields
    if (fields.length >= 2) {
      parsedLines.push(fields);
    }
  }

  if (parsedLines.length === 0) {
    throw new Error('No valid card data found. Expected format: "front,back" or "front\tback"');
  }

  return {
    lines: parsedLines,
    delimiter: delimiter
  };
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

  for (let i = 0; i < lines.length; i++) {
    if (maxCards && cards.length >= maxCards) {
      break;
    }

    const fields = lines[i];
    
    if (fields.length < 2) continue;

    let front = fields[0].trim();
    let back = fields[1].trim();

    // Skip empty cards
    if (!front && !back) continue;

    // Clean and process the content
    front = cleanQuizletText(front);
    back = cleanQuizletText(back);

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
      back = definitions.join('<br>');
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

    cards.push({
      front: front,
      back: back,
      cardType: cardType,
      tags: tags,
      source: 'Quizlet'
    });
  }

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
    console.error('Error parsing Quizlet CSV:', error);
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
    console.error('Error parsing Quizlet study set:', error);
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
        console.warn('CSV parsing failed, trying generic parser:', error);
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
    console.error('All Quizlet parsing strategies failed:', error);
    throw new Error(`Unable to parse Quizlet file. Please ensure it's in a supported format: tab-delimited, comma-delimited, or Quizlet study set format.`);
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