// src/components/editor/MathStructureHandler.jsx - FIXED FRACTION TYPING ISSUE
// This utility handles the creation and management of math structures
// like integrals, summations, products, and fractions

export class MathStructureHandler {
  constructor(onChange) {
    this.onChange = onChange;
  }

  // Insert a math symbol with proper structure handling
  insertMathSymbol(symbol, selection, editorRef) {
    if (!selection?.rangeCount || !editorRef?.current) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();
    
    let elementToInsert;
    
    if (symbol === '∫') {
      elementToInsert = this.createIntegralStructure();
    } else if (symbol === '∑') {
      elementToInsert = this.createSummationStructure();
    } else if (symbol === '∏') {
      elementToInsert = this.createProductStructure();
    } else {
      // Regular symbol insertion
      elementToInsert = document.createTextNode(symbol);
      range.insertNode(elementToInsert);
      
      // Position cursor after regular symbols
      range.setStartAfter(elementToInsert);
      range.setEndAfter(elementToInsert);
      selection.removeAllRanges();
      selection.addRange(range);
      
      this.triggerChange(editorRef);
      return;
    }

    // Create wrapper for complex structures
    const wrapper = document.createElement('span');
    wrapper.style.display = 'inline';
    
    const beforeText = document.createTextNode('');
    const afterText = document.createTextNode(' ');
    
    wrapper.appendChild(beforeText);
    wrapper.appendChild(elementToInsert);
    wrapper.appendChild(afterText);
    
    range.insertNode(wrapper);
    this.setupMathStructureEvents(elementToInsert, afterText);
    
    // Position cursor after the structure
    setTimeout(() => {
      const newRange = document.createRange();
      const sel = window.getSelection();
      newRange.setStartAfter(wrapper);
      newRange.setEndAfter(wrapper);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }, 10);
    
    this.triggerChange(editorRef);
  }

  createIntegralStructure() {
    const element = document.createElement('span');
    element.className = 'math-structure integral-structure';
    element.contentEditable = false;
    element.innerHTML = `
      <span class="math-limits upper-limit">
        <span class="math-limit-editable" contenteditable="true" data-placeholder="∞" spellcheck="false"></span>
      </span>
      <span class="integral-symbol">∫</span>
      <span class="math-limits lower-limit">
        <span class="math-limit-editable" contenteditable="true" data-placeholder="0" spellcheck="false"></span>
      </span>
    `;
    return element;
  }

  createSummationStructure() {
    const element = document.createElement('span');
    element.className = 'math-structure summation-structure';
    element.contentEditable = false;
    element.innerHTML = `
      <span class="math-limits upper-limit">
        <span class="math-limit-editable" contenteditable="true" data-placeholder="n" spellcheck="false"></span>
      </span>
      <span class="summation-symbol">∑</span>
      <span class="math-limits lower-limit">
        <span class="math-limit-editable" contenteditable="true" data-placeholder="i=1" spellcheck="false"></span>
      </span>
    `;
    return element;
  }

  createProductStructure() {
    const element = document.createElement('span');
    element.className = 'math-structure product-structure';
    element.contentEditable = false;
    element.innerHTML = `
      <span class="math-limits upper-limit">
        <span class="math-limit-editable" contenteditable="true" data-placeholder="n" spellcheck="false"></span>
      </span>
      <span class="product-symbol">∏</span>
      <span class="math-limits lower-limit">
        <span class="math-limit-editable" contenteditable="true" data-placeholder="i=1" spellcheck="false"></span>
      </span>
    `;
    return element;
  }

  setupMathStructureEvents(structure, afterTextNode) {
    const editableElements = structure.querySelectorAll('.math-limit-editable');
    
    editableElements.forEach((element, index) => {
      this.setupLimitElement(element, index, editableElements, structure, afterTextNode);
    });
  }

  setupLimitElement(element, index, allElements, structure, afterTextNode) {
    // Handle keyboard navigation
    element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        
        if (index < allElements.length - 1) {
          allElements[index + 1].focus();
          this.selectAllText(allElements[index + 1]);
        } else {
          this.exitStructure(structure, afterTextNode);
        }
      }
      
