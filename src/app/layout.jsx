import { ClerkProvider } from "@clerk/nextjs";
// src/app/layout.jsx - Next.js App Router root layout (replaces public/index.html)
import 'bootstrap/dist/css/bootstrap.min.css';
import '../index.css';
import Providers from './providers';

export const metadata = {
  title: 'Jacal.io',
  description:
    'Master any subject with scientifically-proven spaced repetition. Built for students, professionals, and lifelong learners.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Arsenal:ital,wght@0,400;0,700;1,400;1,700&family=Orbitron:wght@400..900&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: '#4facfe',
              colorBackground: '#0a0a0a',
              colorInputBackground: '#161616',
              colorInputText: '#ffffff',
              colorText: '#ffffff',
              colorTextSecondary: '#a1a1aa',
              colorNeutral: '#ffffff',
              borderRadius: '0.5rem',
              fontFamily: "'Roboto', -apple-system, BlinkMacSystemFont, sans-serif",
            },
            elements: {
              card: { boxShadow: '0 20px 60px rgba(0,0,0,0.6)' },
            },
          }}
        >
          <Providers>{children}</Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}