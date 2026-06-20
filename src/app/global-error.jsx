'use client';
// src/app/global-error.jsx - root error boundary (must render its own <html>/<body>)
export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0a0a0a', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Something went wrong</h1>
          <button
            onClick={() => reset()}
            style={{ padding: '0.6rem 1.2rem', borderRadius: 8, border: 'none', background: '#4facfe', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
