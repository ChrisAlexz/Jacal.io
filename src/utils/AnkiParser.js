// src/utils/AnkiParser.js - SIMPLIFIED AND FIXED VERSION

/**
 * Simplified Anki parser that focuses on the most common formats
 * with better error handling and debugging
 */

// Simple text-based parser as primary method
export async function parseAnkiAsText(file, options = {}) {
  const { previewOnly = false, maxCards = null, onProgress = null } = options;
  
  try {
    console.log('🔄 Parsing Anki file as text:', file.name);
    onProgress && onProgress(20);
    
    const text = await readFileAsText(file);
    console.log('📄 File content length:', text.length);
    console.log('📄 First 200 chars:', text.substring(0, 200));
    
    onProgress && onProgress(50);
    
    if (!text || text.trim().length === 0) {
      throw new Error('File appears to be empty or unreadable');
    }
    
    const cards = parseTextContent(text);
    console.log('✅ Parsed cards count:', cards.length);
    
    onProgress && onProgress(100);
    
    if (cards.length === 0) {
      throw new Error('No valid flashcard pairs found in the file');
    }
    
    return {
      deckName: file.name.replace(/\.[^/.]+$/, ""),
      totalCards: cards.length,
      cards: previewOnly ? cards.slice(0, 5) : cards,
      preview: previewOnly ? cards.slice(0, 5) : undefined
    };
    
  } catch (error) {
    console.error('❌ Text parsing failed:', error);
    throw error;
  }
}

// ZIP-based parser with better error handling
export async function parseAnkiZip(file, options = {}) {
  const { previewOnly = false, maxCards = null, onProgress = null } = options;
  
  try {
    console.log('🔄 Parsing Anki file as ZIP:', file.name);
    onProgress && onProgress(10);
    
    // Dynamic import of JSZip
    let JSZip;
    try {
      JSZip = (await import('jszip')).default;
    } catch (error) {
      throw new Error('JSZip library not available');
    }
    
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);
    
    onProgress && onProgress(30);
    
    const files = Object.keys(zipContent.files);
    console.log('📦 Files in ZIP:', files);
    
    // Look for readable content
    const textFiles = files.filter(name => 
      name.endsWith('.txt') || 
      name.endsWith('.csv') || 
      name.includes('export') ||
      name.includes('notes') ||
      name.includes('cards') ||
      !name.includes('.')  // Sometimes Anki uses numbered files without extension
    );
    
    console.log('📄 Text files found:', textFiles);
    onProgress && onProgress(50);
    
    for (const fileName of textFiles) {
      try {
        console.log(`🔍 Trying to read: ${fileName}`);
        const fileContent = await zipContent.files[fileName].async('text');
        console.log(`📝 ${fileName} content length:`, fileContent.length);
        console.log(`📝 ${fileName} first 100 chars:`, fileContent.substring(0, 100));
        
        if (fileContent && fileContent.trim()) {
          const cards = parseTextContent(fileContent);
          console.log(`✅ Found ${cards.length} cards in ${fileName}`);
          
          if (cards.length > 0) {
            onProgress && onProgress(100);
            return {
              deckName: file.name.replace(/\.[^/.]+$/, ""),
              totalCards: cards.length,
              cards: previewOnly ? cards.slice(0, 5) : cards,
              preview: previewOnly ? cards.slice(0, 5) : undefined
            };
          }
        }
      } catch (error) {
        console.log(`❌ Failed to parse ${fileName}:`, error.message);
        continue;
      }
    }
    
    // If no text files worked, try all files
    for (const fileName of files) {
      if (textFiles.includes(fileName)) continue; // Already tried
      
      try {
        console.log(`🔍 Trying binary file as text: ${fileName}`);
        const fileContent = await zipContent.files[fileName].async('text');
        
        if (fileContent && fileContent.trim()) {
          const cards = parseTextContent(fileContent);
          if (cards.length > 0) {
            console.log(`✅ Found ${cards.length} cards in binary file ${fileName}`);
            onProgress && onProgress(100);
            return {
              deckName: file.name.replace(/\.[^/.]+$/, ""),
              totalCards: cards.length,
              cards: previewOnly ? cards.slice(0, 5) : cards,
              preview: previewOnly ? cards.slice(0, 5) : undefined
            };
          }
        }
      } catch (error) {
        // Binary files might fail, that's OK
        continue;
      }
    }
    
    onProgress && onProgress(100);
    throw new Error(`No readable content found in Anki package. Found files: ${files.join(', ')}`);
    
  } catch (error) {
    console.error('❌ ZIP parsing failed:', error);
    throw error;
  }
}

