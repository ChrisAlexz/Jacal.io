// src/app/not-found.jsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: '#fff' }}>
      <h1 style={{ fontSize: '2rem', margin: 0 }}>404 — Page not found</h1>
      <p style={{ color: '#a1a1aa' }}>That page doesn’t exist.</p>
      <Link href="/" style={{ color: '#4facfe' }}>Back to home</Link>
    </div>
  );
}
