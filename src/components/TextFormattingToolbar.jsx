import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBold, 
  faItalic, 
  faUnderline, 
  faSuperscript, 
  faSubscript, 
  faPalette, 
  faHighlighter, 
  faEraser 
} from '@fortawesome/free-solid-svg-icons';
import '../styles/TextFormattingToolbar.css';

const TextFormattingToolbar = ({ editorRef, selectionRangeRef, activeFormats = {}, onFormatChange }) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [activeStyles, setActiveStyles] = useState({
    bold: false,
    italic: false,
    underline: false,
    superscript: false,
    subscript: false
  });
  
  // Standard text color options
  const colorOptions = [
    '#000000', '#FF0000', '#0000FF', '#008000', 
    '#FFA500', '#800080', '#A52A2A', '#808080'
  ];
  
  // Highlight color options
  const highlightOptions = [
    '#FFFF00', '#00FFFF', '#FF00FF', '#90EE90',
    '#FFD700', '#FFA07A', '#87CEFA', '#D3D3D3'
  ];

  // Focus the editor and set cursor to end if no selection
  const focusEditor = () => {
    if (!editorRef || !editorRef.current) return;
    
    editorRef.current.focus();
    
    // If no selection exists, place cursor at the end
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) {
      const range = document.createRange();
      range.selectNodeContents(editorRef.current);
      range.collapse(false); // Move to end
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  // Apply formatting by toggling document.execCommand
  const toggleFormatting = (command) => {
    if (!editorRef || !editorRef.current) return;
    
    focusEditor();
    
    // Toggle the format state
    const newActiveStyles = { ...activeStyles };
    
    switch (command) {
      case 'bold':
        newActiveStyles.bold = !activeStyles.bold;
        document.execCommand('bold', false, null);
        break;
      case 'italic':
        newActiveStyles.italic = !activeStyles.italic;
        document.execCommand('italic', false, null);
        break;
      case 'underline':
        newActiveStyles.underline = !activeStyles.underline;
        document.execCommand('underline', false, null);
        break;
      case 'superscript':
        // If subscript is active, turn it off first
        if (activeStyles.subscript) {
          document.execCommand('subscript', false, null);
          newActiveStyles.subscript = false;
        }
        newActiveStyles.superscript = !activeStyles.superscript;
        document.execCommand('superscript', false, null);
        break;
      case 'subscript':
        // If superscript is active, turn it off first
        if (activeStyles.superscript) {
          document.execCommand('superscript', false, null);
          newActiveStyles.superscript = false;
        }
        newActiveStyles.subscript = !activeStyles.subscript;
        document.execCommand('subscript', false, null);
        break;
    }
    
    // Update state
    setActiveStyles(newActiveStyles);
    
    // Notify parent component
    if (onFormatChange) {
      onFormatChange(newActiveStyles);
    }
    
    // Keep focus on editor
    editorRef.current.focus();
  };

  // Apply color formatting
  const applyColor = (command, color) => {
    if (!editorRef || !editorRef.current) return;
    
    focusEditor();
    document.execCommand(command, false, color);
    editorRef.current.focus();
  };

  // Remove all formatting
  const removeAllFormatting = () => {
    if (!editorRef || !editorRef.current) return;
    
    focusEditor();
    
    // Remove formatting
    document.execCommand('removeFormat', false, null);
    
    // Reset all active states
    const resetStyles = {
      bold: false,
      italic: false,
      underline: false,
      superscript: false,
      subscript: false
    };
    
    setActiveStyles(resetStyles);
    
    if (onFormatChange) {
      onFormatChange(resetStyles);
    }
    
    editorRef.current.focus();
  };

  // Effect to handle clicks outside of color pickers
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showColorPicker || showHighlightPicker) {
        setShowColorPicker(false);
        setShowHighlightPicker(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColorPicker, showHighlightPicker]);

  // Update active styles when activeFormats prop changes
  useEffect(() => {
    if (activeFormats && Object.keys(activeFormats).length > 0) {
      setActiveStyles(activeFormats);
    }
  }, [activeFormats]);

  return (
    <div className="text-formatting-toolbar">
      <button 
        onClick={() => toggleFormatting('bold')}
        title="Bold"
        className={`toolbar-button ${activeStyles.bold ? 'active' : ''}`}
        type="button"
        disabled={!editorRef}
      >
        <FontAwesomeIcon icon={faBold} />
      </button>
      
      <button 
        onClick={() => toggleFormatting('italic')}
        title="Italic"
        className={`toolbar-button ${activeStyles.italic ? 'active' : ''}`}
        type="button"
        disabled={!editorRef}
      >
        <FontAwesomeIcon icon={faItalic} />
      </button>
      
      <button 
        onClick={() => toggleFormatting('underline')}
        title="Underline"
        className={`toolbar-button ${activeStyles.underline ? 'active' : ''}`}
        type="button"
        disabled={!editorRef}
      >
        <FontAwesomeIcon icon={faUnderline} />
      </button>
      
      <button 
        onClick={() => toggleFormatting('superscript')}
        title="Superscript"
        className={`toolbar-button ${activeStyles.superscript ? 'active' : ''}`}
        type="button"
        disabled={!editorRef}
      >
        <FontAwesomeIcon icon={faSuperscript} />
      </button>
      
      <button 
        onClick={() => toggleFormatting('subscript')}
        title="Subscript"
        className={`toolbar-button ${activeStyles.subscript ? 'active' : ''}`}
        type="button"
        disabled={!editorRef}
      >
        <FontAwesomeIcon icon={faSubscript} />
      </button>
      
      <div className="color-picker-container">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setShowColorPicker(!showColorPicker);
            setShowHighlightPicker(false);
          }} 
          title="Text Color"
          className="toolbar-button"
          type="button"
          disabled={!editorRef}
        >
          <FontAwesomeIcon icon={faPalette} />
        </button>
        
        {showColorPicker && (
          <div 
            className="color-palette"
            onClick={(e) => e.stopPropagation()}
          >
            {colorOptions.map(color => (
              <div 
                key={color}
                className="color-option"
                style={{ backgroundColor: color }}
                onClick={(e) => {
                  e.stopPropagation();
                  applyColor('foreColor', color);
                  setShowColorPicker(false);
                }}
              />
            ))}
          </div>
        )}
      </div>
      
      <div className="color-picker-container">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setShowHighlightPicker(!showHighlightPicker);
            setShowColorPicker(false);
          }} 
          title="Highlight Color"
          className="toolbar-button"
          type="button"
          disabled={!editorRef}
        >
          <FontAwesomeIcon icon={faHighlighter} />
        </button>
        
        {showHighlightPicker && (
          <div 
            className="color-palette"
            onClick={(e) => e.stopPropagation()}
          >
            {highlightOptions.map(color => (
              <div 
                key={color}
                className="color-option"
                style={{ backgroundColor: color }}
                onClick={(e) => {
                  e.stopPropagation();
                  applyColor('hiliteColor', color);
                  setShowHighlightPicker(false);
                }}
              />
            ))}
          </div>
        )}
      </div>
      
      <button 
        onClick={removeAllFormatting}
        title="Remove Formatting"
        className="toolbar-button"
        type="button"
        disabled={!editorRef}
      >
        <FontAwesomeIcon icon={faEraser} />
      </button>
    </div>
  );
};

export default TextFormattingToolbar;