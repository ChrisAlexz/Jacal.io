// src/components/editor/EditorContentHandler.jsx - ROBUST VERSION
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
    const mathStructure = target.closest('.math-structure, .math-fraction');
    
    if (mathStructure) {
      // If we clicked on a math structure but not on an editable area
      const editableArea = target.closest('.math-limit-editable, .fraction-num-editable, .fraction-den-editable');
      
      if (!editableArea) {
        // Clicked on the structure itself, position cursor after it
        event.preventDefault();
        
        const selection = window.getSelection();
        const range = document.createRange();
        
        // Find the position relative to the click
        const rect = mathStructure.getBoundingClientRect();
        const clickX = event.clientX;
        const structureMiddle = rect.left + rect.width / 2;
        
        try {
          if (clickX < structureMiddle) {
            // Clicked on left side - position cursor before the structure
            range.setStartBefore(mathStructure);
            range.collapse(true);
          } else {
            // Clicked on right side - position cursor after the structure
            range.setStartAfter(mathStructure);
            range.collapse(true);
          }
          
          selection.removeAllRanges();
          selection.addRange(range);
          editor.focus();
        } catch (error) {
          console.warn('Cursor positioning error:', error);
          editor.focus();
        }
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
            ? currentNode.parentElement?.closest('.math-structure, .math-fraction')
            : currentNode.closest?.('.math-structure, .math-fraction');
          
          if (parentMathStructure && !currentNode.closest?.('.math-limit-editable, .fraction-num-editable, .fraction-den-editable')) {
            // Cursor is inside a math structure but not in an editable area
            // Move it to after the structure
            try {
              const newRange = document.createRange();
              newRange.setStartAfter(parentMathStructure);
              newRange.collapse(true);
              selection.removeAllRanges();
              selection.addRange(newRange);
            } catch (error) {
              console.warn('Error repositioning cursor:', error);
            }
          }
        }
      }, 10);
    }
  }, [readOnly]);

  // Enhanced handleEditorKeyDown function
  const handleEditorKeyDown = useCallback((event) => {
    if (readOnly) return;
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    
    // Handle "/" key to create fractions
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
          
          // Only trigger onChange if not typing in math
          if (!mathHandler.isCurrentlyTypingInMath()) {
            setTimeout(() => {
              if (onChange && editorRef.current) {
                onChange(editorRef.current.innerHTML);
              }
            }, 100);
          }
          
          return;
        }
      }
    }
    
    // Handle arrow key navigation around math structures
    const isArrowKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key);
    
    if (isArrowKey) {
      const mathStructures = editorRef.current.querySelectorAll('.math-structure, .math-fraction');
      
      mathStructures.forEach(structure => {
        try {
          if (event.key === 'ArrowRight') {
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
        } catch (error) {
          console.warn('Arrow key navigation error:', error);
        }
      });
    }
    
    // Handle backspace and delete around math structures
    if (event.key === 'Backspace' || event.key === 'Delete') {
      const mathStructures = editorRef.current.querySelectorAll('.math-structure, .math-fraction');
      
      mathStructures.forEach(structure => {
        try {
          if (event.key === 'Backspace') {
            if (range.startOffset === 0 && range.startContainer.previousSibling === structure) {
              event.preventDefault();
              structure.remove();
              if (onChange && !mathHandler.isCurrentlyTypingInMath()) {
                setTimeout(() => onChange(editorRef.current.innerHTML), 100);
              }
            }
          } else if (event.key === 'Delete') {
            if (range.endContainer.nextSibling === structure) {
              event.preventDefault();
              structure.remove();
              if (onChange && !mathHandler.isCurrentlyTypingInMath()) {
                setTimeout(() => onChange(editorRef.current.innerHTML), 100);
              }
            }
          }
        } catch (error) {
          console.warn('Delete operation error:', error);
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