'use client';
import { SignIn } from '@clerk/nextjs';
import dynamic from 'next/dynamic';

// Same scroll-driven particle city used on the landing page (client-only).
const ParticleCityBackground = dynamic(
  () => import('../../../components/ParticleCityBackground'),
  { ssr: false }
);

export default function SignInPage() {
  return (
    <>
      <ParticleCityBackground />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          minHeight: '80vh',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem 1rem',
        }}
      >
        <SignIn />
      </div>
    </>
  );
}
