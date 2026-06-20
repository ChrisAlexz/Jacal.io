// src/components/Wordmark.jsx
// Lowercase, space-stripped, monospace wordmark treatment.
// "Jacal Learning" -> "jacallearning"
import React from 'react';

const MONO_STACK =
  "'Geist Mono', 'SF Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

export default function Wordmark({ name = 'Jacal', href = '#top', className = '' }) {
  const text = name.toLowerCase().replace(/\s+/g, '');
  return (
    <a
      href={href}
      className={`wordmark ${className}`}
      style={{
        fontFamily: MONO_STACK,
        fontSize: '0.875rem',
        fontWeight: 500,
        letterSpacing: '-0.02em',
        textDecoration: 'none',
        color: 'var(--color-text-secondary, #a1a1aa)',
        transition: 'color 0.15s ease',
      }}
    >
      {text}
    </a>
  );
}
