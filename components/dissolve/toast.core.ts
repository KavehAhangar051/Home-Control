/**
 * Toast for the web, framework free, from dissolve (dissolve-ui). This file is yours.
 * The React provider (toast.tsx) wraps it; it also runs on its own:
 *
 *   const toasts = createToast(document.body.appendChild(document.createElement('div')));
 *   toasts.show({ title: 'Message deleted', action: { label: 'Undo', onPress: restore } });
 *
 * A stack of toasts that arrive in grains and leave as dust. Each card is drawn on a canvas, so
 * the snapshot handed to the engine is exact. Same timings, limit and layout as the React Native
 * version. The card is the inverted surface (--dissolve-primary, text in
 * --dissolve-primary-foreground); a cardClassName reaches its background, text color, radius and
 * shadow.
 */
import { play, snapshot } from './engine';
import { el, fit, fontOf, injectStyle, propsOf, rectOf, rr, scope, token, frame } from './kit';

export type ToastTone = 'default' | 'success' | 'error';

export type ToastOptions = {
  title: string;
  message?: string;
  tone?: ToastTone;
  /** A single action, typically Undo. The toast leaves after it runs. */
  action?: { label: string; onPress: () => void };
  /** Time on screen before it leaves on its own, ms. Default 3200. 0 keeps it until tapped. */
  duration?: number;
  /** Entrance, an engine variant. Default 'gather'. */
  enter?: string;
  /** Exit, an engine variant. Default 'dust'. */
  exit?: string;
};

export type ToastProps = {
  /** Distance from the top of the viewport, px. Default 56. */
  top?: number;
  /** Toasts on screen at once; over it, the oldest leaves as dust. Default 3. */
  max?: number;
  /** Card classes (background, text color, radius, shadow). */
  cardClassName?: string;
};

export type ToastInstance = {
  /** Shows a toast, returns its id. */
  show: (o: ToastOptions) => number;
  /** Sends a toast away as dust. */
  hide: (id: number) => void;
  update: (props: Partial<ToastProps>) => void;
  destroy: () => void;
};

const DEFAULTS = { top: 56, max: 3 };

const DOT: Record<ToastTone, [string, string]> = {
  default: ['muted', 'rgb(142 142 147)'],
  success: ['success', 'rgb(52 199 89)'],
  error: ['danger', 'rgb(255 59 48)'],
};

const CSS = `
:where([data-dissolve="toast"]) {
  position: fixed; top: var(--dissolve-toast-top, 56px); left: 12px; right: 12px; z-index: 50;
  max-width: 420px; margin: 0 auto; display: flex; flex-direction: column; pointer-events: none;
}
:where(.dissolve-toast-slot) { margin-bottom: 8px; transition: height .32s cubic-bezier(0.32, 0.72, 0, 1), margin .32s cubic-bezier(0.32, 0.72, 0, 1); }
:where(.dissolve-toast-slot[data-gone]) { height: 0 !important; margin-bottom: 0; }
:where(.dissolve-toast-card:focus-visible) { outline: 2px solid var(--dissolve-accent, rgb(10 132 255)); outline-offset: 3px; }
:where(.dissolve-toast-card) {
  display: block; border-radius: 18px; cursor: pointer; pointer-events: auto;
  background-color: var(--dissolve-primary, rgb(28 28 30)); color: var(--dissolve-primary-foreground, rgb(255 255 255));
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18); -webkit-user-select: none; user-select: none;
}
`;

type Layout = { w: number; h: number; action: { x: number; y: number; w: number; h: number } | null };

function layoutOf(ctx: CanvasRenderingContext2D, w: number, o: ToastOptions, font: string): Layout {
  const h = o.message ? 62 : 46;
  if (!o.action) return { w, h, action: null };
  ctx.font = `600 14px ${font}`;
  const aw = Math.ceil(ctx.measureText(o.action.label).width) + 24, ah = 32;
  return { w, h, action: { x: 14, y: (h - ah) / 2, w: aw, h: ah } };
}

type Look = { bg: string; fg: string; dot: string; radius: number; font: string };

function draw(ctx: CanvasRenderingContext2D, { w, h, action }: Layout, o: ToastOptions, k: Look) {
  ctx.direction = 'rtl';
  const text = (str: string, x: number, y: number, size: number, weight: number, alpha: number, align: CanvasTextAlign = 'right') => {
    ctx.font = `${weight} ${size}px ${k.font}`;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = k.fg;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
    ctx.globalAlpha = 1;
  };
  ctx.fillStyle = k.bg;
  rr(ctx, 0, 0, w, h, k.radius); ctx.fill();
  ctx.fillStyle = k.dot;
  ctx.beginPath(); ctx.arc(w - 18, h / 2, 4, 0, Math.PI * 2); ctx.fill();
  const tx = w - 34, textLeft = action ? action.x + action.w + 12 : 14, textWidth = tx - textLeft;
  ctx.font = `600 15px ${k.font}`;
  text(fit(ctx, o.title, textWidth), tx, o.message ? h / 2 - 3 : h / 2 + 5.5, 15, 600, 1);
  if (o.message) {
    ctx.font = `400 13px ${k.font}`;
    text(fit(ctx, o.message, textWidth), tx, h / 2 + 15, 13, 400, 0.7);
  }
  if (action && o.action) {
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = k.fg;
    rr(ctx, action.x, action.y, action.w, action.h, action.h / 2); ctx.fill();
    ctx.globalAlpha = 1;
    text(o.action.label, action.x + action.w / 2, action.y + 21, 14, 600, 1, 'center');
  }
}

