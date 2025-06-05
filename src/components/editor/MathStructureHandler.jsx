// src/components/editor/MathStructureHandler.jsx - ROBUST VERSION THAT PREVENTS DISAPPEARING
export class MathStructureHandler {
  constructor(onChange) {
    this.onChange = onChange;
    this.isTypingInMath = false; // Flag to prevent updates while typing
    this.mathUpdateTimeout = null;
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
      try {
        range.setStartAfter(elementToInsert);
        range.setEndAfter(elementToInsert);
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (error) {
        console.warn('Cursor positioning error:', error);
      }
      
      this.safeOnChange(editorRef);
      return;
    }

    // Insert the math structure directly without wrapper complications
    range.insertNode(elementToInsert);
    this.setupMathStructureEvents(elementToInsert, editorRef);
    
    // Position cursor in the first editable field
    setTimeout(() => {
      const firstEditable = elementToInsert.querySelector('.math-limit-editable');
      if (firstEditable) {
        firstEditable.focus();
        this.selectAllText(firstEditable);
      }
    }, 50);
    
    this.safeOnChange(editorRef);
  }

  createIntegralStructure() {
    const element = document.createElement('span');
    element.className = 'math-structure integral-structure';
    element.contentEditable = false;
    element.setAttribute('data-math-type', 'integral');
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
    element.setAttribute('data-math-type', 'summation');
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
    element.setAttribute('data-math-type', 'product');
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

  setupMathStructureEvents(structure, editorRef) {
    const editableElements = structure.querySelectorAll('.math-limit-editable');
    
    editableElements.forEach((element, index) => {
      this.setupLimitElement(element, index, editableElements, structure, editorRef);
    });
  }

  setupLimitElement(element, index, allElements, structure, editorRef) {
    // Mark when we start typing to prevent external updates
    element.addEventListener('focusin', () => {
      this.isTypingInMath = true;
      console.log('Started typing in math structure');
    });

    element.addEventListener('focusout', () => {
      // Delay clearing the flag to allow for tab navigation
      setTimeout(() => {
        const focusedElement = document.activeElement;
        const isStillInMath = structure.contains(focusedElement);
        if (!isStillInMath) {
          this.isTypingInMath = false;
          console.log('Stopped typing in math structure');
          this.safeOnChange(editorRef);
        }
      }, 100);
    });

    // Handle keyboard navigation
    element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        
        if (index < allElements.length - 1) {
          allElements[index + 1].focus();
          this.selectAllText(allElements[index + 1]);
        } else {
          this.exitStructure(structure, editorRef);
        }
      }
      
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          if (index > 0) {
            allElements[index - 1].focus();
            this.selectAllText(allElements[index - 1]);
          } else {
            this.exitStructureBefore(structure, editorRef);
          }
        } else {
          if (index < allElements.length - 1) {
            allElements[index + 1].focus();
            this.selectAllText(allElements[index + 1]);
          } else {
            this.exitStructure(structure, editorRef);
          }
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        this.exitStructure(structure, editorRef);
      }
    });
    
    // Handle content changes - but don't trigger onChange while typing
    element.addEventListener('input', (e) => {
      // Keep the content as plain text
      const text = element.textContent;
      if (element.innerHTML !== text) {
        element.textContent = text;
      }
      
      // Don't trigger onChange while actively typing in math
      // It will be triggered when focus leaves the structure
    });
    
    // Prevent formatted paste
    element.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text.replace(/\s+/g, ' ').trim());
    });
    
    // Handle focus - select all text
    element.addEventListener('focus', (e) => {
      setTimeout(() => {
        this.selectAllText(element);
      }, 10);
    });
  }

  selectAllText(element) {
    try {
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (error) {
      console.warn('Text selection error:', error);
    }
  }

  exitStructure(structure, editorRef) {
    this.isTypingInMath = false;
    
    try {
      const range = document.createRange();
      const selection = window.getSelection();
      
      // Create a text node after the structure for cursor positioning
      const textNode = document.createTextNode(' ');
      
      if (structure.parentNode) {
        if (structure.nextSibling) {
          structure.parentNode.insertBefore(textNode, structure.nextSibling);
        } else {
          structure.parentNode.appendChild(textNode);
        }
        
        range.setStart(textNode, 1);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        editorRef.current.focus();
      }
    } catch (error) {
      console.warn('Error exiting structure:', error);
      if (editorRef?.current) {
        editorRef.current.focus();
      }
    }
    
    this.safeOnChange(editorRef);
  }

  exitStructureBefore(structure, editorRef) {
    this.isTypingInMath = false;
    
    try {
      const range = document.createRange();
      const selection = window.getSelection();
      
      if (structure.parentNode) {
        range.setStartBefore(structure);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        editorRef.current.focus();
      }
    } catch (error) {
      console.warn('Error exiting structure before:', error);
      if (editorRef?.current) {
        editorRef.current.focus();
      }
    }
    
    this.safeOnChange(editorRef);
  }

  // Safe onChange that respects the typing flag
  safeOnChange(editorRef) {
    if (this.isTypingInMath) {
      console.log('Skipping onChange - currently typing in math structure');
      return;
    }
    
    clearTimeout(this.mathUpdateTimeout);
    this.mathUpdateTimeout = setTimeout(() => {
      if (this.onChange && editorRef?.current && !this.isTypingInMath) {
        console.log('Triggering onChange for math structure');
        this.onChange(editorRef.current.innerHTML);
      }
    }, 200);
  }

  // Check if currently typing in math to prevent external updates
  isCurrentlyTypingInMath() {
    return this.isTypingInMath;
  }

  // Handle fraction creation
  createFraction(numerator, selection, editorRef) {
    if (!selection?.rangeCount || !editorRef?.current) return;

    const range = selection.getRangeAt(0);
    const currentNode = range.startContainer;
    const cursorPos = range.startOffset;
    const currentText = currentNode.textContent || '';
    const textBeforeCursor = currentText.substring(0, cursorPos);
    const textAfterCursor = currentText.substring(cursorPos);

    const fractionElement = document.createElement('span');
    fractionElement.className = 'math-fraction';
    fractionElement.contentEditable = false;
    fractionElement.setAttribute('data-math-type', 'fraction');
    fractionElement.innerHTML = `
      <span class="fraction-numerator">
        <span class="fraction-num-editable" contenteditable="true" spellcheck="false">${numerator}</span>
      </span>
      <span class="fraction-line"></span>
      <span class="fraction-denominator">
        <span class="fraction-den-editable" contenteditable="true" spellcheck="false" data-placeholder=""></span>
      </span>
    `;

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
      fragment.appendChild(document.createTextNode(' '));
    }
    
    if (currentNode.parentNode) {
      currentNode.parentNode.replaceChild(fragment, currentNode);
    }
    
    this.setupFractionEvents(fractionElement, editorRef);
    
    setTimeout(() => {
      const denominator = fractionElement.querySelector('.fraction-den-editable');
      if (denominator) {
        denominator.focus();
        this.selectAllText(denominator);
      }
    }, 50);
    
    this.safeOnChange(editorRef);
  }

  setupFractionEvents(fractionElement, editorRef) {
    const numeratorInput = fractionElement.querySelector('.fraction-num-editable');
    const denominatorInput = fractionElement.querySelector('.fraction-den-editable');
    
    [numeratorInput, denominatorInput].forEach((input, index) => {
      if (!input) return;
      
      // Mark when typing in fraction
      input.addEventListener('focusin', () => {
        this.isTypingInMath = true;
      });

      input.addEventListener('focusout', () => {
        setTimeout(() => {
          const focusedElement = document.activeElement;
          const isStillInFraction = fractionElement.contains(focusedElement);
          if (!isStillInFraction) {
            this.isTypingInMath = false;
            this.safeOnChange(editorRef);
          }
        }, 100);
      });
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          
          if (index === 0 && denominatorInput) {
            denominatorInput.focus();
            this.selectAllText(denominatorInput);
          } else {
            this.exitFraction(fractionElement, editorRef);
          }
        }
        
        if (e.key === 'Escape') {
          e.preventDefault();
          this.exitFraction(fractionElement, editorRef);
        }
      });
      
      input.addEventListener('input', (e) => {
        const text = input.textContent;
        if (input.innerHTML !== text) {
          input.textContent = text;
        }
      });
      
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
        document.execCommand('insertText', false, text.replace(/\s+/g, ' ').trim());
      });
    });
  }

  exitFraction(fractionElement, editorRef) {
    this.isTypingInMath = false;
    
    try {
      const textNode = document.createTextNode(' ');
      
      if (fractionElement.parentNode) {
        if (fractionElement.nextSibling) {
          fractionElement.parentNode.insertBefore(textNode, fractionElement.nextSibling);
        } else {
          fractionElement.parentNode.appendChild(textNode);
        }
        
        const range = document.createRange();
        const selection = window.getSelection();
        range.setStart(textNode, 1);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        editorRef.current.focus();
      }
    } catch (error) {
      console.warn('Error exiting fraction:', error);
    }
    
    this.safeOnChange(editorRef);
  }
}