// src/components/editor/MathStructureHandler.jsx - FIXED: NESTED FRACTIONS & ALIGNMENT
export class MathStructureHandler {
  constructor(onChange) {
    this.onChange = onChange;
    this.isTypingInMath = false;
    this.mathUpdateTimeout = null;
  }

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
      elementToInsert = document.createTextNode(symbol);
      range.insertNode(elementToInsert);
      
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

    range.insertNode(elementToInsert);
    this.setupMathStructureEvents(elementToInsert, editorRef);
    
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
    element.addEventListener('focusin', () => {
      this.isTypingInMath = true;
      console.log('Started typing in math structure');
    });

    element.addEventListener('focusout', () => {
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
    
    element.addEventListener('input', (e) => {
      const text = element.textContent;
      if (element.innerHTML !== text) {
        element.textContent = text;
      }
    });
    
    element.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, text.replace(/\s+/g, ' ').trim());
    });
    
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

  isCurrentlyTypingInMath() {
    return this.isTypingInMath;
  }

  // FIXED: Enhanced fraction creation with proper CSS structure
  createFraction(numerator, selection, editorRef) {
    if (!selection?.rangeCount || !editorRef?.current) return;

    const range = selection.getRangeAt(0);
    const currentNode = range.startContainer;
    const cursorPos = range.startOffset;

    // Check if we're inside an existing fraction editable area
    const parentEditableArea = currentNode.parentElement?.closest('.fraction-num-editable, .fraction-den-editable');
    
    if (parentEditableArea) {
      // NESTED FRACTION CREATION
      console.log('Creating nested fraction inside existing fraction');
      
      const currentText = parentEditableArea.textContent || '';
      const textBeforeCursor = currentText.substring(0, cursorPos);
      const textAfterCursor = currentText.substring(cursorPos);
      
      // Find the numerator for the nested fraction
      const numberMatch = textBeforeCursor.match(/([a-zA-Z0-9+\-*/.()]+)$/);
      const actualNumerator = numberMatch ? numberMatch[1] : numerator;
      
      // Create nested fraction element with FIXED simple structure
      const nestedFraction = document.createElement('span');
      nestedFraction.className = 'math-fraction nested-fraction';
      nestedFraction.contentEditable = false;
      nestedFraction.setAttribute('data-math-type', 'fraction');
      nestedFraction.innerHTML = `
        <span class="fraction-numerator">
          <span class="fraction-num-editable" contenteditable="true" spellcheck="false">${actualNumerator}</span>
        </span>
        <span class="fraction-line"></span>
        <span class="fraction-denominator">
          <span class="fraction-den-editable" contenteditable="true" spellcheck="false" data-placeholder=""></span>
        </span>
      `;

      // Replace content in the editable area
      const beforeNumeratorPos = cursorPos - actualNumerator.length;
      const beforeText = currentText.substring(0, beforeNumeratorPos);
      
      // Clear and rebuild the parent editable area content
      parentEditableArea.innerHTML = '';
      
      if (beforeText) {
        parentEditableArea.appendChild(document.createTextNode(beforeText));
      }
      
      parentEditableArea.appendChild(nestedFraction);
      
      if (textAfterCursor) {
        parentEditableArea.appendChild(document.createTextNode(textAfterCursor));
      }
      
      this.setupFractionEvents(nestedFraction, editorRef);
      
      // Focus on the denominator of the nested fraction
      setTimeout(() => {
        const denominator = nestedFraction.querySelector('.fraction-den-editable');
        if (denominator) {
          denominator.focus();
          this.selectAllText(denominator);
        }
      }, 50);
      
    } else {
      // REGULAR FRACTION CREATION IN MAIN EDITOR
      console.log('Creating regular fraction in main editor');
      
      const currentText = currentNode.textContent || '';
      const textBeforeCursor = currentText.substring(0, cursorPos);
      const textAfterCursor = currentText.substring(cursorPos);

      // Find the numerator
      const numberMatch = textBeforeCursor.match(/([a-zA-Z0-9+\-*/.()]+)$/);
      const actualNumerator = numberMatch ? numberMatch[1] : numerator;

      // Create main fraction element with FIXED simple structure
      const fractionElement = document.createElement('span');
      fractionElement.className = 'math-fraction';
      fractionElement.contentEditable = false;
      fractionElement.setAttribute('data-math-type', 'fraction');
      fractionElement.innerHTML = `
        <span class="fraction-numerator">
          <span class="fraction-num-editable" contenteditable="true" spellcheck="false">${actualNumerator}</span>
        </span>
        <span class="fraction-line"></span>
        <span class="fraction-denominator">
          <span class="fraction-den-editable" contenteditable="true" spellcheck="false" data-placeholder=""></span>
        </span>
      `;

      // Create document fragment for proper replacement
      const fragment = document.createDocumentFragment();
      
      const beforeNumeratorPos = cursorPos - actualNumerator.length;
      const beforeText = currentText.substring(0, beforeNumeratorPos);
      
      if (beforeText) {
        fragment.appendChild(document.createTextNode(beforeText));
      }
      
      fragment.appendChild(fractionElement);
      
      if (textAfterCursor) {
        fragment.appendChild(document.createTextNode(textAfterCursor));
      } else {
        // Add space after fraction for proper text flow
        fragment.appendChild(document.createTextNode(' '));
      }
      
      // Replace the current text node
      if (currentNode.parentNode) {
        currentNode.parentNode.replaceChild(fragment, currentNode);
      }
      
      this.setupFractionEvents(fractionElement, editorRef);
      
      // Focus on the denominator
      setTimeout(() => {
        const denominator = fractionElement.querySelector('.fraction-den-editable');
        if (denominator) {
          denominator.focus();
          this.selectAllText(denominator);
        }
      }, 50);
    }
    
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
      
      // Enhanced keydown handling for nested fractions
      input.addEventListener('keydown', (e) => {
        // Handle "/" key for nested fractions within fraction editables
        if (e.key === '/') {
          e.preventDefault();
          
          const currentText = input.textContent || '';
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const cursorPos = range.startOffset;
            const textBeforeCursor = currentText.substring(0, cursorPos);
            
            // Look for content before cursor to use as numerator
            const numeratorMatch = textBeforeCursor.match(/([a-zA-Z0-9+\-*/.()]+)$/);
            
            if (numeratorMatch) {
              const numerator = numeratorMatch[1];
              this.createFraction(numerator, selection, editorRef);
              return;
            }
          }
        }
        
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
      // Check if this is a nested fraction
      const isNested = fractionElement.classList.contains('nested-fraction');
      
      if (isNested) {
        // For nested fractions, position cursor after the fraction within the parent editable area
        const parentEditable = fractionElement.closest('.fraction-num-editable, .fraction-den-editable');
        if (parentEditable) {
          const range = document.createRange();
          const selection = window.getSelection();
          
          // Position cursor after the nested fraction within the parent
          range.setStartAfter(fractionElement);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          
          parentEditable.focus();
          return;
        }
      }
      
      // For regular fractions, add space and position cursor after
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