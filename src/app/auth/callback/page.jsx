'use client';
import dynamic from 'next/dynamic';

const AuthCallback = dynamic(
  () => import('../../../components/authentication/AuthCallback'),
  { ssr: false }
);

export default function Page() {
  return <AuthCallback />;
}
