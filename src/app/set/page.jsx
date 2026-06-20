'use client';
import dynamic from 'next/dynamic';

const Set = dynamic(() => import('../../components/Set'), { ssr: false });

export default function Page() {
  return <Set />;
}
