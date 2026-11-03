'use client';

/**
 * @file components/ui/dock-label.tsx
 * @description Animated tooltip label and icon wrappers for dock items.
 */

import React, { useEffect, useState } from 'react';
import { m, MotionValue, AnimatePresence } from 'motion/react';
import { useStudioUI } from '@/store/MarkdownContext';

export interface DockLabelProps {
  className?: string;
  children: React.ReactNode;
  isHovered?: MotionValue<number>;
}

export interface DockIconProps {
  className?: string;
  children: React.ReactNode;
  isHovered?: MotionValue<number>;
}

/**
 * DockLabel component providing an animated tooltip for dock items.
 */
export function DockLabel({
  children,
  className = '',
  isHovered,
}: DockLabelProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { theme } = useStudioUI();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!isHovered) return;

    const unsubscribe = isHovered.on('change', (latest) => {
      setIsVisible(latest === 1);
    });

    return () => unsubscribe();
  }, [isHovered]);

  return (
    <AnimatePresence>
      {isVisible && (
        <m.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: -10 }}
          exit={{ opacity: 0, y: 0 }}
          transition={{ duration: 0.15 }}
          className={`absolute -top-8 left-1/2 pointer-events-none z-50 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-vazir shadow-xl backdrop-blur-md select-none ${
            isDark
              ? 'border-white/10 bg-zinc-900/95 text-zinc-100'
              : 'border-zinc-200 bg-white/95 text-zinc-900 shadow-zinc-300/60'
          } ${className}`}
          role="tooltip"
          style={{ x: '-50%' }}
        >
          {children}
        </m.div>
      )}
    </AnimatePresence>
  );
}

/**
 * DockIcon component wrapping and centering the item's icon.
 */
export function DockIcon({ children, className = '' }: DockIconProps) {
  return (
    <div
      className={`flex items-center justify-center transition-colors ${className}`}
    >
      {children}
    </div>
  );
}
