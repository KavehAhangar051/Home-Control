'use client';

/**
 * @file components/views/preview-markdown-components.tsx
 * @description Custom ReactMarkdown element mappings, remark/rehype plugins, and memoized renderer.
 */

import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import type { PluggableList } from 'unified';
import { CodeBlock, CodePre } from '@/components/ui/code-block';
import {
  MarkdownTable,
  MarkdownTableHead,
  MarkdownTableBody,
  MarkdownTableRow,
  MarkdownTableHeaderCell,
  MarkdownTableCell,
} from '@/components/ui/markdown-table';
import { renderHybridChildren } from '@/utils/typographySegmenter';
import { MathDisplayBlock } from '@/components/ui/math-block';

const remarkPlugins: PluggableList = [remarkGfm, remarkMath];
const rehypePlugins: PluggableList = [[rehypeKatex, { strict: false }], rehypeRaw];

const markdownComponents: Components = {
  code: CodeBlock,
  pre: CodePre,
  span: ({ className, children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
    const cls = className ?? '';

    if (cls.includes('katex-display')) {
      return (
        <MathDisplayBlock className={cls} {...props}>
          {children}
        </MathDisplayBlock>
      );
    }

    if (cls === 'katex') {
      return (
        <span className={`${cls} katex-inline-wrapper`} dir="ltr" {...props}>
          {children}
        </span>
      );
    }

    return (
      <span className={className} {...props}>
        {children}
      </span>
    );
  },
  p: ({ children }: { children?: React.ReactNode }) => <p>{renderHybridChildren(children, 'persian')}</p>,
  h1: ({ children }: { children?: React.ReactNode }) => <h1>{renderHybridChildren(children, 'persian')}</h1>,
  h2: ({ children }: { children?: React.ReactNode }) => <h2>{renderHybridChildren(children, 'persian')}</h2>,
  h3: ({ children }: { children?: React.ReactNode }) => <h3>{renderHybridChildren(children, 'persian')}</h3>,
  h4: ({ children }: { children?: React.ReactNode }) => <h4>{renderHybridChildren(children, 'persian')}</h4>,
  h5: ({ children }: { children?: React.ReactNode }) => <h5>{renderHybridChildren(children, 'persian')}</h5>,
  h6: ({ children }: { children?: React.ReactNode }) => <h6>{renderHybridChildren(children, 'persian')}</h6>,
  li: ({ children }: { children?: React.ReactNode }) => <li>{renderHybridChildren(children, 'persian')}</li>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote>{renderHybridChildren(children, 'persian')}</blockquote>
  ),
  kbd: ({ children }: { children?: React.ReactNode }) => (
    <kbd className="px-1.5 py-0.5 text-xs font-mono rounded-sm border border-zinc-200 bg-zinc-100 text-zinc-900 dark:border-zinc-700/80 dark:bg-zinc-900 dark:text-zinc-200 inline-block align-middle mx-1 font-semibold transition-colors">
      {children}
    </kbd>
  ),
  a: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      {...props}
      className="text-emerald-700 dark:text-emerald-400 underline underline-offset-4 decoration-from-font hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
    >
      {renderHybridChildren(children, 'persian')}
    </a>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong>{renderHybridChildren(children, 'persian')}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => <em>{renderHybridChildren(children, 'persian')}</em>,
  del: ({ children }: { children?: React.ReactNode }) => <del className="line-through opacity-70">{children}</del>,
  hr: () => <hr className="my-6 border-t border-zinc-200 dark:border-zinc-800" />,
  img: ({ src, alt, width, height, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt ?? ''}
      width={width ?? 900}
      height={height ?? 260}
      {...props}
      className="rounded-xl outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10 my-4 max-w-full h-auto shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
      loading="lazy"
      decoding="async"
    />
  ),
  input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      {...props}
      aria-label={props['aria-label'] ?? 'Markdown task item'}
      className="cursor-pointer align-middle accent-emerald-500"
    />
  ),
  table: MarkdownTable,
  thead: MarkdownTableHead,
  tbody: MarkdownTableBody,
  tr: MarkdownTableRow,
  th: MarkdownTableHeaderCell,
  td: MarkdownTableCell,
};

export interface MemoizedMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Memoized Markdown renderer isolating AST parsing and custom element mapping from parent UI updates.
 *
 * @param {MemoizedMarkdownProps} props - Markdown string and container className.
 * @returns {React.JSX.Element} Rendered RTL Markdown tree.
 */
export const MemoizedMarkdown = React.memo(function MemoizedMarkdown({
  content,
  className,
}: MemoizedMarkdownProps): React.JSX.Element {
  return (
    <div className={className} dir="rtl">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

MemoizedMarkdown.displayName = 'MemoizedMarkdown';
