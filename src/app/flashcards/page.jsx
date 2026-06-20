'use client';
import dynamic from 'next/dynamic';

const Flashcard = dynamic(() => import('../../components/Flashcard'), { ssr: false });

export default function Page() {
  return <Flashcard />;
}
