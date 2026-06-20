'use client';
import dynamic from 'next/dynamic';

const FlashcardStudyPage = dynamic(
  () => import('../../../components/FlashcardStudyPage'),
  { ssr: false }
);

export default function Page() {
  return <FlashcardStudyPage />;
}
