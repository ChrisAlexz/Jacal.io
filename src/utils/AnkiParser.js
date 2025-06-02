// src/utils/AnkiParser.js
import JSZip from 'jszip';

/**
 * Parse Anki package files (.apkg, .colpkg)
 * Anki files are SQLite databases compressed in ZIP format
 */

// Load SQL.js from CDN
let sqlModule = null;

async function loadSQLJS() {
  if (sqlModule) return sqlModule;
  
  // Load from CDN
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js';
  
  return new Promise((resolve, reject) => {
    script.onload = async () => {
      try {
        sqlModule = await window.initSqlJs({
          locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
        resolve(sqlModule);
      } catch (error) {
        reject(error);
      }
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function parseAnkiFile(file, options = {}) {
  const { previewOnly = false, maxCards = null, onProgress = null } = options;

  try {
    onProgress && onProgress(10);

    // Load the file as a ZIP
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);

    onProgress && onProgress(20);

    // Look for the main database file
    let dbFile = null;
    const fileNames = Object.keys(zipContent.files);

    // Common Anki database filenames
    const dbFileNames = ['collection.anki2', 'collection.anki21', 'anki.db'];
    
    for (const fileName of dbFileNames) {
      if (zipContent.files[fileName]) {
        dbFile = zipContent.files[fileName];
        break;
      }
    }

    if (!dbFile) {
      throw new Error('Invalid Anki file: No database found. Please ensure this is a valid .apkg or .colpkg file.');
    }

    onProgress && onProgress(30);

    // Extract the database file
    const dbArrayBuffer = await dbFile.async('arraybuffer');
    
    onProgress && onProgress(40);

    // Load SQL.js
    const SQL = await loadSQLJS();
    
    onProgress && onProgress(50);

    const db = new SQL.Database(new Uint8Array(dbArrayBuffer));

    onProgress && onProgress(70);

    // Extract deck information
    const deckInfo = extractDeckInfo(db);
    
    // Extract cards and notes
    const cards = extractCards(db, previewOnly ? 5 : maxCards);

    onProgress && onProgress(90);

    // Clean up
    db.close();

    onProgress && onProgress(100);

    const result = {
      deckName: deckInfo.name || 'Imported Anki Deck',
      totalCards: cards.length,
      cards: cards
    };

    if (previewOnly) {
      result.preview = cards.slice(0, Math.min(5, cards.length));
    }

    return result;

  } catch (error) {
    console.error('Error parsing Anki file:', error);
    throw new Error(`Failed to parse Anki file: ${error.message}`);
  }
}

function extractDeckInfo(db) {
  try {
    // Get deck information from the decks table
    const deckQuery = db.exec(`
      SELECT decks FROM col LIMIT 1
    `);
    
    if (deckQuery.length > 0 && deckQuery[0].values.length > 0) {
      const decksJson = deckQuery[0].values[0][0];
      const decks = JSON.parse(decksJson);
      
      // Find the first non-default deck
      for (const deckId in decks) {
        const deck = decks[deckId];
        if (deck.name && deck.name !== 'Default') {
          return { name: deck.name };
        }
      }
    }
    
    return { name: 'Imported Anki Deck' };
  } catch (error) {
    console.warn('Could not extract deck info:', error);
    return { name: 'Imported Anki Deck' };
  }
}

function extractCards(db, maxCards = null) {
  try {
    // Query to get notes and their fields
    let notesQuery = `
      SELECT 
        notes.id,
        notes.flds,
        notes.tags,
        models.flds as modelFields,
        models.name as modelName
      FROM notes 
      LEFT JOIN col ON 1=1
      LEFT JOIN (
        SELECT 
          json_extract(value, '$.flds') as flds,
          json_extract(value, '$.name') as name,
          key as modelId
        FROM json_each((SELECT models FROM col LIMIT 1))
      ) as models ON notes.mid = models.modelId
    `;

    if (maxCards) {
      notesQuery += ` LIMIT ${maxCards}`;
    }

    const notesResult = db.exec(notesQuery);
    
    if (!notesResult.length || !notesResult[0].values.length) {
      throw new Error('No notes found in the Anki file');
    }

    const notes = notesResult[0].values;
    const cards = [];

    for (const note of notes) {
      const [noteId, fieldsData, tags, modelFieldsJson, modelName] = note;
      
      try {
        // Parse the fields
        const fields = fieldsData.split('\x1f'); // Anki uses \x1f as field separator
        
        let front = fields[0] || '';
        let back = fields[1] || '';
        
        // Try to parse model fields for better field mapping
        if (modelFieldsJson) {
          try {
            const modelFields = JSON.parse(modelFieldsJson);
            if (Array.isArray(modelFields) && modelFields.length >= 2) {
              // Use the first two fields as front and back
              front = fields[0] || '';
              back = fields[1] || '';
            }
          } catch (e) {
            // Fallback to default mapping
          }
        }

        // Clean up HTML tags and formatting
        front = cleanAnkiHtml(front);
        back = cleanAnkiHtml(back);

        // Skip empty cards
        if (!front.trim() && !back.trim()) {
          continue;
        }

        // Determine card type based on content
        let cardType = 'Basic';
        if (front.includes('{{c') && front.includes('::')) {
          cardType = 'Cloze';
        }

        cards.push({
          front: front.trim(),
          back: back.trim(),
          cardType: cardType,
          tags: tags || '',
          modelName: modelName || 'Unknown'
        });

      } catch (noteError) {
        console.warn('Error processing note:', noteError);
        // Continue with other notes
      }
    }

    return cards;

  } catch (error) {
    console.error('Error extracting cards:', error);
    throw new Error('Failed to extract cards from Anki database');
  }
}

function cleanAnkiHtml(html) {
  if (!html) return '';
  
  let cleaned = html;
  
  // Convert Anki cloze deletions
  cleaned = cleaned.replace(/\{\{c(\d+)::(.*?)\}\}/g, '{{c$1::$2}}');
  
  // Remove or convert common Anki HTML
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
  cleaned = cleaned.replace(/<\/p><p>/gi, '\n\n');
  cleaned = cleaned.replace(/<p>/gi, '');
  cleaned = cleaned.replace(/<\/p>/gi, '');
  
  // Convert basic formatting
  cleaned = cleaned.replace(/<b>(.*?)<\/b>/gi, '<strong>$1</strong>');
  cleaned = cleaned.replace(/<i>(.*?)<\/i>/gi, '<em>$1</em>');
  cleaned = cleaned.replace(/<u>(.*?)<\/u>/gi, '<u>$1</u>');
  
  // Remove unwanted tags but preserve content
  cleaned = cleaned.replace(/<(?!\/?(strong|em|u|sup|sub|br)\b)[^>]*>/gi, '');
  
  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

// Alternative parser for when SQL.js is not available
export async function parseAnkiFileSimple(file, options = {}) {
  const { previewOnly = false, onProgress = null } = options;

  try {
    onProgress && onProgress(10);

    // For simple parsing, we'll try to extract any text content
    // This is a fallback method when SQLite parsing fails
    
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);

    onProgress && onProgress(50);

    // Look for any text files that might contain card data
    const textFiles = [];
    for (const fileName of Object.keys(zipContent.files)) {
      if (fileName.endsWith('.txt') || fileName.endsWith('.csv')) {
        textFiles.push(fileName);
      }
    }

    if (textFiles.length === 0) {
      throw new Error('Unable to parse Anki file. Please try exporting your deck as a text file from Anki.');
    }

    // Process the first text file found
    const textFile = zipContent.files[textFiles[0]];
    const content = await textFile.async('text');

    onProgress && onProgress(80);

    // Parse as tab-delimited or comma-delimited
    const lines = content.split('\n').filter(line => line.trim());
    const cards = [];

    for (const line of lines) {
      const fields = line.split('\t').length > 1 ? line.split('\t') : line.split(',');
      
      if (fields.length >= 2) {
        cards.push({
          front: fields[0].trim(),
          back: fields[1].trim(),
          cardType: 'Basic'
        });
      }

      if (previewOnly && cards.length >= 5) break;
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
    console.error('Error in simple Anki parsing:', error);
    throw new Error(`Failed to parse Anki file: ${error.message}`);
  }
}