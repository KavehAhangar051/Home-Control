'use client';

/**
 * @file components/ui/code-block-header.tsx
 * @description Header bar for code blocks showing language badge and copy action button.
 */

import React from 'react';
import { m, useReducedMotion } from 'motion/react';
import { Copy, Check } from 'lucide-react';
import { SPRING_PRESS, EASE_OUT } from '@/lib/ease';
import { ActionSwapIcon } from '@/components/motion/action-swap';
import { formatLanguageDisplayName } from '@/utils/syntaxHighlighter';

interface CodeBlockHeaderProps {
  languageName: string;
  isDark: boolean;
  isPersian: boolean;
  copied: boolean;
  onCopy: () => void;
}

function getHeaderClass(isDark: boolean): string {
  return isDark
    ? 'bg-zinc-900/90 border-zinc-800/90 text-zinc-300'
    : 'bg-zinc-50 border-zinc-200 text-zinc-950';
}

function getButtonClass(copied: boolean, isDark: boolean): string {
  if (copied) {
    return isDark
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-xs'
      : 'bg-emerald-50 text-emerald-600 border-emerald-300 shadow-xs';
  }

  if (isDark) {
    return 'bg-zinc-800/80 text-zinc-300 border-zinc-700/70 hover:bg-zinc-700 hover:text-white focus-visible:ring-offset-zinc-950';
  }

  return 'bg-white text-zinc-900 border-zinc-300 hover:bg-zinc-50 hover:text-black shadow-xs focus-visible:ring-offset-white';
}

interface CopyLabels {
  readonly title: string;
  readonly ariaLabel: string;
}

function getCopyLabels(isPersian: boolean, copied: boolean): CopyLabels {
  if (isPersian) {
    return {
      title: copied ? 'کپی شد' : 'کپی کد',
      ariaLabel: copied ? 'کد در کلیپ‌بورد کپی شد' : 'کپی کد در کلیپ‌بورد',
    };
  }

  return {
    title: copied ? 'Copied' : 'Copy code',
    ariaLabel: copied ? 'Code copied to clipboard' : 'Copy code to clipboard',
  };
}

function CopyButtonContent({
  copied,
}: {
  copied: boolean;
}): React.JSX.Element {
  return (
    <ActionSwapIcon
      value={copied ? 'copied' : 'copy'}
      animation="blur"
      className="w-3.5 h-3.5"
    >
      {copied ? (
        <Check aria-hidden="true" className="w-3.5 h-3.5 text-emerald-500 stroke-[2.5]" />
      ) : (
        <Copy aria-hidden="true" className="w-3.5 h-3.5" />
      )}
    </ActionSwapIcon>
  );
}

/**
 * Code block header component with copy trigger and language tag.
 */
export function CodeBlockHeader({
  languageName,
  isDark,
  isPersian,
  copied,
  onCopy,
}: CodeBlockHeaderProps): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const { title, ariaLabel } = getCopyLabels(isPersian, copied);

  return (
    <div
      data-code-header
      className={`flex items-center justify-between px-3.5 py-1.5 border-b text-[11px] font-mono select-none ${getHeaderClass(isDark)}`}
      dir="ltr"
    >
      <div className="flex items-center gap-2.5">
        <div aria-hidden="true" className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500/90" />
          <span className={`inline-block w-2 h-2 rounded-full ${isDark ? 'bg-zinc-700' : 'bg-zinc-300'}`} />
          <span className={`inline-block w-2 h-2 rounded-full ${isDark ? 'bg-zinc-700' : 'bg-zinc-300'}`} />
        </div>
        <span
          data-code-header-lang
          className={`font-black tracking-wider text-[11px] ${
            isDark ? 'text-zinc-200' : 'text-zinc-950'
          }`}
        >
          {formatLanguageDisplayName(languageName, isPersian)}
        </span>
      </div>

      <m.button
        type="button"
        onClick={onCopy}
        whileTap={reduceMotion ? undefined : { scale: 0.96 }}
        animate={
          copied && !reduceMotion
            ? { scale: [1, 1.1, 1], transition: { duration: 0.2, ease: EASE_OUT } }
            : { scale: 1 }
        }
        transition={SPRING_PRESS}
        className={`min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg text-[11px] transition-colors cursor-pointer border touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${getButtonClass(copied, isDark)}`}
        title={title}
        aria-label={ariaLabel}
      >
        <CopyButtonContent copied={copied} />
      </m.button>
    </div>
  );
}
