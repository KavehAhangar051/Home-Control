'use client';

/**
 * @file components/views/editor-active-line.tsx
 * @description Background highlight overlay indicating the cursor's active line in the markdown editor.
 */

import React from 'react';

export interface EditorActiveLineProps {
  isVisible: boolean;
  isDark: boolean;
  top: number;
  height: number;
}

/**
 * Render an active line indicator positioned behind the textarea content.
 *
 * @param {EditorActiveLineProps} props - Component properties.
 * @returns {React.JSX.Element | null} Highlight element or null when hidden.
 */
export const EditorActiveLine: React.FC<EditorActiveLineProps> = React.memo(({
  isVisible,
  isDark,
  top,
  height,
}) => {
  if (!isVisible) return null;

  return (
    <div
      id="editor-active-line-highlight"
      aria-hidden="true"
      className={`absolute top-0 inset-x-0 pointer-events-none will-change-transform transform-gpu rounded-sm z-0 border-y border-s-2 ${
        isDark
          ? 'bg-zinc-800/35 border-y-zinc-700/20 border-s-emerald-500'
          : 'bg-zinc-200/40 border-y-zinc-300/40 border-s-emerald-600'
      }`}
      style={{
        transform: `translate3d(0, ${top}px, 0)`,
        height: `${height}px`,
      }}
    />
  );
});

EditorActiveLine.displayName = 'EditorActiveLine';
