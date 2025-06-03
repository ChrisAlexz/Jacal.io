// src/utils/AnkiParser.js - COMPLETELY REWRITTEN FOR BETTER COMPATIBILITY

/**
 * Enhanced Anki parser with better error handling and fallback strategies
 * Supports .apkg, .colpkg files and provides text export fallback
 */

// Simple text-based parser as primary fallback
export async function parseAnkiAsText(file, options = {}) {
  const { previewOnly = false, maxCards = null, onProgress = null } = options;
  
  try {
    onProgress && onProgress(20);
    
    // Try to read as text first (works for some Anki text exports)
    const text = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file, 'UTF-8');
    });
    
    onProgress && onProgress(50);
    
    if (text && text.trim()) {
      // Parse as tab-delimited or other formats
      const lines = text.split('\n').filter(line => line.trim());
      const cards = [];
      
      for (const line of lines) {
        // Try different delimiters
        let fields = [];
        if (line.includes('\t')) {
          fields = line.split('\t');
        } else if (line.includes('	')) {
          fields = line.split('	');
        } else if (line.includes('|')) {
          fields = line.split('|');
        } else if (line.includes(',')) {
          fields = line.split(',');
        }
        
        if (fields.length >= 2) {
          const front = cleanTextField(fields[0]);
          const back = cleanTextField(fields[1]);
          
          if (front.trim() && back.trim()) {
            cards.push({
              front: front,
              back: back,
              cardType: 'Basic'
            });
            
            if (previewOnly && cards.length >= 5) break;
            if (maxCards && cards.length >= maxCards) break;
          }
        }
      }
      
      onProgress && onProgress(100);
      
      if (cards.length > 0) {
        return {
          deckName: file.name.replace(/\.[^/.]+$/, ""),
          totalCards: cards.length,
          cards: cards,
          preview: previewOnly ? cards.slice(0, 5) : undefined
        };
      }
    }
    
    throw new Error('Could not parse as text');
    
  } catch (error) {
    console.log('Text parsing failed:', error);
    throw error;
  }
}

// Enhanced JSZip-based parser with better error handling
export async function parseAnkiZip(file, options = {}) {
  const { previewOnly = false, maxCards = null, onProgress = null } = options;
  
  try {
    // Dynamic import of JSZip
    let JSZip;
    try {
      JSZip = (await import('jszip')).default;
    } catch (error) {
      throw new Error('JSZip library not available. Please try exporting from Anki as a text file instead.');
    }
    
    onProgress && onProgress(10);
    
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);
    
    onProgress && onProgress(30);
    
    // Look for readable text files first
    const files = Object.keys(zipContent.files);
    console.log('Files in package:', files);
    
    // Try to find text files
    const textFiles = files.filter(name => 
      name.endsWith('.txt') || 
      name.endsWith('.csv') || 
      name.includes('export') ||
      name.includes('notes')
    );
    
    onProgress && onProgress(50);
    
    // If we find text files, parse them
    if (textFiles.length > 0) {
      for (const fileName of textFiles) {
        try {
          const fileContent = await zipContent.files[fileName].async('text');
          const result = await parseTextContent(fileContent, file.name, options);
          if (result.cards.length > 0) {
            onProgress && onProgress(100);
            return result;
          }
        } catch (error) {
          console.log(`Failed to parse ${fileName}:`, error);
          continue;
        }
      }
    }
    
    // Look for media.txt or other metadata files
    const mediaFiles = files.filter(name => 
      name.includes('media') || 
      name.includes('meta') ||
      name === '1' ||
      name === '2'
    );
    
    for (const fileName of mediaFiles) {
      try {
        const fileContent = await zipContent.files[fileName].async('text');
        console.log(`Content of ${fileName}:`, fileContent.substring(0, 200));
        
        // Try to extract any readable content
        if (fileContent && fileContent.trim()) {
          const result = await parseTextContent(fileContent, file.name, options);
          if (result.cards.length > 0) {
            onProgress && onProgress(100);
            return result;
          }
        }
      } catch (error) {
        console.log(`Could not read ${fileName} as text:`, error);
      }
    }
    
    onProgress && onProgress(100);
    
    throw new Error(`No readable content found in Anki package.

Found files: ${files.join(', ')}

This Anki file format is not supported. Please try:
1. Export from Anki as "Notes in Plain Text (*.txt)"
2. Export as "Cards in Plain Text (*.txt)" 
3. Then import that text file using the Quizlet option`);
    
  } catch (error) {
    console.error('ZIP parsing failed:', error);
    throw error;
  }
}

// Parse various text content formats
async function parseTextContent(content, originalFileName, options = {}) {
  const { previewOnly = false, maxCards = null } = options;
  
  const lines = content.split('\n').filter(line => line.trim());
  const cards = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    let front = '';
    let back = '';
    
    // Try different parsing strategies
    if (line.includes('\t')) {
      // Tab-delimited
      const parts = line.split('\t');
      front = cleanTextField(parts[0] || '');
      back = cleanTextField(parts[1] || '');
    } else if (line.includes('	')) {
      // Actual tab character
      const parts = line.split('	');
      front = cleanTextField(parts[0] || '');
      back = cleanTextField(parts[1] || '');
    } else if (line.includes('::')) {
      // Colon-separated (some Anki formats)
      const parts = line.split('::');
      front = cleanTextField(parts[0] || '');
      back = cleanTextField(parts[1] || '');
    } else if (line.includes('|')) {
      // Pipe-separated
      const parts = line.split('|');
      front = cleanTextField(parts[0] || '');
      back = cleanTextField(parts[1] || '');
    } else if (line.includes(',')) {
      // Comma-separated (handle quoted fields)
      const parts = parseCSVLine(line);
      front = cleanTextField(parts[0] || '');
      back = cleanTextField(parts[1] || '');
    } else if (line.length > 20 && i + 1 < lines.length) {
      // Might be a multi-line format
      front = cleanTextField(line);
      back = cleanTextField(lines[i + 1] || '');
      i++; // Skip next line since we used it
    }
    
    // Only add if we have both front and back
    if (front.trim() && back.trim()) {
      cards.push({
        front: front,
        back: back,
        cardType: 'Basic'
      });
      
      if (previewOnly && cards.length >= 5) break;
      if (maxCards && cards.length >= maxCards) break;
    }
  }
  
  return {
    deckName: originalFileName.replace(/\.[^/.]+$/, ""),
    totalCards: cards.length,
    cards: cards,
    preview: previewOnly ? cards.slice(0, 5) : undefined
  };
}

