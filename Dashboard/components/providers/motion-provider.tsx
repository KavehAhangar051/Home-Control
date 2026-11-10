'use client';

import React from 'react';
import { LazyMotion, domMax } from 'motion/react';

interface MotionProviderProps {
  children: React.ReactNode;
}

/**
 * Global LazyMotion provider with domMax feature set to enable full motion primitives (m.*),
 * including layout projection (layout / layoutId), spring physics, and gesture animations.
 */
export function MotionProvider({ children }: MotionProviderProps) {
  return (
    <LazyMotion features={domMax} strict={false}>
      {children}
    </LazyMotion>
  );
}
