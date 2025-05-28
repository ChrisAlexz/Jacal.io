import React, { useRef, useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBold, 
  faItalic, 
  faUnderline, 
  faSuperscript, 
  faSubscript, 
  faEraser 
} from '@fortawesome/free-solid-svg-icons';
import '../styles/SimpleRichTextEditor.css';

const SimpleRichTextEditor = ({ 
  value = '', 
  onChange, 
  placeholder = '', 
  readOnly = false 
}) => {
  const editorRef = useRef(null);
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    superscript: false,
    subscript: false
  });

  // Execute formatting command
  const execCommand = useCallback((command, value = null) => {
    if (readOnly) return;
    
    // Focus the editor
    editorRef.current?.focus();
    
    // Execute the command
    document.execCommand(command, false, value);
    
    // Update active formats
    const newFormats = { ...activeFormats };
    
    switch (command) {
      case 'bold':
        newFormats.bold = !activeFormats.bold;
        break;
      case 'italic':
        newFormats.italic = !activeFormats.italic;
        break;
      case 'underline':
        newFormats.underline = !activeFormats.underline;
        break;
      case 'superscript':
        if (activeFormats.subscript) {
          document.execCommand('subscript', false, null);
          newFormats.subscript = false;
        }
        newFormats.superscript = !activeFormats.superscript;
        break;
      case 'subscript':
        if (activeFormats.superscript) {
          document.execCommand('superscript', false, null);
          newFormats.superscript = false;
        }
        newFormats.subscript = !activeFormats.subscript;
        break;
      case 'removeFormat':
        newFormats.bold = false;
        newFormats.italic = false;
        newFormats.underline = false;
        newFormats.superscript = false;
        newFormats.subscript = false;
        break;
    }
    
    setActiveFormats(newFormats);
    
    // Trigger onChange
    setTimeout(() => {
      if (onChange && editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }, 10);
  }, [activeFormats, onChange, readOnly]);

  // Handle content changes
  const handleInput = useCallback(() => {
    if (onChange && editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  // Set initial content
  React.useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  return (
    <div className="simple-rich-text-editor">
      {!readOnly && (
        <div className="editor-toolbar">
          <button
            type="button"
            className={`toolbar-btn ${activeFormats.bold ? 'active' : ''}`}
            onClick={() => execCommand('bold')}
            title="Bold"
          >
            <FontAwesomeIcon icon={faBold} />
          </button>
          
          <button
            type="button"
            className={`toolbar-btn ${activeFormats.italic ? 'active' : ''}`}
            onClick={() => execCommand('italic')}
            title="Italic"
          >
            <FontAwesomeIcon icon={faItalic} />
          </button>
          
          <button
            type="button"
            className={`toolbar-btn ${activeFormats.underline ? 'active' : ''}`}
            onClick={() => execCommand('underline')}
            title="Underline"
          >
            <FontAwesomeIcon icon={faUnderline} />
          </button>
          
          <button
            type="button"
            className={`toolbar-btn ${activeFormats.superscript ? 'active' : ''}`}
            onClick={() => execCommand('superscript')}
            title="Superscript"
          >
            <FontAwesomeIcon icon={faSuperscript} />
          </button>
          
          <button
            type="button"
            className={`toolbar-btn ${activeFormats.subscript ? 'active' : ''}`}
            onClick={() => execCommand('subscript')}
            title="Subscript"
          >
            <FontAwesomeIcon icon={faSubscript} />
          </button>
          
          <button
            type="button"
            className="toolbar-btn"
            onClick={() => execCommand('removeFormat')}
            title="Clear Formatting"
          >
            <FontAwesomeIcon icon={faEraser} />
          </button>
        </div>
      )}
      
      <div
        ref={editorRef}
        className={`editor-content ${readOnly ? 'readonly' : ''}`}
        contentEditable={!readOnly}
        onInput={handleInput}
        data-placeholder={placeholder}
        suppressContentEditableWarning={true}
      />
    </div>
  );
};

export default SimpleRichTextEditor;