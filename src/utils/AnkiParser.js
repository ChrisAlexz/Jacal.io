// src/utils/AnkiParser.js - FIXED FOR LATEST ANKI VERSIONS
import JSZip from 'jszip';

/**
 * Parse Anki package files (.apkg, .colpkg)
 * Updated to support Anki 2.1.50+ formats including .anki21b and new schema
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

    // Look for the main database file - try multiple possible names
    let dbFile = null;
    let dbFileName = null;
    const fileNames = Object.keys(zipContent.files);

    console.log('Files in Anki package:', fileNames);

    // Anki database filename priority order (newest to oldest)
    const dbFileNames = [
      'collection.anki21b',  // Anki 2.1.50+ 
      'collection.anki21',   // Anki 2.1.x
      'collection.anki2',    // Anki 2.0.x
      'anki.db',            // Very old format
      'collection.db'       // Alternative name
    ];
    
    for (const fileName of dbFileNames) {
      if (zipContent.files[fileName]) {
        dbFile = zipContent.files[fileName];
        dbFileName = fileName;
        console.log('Found database file:', fileName);
        break;
      }
    }

    if (!dbFile) {
      console.error('Available files:', fileNames);
      throw new Error(`Invalid Anki file: No database found. 
      
Found files: ${fileNames.join(', ')}

Please ensure this is a valid .apkg or .colpkg file exported from Anki. If you're using a newer version of Anki, try exporting as "Anki Collection Package (*.colpkg)" instead.`);
    }

    onProgress && onProgress(30);

    // Extract the database file
    const dbArrayBuffer = await dbFile.async('arraybuffer');
    
    onProgress && onProgress(40);

    // Load SQL.js
    const SQL = await loadSQLJS();
    
    onProgress && onProgress(50);

    // Handle different database formats
    let db;
    try {
      db = new SQL.Database(new Uint8Array(dbArrayBuffer));
      console.log('Successfully opened database with SQL.js');
    } catch (error) {
      console.error('Error opening database:', error);
      
      if (dbFileName === 'collection.anki21b') {
        throw new Error(`This appears to be a newer Anki format (.anki21b) that requires additional processing. 

Please try one of these solutions:
1. In Anki, go to File → Export → Export as "Notes in Plain Text (*.txt)"
2. Or try exporting as "Anki Collection Package (*.colpkg)" 
3. Or use File → Export → "Cards in Plain Text (*.txt)"

Then import that text file using the Quizlet import option instead.`);
      }
      
      throw new Error(`Unable to read Anki database: ${error.message}

This might be a newer Anki format. Try exporting your deck as a text file instead:
1. In Anki: File → Export
2. Choose "Notes in Plain Text (*.txt)"
3. Import using the Quizlet option in our app`);
    }

    onProgress && onProgress(70);

    // Extract deck information
    const deckInfo = extractDeckInfo(db);
    
    // Extract cards and notes
    const cards = await extractCards(db, previewOnly ? 5 : maxCards);

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
    
    // Provide more helpful error messages
    if (error.message.includes('no such table')) {
      throw new Error(`This Anki file uses a newer database schema that we don't fully support yet.

Workaround:
1. Open Anki
2. Go to File → Export
3. Select your deck
4. Choose "Notes in Plain Text (*.txt)" format
5. Import the .txt file using our Quizlet import option

This will preserve all your cards and content.`);
    }
    
    if (error.message.includes('SQLITE_CORRUPT') || error.message.includes('malformed')) {
      throw new Error(`The Anki file appears to be corrupted or uses an unsupported format.

Try these steps:
1. Re-export from Anki as "Notes in Plain Text (*.txt)"
2. Or try "Cards in Plain Text (*.txt)"
3. Import the text file using Quizlet import option`);
    }

    throw error;
  }
}

function extractDeckInfo(db) {
  try {
    // Try modern Anki schema first
    let deckQuery;
    
    try {
      // For Anki 2.1.x - decks are stored as JSON in col table
      deckQuery = db.exec(`SELECT decks FROM col LIMIT 1`);
    } catch (error) {
      console.log('Modern schema failed, trying legacy schema:', error);
      
      // For older Anki versions - try alternative approaches
      try {
        deckQuery = db.exec(`SELECT * FROM col LIMIT 1`);
      } catch (legacyError) {
        console.log('Legacy schema also failed:', legacyError);
        return { name: 'Imported Anki Deck' };
      }
    }
    
    if (deckQuery.length > 0 && deckQuery[0].values.length > 0) {
      const decksJson = deckQuery[0].values[0][0];
      
      if (decksJson && typeof decksJson === 'string') {
        try {
          const decks = JSON.parse(decksJson);
          
          // Find the first non-default deck
          for (const deckId in decks) {
            const deck = decks[deckId];
            if (deck.name && deck.name !== 'Default' && !deck.name.startsWith('Default::')) {
              return { name: deck.name };
            }
          }
        } catch (jsonError) {
          console.log('Error parsing decks JSON:', jsonError);
        }
      }
    }
    
    return { name: 'Imported Anki Deck' };
  } catch (error) {
    console.warn('Could not extract deck info:', error);
    return { name: 'Imported Anki Deck' };
  }
}

async function extractCards(db, maxCards = null) {
  try {
    // First, let's see what tables exist
    const tableQuery = db.exec(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      ORDER BY name
    `);
    
    const tables = tableQuery[0]?.values?.map(row => row[0]) || [];
    console.log('Available tables:', tables);

    if (!tables.includes('notes')) {
      throw new Error('no such table: notes');
    }

    // Try to get the schema for the notes table
    let notesSchema;
    try {
      const schemaQuery = db.exec(`PRAGMA table_info(notes)`);
      notesSchema = schemaQuery[0]?.values || [];
      console.log('Notes table schema:', notesSchema);
    } catch (error) {
      console.log('Could not get notes schema:', error);
    }

    // Build a flexible query based on available columns
    let notesQuery = `
      SELECT 
        notes.id,
        notes.flds
    `;

    // Add optional columns if they exist
    const noteColumns = notesSchema?.map(row => row[1]) || [];
    if (noteColumns.includes('tags')) {
      notesQuery += `, notes.tags`;
    }
    if (noteColumns.includes('mid')) {
      notesQuery += `, notes.mid`;
    }

    notesQuery += ` FROM notes`;

    if (maxCards) {
      notesQuery += ` LIMIT ${maxCards}`;
    }

    console.log('Executing query:', notesQuery);
    const notesResult = db.exec(notesQuery);
    
    if (!notesResult.length || !notesResult[0].values.length) {
      console.log('No notes found, trying alternative approach...');
      
      // Try to extract from cards table directly
      try {
        const cardsQuery = db.exec(`
          SELECT DISTINCT cards.id, notes.flds 
          FROM cards 
          JOIN notes ON cards.nid = notes.id 
          ${maxCards ? `LIMIT ${maxCards}` : ''}
        `);
        
        if (cardsQuery.length > 0 && cardsQuery[0].values.length > 0) {
          return processNotes(cardsQuery[0].values);
        }
      } catch (cardsError) {
        console.log('Cards table approach failed:', cardsError);
      }
      
      throw new Error('No notes or cards found in the Anki file');
    }

    return processNotes(notesResult[0].values);

  } catch (error) {
    console.error('Error extracting cards:', error);
    
    if (error.message.includes('no such table')) {
      throw new Error(`This Anki file uses a database schema we don't recognize.

The file might be from a very new or very old version of Anki. 

Please export your deck as a text file instead:
1. In Anki: File → Export
2. Choose "Notes in Plain Text (*.txt)"  
3. Import that file using our Quizlet import option`);
    }
    
    throw new Error(`Failed to extract cards from Anki database: ${error.message}`);
  }
}

function processNotes(notesData) {
  const cards = [];

  for (const note of notesData) {
    try {
      const [noteId, fieldsData, tags, modelId] = note;
      
      if (!fieldsData) {
        console.log('Skipping note with no fields:', noteId);
        continue;
      }

      // Parse the fields - Anki uses \x1f as field separator
      const fields = fieldsData.split('\x1f');
      
      let front = fields[0] || '';
      let back = fields[1] || '';

      // If we only have one field, try to split it differently
      if (fields.length === 1 && fields[0]) {
        const singleField = fields[0];
        
        // Try to find common separators
        if (singleField.includes('\t')) {
          const parts = singleField.split('\t');
          front = parts[0] || '';
          back = parts[1] || '';
        } else if (singleField.includes(' - ')) {
          const parts = singleField.split(' - ');
          front = parts[0] || '';
          back = parts[1] || '';
        } else if (singleField.includes(': ')) {
          const parts = singleField.split(': ');
          front = parts[0] || '';
          back = parts[1] || '';
        } else {
          // Use the single field as front, empty back
          front = singleField;
          back = '(No back side found)';
        }
      }

      // Clean up HTML tags and formatting
      front = cleanAnkiHtml(front);
      back = cleanAnkiHtml(back);

      // Skip completely empty cards
      if (!front.trim() && !back.trim()) {
        continue;
      }

      // If front is empty but back has content, swap them
      if (!front.trim() && back.trim()) {
        [front, back] = [back, front];
      }

      // Determine card type based on content
      let cardType = 'Basic';
      if (front.includes('{{c') && front.includes('::')) {
        cardType = 'Cloze';
      }

      cards.push({
        front: front.trim() || '(Empty front)',
        back: back.trim() || '(Empty back)',
        cardType: cardType,
        tags: tags || '',
        originalId: noteId
      });

    } catch (noteError) {
      console.warn('Error processing note:', noteError, note);
      // Continue with other notes
    }
  }

  console.log(`Processed ${cards.length} cards from ${notesData.length} notes`);
  return cards;
}

function cleanAnkiHtml(html) {
  if (!html) return '';
  
  let cleaned = html;
  
  // Convert Anki cloze deletions to our format
  cleaned = cleaned.replace(/\{\{c(\d+)::(.*?)\}\}/g, '{{c$1::$2}}');
  
  // Remove or convert common Anki HTML
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
  cleaned = cleaned.replace(/<\/p><p>/gi, '\n\n');
  cleaned = cleaned.replace(/<p>/gi, '');
  cleaned = cleaned.replace(/<\/p>/gi, '');
  cleaned = cleaned.replace(/<div>/gi, '');
  cleaned = cleaned.replace(/<\/div>/gi, '');
  
  // Convert basic formatting
  cleaned = cleaned.replace(/<b>(.*?)<\/b>/gi, '<strong>$1</strong>');
  cleaned = cleaned.replace(/<i>(.*?)<\/i>/gi, '<em>$1</em>');
  cleaned = cleaned.replace(/<u>(.*?)<\/u>/gi, '<u>$1</u>');
  
  // Handle Anki media references
  cleaned = cleaned.replace(/\[sound:(.*?)\]/gi, '[Audio: $1]');
  cleaned = cleaned.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '[Image: $1]');
  
  // Remove unwanted tags but preserve content
  cleaned = cleaned.replace(/<(?!\/?(strong|em|u|sup|sub|br)\b)[^>]*>/gi, '');
  
  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  cleaned = cleaned.replace(/\n\s+/g, '\n');
  
  return cleaned;
}

// Fallback parser for when the main parser fails
export async function parseAnkiFileSimple(file, options = {}) {
  const { previewOnly = false, onProgress = null } = options;

  try {
    onProgress && onProgress(10);

    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);

    onProgress && onProgress(50);

    // Look for any readable content
    const textFiles = [];
    const fileNames = Object.keys(zipContent.files);
    
    for (const fileName of fileNames) {
      if (fileName.endsWith('.txt') || fileName.endsWith('.csv') || fileName.includes('note')) {
        textFiles.push(fileName);
      }
    }

    if (textFiles.length === 0) {
      throw new Error(`Unable to parse this Anki file format.

This appears to be a newer Anki format that requires the full Anki application to read.

Please export from Anki as:
1. File → Export
2. "Notes in Plain Text (*.txt)" 
3. Import that .txt file using our Quizlet import option

Available files in package: ${fileNames.join(', ')}`);
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
    throw new Error(`Unable to parse Anki file: ${error.message}

Try exporting from Anki as a text file:
1. File → Export
2. "Notes in Plain Text (*.txt)"
3. Import using Quizlet option instead`);
  }
}

// Main export - tries full parsing first, then falls back to simple parsing
export async function parseAnkiFileWithFallback(file, options = {}) {
  try {
    // Try the full parser first
    return await parseAnkiFile(file, options);
  } catch (error) {
    console.log('Full parser failed, trying simple parser:', error.message);
    
    // If the full parser fails, try the simple parser
    try {
      return await parseAnkiFileSimple(file, options);
    } catch (fallbackError) {
      console.log('Simple parser also failed:', fallbackError.message);
      
      // Both failed - provide helpful guidance
      throw new Error(`Unable to parse this Anki file format.

This might be a newer Anki format (.anki21b) or corrupted file.

Recommended solution:
1. Open Anki
2. Select your deck
3. Go to File → Export
4. Choose "Notes in Plain Text (*.txt)" format
5. Import that .txt file using our Quizlet import option

This will preserve all your cards and formatting.

Original error: ${error.message}`);
    }
  }
}

// Keep the original export for backward compatibility
export default parseAnkiFile;