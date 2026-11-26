/**
 * ElasticSlider for the web, framework free, from dissolve (dissolve-ui). This file is yours.
 * The React component (elastic-slider.tsx) wraps it; it also runs on its own:
 *
 *   const s = createElasticSlider(el, { label: 'Volume', defaultValue: 40, onValueChange: setVolume });
 *
 * A thick, rounded slider in the spirit of the iOS Control Center: the fill grows from the left,
 * a label sits on the left and the value on the right, both inverting their color where the fill
 * passes under them. Drag anywhere to move it by the pointer's distance, or click to jump. Pull past
 * either end and the whole track stretches like a rubber band toward the pointer, thinning a little,
 * then snaps back with a bounce on release. The value rolls digit by digit. Arrow keys, Home and End
 * work once it has focus. Colors follow --dissolve-foreground and --dissolve-background.
 */
import { el, injectStyle, onThemeChange, propsOf, reducedMotion, rgbOf, scope, token, value, vibrate } from './kit';

export const ELASTIC_SLIDER_SIZES = {
  sm: { height: 32, font: 13, pad: 14 },
  md: { height: 44, font: 15, pad: 16 },
  lg: { height: 56, font: 17, pad: 20 },
} as const;

export type ElasticSliderSize = keyof typeof ELASTIC_SLIDER_SIZES;

export type ElasticSliderProps = {
  /** Current value (controlled). */
  value?: number;
  /** Initial value when uncontrolled. Default: min. */
  defaultValue?: number;
  /** Called with the stepped value while sliding, every time it changes. */
  onValueChange?: (value: number) => void;
  /** Called with the final value when the pointer lifts. */
  onSlidingComplete?: (value: number) => void;
  /** Range and step. Default 0 to 100 by 1. */
  min?: number;
  max?: number;
  step?: number;
  /** Text on the left of the track. */
  label?: string;
  /** Shows the value on the right of the track. Default true. */
  showValue?: boolean;
  /** Turns the value into the shown text. Default: the number. */
  formatValue?: (value: number) => string;
  /** Optional, separately formatted screen-reader announcement. */
  formatValueText?: (value: number) => string;
  /** Shows boundary and per-step dots when the range has at most 20 steps. */
  showTicks?: boolean;
  /** Track height and type size: 32, 44 or 56 px. Default 'md'. */
  size?: ElasticSliderSize;
  /** A short vibration at the ends, and on every step when there are 20 steps or fewer. Default true. */
  haptics?: boolean;
  /** No sliding, the track shows at half opacity. Default false. */
  disabled?: boolean;
  /** Fill color. Default: the foreground token. */
  fillColor?: string;
  /** Empty track color. Default: the foreground token at a low alpha. */
  trackColor?: string;
};

export type ElasticSliderInstance = {
  /**
   * The icon box before the label, in the plain (inked false) or the fill's inverted (inked true)
   * copy, hidden while empty. Draw the icon in currentColor: each copy sets its own color.
   */
  icon: (inked: boolean) => HTMLElement;
  update: (props: Partial<ElasticSliderProps>) => void;
  destroy: () => void;
};

const DEFAULTS = { min: 0, max: 100, step: 1, showValue: true, showTicks: true, size: 'md' as ElasticSliderSize, haptics: true, disabled: false };

/** How far the track can stretch past an end, in px. */
const REACH = 46;
/** Thinning at full stretch, as a share of the height. */
const THIN = 0.16;
/** The springs: the snap back bounces, the press and the fill are calm. */
const BOUNCE = { stiffness: 240, damping: 9, mass: 0.7 };
const SETTLE = { stiffness: 260, damping: 22 };
/** Press: the track grows this much in height. */
const PRESS = 0.08;
/** A pointer that moves less than this is a click. */
const TAP = 6;

/** Rubber band: grows like the pull at first, never past REACH. */
const rubber = (x: number) => Math.sign(x) * REACH * (1 - 1 / (Math.abs(x) / REACH + 1));