      // Handle tab navigation
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          // Shift+Tab: go to previous limit or exit
          if (index > 0) {
            allElements[index - 1].focus();
            this.selectAllText(allElements[index - 1]);
          } else {
            this.exitStructureBefore(structure);
          }
        } else {
          // Tab: go to next limit or exit
          if (index < allElements.length - 1) {
            allElements[index + 1].focus();
            this.selectAllText(allElements[index + 1]);
          } else {
            this.exitStructure(structure, afterTextNode);
          }
        }
      }

      // Handle Escape key
      if (e.key === 'Escape') {
        e.preventDefault();
        this.exitStructure(structure, afterTextNode);
      }
    });
    
    // Handle blur
    element.addEventListener('blur', (e) => {
      setTimeout(() => {
        const focusedElement = document.activeElement;
        const isStillInStructure = structure.contains(focusedElement);
        
        if (!isStillInStructure && !focusedElement.closest('.math-limit-editable')) {
          this.exitStructure(structure, afterTextNode);
        }
      }, 50);
    });
    
    // Handle content changes
    element.addEventListener('input', (e) => {
      const text = element.textContent;
      if (element.innerHTML !== text) {
        element.textContent = text;
      }
      
      if (this.onChange) {
        this.onChange();
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
        this.selectAllText(element);
      }, 10);
    });
  }

  selectAllText(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  exitStructure(structure, afterTextNode) {
    const range = document.createRange();
    const selection = window.getSelection();
    const wrapper = structure.parentNode;
    range.setStartAfter(wrapper);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  exitStructureBefore(structure) {
    const range = document.createRange();
    const selection = window.getSelection();
    const wrapper = structure.parentNode;
    range.setStartBefore(wrapper);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  triggerChange(editorRef) {
    setTimeout(() => {
      if (this.onChange && editorRef?.current) {
        this.onChange(editorRef.current.innerHTML);
      }
    }, 50);
  }

  // FIXED: Handle fraction creation with proper focus and event handling
  createFraction(numerator, selection, editorRef) {
    if (!selection?.rangeCount || !editorRef?.current) return;

    const range = selection.getRangeAt(0);
    const currentNode = range.startContainer;
    const cursorPos = range.startOffset;
    const currentText = currentNode.textContent || '';
    const textBeforeCursor = currentText.substring(0, cursorPos);
    const textAfterCursor = currentText.substring(cursorPos);

    // Create the fraction structure with proper contenteditable setup
    const fractionElement = document.createElement('span');
    fractionElement.className = 'math-fraction';
    fractionElement.contentEditable = false; // CRITICAL: Parent not editable
    fractionElement.innerHTML = `
      <span class="fraction-numerator">
        <span class="fraction-num-editable" contenteditable="true" spellcheck="false">${numerator}</span>
      </span>
      <span class="fraction-line"></span>
      <span class="fraction-denominator">
        <span class="fraction-den-editable" contenteditable="true" spellcheck="false" data-placeholder=""></span>
      </span>
    `;

    // Create document fragment for proper insertion
    const fragment = document.createDocumentFragment();
    
    const beforeNumeratorPos = cursorPos - numerator.length;
    const beforeText = currentText.substring(0, beforeNumeratorPos);
    
    if (beforeText) {
      fragment.appendChild(document.createTextNode(beforeText));
    }
    
    fragment.appendChild(fractionElement);
    
    if (textAfterCursor) {
      fragment.appendChild(document.createTextNode(textAfterCursor));
    } else {
      // FIXED: Always add a text node after the fraction for cursor positioning
      fragment.appendChild(document.createTextNode(' '));
    }
    
    // Replace the current text node
    if (currentNode.parentNode) {
      currentNode.parentNode.replaceChild(fragment, currentNode);
    }
    
    // CRITICAL: Set up event handling BEFORE focusing
    this.setupFractionEvents(fractionElement, editorRef);
    
    // Focus on the denominator with proper delay
    setTimeout(() => {
      const denominator = fractionElement.querySelector('.fraction-den-editable');
      if (denominator) {
        denominator.focus();
        
        // FIXED: Set cursor at end instead of selecting all
        setTimeout(() => {
          const range = document.createRange();
          const selection = window.getSelection();
          range.selectNodeContents(denominator);
          range.collapse(false); // Collapse to end
          selection.removeAllRanges();
          selection.addRange(range);
        }, 10);
      }
    }, 50); // Increased delay for better reliability
    
    this.triggerChange(editorRef);
  }

  // FIXED: Improved fraction events setup with better focus handling
  setupFractionEvents(fractionElement, editorRef) {
    const numeratorInput = fractionElement.querySelector('.fraction-num-editable');
    const denominatorInput = fractionElement.querySelector('.fraction-den-editable');
    
    [numeratorInput, denominatorInput].forEach((input, index) => {
      if (!input) return;
      
      // FIXED: Ensure the element is properly focusable
      input.style.cursor = 'text';
      input.style.minWidth = '1em';
      input.style.minHeight = '1em';
      
      // FIXED: Add a non-breaking space if empty to ensure cursor visibility
      if (!input.textContent.trim()) {
        input.innerHTML = '&nbsp;';
        // Clear it on first focus
        input.addEventListener('focus', function clearInitialContent() {
          if (input.innerHTML === '&nbsp;') {
            input.innerHTML = '';
          }
          input.removeEventListener('focus', clearInitialContent);
        });
      }
      
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
            this.setupFractionEvents(nestedFraction, editorRef);
            
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
            if (this.onChange) {
              this.onChange();
            }
            
            return;
          }
        }
        
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          
          if (index === 0 && denominatorInput) {
            // Move from numerator to denominator
            denominatorInput.focus();
            setTimeout(() => {
              const range = document.createRange();
              range.selectNodeContents(denominatorInput);
              range.collapse(false); // Position at end
              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(range);
            }, 10);
          } else {
            // Exit the fraction
            this.exitFraction(fractionElement, editorRef);
          }
        }
        
        if (e.key === 'Escape') {
          e.preventDefault();
          this.exitFraction(fractionElement, editorRef);
        }
        
        // FIXED: Handle right arrow key to exit fraction when at end of denominator
        if (e.key === 'ArrowRight' && index === 1) { // Only for denominator
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const isAtEnd = range.startOffset >= (range.startContainer.textContent?.length || 0);
            
            if (isAtEnd) {
              e.preventDefault();
              this.exitFraction(fractionElement, editorRef);
            }
          }
        }
      });
      
      // FIXED: Better content change handling
      input.addEventListener('input', (e) => {
        // Handle paste and ensure plain text only
        const text = input.textContent;
        
        // Don't interfere with normal typing
        if (this.onChange) {
          setTimeout(() => {
            this.onChange();
          }, 10);
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
      
      // FIXED: Better focus handling - don't select all text immediately
      input.addEventListener('focus', (e) => {
        // Only select all if the field is empty or has placeholder content
        if (!input.textContent.trim() || input.innerHTML === '&nbsp;') {
          setTimeout(() => {
            if (input.innerHTML === '&nbsp;') {
              input.innerHTML = '';
            }
            const range = document.createRange();
            range.selectNodeContents(input);
            range.collapse(false); // Position at end
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
          }, 10);
        }
      });
      
      // FIXED: Handle blur to properly exit fraction when clicking outside
      input.addEventListener('blur', (e) => {
        // Small delay to check if focus moved to another fraction input
        setTimeout(() => {
          const focusedElement = document.activeElement;
          const isStillInFraction = fractionElement.contains(focusedElement);
          
          if (!isStillInFraction && !focusedElement.closest('.fraction-num-editable, .fraction-den-editable')) {
            // Focus moved completely outside all fractions
            // Ensure there's a text node after the fraction for future cursor positioning
            this.ensureTextNodeAfterFraction(fractionElement);
          }
        }, 50);
      });
    });
  }

  // FIXED: Improved fraction exit with better cursor positioning
  exitFraction(fractionElement, editorRef) {
    // Find or create a text node after the fraction
    let targetNode = this.findOrCreateTextNodeAfter(fractionElement);
    
    // Position cursor at the beginning of the text node
    setTimeout(() => {
      if (targetNode && editorRef?.current) {
        editorRef.current.focus();
        
        const range = document.createRange();
        const selection = window.getSelection();
        range.setStart(targetNode, 0);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }, 10);
  }

  // FIXED: Helper method to ensure text node exists after fraction
  ensureTextNodeAfterFraction(fractionElement) {
    return this.findOrCreateTextNodeAfter(fractionElement);
  }

  // FIXED: Utility method to find or create text node after an element
  findOrCreateTextNodeAfter(element) {
    let targetNode = null;
    let currentElement = element;
    
    // Walk up the DOM tree to find a suitable text node
    while (currentElement && currentElement !== document.body) {
      let nextSibling = currentElement.nextSibling;
      
      while (nextSibling) {
        if (nextSibling.nodeType === Node.TEXT_NODE && nextSibling.textContent.length > 0) {
          targetNode = nextSibling;
          break;
        }
        nextSibling = nextSibling.nextSibling;
      }
      
      if (targetNode) break;
      currentElement = currentElement.parentNode;
    }
    
    // If no text node found, create one
    if (!targetNode) {
      const newTextNode = document.createTextNode(' ');
      
      let insertionPoint = element;
      while (insertionPoint.parentNode && insertionPoint.parentNode.contentEditable !== 'true') {
        insertionPoint = insertionPoint.parentNode;
      }
      
      if (insertionPoint.nextSibling) {
        insertionPoint.parentNode.insertBefore(newTextNode, insertionPoint.nextSibling);
      } else {
        insertionPoint.parentNode.appendChild(newTextNode);
      }
      
      targetNode = newTextNode;
    }
    
    return targetNode;
  }
}