/**
 * @file types/ui.ts
 * @description Type definitions for UI layout states and view modes.
 */

export type ViewMode = 'split' | 'editor' | 'preview';

export type Theme = 'dark' | 'light';

export interface DecodeEffectOptions {
  text: string;
  speed?: number;
  chars?: string;
  enabled?: boolean;
}

export type ToastType = 'success' | 'info' | 'error';

export interface ToastActionConfig {
  readonly label: string;
  readonly onClick: () => void;
}

export interface ToastState {
  readonly message: string;
  readonly type?: ToastType;
  readonly id: number;
  readonly action?: ToastActionConfig;
}

