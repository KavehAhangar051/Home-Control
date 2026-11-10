'use client';

/**
 * @file components/motion/studio-view-transition.tsx
 * @description Reusable React 19 `<ViewTransition>` boundaries for shared workspace panels,
 * focus controls, and state-change reveals. Adheres strictly to the Critical Placement Rule
 * (`<ViewTransition>` placed before any DOM node).
 */

import React from 'react';
import { STUDIO_VT_NAMES, StudioViewTransition } from '@/utils/viewTransitions';

export interface SharedPanelTransitionProps {
  /** Identifies whether this boundary wraps the editor or preview workspace panel. */
  panel: 'editor' | 'preview';
  /** Inner workspace panel element (must be a single DOM-producing child). */
  children: React.ReactNode;
}

/**
 * Wraps the Editor or Preview panel in a named `<ViewTransition>` boundary.
 * When switching between `split` ↔ `editor` or `split` ↔ `preview`, the panel present
 * in both modes morphs smoothly (`share="vt-morph"`), while the panel entering or
 * leaving scales and fades (`enter="vt-scale-in"` / `exit="vt-scale-out"`).
 * `default="none"` prevents unintended cross-fades on deferred keystroke updates.
 *
 * @param {SharedPanelTransitionProps} props - Panel identifier and child node.
 * @returns {React.JSX.Element} Configured `<ViewTransition>` boundary.
 */
export function SharedPanelTransition({
  panel,
  children,
}: SharedPanelTransitionProps): React.JSX.Element {
  const name =
    panel === 'editor' ? STUDIO_VT_NAMES.EDITOR_PANEL : STUDIO_VT_NAMES.PREVIEW_PANEL;

  return (
    <StudioViewTransition
      name={name}
      share="vt-morph"
      enter="vt-scale-in"
      exit="vt-scale-out"
      default="none"
    >
      {children}
    </StudioViewTransition>
  );
}

export interface ViewFadeTransitionProps {
  /** Optional unique key when forcing re-enter on content identity swap. */
  transitionKey?: string;
  /** Child element rendered directly inside the `<ViewTransition>` boundary. */
  children: React.ReactNode;
}

/**
 * Wraps a conditional UI surface in an opacity-only enter/exit `<ViewTransition>`
 * with `default="none"` so it only animates when mounting or unmounting inside a Transition.
 *
 * @param {ViewFadeTransitionProps} props - Child element and optional key.
 * @returns {React.JSX.Element} Configured `<ViewTransition>` boundary.
 */
export function ViewFadeTransition({
  transitionKey,
  children,
}: ViewFadeTransitionProps): React.JSX.Element {
  return (
    <StudioViewTransition
      key={transitionKey}
      enter="vt-fade-in"
      exit="vt-fade-out"
      default="none"
    >
      {children}
    </StudioViewTransition>
  );
}