type Item = { id: number; o: ToastOptions; slot: HTMLElement; gone: boolean; timer: ReturnType<typeof setTimeout> | undefined; leave: () => Promise<void> };

/** A toast stack in host, pinned to the top of the viewport by default. */
export function createToast(host: HTMLElement, initial: ToastProps = {}): ToastInstance {
  injectStyle('dissolve-toast', CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();
  const items: Item[] = [];
  let next = 1;

  host.dataset.dissolve = 'toast';
  host.setAttribute('aria-live', 'polite');
  const place = () => host.style.setProperty('--dissolve-toast-top', p().top + 'px');
  place();

  function show(o: ToastOptions) {
    const id = next++;
    if (!sc.alive) return id;
    const w = Math.round(host.clientWidth);
    const fixed = getComputedStyle(host).position === 'fixed';

    // The card's CSS gives the colors and the radius; the canvas, drawn off the document so page
    // font smoothing does not thin its text, paints them.
    const cls = 'dissolve-toast-card' + (p().cardClassName ? ' ' + p().cardClassName : '');
    const probe = el('canvas', cls);
    const slot = el('div', 'dissolve-toast-slot');
    slot.append(probe);
    host.append(slot);
    const cs = getComputedStyle(probe);
    const font = fontOf(host);
    const [dotToken, dotFallback] = DOT[o.tone ?? 'default'];
    const look: Look = {
      bg: cs.backgroundColor,
      fg: cs.color,
      dot: token(probe, dotToken, dotFallback),
      radius: parseFloat(cs.borderTopLeftRadius) || 0,
      font,
    };
    const L = layoutOf(probe.getContext('2d')!, w, o, font);
    const card = snapshot(w, L.h, (ctx) => draw(ctx, L, o, look));
    card.className = cls;
    Object.assign(card.style, { width: w + 'px', height: L.h + 'px', opacity: '0', backgroundColor: 'transparent' });
    probe.replaceWith(card);
    card.setAttribute('role', o.tone === 'error' ? 'alert' : 'status');
    card.setAttribute('aria-label', [o.title, o.message, o.action ? `${o.action.label} available` : ''].filter(Boolean).join('. '));
    if (o.action) card.tabIndex = 0;

    const it: Item = {
      id, o, slot, gone: false, timer: undefined,
      async leave() {
        if (it.gone) return;
        it.gone = true;
        clearTimeout(it.timer);
        const r = rectOf(card);
        card.style.opacity = '0';
        await sc.track(play({ source: card, ...r, preset: o.exit ?? 'dust', duration: 1100, fixed })).done;
        if (!sc.alive) return;
        // The stack closes up (LinearTransition 320 ms on the native side).
        slot.style.height = slot.offsetHeight + 'px';
        void slot.offsetHeight;
        slot.dataset.gone = '';
        await sc.wait(330);
        slot.remove();
        items.splice(items.indexOf(it), 1);
      },
    };
    items.push(it);

    const activate = (e: MouseEvent) => {
      const b = card.getBoundingClientRect(), s = b.width / card.offsetWidth || 1;
      const x = (e.clientX - b.left) / s, y = (e.clientY - b.top) / s, a = L.action;
      if (a && x >= a.x - 8 && x <= a.x + a.w + 8 && y >= a.y - 8 && y <= a.y + a.h + 8) o.action?.onPress();
      it.leave();
    };
    card.addEventListener('click', activate);
    if (o.action) card.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      o.action?.onPress();
      it.leave();
    });

    // Over the limit, the oldest leaves as dust instead of vanishing.
    const live = items.filter((x) => !x.gone);
    live.slice(0, Math.max(0, live.length - p().max)).forEach((x) => x.leave());

    (async () => {
      await frame();
      if (!sc.alive) return;
      await sc.track(play({ source: card, ...rectOf(card), preset: o.enter ?? 'gather', direction: 'in', duration: 900, fixed })).done;
      if (!sc.alive || it.gone) return;
      card.style.opacity = '1';
      const ms = o.duration ?? 3200;
      if (ms) it.timer = setTimeout(it.leave, ms);
    })();
    return id;
  }

  return {
    show,
    hide: (id) => { items.find((x) => x.id === id)?.leave(); },
    update(nextProps) {
      if (props.update(nextProps).has('top')) place();
    },
    destroy() {
      sc.dispose();
      items.forEach((x) => { clearTimeout(x.timer); x.slot.remove(); });
      items.length = 0;
      delete host.dataset.dissolve;
      host.removeAttribute('aria-live');
      host.style.removeProperty('--dissolve-toast-top');
    },
  };
}
