'use client';

/**
 * @file components/ui/code-block.tsx
 * @description LTR isolated code block with syntax highlighting and copy functionality.
 */

import React, { useCallback, useMemo, useContext } from 'react';
import { useStudioUI } from '@/store/MarkdownContext';
import { highlightCode } from '@/utils/syntaxHighlighter';
import { hasPersianText, normalizeDigitsToAscii } from '@/utils/persianizer';
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

/** Hybrid font stack guaranteeing Kode Mono for Latin/digits & Dana / Vazirmatn for Persian characters */
const HYBRID_CODE_FONT =
  "'Kode Mono', 'Dana', 'Vazirmatn', var(--font-vazir-local), monospace";

const LANGUAGE_CLASS_REGEX = /language-([a-zA-Z0-9_+#.-]+)/;
const TRAILING_NEWLINE_REGEX = /\n$/;

function extractLanguageFromClassName(className?: string): string {
  const match = LANGUAGE_CLASS_REGEX.exec(className || '');

  return match ? match[1] : '';
}

/**
 * Recursively extracts plain text from React children in case upstream plugins wrap text nodes.
 */
function extractPlainText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractPlainText).join('');
  if (React.isValidElement(node)) {
    const elem = node as React.ReactElement<{ children?: React.ReactNode }>;
    return extractPlainText(elem.props?.children);
  }
  return '';
}

function InlineCodePill({
  isDark,
  containsPersian,
  rawText,
  className,
  style,
  ...props
}: CodeBlockProps & {
  isDark: boolean;
  containsPersian: boolean;
  rawText: string;
}): React.JSX.Element {
  const themeClass = isDark
    ? 'bg-zinc-900/90 text-zinc-200 border-zinc-800/90'
    : 'bg-zinc-100/90 text-zinc-800 border-zinc-200/90';

  const inlineClass = `text-[0.86em] px-1.5 py-0.5 mx-0.5 rounded-md border font-normal tracking-normal transition-colors inline align-baseline ${themeClass} ${className || ''}`.trim();

  return (
    <code
      className={inlineClass}
      dir={containsPersian ? 'rtl' : 'ltr'}
      style={{
        fontFamily: HYBRID_CODE_FONT,
        unicodeBidi: 'isolate',
        ...style,
      }}
      {...props}
    >
      {containsPersian ? renderHybridChildren(rawText, 'persian') : normalizeDigitsToAscii(rawText)}
    </code>
  );
}

/**
 * VSCode-grade Code Block Component with line numbers gutter, semantic syntax highlighting,
 * and BiDi-safe hybrid typography for markdown previews.
 *
 * @param {CodeBlockProps} props - Code component properties.
 * @returns {React.JSX.Element} Rendered VSCode code block or inline code token.
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
  const rawCode = useMemo(
    () => extractPlainText(children).replace(TRAILING_NEWLINE_REGEX, ''),
    [children]
  );
  const isInlineCode = inline ?? (!isInsidePre && !specifiedLang && !rawCode.includes('\n'));
  const containsPersian = useMemo(
    () => (isInlineCode ? hasPersianText(rawCode) : false),
    [rawCode, isInlineCode]
  );

  const highlighted = useMemo(() => {
    if (isInlineCode || !rawCode) {
      return { html: '', language: specifiedLang || 'text', dir: 'ltr' as const, lineCount: 1 };
    }

    const res = highlightCode(rawCode, specifiedLang);
    let lines = 1;
    for (let i = 0; i < rawCode.length; i++) {
      if (rawCode.charCodeAt(i) === 10) lines++;
    }

    return { ...res, lineCount: lines };
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
        rawText={rawCode}
        className={className}
        {...props}
      />
    );
  }

  const showLineNumbers = highlighted.language !== 'text' && highlighted.dir === 'ltr';

  const containerThemeClass = isDark
    ? 'bg-zinc-950/90 border-zinc-800/80 shadow-black/40'
    : 'bg-white/95 border-zinc-200/90 shadow-zinc-200/50';

  const preThemeClass = isDark
    ? '!bg-transparent !text-zinc-200'
    : '!bg-transparent !text-zinc-800';

  const gutterColorClass = isDark
    ? 'text-zinc-600 border-zinc-800/80'
    : 'text-zinc-400 border-zinc-200/80';

  return (
    <div
      className={`my-5 rounded-xl border overflow-hidden transition-colors duration-200 shadow-lg ${containerThemeClass}`}
      dir="ltr"
    >
      <CodeBlockHeader
        languageName={specifiedLang || highlighted.language}
        isDark={isDark}
        isPersian={language === 'fa'}
        copied={copied}
        onCopy={handleCopy}
      />

      {/* VSCode Editor Viewport */}
      <pre
        className={`py-3.5 px-4 overflow-x-auto overflow-y-hidden text-[13.5px] leading-[1.68] !rounded-none !border-0 !m-0 !shadow-none code-scrollbar ${
          highlighted.dir === 'rtl' ? 'text-right' : 'text-left'
        } ${preThemeClass}`}
        dir={highlighted.dir}
        style={{ fontFamily: HYBRID_CODE_FONT }}
      >
        {showLineNumbers ? (
          <div className="flex items-start min-w-max">
            <span
              aria-hidden="true"
              className={`select-none pr-3.5 mr-3.5 border-r text-right font-mono tabular-nums shrink-0 leading-[1.68] ${gutterColorClass}`}
            >
              {Array.from({ length: highlighted.lineCount }, (_, idx) => (
                <span key={idx} className="block">
                  {idx + 1}
                </span>
              ))}
            </span>
            <code
              className="hljs !bg-transparent !border-none !p-0 block flex-1 select-text leading-[1.68]"
              style={{ fontFamily: HYBRID_CODE_FONT }}
              dangerouslySetInnerHTML={{ __html: highlighted.html }}
            />
          </div>
        ) : (
          <code
            className="hljs !bg-transparent !border-none !p-0 block select-text leading-[1.75]"
            style={{ fontFamily: HYBRID_CODE_FONT }}
            dangerouslySetInnerHTML={{ __html: highlighted.html }}
          />
        )}
      </pre>
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';