const CSS = `
:where([data-dissolve="elastic-slider"]) { position: relative; display: block; -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; }
:where([data-dissolve="elastic-slider"]:focus-visible) { outline: 2px solid var(--dissolve-accent, rgb(10 132 255)); outline-offset: 3px; border-radius: 14px; }
:where(.dissolve-es-track) { position: absolute; inset: 0; overflow: hidden; will-change: transform; }
:where(.dissolve-es-fill) { position: absolute; inset: 0; will-change: transform; }
:where(.dissolve-es-ticks) { position: absolute; inset: 0; pointer-events: none; }
:where(.dissolve-es-tick) { position: absolute; top: 50%; width: 2px; height: 2px; border-radius: 50%; transform: translate(-50%, -50%); }
:where(.dissolve-es-text) {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: space-between;
  font-weight: 600; letter-spacing: -0.012em; white-space: nowrap; pointer-events: none;
}
:where(.dissolve-es-text) > * { will-change: transform; }
:where(.dissolve-es-clip) { position: absolute; top: 0; bottom: 0; overflow: hidden; pointer-events: none; will-change: transform; }
:where(.dissolve-es-clip) > .dissolve-es-text { inset: 0 auto 0 auto; will-change: transform; }
:where(.dissolve-es-left) { display: inline-flex; align-items: center; min-width: 0; }
:where(.dissolve-es-left) > span { overflow: hidden; text-overflow: ellipsis; }
:where(.dissolve-es-icon) { display: block; flex: none; }
:where(.dissolve-es-icon:empty) { display: none; }
:where(.dissolve-es-icon) svg { display: block; width: 100%; height: 100%; }
:where(.dissolve-es-value) { display: inline-flex; align-items: flex-start; overflow: hidden; font-variant-numeric: tabular-nums; }
:where(.dissolve-es-value) > span { display: block; }
:where(.dissolve-es-value[hidden]) { display: none; }
:where(.dissolve-es-digit) { display: inline-block; overflow: hidden; }
:where(.dissolve-es-digit) > span { display: flex; flex-direction: column; transition: transform .26s cubic-bezier(0.22, 1, 0.36, 1); }
`;

const DIGITS = Array.from({ length: 10 }, (_, i) => `<span>${i}</span>`).join('');

