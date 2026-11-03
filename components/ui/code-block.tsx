'use client';

/**
 * @file components/ui/code-block.tsx
 * @description LTR isolated code block with syntax highlighting and copy functionality.
 */

import React, { useCallback, useMemo, useContext } from 'react';
import { useStudioUI } from '@/store/MarkdownContext';
import { highlightCode } from '@/utils/syntaxHighlighter';
import { hasPersianText } from '@/utils/persianizer';
import { CodeBlockHeader } from '@/components/ui/code-block-header';
import { useClipboard } from '@/hooks/useClipboard';
import { CLIPBOARD_RESET_DURATION_MS } from '@/constants/domain';
import { renderHybridChildren } from '@/utils/typographySegmenter';

/** Internal context to communicate between parent <pre> and child <code> */
const PreContext = React.createContext<boolean>(false);

/**
 * Wrapper component for markdown `<pre>` blocks to inform child `CodeBlock` instances.
 */
export function CodePre({ children }: { children?: React.ReactNode }): React.JSX.Element {
  return <PreContext.Provider value={true}>{children}</PreContext.Provider>;
}

interface CodeBlockProps extends React.HTMLAttributes<HTMLElement> {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/** Hybrid code font stack guaranteeing Kode Mono for Latin & Dana / Vazirmatn for Persian characters */
const HYBRID_CODE_FONT =
  "'Kode Mono', 'Dana', 'Vazirmatn', var(--font-vazir-local), monospace";

const LANGUAGE_CLASS_REGEX = /language-([a-zA-Z0-9_+#.-]+)/;
const TRAILING_NEWLINE_REGEX = /\n$/;

function extractLanguageFromClassName(className?: string): string {
  const match = LANGUAGE_CLASS_REGEX.exec(className || '');

  return match ? match[1] : '';
}

function InlineCodePill({
  isDark,
  containsPersian,
  className,
  children,
  style,
  ...props
}: CodeBlockProps & { isDark: boolean; containsPersian: boolean }): React.JSX.Element {
  const themeClass = isDark
    ? 'bg-zinc-800/90 text-emerald-400 border-zinc-700/70'
    : 'bg-emerald-50 text-emerald-800 border-emerald-200/80';

  const inlineClass = `text-[0.875em] px-1.5 py-0.5 rounded-md border font-normal transition-colors inline align-baseline ${themeClass} ${className || ''}`.trim();

  return (
    <code
      className={inlineClass}
      dir="auto"
      style={{
        fontFamily: HYBRID_CODE_FONT,
        unicodeBidi: 'isolate',
        ...style,
      }}
      {...props}
    >
      {containsPersian ? renderHybridChildren(children, 'persian') : children}
    </code>
  );
}

/**
 * Code Block Component with full syntax highlighting support for markdown previews.
 *
 * @param {CodeBlockProps} props - Code component properties.
 * @returns {React.JSX.Element} Rendered syntax-highlighted code block or inline code pill.
 */
export const CodeBlock = React.memo(function CodeBlock({
  inline,
  className,
  children,
  ...props
}: CodeBlockProps): React.JSX.Element {
  const { theme, language, showToast } = useStudioUI();
  const isDark = theme === 'dark';
  const { copied, copyToClipboard } = useClipboard(CLIPBOARD_RESET_DURATION_MS);
  const isInsidePre = useContext(PreContext);

  const specifiedLang = extractLanguageFromClassName(className);
  const rawCode = String(children ?? '').replace(TRAILING_NEWLINE_REGEX, '');
  const isInlineCode = inline ?? (!isInsidePre && !specifiedLang && !rawCode.includes('\n'));
  const containsPersian = useMemo(
    () => (isInlineCode ? hasPersianText(rawCode) : false),
    [rawCode, isInlineCode]
  );

  const highlighted = useMemo(() => {
    if (isInlineCode || !rawCode) {
      return { html: '', language: specifiedLang || 'text', dir: 'ltr' as const };
    }

    return highlightCode(rawCode, specifiedLang);
  }, [rawCode, specifiedLang, isInlineCode]);

  const handleCopy = useCallback(() => {
    if (!rawCode) return;
    copyToClipboard(rawCode);
    showToast(language === 'fa' ? 'کد در کلیپ‌بورد کپی شد' : 'Code copied to clipboard', 'success');
  }, [rawCode, copyToClipboard, showToast, language]);

  if (isInlineCode) {
    return (
      <InlineCodePill
        isDark={isDark}
        containsPersian={containsPersian}
        className={className}
        {...props}
      >
        {children}
      </InlineCodePill>
    );
  }

  const containerThemeClass = isDark
    ? 'bg-zinc-950/95 border-zinc-800/90 shadow-[0_2px_8px_rgba(0,0,0,0.35)]'
    : 'bg-white border-zinc-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)]';

  const preThemeClass = isDark
    ? '!bg-zinc-950 !text-zinc-100'
    : '!bg-slate-50 !text-zinc-900';

  return (
    <div
      className={`my-4 rounded-xl border overflow-hidden transition-colors ${containerThemeClass}`}
      dir="ltr"
    >
      <CodeBlockHeader
        languageName={highlighted.language}
        isDark={isDark}
        isPersian={language === 'fa'}
        copied={copied}
        onCopy={handleCopy}
      />

      {/* Highlighted Code Container */}
      <pre
        className={`p-4 overflow-x-auto text-[13px] leading-relaxed !rounded-none !border-0 !m-0 !shadow-none text-start ${preThemeClass}`}
        dir={highlighted.dir}
        style={{ fontFamily: HYBRID_CODE_FONT }}
      >
        <code
          className={`hljs !bg-transparent !border-none !p-0 block select-text ${
            isDark ? '!text-zinc-100' : '!text-zinc-900'
          }`}
          style={{ fontFamily: HYBRID_CODE_FONT }}
          dangerouslySetInnerHTML={{ __html: highlighted.html }}
        />
      </pre>
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';
