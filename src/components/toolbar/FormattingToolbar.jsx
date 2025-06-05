// src/components/toolbar/FormattingToolbar.jsx
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBold, 
  faItalic, 
  faUnderline, 
  faSuperscript, 
  faSubscript, 
  faEraser
} from '@fortawesome/free-solid-svg-icons';

const FormattingToolbar = ({ 
  activeFormats, 
  onFormatCommand, 
  disabled = false 
}) => {
  const formatButtons = [
    { key: 'bold', icon: faBold, title: 'Bold' },
    { key: 'italic', icon: faItalic, title: 'Italic' },
    { key: 'underline', icon: faUnderline, title: 'Underline' },
    { key: 'superscript', icon: faSuperscript, title: 'Superscript' },
    { key: 'subscript', icon: faSubscript, title: 'Subscript' }
  ];

  return (
    <>
      {formatButtons.map(({ key, icon, title }) => (
        <button
          key={key}
          type="button"
          className={`toolbar-btn ${activeFormats[key] ? 'active' : ''}`}
          onClick={() => onFormatCommand(key)}
          disabled={disabled}
          title={title}
        >
          <FontAwesomeIcon icon={icon} />
        </button>
      ))}
      
      <button
        type="button"
        className="toolbar-btn"
        onClick={() => onFormatCommand('removeFormat')}
        disabled={disabled}
        title="Clear Formatting"
      >
        <FontAwesomeIcon icon={faEraser} />
      </button>
    </>
  );
};

export default FormattingToolbar;