// Parse text content with multiple strategies
function parseTextContent(content) {
  console.log('🔄 Parsing text content...');
  const lines = content.split('\n').filter(line => line.trim());
  console.log('📊 Total lines:', lines.length);
  
  const cards = [];
  
  // Strategy 1: Tab-delimited (most common Anki export format)
  console.log('🔍 Trying tab-delimited parsing...');
  for (const line of lines) {
    if (line.includes('\t')) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const front = cleanTextField(parts[0]);
        const back = cleanTextField(parts[1]);
        
        if (front.trim() && back.trim()) {
          cards.push({
            front: front,
            back: back,
            cardType: 'Basic'
          });
        }
      }
    }
  }
  
  if (cards.length > 0) {
    console.log(`✅ Tab-delimited: Found ${cards.length} cards`);
    return cards;
  }
  
  // Strategy 2: Comma-delimited with quotes
  console.log('🔍 Trying comma-delimited parsing...');
  for (const line of lines) {
    if (line.includes(',')) {
      const parts = parseCSVLine(line);
      if (parts.length >= 2) {
        const front = cleanTextField(parts[0]);
        const back = cleanTextField(parts[1]);
        
        if (front.trim() && back.trim()) {
          cards.push({
            front: front,
            back: back,
            cardType: 'Basic'
          });
        }
      }
    }
  }
  
  if (cards.length > 0) {
    console.log(`✅ Comma-delimited: Found ${cards.length} cards`);
    return cards;
  }
  
  // Strategy 3: Other delimiters
  console.log('🔍 Trying other delimiters...');
  const delimiters = ['|', ';', '::'];
  
  for (const delimiter of delimiters) {
    for (const line of lines) {
      if (line.includes(delimiter)) {
        const parts = line.split(delimiter);
        if (parts.length >= 2) {
          const front = cleanTextField(parts[0]);
          const back = cleanTextField(parts[1]);
          
          if (front.trim() && back.trim()) {
            cards.push({
              front: front,
              back: back,
              cardType: 'Basic'
            });
          }
        }
      }
    }
    
    if (cards.length > 0) {
      console.log(`✅ ${delimiter}-delimited: Found ${cards.length} cards`);
      return cards;
    }
  }
  
  // Strategy 4: Line pairs (every 2 lines is a card)
  console.log('🔍 Trying line pairs...');
  for (let i = 0; i < lines.length - 1; i += 2) {
    const front = cleanTextField(lines[i]);
    const back = cleanTextField(lines[i + 1]);
    
    if (front.trim() && back.trim()) {
      cards.push({
        front: front,
        back: back,
        cardType: 'Basic'
      });
    }
  }
  
  if (cards.length > 0) {
    console.log(`✅ Line pairs: Found ${cards.length} cards`);
    return cards;
  }
  
  console.log('❌ No cards found with any parsing strategy');
  return [];
}

// Read file as text with encoding detection
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      resolve(e.target.result);
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    // Try UTF-8 first
    reader.readAsText(file, 'UTF-8');
  });
}

// Parse CSV line with proper quote handling
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
  
  // Remove surrounding quotes
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  
  // Convert HTML entities
  cleaned = cleaned.replace(/&lt;/g, '<');
  cleaned = cleaned.replace(/&gt;/g, '>');
  cleaned = cleaned.replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/&quot;/g, '"');
  
  // Handle line breaks
  cleaned = cleaned.replace(/\\n/g, '<br>');
  cleaned = cleaned.replace(/\r?\n/g, '<br>');
  
  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

// Main export function with comprehensive error handling
export async function parseAnkiFileWithFallback(file, options = {}) {
  const { previewOnly = false, maxCards = null, onProgress = null } = options;
  
  console.log('🚀 Starting Anki file parsing:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type
  });
  
  const errors = [];
  
  // Strategy 1: Parse as text file
  try {
    onProgress && onProgress(5);
    console.log('📝 Strategy 1: Parse as text file');
    const result = await parseAnkiAsText(file, options);
    if (result.cards.length > 0) {
      console.log('✅ Strategy 1 successful:', result.totalCards, 'cards');
      return result;
    }
  } catch (error) {
    console.log('❌ Strategy 1 failed:', error.message);
    errors.push(`Text parsing: ${error.message}`);
  }
  
  // Strategy 2: Parse as ZIP file
  try {
    onProgress && onProgress(40);
    console.log('📦 Strategy 2: Parse as ZIP file');
    const result = await parseAnkiZip(file, options);
    if (result.cards.length > 0) {
      console.log('✅ Strategy 2 successful:', result.totalCards, 'cards');
      return result;
    }
  } catch (error) {
    console.log('❌ Strategy 2 failed:', error.message);
    errors.push(`ZIP parsing: ${error.message}`);
  }
  
  onProgress && onProgress(100);
  
  // All strategies failed
  console.error('❌ All parsing strategies failed');
  
  const helpfulError = `Unable to parse this Anki file. 

**What went wrong:**
${errors.map(err => `• ${err}`).join('\n')}

**How to fix this:**
1. Open Anki on your computer
2. Select your deck
3. Go to **File → Export**
4. Choose **"Notes in Plain Text (*.txt)"** format
5. Save the file
6. Import that .txt file using the **"Quizlet"** option instead

**Why this works:**
Anki's text export creates a simple tab-delimited format that's much easier to parse and works with our Quizlet importer.

**File info:**
• Name: ${file.name}
• Size: ${(file.size / 1024).toFixed(1)} KB
• Type: ${file.type || 'unknown'}`;

  throw new Error(helpfulError);
}

// Export for backward compatibility
export async function parseAnkiFile(file, options = {}) {
  return parseAnkiFileWithFallback(file, options);
}

export default parseAnkiFileWithFallback;