// src/components/MathSymbolsDropdown.jsx
import React, { useState, useRef, useEffect } from 'react';

const MathSymbolsDropdown = ({ 
  onInsertSymbol, 
  disabled = false 
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSymbolClick = (symbol) => {
    onInsertSymbol(symbol);
    setShowDropdown(false);
  };

  return (
    <div className="math-symbols-container" ref={dropdownRef}>
      <button
        type="button"
        className={`toolbar-btn math-btn ${showDropdown ? 'active' : ''}`}
        onClick={() => setShowDropdown(!showDropdown)}
        title="Insert Math Symbol"
        disabled={disabled}
      >
        𝑓(𝑥)
      </button>
      
      {showDropdown && (
        <div className="math-dropdown">
          <div className="math-dropdown-header">
            <span>Insert Math Symbol</span>
            <button
              type="button"
              className="close-dropdown-btn"
              onClick={() => setShowDropdown(false)}
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
                      onClick={() => handleSymbolClick(item.symbol)}
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
  );
};

export default MathSymbolsDropdown;