export function createElasticSlider(host: HTMLElement, initial: ElasticSliderProps = {}): ElasticSliderInstance {
  injectStyle('dissolve-elastic-slider', CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();

  host.dataset.dissolve = 'elastic-slider';
  host.setAttribute('role', 'slider');
  host.tabIndex = p().disabled ? -1 : 0;
  Object.assign(host.style, { touchAction: 'pan-y', cursor: 'pointer' });

  const track = el('div', 'dissolve-es-track');
  const fill = el('div', 'dissolve-es-fill');
  track.append(fill);
  const mkText = () => {
    const t = el('div', 'dissolve-es-text'), left = el('span', 'dissolve-es-left'), icon = el('i', 'dissolve-es-icon'), label = el('span');
    const val = el('span', 'dissolve-es-value');
    icon.setAttribute('aria-hidden', 'true');
    left.append(icon, label);
    t.append(left, val);
    return { t, left, icon, label, val };
  };
  const base = mkText();
  const clip = el('div', 'dissolve-es-clip');
  const inked = mkText();
  clip.append(inked.t);
  const ticksLayer = el('div', 'dissolve-es-ticks');
  ticksLayer.setAttribute('aria-hidden', 'true');
  track.append(ticksLayer);
  host.append(track, base.t, clip);
  let tickNodes: HTMLElement[] = [];
  let tickColors = { filled: 'rgb(255 255 255)', empty: 'rgb(28 28 30)' };
  const updateTicks = () => {
    tickNodes.forEach((node) => node.remove());
    tickNodes = [];
    const { min, max, step } = range();
    const count = Math.floor((max - min) / step);
    if (!p().showTicks || count > 20) return;
    const values = Array.from({ length: count + 1 }, (_, i) => min + i * step);
    if (values[values.length - 1] < max) values.push(max);
    tickNodes = values.map((v) => {
      const dot = el('span', 'dissolve-es-tick');
      dot.style.left = `${((v - min) / (max - min)) * 100}%`;
      ticksLayer.append(dot);
      return dot;
    });
  };

  const range = () => {
    const min = Number.isFinite(p().min) ? p().min! : 0;
    const max = Number.isFinite(p().max) && p().max! > min ? p().max! : min + 100;
    const step = Number.isFinite(p().step) && p().step! > 0 ? p().step! : 1;
    return { min, max, step };
  };
  const snap = (v: number) => {
    const { min, max, step } = range();
    const precision = Math.min(8, ...[min, max, step].map((n) => (String(n).split('.')[1] ?? '').length));
    const stepped = min + Math.round((v - min) / step) * step;
    return Number(Math.min(max, Math.max(min, stepped)).toFixed(precision));
  };
  const span = () => {
    const { min, max } = range();
    return max - min;
  };
  let inner = snap(p().defaultValue ?? range().min);
  const shown = () => (p().value !== undefined ? snap(p().value!) : inner);
  let last = shown();
  let W = 0;

  const render = () => {
    const o = over.v, q = fillP.v, pr = press.v;
    tickNodes.forEach((dot) => {
      const position = Number.parseFloat(dot.style.left) / 100;
      dot.style.background = position <= q ? tickColors.filled : tickColors.empty;
    });
    // Only the end being pulled moves (the right one when full, the left one when empty), the other
    // stays anchored, through the bounce too: e > 0 stretches, e < 0 is the bounce squeezing back in.
    const side = q > 0.5 ? 1 : -1, e = side * o;
    const k = Math.max(-0.5, Math.min(1, e / REACH));
    track.style.transform = `translateX(${o / 2}px) scale(${1 + e / Math.max(1, W) + 0.012 * pr}, ${(1 - THIN * k) * (1 + PRESS * pr)})`;
    fill.style.transform = `translateX(${-(1 - q) * W}px)`;
    // The texts ride with the end that moves, without being stretched.
    for (const x of [base, inked]) {
      x.left.style.transform = `translateX(${side < 0 ? o : 0}px)`;
      x.val.style.transform = `translateX(${side > 0 ? o : 0}px)`;
    }
    // The inked copy is clipped to where the fill ends on screen: the moving right end when full,
    // the moving left end when empty (so nothing shows).
    const shift = q * W + o - W - REACH;
    clip.style.left = -REACH + 'px';
    clip.style.width = W + REACH * 2 + 'px';
    clip.style.transform = `translateX(${shift}px)`;
    inked.t.style.left = REACH + 'px';
    inked.t.style.width = W + 'px';
    inked.t.style.transform = `translateX(${-shift}px)`;
  };
  const fillP = value(sc, (last - range().min) / span(), render);
  const over = value(sc, 0, render);
  const press = value(sc, 0, render);

  /** The value text, its digits rolling: one column of 0 to 9 per digit, keyed from the right. */
  function writeValue() {
    const o = p(), v = shown();
    const text = o.formatValue ? o.formatValue(v) : String(v);
    const s = ELASTIC_SLIDER_SIZES[o.size] ?? ELASTIC_SLIDER_SIZES.md;
    const line = Math.round(s.font * 1.25);
    for (const x of [base, inked]) {
      x.val.hidden = !o.showValue;
      x.val.style.height = line + 'px';
      const chars = text.split('');
      const nodes = Array.from(x.val.children) as HTMLElement[];
      // Rebuild when the shape changes (a digit appears or goes): same length and same digit slots keep their columns.
      const shape = chars.map((c) => (/\d/.test(c) ? 'd' : c)).join('');
      if (x.val.dataset.shape !== shape) {
        x.val.dataset.shape = shape;
        x.val.replaceChildren(...chars.map((c) => {
          if (!/\d/.test(c)) return el('span', '', c);
          const d = el('span', 'dissolve-es-digit');
          d.style.height = line + 'px';
          d.innerHTML = `<span>${DIGITS}</span>`;
          const col = d.firstElementChild as HTMLElement;
          col.style.transition = 'none';
          col.style.transform = `translateY(${-Number(c) * line}px)`;
          requestAnimationFrame(() => { col.style.transition = ''; });
          return d;
        }));
      } else {
        chars.forEach((c, i) => {
          const n = nodes[i];
          if (/\d/.test(c)) {
            const col = n.firstElementChild as HTMLElement;
            col.style.transform = `translateY(${-Number(c) * line}px)`;
            if (reducedMotion()) col.style.transition = 'none';
          } else n.textContent = c;
        });
      }
      // Every glyph on the same line box as the digit columns, so % and units share their baseline.
      x.val.style.lineHeight = line + 'px';
      for (const span of Array.from(x.val.querySelectorAll<HTMLElement>('.dissolve-es-digit > span > span, .dissolve-es-value > span:not(.dissolve-es-digit)'))) span.style.height = span.style.lineHeight = line + 'px';
    }
    host.setAttribute('aria-valuenow', String(v));
    host.setAttribute('aria-valuetext', o.formatValueText?.(v) ?? text);
  }

  function paint() {
    const o = p();
    const bg = token(host, 'background', 'rgb(255 255 255)'), fg = token(host, 'foreground', 'rgb(28 28 30)');
    tickColors = { filled: bg, empty: fg };
    const b = rgbOf(bg), f = rgbOf(fg);
    const dark = (0.2126 * b[0] + 0.7152 * b[1] + 0.0722 * b[2]) / 255 < 0.5;
    track.style.background = o.trackColor ?? `rgba(${f[0]}, ${f[1]}, ${f[2]}, ${dark ? 0.14 : 0.08})`;
    fill.style.background = o.fillColor ?? fg;
    base.t.style.color = fg;
    inked.t.style.color = bg;
    render();
  }

  function layout() {
    const o = p(), s = ELASTIC_SLIDER_SIZES[o.size] ?? ELASTIC_SLIDER_SIZES.md;
    host.style.height = s.height + 'px';
    track.style.borderRadius = s.height * 0.42 + 'px';
    for (const x of [base, inked]) {
      x.t.style.padding = `0 ${s.pad}px`;
      x.t.style.fontSize = s.font + 'px';
      x.label.textContent = o.label ?? '';
      x.left.style.gap = Math.round(s.font * 0.55) + 'px';
      x.icon.style.width = x.icon.style.height = Math.round(s.font * 1.2) + 'px';
    }
    const { min, max } = range();
    host.setAttribute('aria-valuemin', String(min));
    host.setAttribute('aria-valuemax', String(max));
    if (o.label) host.setAttribute('aria-label', o.label);
    else host.removeAttribute('aria-label');
    W = host.clientWidth;
    updateTicks();
    writeValue();
    render();
  }

  const steps = () => span() / range().step;
  /** A new stepped value from the user: tick, state, onValueChange. */
  function emit(v: number) {
    if (v === last) return;
    last = v;
    const o = p();
    const { min, max } = range();
    if (o.haptics && (v === min || v === max || steps() <= 20)) vibrate(4);
    if (o.value === undefined) inner = v;
    o.onValueChange?.(v);
    writeValue();
  }
  const settle = () => {
    const to = (last - range().min) / span();
    if (reducedMotion()) fillP.set(to);
    else fillP.spring(to, SETTLE);
  };

  // Pointer: drag moves by the distance, past the ends the track stretches; a click jumps.
  let ptr: { id: number; x: number; y: number; q0: number; drag: boolean } | null = null;
  const onDown = (e: PointerEvent) => {
    if (ptr || e.button > 0 || p().disabled) return;
    W = host.clientWidth;
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, q0: fillP.v, drag: false };
    if (reducedMotion()) press.set(1);
    else press.spring(1, SETTLE);
  };
  const onMove = (e: PointerEvent) => {
    if (!ptr || ptr.id !== e.pointerId || W <= 0) return;
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
    if (!ptr.drag) {
      if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) return end(e, false);
      if (Math.abs(dx) < 4) return;
      ptr.drag = true;
      try { host.setPointerCapture(e.pointerId); } catch {}
      host.style.cursor = 'grabbing';
    }
    const raw = ptr.q0 + dx / W, q = Math.min(1, Math.max(0, raw));
    fillP.set(q);
    over.set(reducedMotion() ? 0 : rubber((raw - q) * W));
    emit(snap(range().min + q * span()));
  };
  function end(e: PointerEvent, commit = true) {
    if (!ptr || ptr.id !== e.pointerId) return;
    const wasTap = !ptr.drag && Math.abs(e.clientX - ptr.x) < TAP && Math.abs(e.clientY - ptr.y) < TAP;
    if (commit && wasTap && e.type === 'pointerup') {
      const r = host.getBoundingClientRect();
      emit(snap(range().min + Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * span()));
    }
    ptr = null;
    host.style.cursor = 'pointer';
    settle();
    if (reducedMotion()) { over.set(0); press.set(0); }
    else { over.spring(0, BOUNCE); press.spring(0, SETTLE); }
    if (commit) p().onSlidingComplete?.(last);
  }
  const onEnd = (e: PointerEvent) => end(e, e.type === 'pointerup');
  const onLostCapture = (e: PointerEvent) => end(e, true);
  const onKey = (e: KeyboardEvent) => {
    if (p().disabled) return;
    const { min, max, step } = range();
    const big = Math.max(step, (max - min) / 10);
    const d: Record<string, number> = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: big, PageDown: -big };
    let v: number | null = null;
    if (e.key in d) v = snap(last + d[e.key]);
    else if (e.key === 'Home') v = min;
    else if (e.key === 'End') v = max;
    if (v === null) return;
    e.preventDefault();
    emit(v);
    settle();
    o.onSlidingComplete?.(v);
  };
  host.addEventListener('pointerdown', onDown);
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onEnd);
  host.addEventListener('pointercancel', onEnd);
  host.addEventListener('lostpointercapture', onLostCapture);
  const onWindowBlur = () => {
    if (!ptr) return;
    const pointerId = ptr.id;
    ptr = null;
    try {
      if (host.hasPointerCapture(pointerId)) host.releasePointerCapture(pointerId);
    } catch {}
    host.style.cursor = 'pointer';
    settle();
    if (reducedMotion()) { over.set(0); press.set(0); }
    else { over.spring(0, BOUNCE); press.spring(0, SETTLE); }
    p().onSlidingComplete?.(last);
  };
  window.addEventListener('blur', onWindowBlur);
  host.addEventListener('keydown', onKey);

  const ro = new ResizeObserver(() => { if (host.clientWidth !== W) { W = host.clientWidth; render(); } });
  ro.observe(host);
  onThemeChange(sc, paint);

  const disable = () => {
    host.style.opacity = p().disabled ? '0.5' : '';
    host.setAttribute('aria-disabled', String(p().disabled));
    host.tabIndex = p().disabled ? -1 : 0;
  };

  paint();
  disable();
  layout();

  return {
    icon: (on) => (on ? inked : base).icon,
    update(next) {
      const changed = props.update(next);
      if ((['size', 'label', 'min', 'max', 'step', 'showValue', 'showTicks', 'formatValue'] as const).some((k) => changed.has(k))) layout();
      if (changed.has('formatValueText')) writeValue();
      if (changed.has('value') && p().value !== undefined && !ptr) {
        const v = shown();
        if (v !== last) { last = v; writeValue(); settle(); }
      }
      if (changed.has('fillColor') || changed.has('trackColor')) paint();
      if (changed.has('disabled')) disable();
    },
    destroy() {
      sc.dispose();
      ro.disconnect();
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onEnd);
      host.removeEventListener('pointercancel', onEnd);
      host.removeEventListener('lostpointercapture', onLostCapture);
      window.removeEventListener('blur', onWindowBlur);
      host.removeEventListener('keydown', onKey);
      track.remove();
      ticksLayer.remove();
      tickNodes = [];
      base.t.remove();
      clip.remove();
      for (const k of ['touch-action', 'cursor', 'height', 'opacity']) host.style.removeProperty(k);
      for (const a of ['role', 'tabindex', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext', 'aria-label', 'aria-disabled', 'data-dissolve']) host.removeAttribute(a);
    },
  };
}
