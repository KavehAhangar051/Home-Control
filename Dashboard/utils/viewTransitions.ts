/**
 * @file utils/viewTransitions.ts
 * @description Type-safe React View Transition constants, transition type resolvers,
 * and startTransition + addTransitionType execution helpers.
 */

import React, { startTransition } from 'react';
import type { ViewMode } from '@/types/ui';

/**
 * Cross-channel `<ViewTransition>` component resolving React's `<ViewTransition>` boundary
 * with a safe fragment fallback.
 */
export const StudioViewTransition: React.ComponentType<React.ViewTransitionProps> =
  React.ViewTransition ??
  (({ children }: React.ViewTransitionProps) => React.createElement(React.Fragment, null, children));

/**
 * Cross-channel `addTransitionType` function resolving React's `addTransitionType`
 * with a safe no-op fallback.
 */
export const addStudioTransitionType: (type: string) => void =
  React.addTransitionType ??
  (() => {});

/**
 * Globally unique `view-transition-name` identifiers used across RTL Markdown Studio.
 * Maintaining a single registry prevents duplicate-name collisions at runtime.
 */
export const STUDIO_VT_NAMES = {
  EDITOR_PANEL: 'studio-editor-panel',
  PREVIEW_PANEL: 'studio-preview-panel',
  FOCUS_CONTROL: 'studio-focus-control',
  DOCK_INDICATOR: 'dock-active-indicator',
  PERSISTENT_HEADER: 'studio-header',
  PERSISTENT_DOCK: 'studio-dock',
  FLOATING_TOASTER: 'studio-toaster',
  CUSTOM_CURSOR: 'studio-custom-cursor',
} as const;

export type StudioVtName = (typeof STUDIO_VT_NAMES)[keyof typeof STUDIO_VT_NAMES];

/**
 * Supported transition type tags passed to React's `addTransitionType`.
 */
export const STUDIO_TRANSITION_TYPES = [
  'default',
  'view-split',
  'view-editor',
  'view-preview',
  'focus-enter',
  'focus-exit',
  'lang-switch',
  'content-load',
  'content-clear',
] as const;

export type StudioTransitionType = (typeof STUDIO_TRANSITION_TYPES)[number];

/**
 * Supported CSS View Transition animation class names defined in `styles/view-transitions.css`.
 */
export const STUDIO_VT_ANIMATIONS = [
  'auto',
  'none',
  'vt-fade-in',
  'vt-fade-out',
  'vt-slide-up',
  'vt-slide-down',
  'vt-scale-in',
  'vt-scale-out',
  'vt-morph',
  'vt-tab-indicator',
] as const;

export type StudioVtAnimation = (typeof STUDIO_VT_ANIMATIONS)[number];

export type StudioTransitionMap = {
  default: StudioVtAnimation;
} & Partial<Record<Exclude<StudioTransitionType, 'default'>, StudioVtAnimation>>;

/**
 * Maps a target studio `ViewMode` to its corresponding transition type tag.
 *
 * @param {ViewMode} mode - Target workspace view mode ('split' | 'editor' | 'preview').
 * @returns {StudioTransitionType} Matching transition type identifier.
 */
export function resolveViewModeTransitionType(mode: ViewMode): StudioTransitionType {
  switch (mode) {
    case 'split':
      return 'view-split';
    case 'editor':
      return 'view-editor';
    case 'preview':
      return 'view-preview';
  }
}

/**
 * Executes a state update inside React's `startTransition` and tags it with one or more
 * transition types via `addTransitionType` so `<ViewTransition>` boundaries can animate contextually.
 *
 * @param {StudioTransitionType | readonly StudioTransitionType[]} types - Transition type tag(s) to attach.
 * @param {() => void} updateFn - Synchronous state update callback.
 */
export function runStudioTransition(
  types: StudioTransitionType | readonly StudioTransitionType[],
  updateFn: () => void
): void {
  const typeList = Array.isArray(types) ? types : [types];

  startTransition(() => {
    for (const t of typeList) {
      if (t !== 'default') {
        addStudioTransitionType(t);
      }
    }

    updateFn();
  });
}
