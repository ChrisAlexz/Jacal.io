// src/components/editor/EditorContentHandler.jsx
import React, { useCallback } from 'react';
import { MathStructureHandler } from './MathStructureHandler';

const EditorContentHandler = ({ 
  editorRef, 
  onChange, 
  readOnly, 
  setActiveFormats 
}) => {
  const mathHandler = new MathStructureHandler(onChange);

  // Enhanced handleEditorClick function with math structure support
  const handleEditorClick = useCallback((event) => {
    if (readOnly) return;
    
    const target = event.target;
    const editor = editorRef.current;
    
    // Check if we clicked on or near a math structure
    const mathStructure = target.closest('.math-structure');
    
    if (mathStructure) {
      // If we clicked on a math structure but not on an editable limit
      const editableLimit = target.closest('.math-limit-editable');
      
      if (!editableLimit) {
        // Clicked on the structure itself, position cursor after it
        event.preventDefault();
        
        const selection = window.getSelection();
        const range = document.createRange();
        
        // Find the position relative to the click
        const rect = mathStructure.getBoundingClientRect();
        const clickX = event.clientX;
        const structureMiddle = rect.left + rect.width / 2;
        const wrapper = mathStructure.parentNode;
        
        if (clickX < structureMiddle) {
          // Clicked on left side - position cursor before the structure
          range.setStartBefore(wrapper);
          range.collapse(true);
        } else {
          // Clicked on right side - position cursor after the structure
          range.setStartAfter(wrapper);
          range.collapse(true);
        }
        
        selection.removeAllRanges();
        selection.addRange(range);
        editor.focus();
      }
    } else {
      // Normal click handling - ensure cursor is positioned correctly
      setTimeout(() => {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          
          // Check if cursor ended up inside a math structure accidentally
          const currentNode = range.startContainer;
          const parentMathStructure = currentNode.nodeType === Node.TEXT_NODE 
            ? currentNode.parentElement?.closest('.math-structure')
            : currentNode.closest?.('.math-structure');
          
          if (parentMathStructure && !currentNode.closest?.('.math-limit-editable')) {
            // Cursor is inside a math structure but not in an editable limit
            // Move it to after the structure
            const wrapper = parentMathStructure.parentNode;
            const newRange = document.createRange();
            newRange.setStartAfter(wrapper);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
        }
      }, 10);
    }
  }, [readOnly]);

  // Enhanced handleEditorKeyDown function with proper fraction cursor exit
  const handleEditorKeyDown = useCallback((event) => {
    if (readOnly) return;
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    
    // Handle "/" key to create fractions with proper cursor positioning
    if (event.key === '/') {
      event.preventDefault();
      
      const currentNode = range.startContainer;
      const cursorPos = range.startOffset;
      
      // Check if we're inside a fraction editable area
      const isInFractionEditable = currentNode.parentElement?.closest('.fraction-num-editable, .fraction-den-editable');
      
      if (isInFractionEditable) {
        // Handle nested fraction creation within existing fraction
        const editableElement = currentNode.parentElement.closest('.fraction-num-editable, .fraction-den-editable');
        const textContent = editableElement.textContent || '';
        const textBeforeCursor = textContent.substring(0, cursorPos);
        
        // Look for numerator pattern (more flexible for nested fractions)
        const numeratorMatch = textBeforeCursor.match(/([^/\s]+)$/);
        
        if (numeratorMatch) {
          const numerator = numeratorMatch[1];
          mathHandler.createFraction(numerator, selection, editorRef);
          return;
        }
      } else {
        // Handle regular fraction creation in main editor
        const currentText = currentNode.textContent || '';
        const textBeforeCursor = currentText.substring(0, cursorPos);
        const numberMatch = textBeforeCursor.match(/([a-zA-Z0-9+\-*/.()]+)$/);
        
        if (numberMatch) {
          const numerator = numberMatch[1];
          mathHandler.createFraction(numerator, selection, editorRef);
          return;
        }
      }
    }
    
    // Handle Enter and Right Arrow to exit superscript/subscript
    if (event.key === 'Enter' || event.key === 'ArrowRight') {
      const currentNode = range.startContainer;
      const parentElement = currentNode.nodeType === Node.TEXT_NODE ? currentNode.parentElement : currentNode;
      
      // Check if we're inside a superscript or subscript
      const supElement = parentElement?.closest('sup');
      const subElement = parentElement?.closest('sub');
      
      if (supElement || subElement) {
        const formatElement = supElement || subElement;
        
        // For Enter key, always exit the formatting
        // For Right arrow, only exit if we're at the end of the formatted text
        if (event.key === 'Enter' || 
           (event.key === 'ArrowRight' && range.startOffset >= (range.startContainer.textContent?.length || 0))) {
          
          event.preventDefault();
          event.stopPropagation();
          
          // Find the parent container (should be the editor content)
          const editorContent = formatElement.closest('.editor-content');
          if (!editorContent) return;
          
          // Create a text node with a space for normal text
          const textNode = document.createTextNode('\u00A0'); // Non-breaking space
          
          // Insert the text node after the superscript/subscript element
          if (formatElement.nextSibling) {
            formatElement.parentNode.insertBefore(textNode, formatElement.nextSibling);
          } else {
            formatElement.parentNode.appendChild(textNode);
          }
          
          // Position cursor at the end of the new text node
          const newRange = document.createRange();
          newRange.setStart(textNode, 1);
          newRange.setEnd(textNode, 1);
          
          selection.removeAllRanges();
          selection.addRange(newRange);
          
          // Clear the active formatting states
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
          }, 10);
          
          return;
        }
      }
    }
    
    // Check if we're adjacent to a math structure
    const isArrowKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key);
    
    if (isArrowKey) {
      // Find math structures in the editor
      const mathStructures = editorRef.current.querySelectorAll('.math-structure');
      
      mathStructures.forEach(structure => {
        // If cursor is at the boundary of a math structure, handle navigation
        if (event.key === 'ArrowRight') {
          // Check if we're at the end of text just before a math structure
          const nextSibling = range.endContainer.nextSibling;
          if (nextSibling === structure || (nextSibling && nextSibling.contains && nextSibling.contains(structure))) {
            event.preventDefault();
            const newRange = document.createRange();
            newRange.setStartAfter(structure);
            newRange.setEndAfter(structure);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
        } else if (event.key === 'ArrowLeft') {
          // Check if we're at the start of text just after a math structure
          const prevSibling = range.startContainer.previousSibling;
          if (prevSibling === structure || (prevSibling && prevSibling.contains && prevSibling.contains(structure))) {
            event.preventDefault();
            const newRange = document.createRange();
            newRange.setStartBefore(structure);
            newRange.setEndBefore(structure);
            selection.removeAllRanges();
            selection.addRange(newRange);
          }
        }
      });
    }
    
    // Handle backspace and delete around math structures
    if (event.key === 'Backspace' || event.key === 'Delete') {
      const mathStructures = editorRef.current.querySelectorAll('.math-structure');
      
      mathStructures.forEach(structure => {
        if (event.key === 'Backspace') {
          // Check if cursor is just after a math structure
          if (range.startOffset === 0 && range.startContainer.previousSibling === structure) {
            event.preventDefault();
            // Delete the entire math structure
            structure.remove();
            if (onChange) onChange(editorRef.current.innerHTML);
          }
        } else if (event.key === 'Delete') {
          // Check if cursor is just before a math structure
          if (range.endContainer.nextSibling === structure) {
            event.preventDefault();
            // Delete the entire math structure
            structure.remove();
            if (onChange) onChange(editorRef.current.innerHTML);
          }
        }
      });
    }
  }, [readOnly, onChange, setActiveFormats, mathHandler]);

  return {
    handleEditorClick,
    handleEditorKeyDown,
    mathHandler
  };
};

export default EditorContentHandler;