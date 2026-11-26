'use client';

/**
 * React adapter for the official Dissolve web ElasticSlider core.
 * The animation and gesture engine remains framework-free in elastic-slider.core.ts.
 */
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  createElasticSlider,
  type ElasticSliderProps as CoreProps,
  type ElasticSliderSize,
} from './elastic-slider.core';
import { useDissolveCore } from './react';

export type { ElasticSliderSize };

export type ElasticSliderProps = CoreProps & {
  /** React-friendly alias retained for existing DashboardSlider consumers. */
  onValueCommit?: (value: number) => void;
  icon?: ReactNode | ((props: { color: string; size: number }) => ReactNode);
  className?: string;
  style?: CSSProperties;
};

export function ElasticSlider({
  icon,
  className,
  style,
  onValueCommit,
  onSlidingComplete,
  ...props
}: ElasticSliderProps) {
  const coreProps: CoreProps = {
    ...props,
    onSlidingComplete: onValueCommit ?? onSlidingComplete,
  };
  const { host, instance } = useDissolveCore(createElasticSlider, coreProps);
  const glyphSize = Math.round(({ sm: 13, md: 15, lg: 17 }[props.size ?? 'md']) * 1.2);
  const glyph = () =>
    typeof icon === 'function' ? icon({ color: 'currentColor', size: glyphSize }) : icon;

  return (
    <div ref={host} className={className} style={style}>
      {instance && icon != null
        ? [false, true].map((inked) =>
            createPortal(glyph(), instance.icon(inked), String(inked)),
          )
        : null}
    </div>
  );
}
