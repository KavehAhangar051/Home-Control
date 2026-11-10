'use client';

/**
 * @file app/showcase/page.tsx
 * @description Dedicated Awwwards-tier showcase route presenting the AIDA design engineering experience.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { MarkdownProvider } from '@/store/MarkdownContext';
import { Header } from '@/components/layout/header';
import { StudioShowcase } from '@/components/showcase/studio-showcase';

function ShowcaseContent(): React.JSX.Element {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col bg-noise relative">
      {/* Floating Island Navigation */}
      <div className="w-full shrink-0 origin-top overflow-hidden">
        <Header />
      </div>

      {/* AIDA Showcase Experience */}
      <StudioShowcase onClose={() => router.push('/')} />
    </div>
  );
}

export default function ShowcasePage(): React.JSX.Element {
  return (
    <MarkdownProvider>
      <ShowcaseContent />
    </MarkdownProvider>
  );
}
