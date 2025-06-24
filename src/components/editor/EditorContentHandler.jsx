// src/components/editor/EditorContentHandler.jsx - FIXED VERSION
import React, { useCallback } from 'react';

const EditorContentHandler = ({ 
  editorRef, 
  onChange, 
  readOnly, 
  setActiveFormats 
}) => {
  
  // FIXED: Enhanced click handler with format detection
  const handleEditorClick = useCallback((event) => {
    if (readOnly) return;
    
    // Ensure the editor is focused
    if (editorRef.current && event.target.closest('.editor-content')) {
      editorRef.current.focus();
    }
    
    // Delay format detection to allow selection to settle
    setTimeout(() => {
      try {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          // Update active formats based on current selection
          const newFormats = {
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),
            superscript: document.queryCommandState('superscript'),
            subscript: document.queryCommandState('subscript')
          };
          
          setActiveFormats(newFormats);
        }
      } catch (error) {
        console.warn('Error detecting formats on click:', error);
      }
    }, 10);
  }, [readOnly, setActiveFormats, editorRef]);

  // FIXED: Enhanced keydown handler with better format management
  const handleEditorKeyDown = useCallback((event) => {
    if (readOnly) return;
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    
    // Handle keyboard shortcuts for formatting
    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 'b':
          event.preventDefault();
          document.execCommand('bold', false, null);
          setTimeout(() => {
            setActiveFormats(prev => ({
              ...prev,
              bold: document.queryCommandState('bold')
            }));
            if (onChange && editorRef.current) {
              onChange(editorRef.current.innerHTML);
            }
          }, 10);
          return;
          
        case 'i':
          event.preventDefault();
          document.execCommand('italic', false, null);
          setTimeout(() => {
            setActiveFormats(prev => ({
              ...prev,
              italic: document.queryCommandState('italic')
            }));
            if (onChange && editorRef.current) {
              onChange(editorRef.current.innerHTML);
            }
          }, 10);
          return;
          
        case 'u':
          event.preventDefault();
          document.execCommand('underline', false, null);
          setTimeout(() => {
            setActiveFormats(prev => ({
              ...prev,
              underline: document.queryCommandState('underline')
            }));
            if (onChange && editorRef.current) {
              onChange(editorRef.current.innerHTML);
            }
          }, 10);
          return;
      }
    }
    
    // Handle Enter and Arrow keys to exit superscript/subscript and detect formats
    if (['Enter', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      const currentNode = range.startContainer;
      const parentElement = currentNode.nodeType === Node.TEXT_NODE ? currentNode.parentElement : currentNode;
      
      const supElement = parentElement?.closest('sup');
      const subElement = parentElement?.closest('sub');
      
      if (supElement || subElement) {
        const formatElement = supElement || subElement;
        
        // Exit formatting on Enter or at the end of formatted text
        if (event.key === 'Enter' || 
           (event.key === 'ArrowRight' && range.startOffset >= (range.startContainer.textContent?.length || 0))) {
          
          event.preventDefault();
          event.stopPropagation();
          
          const editorContent = formatElement.closest('.editor-content');
          if (!editorContent) return;
          
          // Create a space with normal formatting
          const textNode = document.createTextNode('\u00A0');
          
          if (formatElement.nextSibling) {
            formatElement.parentNode.insertBefore(textNode, formatElement.nextSibling);
          } else {
            formatElement.parentNode.appendChild(textNode);
          }
          
          // Move cursor to the new position
          const newRange = document.createRange();
          newRange.setStart(textNode, 1);
          newRange.setEnd(textNode, 1);
          
          selection.removeAllRanges();
          selection.addRange(newRange);
          
          // Update formats
          setActiveFormats(prev => ({
            ...prev,
            superscript: false,
            subscript: false
          }));
          
          // Trigger content change
          setTimeout(() => {
            if (onChange && editorRef.current) {
              onChange(editorRef.current.innerHTML);
            }
          }, 100);
          
          return;
        }
      }
      
      // For arrow keys, update format detection after movement
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        setTimeout(() => {
          try {
            const newFormats = {
              bold: document.queryCommandState('bold'),
              italic: document.queryCommandState('italic'),
              underline: document.queryCommandState('underline'),
              superscript: document.queryCommandState('superscript'),
              subscript: document.queryCommandState('subscript')
            };
            
            setActiveFormats(newFormats);
          } catch (error) {
            console.warn('Error detecting formats on arrow key:', error);
          }
        }, 50);
      }
    }
    
    // Handle Backspace and Delete to update formats
    if (['Backspace', 'Delete'].includes(event.key)) {
      setTimeout(() => {
        try {
          const newFormats = {
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),
            superscript: document.queryCommandState('superscript'),
            subscript: document.queryCommandState('subscript')
          };
          
          setActiveFormats(newFormats);
          
          if (onChange && editorRef.current) {
            onChange(editorRef.current.innerHTML);
          }
        } catch (error) {
          console.warn('Error detecting formats after delete:', error);
        }
      }, 10);
    }
  }, [readOnly, onChange, setActiveFormats, editorRef]);

  return {
    handleEditorClick,
    handleEditorKeyDown
  };
};

export default EditorContentHandler;