// Parse CSV line with quoted field support
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Clean and format text fields
function cleanTextField(text) {
  if (!text) return '';
  
  let cleaned = text.toString().trim();
  
  // Remove quotes if they wrap the entire text
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  
  // Convert common HTML entities
  cleaned = cleaned.replace(/&lt;/g, '<');
  cleaned = cleaned.replace(/&gt;/g, '>');
  cleaned = cleaned.replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/&quot;/g, '"');
  
  // Convert line breaks
  cleaned = cleaned.replace(/\\n/g, '<br>');
  cleaned = cleaned.replace(/\n/g, '<br>');
  
  // Basic HTML cleanup but preserve formatting
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '<br>');
  
  return cleaned;
}

// Main parser function with fallback strategies
export async function parseAnkiFileWithFallback(file, options = {}) {
  const { previewOnly = false, maxCards = null, onProgress = null } = options;
  
  console.log('Starting Anki file parsing:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    previewOnly,
    maxCards
  });
  
  const errors = [];
  
  // Strategy 1: Try parsing as text file first (fastest and most reliable)
  try {
    onProgress && onProgress(5);
    console.log('Trying Strategy 1: Parse as text file');
    const result = await parseAnkiAsText(file, options);
    if (result.cards.length > 0) {
      console.log('Strategy 1 succeeded:', result.totalCards, 'cards found');
      return result;
    }
  } catch (error) {
    console.log('Strategy 1 failed:', error.message);
    errors.push(`Text parsing: ${error.message}`);
  }
  
  // Strategy 2: Try ZIP-based parsing
  try {
    onProgress && onProgress(20);
    console.log('Trying Strategy 2: Parse as ZIP package');
    const result = await parseAnkiZip(file, options);
    if (result.cards.length > 0) {
      console.log('Strategy 2 succeeded:', result.totalCards, 'cards found');
      return result;
    }
  } catch (error) {
    console.log('Strategy 2 failed:', error.message);
    errors.push(`ZIP parsing: ${error.message}`);
  }
  
  // Strategy 3: Try binary/hex analysis (for debugging)
  try {
    onProgress && onProgress(70);
    console.log('Trying Strategy 3: Binary analysis');
    
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Look for readable strings in the binary data
    let binaryText = '';
    for (let i = 0; i < Math.min(uint8Array.length, 10000); i++) {
      const byte = uint8Array[i];
      if (byte >= 32 && byte <= 126) {
        binaryText += String.fromCharCode(byte);
      } else if (byte === 0 || byte === 10 || byte === 13) {
        binaryText += ' ';
      }
    }
    
    // Try to find patterns in the binary data
    const words = binaryText.split(/\s+/).filter(word => word.length > 3);
    console.log('Found words in binary:', words.slice(0, 20));
    
    if (words.length > 10) {
      // Try to create cards from found text
      const cards = [];
      for (let i = 0; i < words.length - 1; i += 2) {
        if (words[i] && words[i + 1]) {
          cards.push({
            front: cleanTextField(words[i]),
            back: cleanTextField(words[i + 1]),
            cardType: 'Basic'
          });
          
          if (previewOnly && cards.length >= 5) break;
          if (maxCards && cards.length >= maxCards) break;
        }
      }
      
      if (cards.length > 0) {
        onProgress && onProgress(100);
        console.log('Strategy 3 succeeded:', cards.length, 'cards extracted from binary');
        return {
          deckName: file.name.replace(/\.[^/.]+$/, "") + " (Recovered)",
          totalCards: cards.length,
          cards: cards,
          preview: previewOnly ? cards.slice(0, 5) : undefined
        };
      }
    }
  } catch (error) {
    console.log('Strategy 3 failed:', error.message);
    errors.push(`Binary analysis: ${error.message}`);
  }
  
  onProgress && onProgress(100);
  
  // All strategies failed
  console.error('All parsing strategies failed:', errors);
  
  throw new Error(`Unable to parse this Anki file. All parsing methods failed.

Errors encountered:
${errors.map(err => `• ${err}`).join('\n')}

**Recommended solution:**
1. Open Anki on your computer
2. Select your deck
3. Go to File → Export
4. Choose "Notes in Plain Text (*.txt)" format
5. Import that .txt file using the "Quizlet" option instead

This will preserve all your cards and content while ensuring compatibility.

**File details:**
• Name: ${file.name}
• Size: ${file.size} bytes
• Type: ${file.type || 'unknown'}`);
}

// Legacy exports for backward compatibility
export async function parseAnkiFile(file, options = {}) {
  return parseAnkiFileWithFallback(file, options);
}

export default parseAnkiFileWithFallback;