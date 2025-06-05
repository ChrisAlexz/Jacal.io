// src/components/SimpleRichTextEditor.jsx - ENHANCED WITH MATH SYMBOLS TOOLBAR AND CURSOR FIXES
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBold, 
  faItalic, 
  faUnderline, 
  faSuperscript, 
  faSubscript, 
  faEraser,
  faMicrophone,
  faFileAudio,
  faPlay,
  faPause,
  faTrash,
  faStop
} from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../supabase';
import '../styles/SimpleRichTextEditor.css';

const SimpleRichTextEditor = ({ 
  value = '', 
  onChange, 
  placeholder = '', 
  readOnly = false,
  onAudioChange = null, // Callback for when audio is added/removed
  initialAudioUrl = null,
  user = null
}) => {
  const editorRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    superscript: false,
    subscript: false
  });

  // Audio states
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState('');

  // Recording timer
  const recordingTimerRef = useRef(null);

  // Math symbols dropdown state
  const [showMathDropdown, setShowMathDropdown] = useState(false);
  const mathDropdownRef = useRef(null);

  // Math symbols organized by category
  const mathSymbols = {
    basic: [
      { symbol: '±', name: 'Plus minus' },
      { symbol: '∓', name: 'Minus plus' },
      { symbol: '×', name: 'Multiplication' },
      { symbol: '÷', name: 'Division' },
      { symbol: '√', name: 'Square root' },
      { symbol: '∛', name: 'Cube root' },
      { symbol: '∜', name: 'Fourth root' },
      { symbol: '∞', name: 'Infinity' }
    ],
    powers: [
      { symbol: '²', name: 'Squared' },
      { symbol: '³', name: 'Cubed' },
      { symbol: '⁴', name: 'Fourth power' },
      { symbol: '⁵', name: 'Fifth power' },
      { symbol: '⁶', name: 'Sixth power' },
      { symbol: '⁷', name: 'Seventh power' },
      { symbol: '⁸', name: 'Eighth power' },
      { symbol: '⁹', name: 'Ninth power' }
    ],
    algebra: [
      { symbol: '≠', name: 'Not equal' },
      { symbol: '≈', name: 'Approximately equal' },
      { symbol: '≡', name: 'Identical to' },
      { symbol: '∝', name: 'Proportional to' },
      { symbol: '≤', name: 'Less than or equal' },
      { symbol: '≥', name: 'Greater than or equal' },
      { symbol: '≪', name: 'Much less than' },
      { symbol: '≫', name: 'Much greater than' }
    ],
    calculus: [
      { symbol: '∂', name: 'Partial derivative' },
      { symbol: '∫', name: 'Integral' },
      { symbol: '∮', name: 'Contour integral' },
      { symbol: '∑', name: 'Summation' },
      { symbol: '∏', name: 'Product' },
      { symbol: '∆', name: 'Delta' },
      { symbol: '∇', name: 'Nabla' },
      { symbol: '∀', name: 'For all' }
    ],
    greek: [
      { symbol: 'α', name: 'Alpha' },
      { symbol: 'β', name: 'Beta' },
      { symbol: 'γ', name: 'Gamma' },
      { symbol: 'δ', name: 'Delta' },
      { symbol: 'ε', name: 'Epsilon' },
      { symbol: 'θ', name: 'Theta' },
      { symbol: 'λ', name: 'Lambda' },
      { symbol: 'μ', name: 'Mu' },
      { symbol: 'π', name: 'Pi' },
      { symbol: 'σ', name: 'Sigma' },
      { symbol: 'φ', name: 'Phi' },
      { symbol: 'ω', name: 'Omega' }
    ],
    sets: [
      { symbol: '∈', name: 'Element of' },
      { symbol: '∉', name: 'Not element of' },
      { symbol: '⊂', name: 'Subset of' },
      { symbol: '⊃', name: 'Superset of' },
      { symbol: '∪', name: 'Union' },
      { symbol: '∩', name: 'Intersection' },
      { symbol: '∅', name: 'Empty set' },
      { symbol: '⊆', name: 'Subset or equal' }
    ],
    logic: [
      { symbol: '∧', name: 'Logical and' },
      { symbol: '∨', name: 'Logical or' },
      { symbol: '¬', name: 'Logical not' },
      { symbol: '→', name: 'Implies' },
      { symbol: '↔', name: 'If and only if' },
      { symbol: '∃', name: 'There exists' },
      { symbol: '∄', name: 'There does not exist' },
      { symbol: '⊕', name: 'Exclusive or' }
    ]
  };

  // Close math dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mathDropdownRef.current && !mathDropdownRef.current.contains(event.target)) {
        setShowMathDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Execute formatting command
  const execCommand = useCallback((command, value = null) => {
    if (readOnly) return;
    
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    
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
    
    setTimeout(() => {
      if (onChange && editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }, 10);
  }, [activeFormats, onChange, readOnly]);

  // FIXED: Enhanced insertMathSymbol function with better cursor management
  const insertMathSymbol = useCallback((symbol) => {
    if (readOnly) return;
    
    editorRef.current?.focus();
    
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      
      let elementToInsert;
      
      // Beautiful math structures with proper limits
      if (symbol === '∫') {
        // Create a wrapper to ensure proper text flow
        const wrapper = document.createElement('span');
        wrapper.style.display = 'inline';
        
        elementToInsert = document.createElement('span');
        elementToInsert.className = 'math-structure integral-structure';
        elementToInsert.contentEditable = false;
        elementToInsert.innerHTML = `
          <span class="math-limits upper-limit">
            <span class="math-limit-editable" contenteditable="true" data-placeholder="∞" spellcheck="false"></span>
          </span>
          <span class="integral-symbol">∫</span>
          <span class="math-limits lower-limit">
            <span class="math-limit-editable" contenteditable="true" data-placeholder="0" spellcheck="false"></span>
          </span>
        `;
        
        // FIXED: Add proper spacing around the structure without visible characters
        const beforeText = document.createTextNode(''); // Empty text node for positioning
        const afterText = document.createTextNode(' '); // Single space after
        
        wrapper.appendChild(beforeText);
        wrapper.appendChild(elementToInsert);
        wrapper.appendChild(afterText);
        
        range.insertNode(wrapper);
        
        // Set up event handling
        setupMathStructureEvents(elementToInsert, afterText);
        
        // Position cursor after the structure
        setTimeout(() => {
          const newRange = document.createRange();
          const sel = window.getSelection();
          newRange.setStartAfter(wrapper);
          newRange.setEndAfter(wrapper);
          sel.removeAllRanges();
          sel.addRange(newRange);
        }, 10);
        
      } else if (symbol === '∑') {
        const wrapper = document.createElement('span');
        wrapper.style.display = 'inline';
        
        elementToInsert = document.createElement('span');
        elementToInsert.className = 'math-structure summation-structure';
        elementToInsert.contentEditable = false;
        elementToInsert.innerHTML = `
          <span class="math-limits upper-limit">
            <span class="math-limit-editable" contenteditable="true" data-placeholder="n" spellcheck="false"></span>
          </span>
          <span class="summation-symbol">∑</span>
          <span class="math-limits lower-limit">
            <span class="math-limit-editable" contenteditable="true" data-placeholder="i=1" spellcheck="false"></span>
          </span>
        `;
        
        const beforeText = document.createTextNode('');
        const afterText = document.createTextNode(' ');
        
        wrapper.appendChild(beforeText);
        wrapper.appendChild(elementToInsert);
        wrapper.appendChild(afterText);
        
        range.insertNode(wrapper);
        setupMathStructureEvents(elementToInsert, afterText);
        
        setTimeout(() => {
          const newRange = document.createRange();
          const sel = window.getSelection();
          newRange.setStartAfter(wrapper);
          newRange.setEndAfter(wrapper);
          sel.removeAllRanges();
          sel.addRange(newRange);
        }, 10);
        
      } else if (symbol === '∏') {
        const wrapper = document.createElement('span');
        wrapper.style.display = 'inline';
        
        elementToInsert = document.createElement('span');
        elementToInsert.className = 'math-structure product-structure';
        elementToInsert.contentEditable = false;
        elementToInsert.innerHTML = `
          <span class="math-limits upper-limit">
            <span class="math-limit-editable" contenteditable="true" data-placeholder="n" spellcheck="false"></span>
          </span>
          <span class="product-symbol">∏</span>
          <span class="math-limits lower-limit">
            <span class="math-limit-editable" contenteditable="true" data-placeholder="i=1" spellcheck="false"></span>
          </span>
        `;
        
        const beforeText = document.createTextNode('');
        const afterText = document.createTextNode(' ');
        
        wrapper.appendChild(beforeText);
        wrapper.appendChild(elementToInsert);
        wrapper.appendChild(afterText);
        
        range.insertNode(wrapper);
        setupMathStructureEvents(elementToInsert, afterText);
        
        setTimeout(() => {
          const newRange = document.createRange();
          const sel = window.getSelection();
          newRange.setStartAfter(wrapper);
          newRange.setEndAfter(wrapper);
          sel.removeAllRanges();
          sel.addRange(newRange);
        }, 10);
        
      } else {
        // Regular symbol insertion
        elementToInsert = document.createTextNode(symbol);
        range.insertNode(elementToInsert);
        
        // Position cursor after regular symbols
        range.setStartAfter(elementToInsert);
        range.setEndAfter(elementToInsert);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    
    setShowMathDropdown(false);
    
    setTimeout(() => {
      if (onChange && editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }, 50);
  }, [readOnly, onChange]);

  // FIXED: Separate function to set up math structure event handling
  const setupMathStructureEvents = useCallback((structure, afterTextNode) => {
    const editableElements = structure.querySelectorAll('.math-limit-editable');
    
    editableElements.forEach((element, index) => {
      // Handle keyboard navigation
      element.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          
          if (index < editableElements.length - 1) {
            editableElements[index + 1].focus();
            const range = document.createRange();
            range.selectNodeContents(editableElements[index + 1]);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
          } else {
            // FIXED: Exit and position cursor after the structure wrapper
            const range = document.createRange();
            const selection = window.getSelection();
            const wrapper = structure.parentNode;
            
            // Position cursor after the entire wrapper (which includes the afterText)
            range.setStartAfter(wrapper);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            editorRef.current?.focus();
          }
        }
        
        // Handle tab navigation
        if (e.key === 'Tab') {
          e.preventDefault();
          if (e.shiftKey) {
            // Shift+Tab: go to previous limit or exit
            if (index > 0) {
              editableElements[index - 1].focus();
              const range = document.createRange();
              range.selectNodeContents(editableElements[index - 1]);
              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(range);
            } else {
              // Exit to before the structure
              const range = document.createRange();
              const selection = window.getSelection();
              const wrapper = structure.parentNode;
              range.setStartBefore(wrapper);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
              editorRef.current?.focus();
            }
          } else {
            // Tab: go to next limit or exit
            if (index < editableElements.length - 1) {
              editableElements[index + 1].focus();
              const range = document.createRange();
              range.selectNodeContents(editableElements[index + 1]);
              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(range);
            } else {
              // FIXED: Exit to after the structure wrapper
              const range = document.createRange();
              const selection = window.getSelection();
              const wrapper = structure.parentNode;
              range.setStartAfter(wrapper);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
              editorRef.current?.focus();
            }
          }
        }

        // FIXED: Handle Escape key to exit the math structure
        if (e.key === 'Escape') {
          e.preventDefault();
          const range = document.createRange();
          const selection = window.getSelection();
          const wrapper = structure.parentNode;
          range.setStartAfter(wrapper);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          editorRef.current?.focus();
        }
      });
      
      // FIXED: Handle blur to position cursor after structure when clicking outside
      element.addEventListener('blur', (e) => {
        // Small delay to check if focus moved to another limit
        setTimeout(() => {
          const focusedElement = document.activeElement;
          const isStillInStructure = structure.contains(focusedElement);
          
          if (!isStillInStructure && !focusedElement.closest('.math-limit-editable')) {
            // Focus moved completely outside the structure
            // Position cursor after the structure
            const range = document.createRange();
            const selection = window.getSelection();
            const wrapper = structure.parentNode;
            range.setStartAfter(wrapper);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }, 50);
      });
      
      // Handle content changes
      element.addEventListener('input', (e) => {
        const text = element.textContent;
        if (element.innerHTML !== text) {
          element.textContent = text;
        }
        
        if (onChange && editorRef.current) {
          onChange(editorRef.current.innerHTML);
        }
      });
      
      // Prevent formatted paste
      element.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, text.replace(/\s+/g, ' ').trim());
      });
      
      // Handle focus
      element.addEventListener('focus', (e) => {
        setTimeout(() => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }, 10);
      });
    });
  }, [onChange]);
  
  // Helper function for fallback cases
  const getStructureHTML = useCallback((symbol) => {
    const structures = {
      '∫': `
        <span class="math-structure integral-structure" contenteditable="false">
          <span class="math-limits upper-limit">
            <span class="math-limit-editable" contenteditable="true" data-placeholder="∞" spellcheck="false"></span>
          </span>
          <span class="integral-symbol">∫</span>
          <span class="math-limits lower-limit">
            <span class="math-limit-editable" contenteditable="true" data-placeholder="0" spellcheck="false"></span>
          </span>
        </span>
      `,
      '∑': `
        <span class="math-structure summation-structure" contenteditable="false">
          <span class="math-limits upper-limit">
            <span class="math-limit-editable" contenteditable="true" data-placeholder="n" spellcheck="false"></span>
          </span>
          <span class="summation-symbol">∑</span>
          <span class="math-limits lower-limit">
            <span class="math-limit-editable" contenteditable="true" data-placeholder="i=1" spellcheck="false"></span>
          </span>
        </span>
      `,
      '∏': `
        <span class="math-structure product-structure" contenteditable="false">
          <span class="math-limits upper-limit">
            <span class="math-limit-editable" contenteditable="true" data-placeholder="n" spellcheck="false"></span>
          </span>
          <span class="product-symbol">∏</span>
          <span class="math-limits lower-limit">
            <span class="math-limit-editable" contenteditable="true" data-placeholder="i=1" spellcheck="false"></span>
          </span>
        </span>
      `
    };
    return structures[symbol] || symbol;
  }, []);

  // Handle content changes
  const handleInput = useCallback(() => {
    if (onChange && editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  // FIXED: Enhanced handleEditorClick function with math structure support
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
      // FIXED: Normal click handling - ensure cursor is positioned correctly
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

  // FIXED: Enhanced handleEditorKeyDown function with nested fraction support
  const handleEditorKeyDown = useCallback((event) => {
    if (readOnly) return;
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    
    // FIXED: Handle "/" key to create fractions (including nested fractions)
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
        const textAfterCursor = textContent.substring(cursorPos);
        
        // Look for numerator pattern (more flexible for nested fractions)
        const numeratorMatch = textBeforeCursor.match(/([^/\s]+)$/);
        
        if (numeratorMatch) {
          const numerator = numeratorMatch[1];
          const numeratorStartPos = cursorPos - numerator.length;
          
          // Create nested fraction
          const nestedFraction = document.createElement('span');
          nestedFraction.className = 'math-fraction nested-fraction';
          nestedFraction.contentEditable = false;
          nestedFraction.innerHTML = `
            <span class="fraction-numerator">
              <span class="fraction-num-editable" contenteditable="true" spellcheck="false">${numerator}</span>
            </span>
            <span class="fraction-line"></span>
            <span class="fraction-denominator">
              <span class="fraction-den-editable" contenteditable="true" spellcheck="false" data-placeholder=""></span>
            </span>
          `;
          
          // Replace content in the editable element
          const beforeNumerator = textBeforeCursor.substring(0, numeratorStartPos);
          editableElement.innerHTML = '';
          
          if (beforeNumerator) {
            editableElement.appendChild(document.createTextNode(beforeNumerator));
          }
          
          editableElement.appendChild(nestedFraction);
          
          if (textAfterCursor) {
            editableElement.appendChild(document.createTextNode(textAfterCursor));
          }
          
          // Set up events for nested fraction
          setupFractionEvents(nestedFraction);
          
          // Focus on denominator of nested fraction
          setTimeout(() => {
            const denominator = nestedFraction.querySelector('.fraction-den-editable');
            if (denominator) {
              denominator.focus();
              const range = document.createRange();
              range.selectNodeContents(denominator);
              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }, 10);
          
          return;
        }
      } else {
        // Handle regular fraction creation in main editor
        const currentText = currentNode.textContent || '';
        const textBeforeCursor = currentText.substring(0, cursorPos);
        const numberMatch = textBeforeCursor.match(/([a-zA-Z0-9+\-*/.()]+)$/);
        
        if (numberMatch) {
          const numerator = numberMatch[1];
          const numberStartPos = cursorPos - numerator.length;
          
          // Create the fraction structure
          const fractionElement = document.createElement('span');
          fractionElement.className = 'math-fraction';
          fractionElement.contentEditable = false;
          fractionElement.innerHTML = `
            <span class="fraction-numerator">
              <span class="fraction-num-editable" contenteditable="true" spellcheck="false">${numerator}</span>
            </span>
            <span class="fraction-line"></span>
            <span class="fraction-denominator">
              <span class="fraction-den-editable" contenteditable="true" spellcheck="false" data-placeholder=""></span>
            </span>
          `;
          
          // Remove the number from the text node
          const beforeText = currentText.substring(0, numberStartPos);
          const afterText = currentText.substring(cursorPos);
          
          // Replace the current text node
          if (beforeText || afterText) {
            currentNode.textContent = beforeText;
            
            // Insert the fraction
            const wrapper = document.createElement('span');
            wrapper.style.display = 'inline';
            const afterSpace = document.createTextNode(afterText);
            
            wrapper.appendChild(fractionElement);
            
            if (currentNode.parentNode) {
              currentNode.parentNode.insertBefore(wrapper, currentNode.nextSibling);
              if (afterText) {
                currentNode.parentNode.insertBefore(afterSpace, wrapper.nextSibling);
              }
            }
          } else {
            // Replace the entire text node
            if (currentNode.parentNode) {
              currentNode.parentNode.replaceChild(fractionElement, currentNode);
            }
          }
          
          // Set up event handling for the fraction
          setupFractionEvents(fractionElement);
          
          // Focus on the denominator for user to type
          setTimeout(() => {
            const denominator = fractionElement.querySelector('.fraction-den-editable');
            if (denominator) {
              denominator.focus();
              const range = document.createRange();
              range.selectNodeContents(denominator);
              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }, 10);
          
          // Trigger content change
          setTimeout(() => {
            if (onChange && editorRef.current) {
              onChange(editorRef.current.innerHTML);
            }
          }, 50);
          
          return;
        }
      }
    }
    
    // FIXED: Handle Enter and Right Arrow to exit superscript/subscript
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
            handleInput(); // Trigger change event
          }
        } else if (event.key === 'Delete') {
          // Check if cursor is just before a math structure
          if (range.endContainer.nextSibling === structure) {
            event.preventDefault();
            // Delete the entire math structure
            structure.remove();
            handleInput(); // Trigger change event
          }
        }
      });
    }
  }, [readOnly, handleInput, setActiveFormats, onChange]);

  // FIXED: Enhanced setupFractionEvents function with nested fraction support
  const setupFractionEvents = useCallback((fractionElement) => {
    const numeratorInput = fractionElement.querySelector('.fraction-num-editable');
    const denominatorInput = fractionElement.querySelector('.fraction-den-editable');
    
    [numeratorInput, denominatorInput].forEach((input, index) => {
      if (!input) return;
      
      // Handle keyboard navigation
      input.addEventListener('keydown', (e) => {
        // FIXED: Handle "/" key for nested fractions within fraction elements
        if (e.key === '/') {
          const selection = window.getSelection();
          if (!selection.rangeCount) return;
          
          const range = selection.getRangeAt(0);
          const currentNode = range.startContainer;
          const cursorPos = range.startOffset;
          const textContent = currentNode.textContent || '';
          const textBeforeCursor = textContent.substring(0, cursorPos);
          
          // Look for numerator pattern for nested fraction
          const numeratorMatch = textBeforeCursor.match(/([^/\s]+)$/);
          
          if (numeratorMatch) {
            e.preventDefault();
            
            const numerator = numeratorMatch[1];
            const numeratorStartPos = cursorPos - numerator.length;
            const textAfterCursor = textContent.substring(cursorPos);
            
            // Create nested fraction
            const nestedFraction = document.createElement('span');
            nestedFraction.className = 'math-fraction nested-fraction';
            nestedFraction.contentEditable = false;
            nestedFraction.innerHTML = `
              <span class="fraction-numerator">
                <span class="fraction-num-editable" contenteditable="true" spellcheck="false">${numerator}</span>
              </span>
              <span class="fraction-line"></span>
              <span class="fraction-denominator">
                <span class="fraction-den-editable" contenteditable="true" spellcheck="false" data-placeholder=""></span>
              </span>
            `;
            
            // Replace content in the current input
            const beforeNumerator = textBeforeCursor.substring(0, numeratorStartPos);
            input.innerHTML = '';
            
            if (beforeNumerator) {
              input.appendChild(document.createTextNode(beforeNumerator));
            }
            
            input.appendChild(nestedFraction);
            
            if (textAfterCursor) {
              input.appendChild(document.createTextNode(textAfterCursor));
            }
            
            // Set up events for nested fraction
            setupFractionEvents(nestedFraction);
            
            // Focus on denominator of nested fraction
            setTimeout(() => {
              const denominator = nestedFraction.querySelector('.fraction-den-editable');
              if (denominator) {
                denominator.focus();
                const range = document.createRange();
                range.selectNodeContents(denominator);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
              }
            }, 10);
            
            // Trigger change
            if (onChange && editorRef.current) {
              onChange(editorRef.current.innerHTML);
            }
            
            return;
          }
        }
        
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          
          if (index === 0 && denominatorInput) {
            // Move from numerator to denominator
            denominatorInput.focus();
            const range = document.createRange();
            range.selectNodeContents(denominatorInput);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
          } else {
            // Exit the fraction - position cursor after the main fraction wrapper
            const mainWrapper = fractionElement.parentNode;
            const range = document.createRange();
            const selection = window.getSelection();
            range.setStartAfter(mainWrapper);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            editorRef.current?.focus();
          }
        }
        
        if (e.key === 'Escape') {
          e.preventDefault();
          const mainWrapper = fractionElement.parentNode;
          const range = document.createRange();
          const selection = window.getSelection();
          range.setStartAfter(mainWrapper);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          editorRef.current?.focus();
        }
      });
      
      // Handle content changes
      input.addEventListener('input', (e) => {
        // Handle paste and ensure plain text only
        const text = input.textContent;
        if (input.innerHTML !== text) {
          // Keep only text content, preserve any nested fractions
          const children = Array.from(input.childNodes);
          input.innerHTML = '';
          
          children.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
              input.appendChild(document.createTextNode(child.textContent));
            } else if (child.classList && child.classList.contains('math-fraction')) {
              input.appendChild(child);
            }
          });
        }
        
        if (onChange && editorRef.current) {
          onChange(editorRef.current.innerHTML);
        }
      });
      
      // Prevent formatted paste
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
        
        // Check if pasted text contains "/" for auto-fraction conversion
        if (text.includes('/')) {
          // Insert text and then trigger fraction detection
          document.execCommand('insertText', false, text);
          // Trigger a synthetic "/" keydown to convert any fractions
          setTimeout(() => {
            const syntheticEvent = new KeyboardEvent('keydown', { key: '/' });
            input.dispatchEvent(syntheticEvent);
          }, 10);
        } else {
          document.execCommand('insertText', false, text.replace(/\s+/g, ' ').trim());
        }
      });
      
      // Handle focus
      input.addEventListener('focus', (e) => {
        setTimeout(() => {
          const range = document.createRange();
          range.selectNodeContents(input);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }, 10);
      });
    });
  }, [onChange]);

  // FIXED: Format time function for recording timer
  const formatRecordingTime = (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Audio recording functions
  const startRecording = async () => {
    try {
      setError('');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });
      
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType || 'audio/webm' 
        });
        
        // Upload immediately after recording
        await uploadAudioFile(audioBlob, true);
        
        // Stop all tracks
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop());
          audioStreamRef.current = null;
        }
      };
      
      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0); // FIXED: Reset to 0 at start
      
      // FIXED: Clear any existing timer before starting new one
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          console.log('Recording time updated:', newTime); // Debug log
          return newTime;
        });
      }, 1000);
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Could not access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // FIXED: Clear timer properly
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // Upload audio file
  const uploadAudioFile = async (file, isRecording = false) => {
    if (!user || !file) return null;

    setIsUploading(true);
    setError('');

    try {
      const fileExt = isRecording ? 'webm' : file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('flashcard-audio')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('flashcard-audio')
        .getPublicUrl(fileName);

      setAudioUrl(publicUrl);
      if (onAudioChange) {
        onAudioChange(publicUrl);
      }
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading audio:', error);
      setError(`Upload failed: ${error.message}`);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/webm'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid audio file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    await uploadAudioFile(file, false);
  };

  // Audio playback
  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleAudioPlay = () => setIsPlaying(true);
  const handleAudioPause = () => setIsPlaying(false);
  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleProgressClick = (e) => {
    if (!audioRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // FIXED: Format time for audio player - separate from recording timer
  const formatAudioTime = (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Remove audio
  const removeAudio = () => {
    setAudioUrl(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    if (onAudioChange) {
      onAudioChange(null);
    }
  };

  // Set initial content
  React.useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  // Set initial audio URL
  React.useEffect(() => {
    if (initialAudioUrl && initialAudioUrl !== audioUrl) {
      setAudioUrl(initialAudioUrl);
    }
  }, [initialAudioUrl]);

  // FIXED: Add event listeners for math structure handling
  React.useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    
    // Add both click and keyboard event listeners
    editor.addEventListener('click', handleEditorClick);
    editor.addEventListener('keydown', handleEditorKeyDown);
    
    return () => {
      editor.removeEventListener('click', handleEditorClick);
      editor.removeEventListener('keydown', handleEditorKeyDown);
    };
  }, [handleEditorClick, handleEditorKeyDown]);

  // FIXED: Cleanup function to properly clear timer
  React.useEffect(() => {
    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="simple-rich-text-editor">
      {!readOnly && (
        <div className="editor-toolbar">
          {/* Text formatting buttons */}
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

          {/* Divider */}
          <div className="toolbar-divider"></div>

          {/* Math Symbols Dropdown */}
          <div className="math-symbols-container" ref={mathDropdownRef}>
            <button
              type="button"
              className={`toolbar-btn math-btn ${showMathDropdown ? 'active' : ''}`}
              onClick={() => setShowMathDropdown(!showMathDropdown)}
              title="Insert Math Symbol"
              disabled={readOnly}
            >
              𝑓(𝑥)
            </button>
            
            {showMathDropdown && (
              <div className="math-dropdown">
                <div className="math-dropdown-header">
                  <span>Insert Math Symbol</span>
                  <button
                    type="button"
                    className="close-dropdown-btn"
                    onClick={() => setShowMathDropdown(false)}
                  >
                    ×
                  </button>
                </div>
                
                <div className="math-categories">
                  {Object.entries(mathSymbols).map(([category, symbols]) => (
                    <div key={category} className="math-category">
                      <div className="category-header">
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </div>
                      <div className="symbols-grid">
                        {symbols.map((item, index) => (
                          <button
                            key={index}
                            type="button"
                            className="symbol-btn"
                            onClick={() => insertMathSymbol(item.symbol)}
                            title={item.name}
                          >
                            {item.symbol}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="toolbar-divider"></div>

          {/* Audio buttons */}
          {!audioUrl && !isRecording && (
            <>
              <button
                type="button"
                className="toolbar-btn audio-btn"
                onClick={startRecording}
                disabled={isUploading}
                title="Record Audio"
              >
                <FontAwesomeIcon icon={faMicrophone} />
              </button>
              
              <button
                type="button"
                className="toolbar-btn audio-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                title="Upload Audio File"
              >
                <FontAwesomeIcon icon={faFileAudio} />
              </button>
            </>
          )}

          {isRecording && (
            <>
              <button
                type="button"
                className="toolbar-btn recording-btn"
                onClick={stopRecording}
                title="Stop Recording"
              >
                <FontAwesomeIcon icon={faStop} />
              </button>
              <span className="recording-time">{formatRecordingTime(recordingTime)}</span>
            </>
          )}

          {audioUrl && !isRecording && (
            <>
              <button
                type="button"
                className="toolbar-btn audio-btn"
                onClick={togglePlayback}
                disabled={isUploading}
                title={isPlaying ? "Pause" : "Play"}
              >
                <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
              </button>
              
              <button
                type="button"
                className="toolbar-btn audio-btn delete-audio"
                onClick={removeAudio}
                title="Remove Audio"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </>
          )}

          {isUploading && (
            <span className="uploading-indicator">Uploading...</span>
          )}
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

      {/* Audio Player Display - Shows when audio is attached */}
      {audioUrl && (
        <div className="editor-audio-player">
          <div className="audio-player-header">
            <span className="audio-icon">🎵</span>
            <span className="audio-label">Audio attached</span>
            <button
              type="button"
              className="remove-audio-btn"
              onClick={removeAudio}
              title="Remove audio"
            >
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>
          
          <div className="audio-player-controls">
            <button
              type="button"
              className="play-pause-btn"
              onClick={togglePlayback}
              title={isPlaying ? "Pause" : "Play"}
            >
              <FontAwesomeIcon icon={isPlaying ? faPause : faPlay} />
            </button>
            
            <div className="audio-progress-container">
              <audio
                ref={audioRef}
                src={audioUrl}
                onPlay={handleAudioPlay}
                onPause={handleAudioPause}
                onEnded={handleAudioEnded}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                preload="metadata"
              />
              
              <div className="audio-progress-bar" onClick={handleProgressClick}>
                <div 
                  className="audio-progress-fill" 
                  style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
                ></div>
              </div>
              
              <div className="audio-time">
                <span>{formatAudioTime(currentTime)}</span>
                <span>/</span>
                <span>{formatAudioTime(duration)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />

      {/* Error display */}
      {error && (
        <div className="audio-error">
          <small>{error}</small>
        </div>
      )}
    </div>
  );
};

export default SimpleRichTextEditor;