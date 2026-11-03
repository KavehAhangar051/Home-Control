'use client';

/**
 * @file components/showcase/studio-showcase.tsx
 * @description Master AIDA showcase container implementing award-winning design engineering.
 */

import React from 'react';
import { useMarkdownContext } from '@/store/MarkdownContext';
import { ShowcaseHero } from '@/components/showcase/showcase-hero';
import { ShowcaseMarquee } from '@/components/showcase/showcase-marquee';
import { ShowcaseBento } from '@/components/showcase/showcase-bento';
import { ShowcaseAccordion } from '@/components/showcase/showcase-accordion';
import { ShowcaseCta } from '@/components/showcase/showcase-cta';

interface StudioShowcaseProps {
  onClose?: () => void;
}

export function StudioShowcase({ onClose }: StudioShowcaseProps): React.JSX.Element {
  const { theme, language, loadSample } = useMarkdownContext();
  const isDark = theme === 'dark';
  const isFa = language === 'fa';

  const handleLaunchEditor = () => {
    if (onClose) {
      onClose();
    }
  };

  const handleLoadSample = () => {
    loadSample();
    if (onClose) {
      onClose();
    }
  };

  return (
    <main
      id="studio-showcase-flow"
      className={`overflow-x-hidden w-full max-w-full transition-colors duration-300 ${
        isDark ? 'bg-black text-zinc-100' : 'bg-slate-100/70 text-zinc-900'
      } ${isFa ? 'font-vazir' : 'font-sans'}`}
      dir={isFa ? 'rtl' : 'ltr'}
    >
      {/* Attention: Cinematic Center Hero */}
      <ShowcaseHero
        isDark={isDark}
        isFa={isFa}
        onLaunchEditor={handleLaunchEditor}
        onLoadSample={handleLoadSample}
      />

      {/* Infinite Scrolling Capability Marquee */}
      <ShowcaseMarquee isDark={isDark} isFa={isFa} />

      {/* Interest: Gapless 4-Column Bento Grid */}
      <ShowcaseBento isDark={isDark} isFa={isFa} />

      {/* Desire: Interactive Horizontal Accordion */}
      <ShowcaseAccordion isDark={isDark} isFa={isFa} />

      {/* Action: Massive CTA and Footer */}
      <ShowcaseCta
        isDark={isDark}
        isFa={isFa}
        onLaunchEditor={handleLaunchEditor}
        onLoadSample={handleLoadSample}
      />
    </main>
  );
}
