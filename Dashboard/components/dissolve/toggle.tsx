'use client';
/**
 * Toggle for React on the web, from dissolve (dissolve-ui). This file is yours. Same props as the
 * React Native version; the switch itself lives in toggle.core.ts.
 *
 * An iOS style switch whose thumb breaks into grains, flows to the other end of the track and
 * reassembles there while the track fills with the on color.
 *
 * <Toggle value={wifi} onValueChange={setWifi} />
 *
 * <Toggle defaultValue size="sm" onColor="#0A84FF" accessibilityLabel="Notifications" />
 */
import type { CSSProperties, MouseEventHandler } from 'react';
import { createToggle, type ToggleProps as CoreProps, type ToggleSize } from './toggle.core';
import { useDissolveCore } from './react';

export type { ToggleSize };

export type ToggleProps = CoreProps & {
  /** Outer classes (margins...). The size comes from the size prop. */
  className?: string;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

export function Toggle({ className, style, onClick, ...props }: ToggleProps) {
  const { host } = useDissolveCore(createToggle, props);
  return (
    <button
      ref={host}
      type="button"
      role="switch"
      aria-checked={Boolean(props.value ?? props.defaultValue)}
      aria-label={props.accessibilityLabel}
      aria-disabled={props.disabled || undefined}
      disabled={props.disabled}
      className={className}
      style={style}
      onClick={onClick}
    />
  );
}

/** Props for a non-interactive grain switch inside an owning control. */
export type ToggleIndicatorProps = Omit<ToggleProps, "onClick">;

/** A non-interactive grain switch for status indicators inside an owning control. */
export function GrainToggleEffect({ className, style, shape = 'square', ...props }: ToggleIndicatorProps) {
  const { host } = useDissolveCore(createToggle, { ...props, shape, interactive: false, haptics: false });
  return <span ref={host} className={className} style={style} aria-hidden="true" />;
}

/** @deprecated Use GrainToggleEffect to make the visual-only role explicit. */
export const ToggleIndicator = GrainToggleEffect;
