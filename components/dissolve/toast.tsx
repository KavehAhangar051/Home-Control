'use client';
/**
 * Toast for React on the web, from dissolve (dissolve-ui). This file is yours. Same API as the
 * React Native version; the stack itself lives in toast.core.ts.
 *
 * Toasts that arrive in grains and leave as dust.
 *
 * <ToastProvider top={16}>{app}</ToastProvider>
 * const toast = useToast();
 * toast.show({ title: 'Message deleted', action: { label: 'Undo', onPress: restore } });
 */
import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react';
import { createToast, type ToastProps as CoreProps, type ToastOptions, type ToastTone } from './toast.core';
import { useDissolveCore } from './react';

export type { ToastOptions, ToastTone };

export type ToastProviderProps = CoreProps & {
  children?: ReactNode;
  /** Stack classes (position, side insets, width). */
  className?: string;
  style?: CSSProperties;
};

type Ctx = { show: (o: ToastOptions) => number; hide: (id: number) => void };

const ToastContext = createContext<Ctx | null>(null);

export function ToastProvider({ children, className, style, ...props }: ToastProviderProps) {
  const { host, current } = useDissolveCore(createToast, props);
  const value = useMemo<Ctx>(() => ({
    show: (o) => current.current?.show(o) ?? 0,
    hide: (id) => current.current?.hide(id),
  }), [current]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div ref={host} className={className} style={style} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
