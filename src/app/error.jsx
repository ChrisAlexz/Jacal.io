'use client';
// src/app/error.jsx - route-level error boundary
import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: '#fff' }}>
      <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Something went wrong</h1>
      <button
        onClick={() => reset()}
        style={{ padding: '0.6rem 1.2rem', borderRadius: 8, border: 'none', background: '#4facfe', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
      >
        Try again
      </button>
    </div>
  );
}
