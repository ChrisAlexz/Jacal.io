// src/components/editor/EditorContentHandler.jsx - MATH REMOVED VERSION
import React, { useCallback } from 'react';

const EditorContentHandler = ({ 
  editorRef, 
  onChange, 
  readOnly, 
  setActiveFormats 
}) => {
  const handleEditorClick = useCallback((event) => {
    if (readOnly) return;
    
    // Simple click handling without math structures
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        // Basic click handling - no special math structure logic needed
      }
    }, 10);
  }, [readOnly]);

  const handleEditorKeyDown = useCallback((event) => {
    if (readOnly) return;
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    
    // Handle Enter and Right Arrow to exit superscript/subscript
    if (event.key === 'Enter' || event.key === 'ArrowRight') {
      const currentNode = range.startContainer;
      const parentElement = currentNode.nodeType === Node.TEXT_NODE ? currentNode.parentElement : currentNode;
      
      const supElement = parentElement?.closest('sup');
      const subElement = parentElement?.closest('sub');
      
      if (supElement || subElement) {
        const formatElement = supElement || subElement;
        
        if (event.key === 'Enter' || 
           (event.key === 'ArrowRight' && range.startOffset >= (range.startContainer.textContent?.length || 0))) {
          
          event.preventDefault();
          event.stopPropagation();
          
          const editorContent = formatElement.closest('.editor-content');
          if (!editorContent) return;
          
          const textNode = document.createTextNode('\u00A0');
          
          if (formatElement.nextSibling) {
            formatElement.parentNode.insertBefore(textNode, formatElement.nextSibling);
          } else {
            formatElement.parentNode.appendChild(textNode);
          }
          
          const newRange = document.createRange();
          newRange.setStart(textNode, 1);
          newRange.setEnd(textNode, 1);
          
          selection.removeAllRanges();
          selection.addRange(newRange);
          
          setActiveFormats(prev => ({
            ...prev,
            superscript: false,
            subscript: false
          }));
          
          setTimeout(() => {
            if (onChange && editorRef.current) {
              onChange(editorRef.current.innerHTML);
            }
          }, 100);
          
          return;
        }
      }
    }
  }, [readOnly, onChange, setActiveFormats]);

  return {
    handleEditorClick,
    handleEditorKeyDown
  };
};

export default EditorContentHandler;