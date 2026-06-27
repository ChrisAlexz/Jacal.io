// src/components/toolbar/FormattingToolbar.jsx
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBold,
  faItalic,
  faUnderline,
  faSuperscript,
  faSubscript,
  faEraser,
} from '@fortawesome/free-solid-svg-icons';

const FormattingToolbar = ({ editor, disabled = false }) => {
  if (!editor) return null;

  // preventDefault on mousedown so clicking a button doesn't blur the editor
  // and collapse the current text selection.
  const keepSelection = (e) => e.preventDefault();

  const buttons = [
    {
      key: 'bold',
      icon: faBold,
      title: 'Bold',
      active: editor.isActive('bold'),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      key: 'italic',
      icon: faItalic,
      title: 'Italic',
      active: editor.isActive('italic'),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      key: 'underline',
      icon: faUnderline,
      title: 'Underline',
      active: editor.isActive('underline'),
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      key: 'superscript',
      icon: faSuperscript,
      title: 'Superscript',
      active: editor.isActive('superscript'),
      run: () => editor.chain().focus().toggleSuperscript().run(),
    },
    {
      key: 'subscript',
      icon: faSubscript,
      title: 'Subscript',
      active: editor.isActive('subscript'),
      run: () => editor.chain().focus().toggleSubscript().run(),
    },
  ];

  return (
    <>
      {buttons.map(({ key, icon, title, active, run }) => (
        <button
          key={key}
          type="button"
          className={`toolbar-btn ${active ? 'active' : ''}`}
          onMouseDown={keepSelection}
          onClick={run}
          disabled={disabled}
          title={title}
          aria-label={title}
          aria-pressed={active}
        >
          <FontAwesomeIcon icon={icon} />
        </button>
      ))}

      <button
        type="button"
        className="toolbar-btn"
        onMouseDown={keepSelection}
        onClick={() => editor.chain().focus().unsetAllMarks().run()}
        disabled={disabled}
        title="Clear Formatting"
        aria-label="Clear Formatting"
      >
        <FontAwesomeIcon icon={faEraser} />
      </button>
    </>
  );
};

export default FormattingToolbar;
