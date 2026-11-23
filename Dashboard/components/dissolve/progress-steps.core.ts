/**
 * ProgressSteps for the web, framework free, from dissolve (dissolve-ui). This file is yours.
 * The React component (progress-steps.tsx) wraps it; it also runs on its own:
 *
 *   const s = createProgressSteps(el, { steps: ['Account', 'Profile', 'Payment'], current: 0 });
 *   s.update({ current: 1 });
 *
 * Steps for onboarding, checkout or any multi step form, in two looks.
 *
 * variant 'numbers' (default): small numbered discs joined by a hairline. Done steps are filled with
 * a check, the current one is filled with a thin ring around it, the next ones are soft and muted.
 * Move forward and the current disc sheds a copy of itself in grains: the cloud flattens
 * onto the line and streams along it, filling the line behind its front, then gathers back into a
 * disc on the new step (about 450 ms, a little longer when it skips steps). Move back and the disc
 * breaks up and streams home the other way, emptying the line.
 *
 * variant 'bars': story style segments, one per step, no numbers. Move forward and the fill runs on
 * into the next segment, its head gathering out of grains that drift in and settle; move back and the
 * head recedes, shedding its grains as dust.
 *
 * Reduced motion: the fills slide and the discs cross fade. Colors follow --dissolve-primary, --dissolve-primary-foreground,
 * --dissolve-foreground and --dissolve-muted.
 */
import {
  bezier,
  clamp,
  el,
  hash,
  injectStyle,
  loop,
  onThemeChange,
  propsOf,
  reducedMotion,
  rgbOf,
  scope,
  token,
  vibrate,
} from "./kit";

export const PROGRESS_STEPS_SIZES = {
  sm: { disc: 18, line: 1.5, font: 10, label: 12, ring: 3, bar: 3, barGap: 4 },
  md: { disc: 22, line: 2, font: 11, label: 13, ring: 3.5, bar: 4, barGap: 5 },
  lg: { disc: 28, line: 2, font: 13, label: 14, ring: 4, bar: 6, barGap: 6 },
} as const;

export type ProgressStepsSize = keyof typeof PROGRESS_STEPS_SIZES;

export type ProgressStepsVariant = "numbers" | "bars";

export type ProgressStepsProps = {
  /** 'numbers': numbered discs on a line. 'bars': story style segments, no numbers. Default 'numbers'. */
  variant?: ProgressStepsVariant;
  /** The steps: their labels, or how many there are (no labels then). Two or more. */
  steps?: string[] | number;
  /** The current step, from 0. steps.length marks them all done. */
  current?: number;
  /** Called with the index of a pressed step. Steps are not pressable without it. */
  onStepPress?: (index: number) => void;
  /** Disc, line and type size (18, 22 or 28 px discs), or bar thickness (3, 4 or 6 px). Default 'md'. */
  size?: ProgressStepsSize;
  /** A short vibration on every change of current, where the browser has it. Default true. */
  haptics?: boolean;
  /** Fill of the done and current discs, the line and the grains. Default: the primary token. */
  activeColor?: string;
  /** The next steps' discs, the empty line and the empty bars. Default: the foreground token at a low alpha. */
  trackColor?: string;
  /** Label classes (font, tracking...). The colors come from the theme tokens. */
  labelClassName?: string;
  /** Optional override for reduced motion (e.g. dashboard animations toggle). Defaults to system prefers-reduced-motion. */
  reducedMotion?: boolean;
};

export type ProgressStepsInstance = {
  update: (props: Partial<ProgressStepsProps>) => void;
  destroy: () => void;
};

const DEFAULTS = {
  steps: 3 as string[] | number,
  current: 0,
  size: "md" as ProgressStepsSize,
  haptics: true,
};

/** Grains leave over STAGGER (leading edge first), each flies for RUN, plus HOP per skipped step. */
const STAGGER = 120;
const RUN = 300;
const HOP = 110;
/** The new disc fades in under the grains as they land, then the grains fade off it. */
const LAND = 110;
const FADE = 90;
/** Share of the trip over which a step it crosses changes state. */
const WINDOW = 0.18;
/** Reduced motion: the line fills and the discs cross fade over this long. */
const PLAIN = 280;
/** Mid flight the cloud flattens to this share of its height and its grains shrink to this share. */
const FLATTEN = 0.85;
const SHRINK = 0.45;
/** Grain pool, and the grid pitch as a share of the disc size. */
const MAX_GRAINS = 90;
const PITCH = 0.14;
const OVERLAP = 1.25;
/** Gap between a disc and the line, in px. */
const GAP = 6;
/** Width of the ring around the current disc, in px. */
const RING_W = 1.5;
/** Room above and below the row for the grains. */
const PAD = 8;
/** Per step levels: fill, check, ring. */
const SF = 3;

/** Leaves fast, lands soft. */
const FLOW = bezier(0.42, 0, 0.12, 1);

/** Grid points inside the disc, centered on it: x y, seed, seed. */
function grainGrid(d: number) {
  let pitch = Math.max(3, d * PITCH);
  for (;;) {
    const cols = Math.max(3, Math.round(d / pitch)),
      p = d / cols,
      r = d / 2,
      out: [number, number, number, number][] = [];
    for (let j = 0; j < cols; j++)
      for (let i = 0; i < cols; i++) {
        const x = (i + 0.5) * p - r,
          y = (j + 0.5) * p - r;
        if (x * x + y * y > (r - p * 0.3) ** 2) continue;
        const k = out.length;
        out.push([x, y, hash(k, 4), hash(k, 6)]);
      }
    if (out.length <= MAX_GRAINS) return { grid: out, dot: p * OVERLAP };
    pitch *= 1.15;
  }
}

/** Levels of every step and line for a current step: fill, check, ring per step, then one per line. */
function levelsFor(n: number, cur: number) {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i <= cur ? 1 : 0, i < cur ? 1 : 0, i === cur ? 1 : 0);
  for (let k = 0; k < n - 1; k++) out.push(k < cur ? 1 : 0);
  return out;
}

const CHECK =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3.6 8.4 6.6 11.3 12.4 4.9"/></svg>';

const CSS = `
:where([data-dissolve="progress-steps"]) { position: relative; -webkit-user-select: none; user-select: none; }
:where(.dissolve-steps-row) { position: relative; }
:where(.dissolve-steps-row) > * { position: absolute; }
:where(.dissolve-steps-line) { border-radius: 999px; }
:where(.dissolve-steps-fill) { transform-origin: left center; will-change: transform; }
:where(.dissolve-steps-disc) { display: flex; align-items: center; justify-content: center; border-radius: 50%; box-sizing: border-box; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1; }
:where(.dissolve-steps-hollow) { color: var(--dissolve-muted, var(--text-muted)); border: 1px solid var(--dissolve-border, var(--border-color)); }
:where(.dissolve-steps-solid) { will-change: transform, opacity; font-weight: 700; }
:where(.dissolve-steps-solid) > * { position: absolute; }
:where(.dissolve-steps-check) { width: 58%; height: 58%; }
:where(.dissolve-steps-check) svg { display: block; width: 100%; height: 100%; }
:where(.dissolve-steps-ring) { border-radius: 50%; border-style: solid; box-sizing: border-box; will-change: transform, opacity; }
:where(.dissolve-steps-grains) { pointer-events: none; }
:where(.dissolve-steps-labels) { display: flex; margin-top: 8px; }
:where(.dissolve-steps-label) {
  flex: 1; min-width: 0; padding: 0 2px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  letter-spacing: -0.006em; color: var(--dissolve-muted, var(--text-muted)); font-weight: 500;
}
:where(.dissolve-steps-label.is-reached) { color: var(--text-secondary, var(--dissolve-foreground)); }
:where(.dissolve-steps-label.is-current) { color: var(--dissolve-foreground, var(--text-primary)); font-weight: 600; }
:where(.dissolve-steps-hit) { position: absolute; top: 0; bottom: 0; outline: none; }
:where(.dissolve-steps-hit:focus:not(:focus-visible)) { outline: none; }
:where(.dissolve-steps-hit:focus-visible) { outline: 2px solid var(--ring, var(--dissolve-accent)); outline-offset: 2px; border-radius: 10px; }
`;

/** Hit areas are form controls: page resets beat :where(), so their look is inline. */
const BUTTON: Partial<CSSStyleDeclaration> = {
  border: "0",
  padding: "0",
  margin: "0",
  background: "none",
  cursor: "pointer",
  font: "inherit",
  color: "inherit",
};

type StepNodes = {
  ring: HTMLElement;
  hollow: HTMLElement;
  solid: HTMLElement;
  num: HTMLElement;
  check: HTMLElement;
};

function createNumbers(host: HTMLElement, initial: ProgressStepsProps): ProgressStepsInstance {
  injectStyle("dissolve-progress-steps", CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();

  host.dataset.dissolve = "progress-steps";
  host.setAttribute("role", "progressbar");

  const row = el("div", "dissolve-steps-row");
  const cv = el("canvas", "dissolve-steps-grains");
  const ctx = cv.getContext("2d")!;
  const labelsRow = el("div", "dissolve-steps-labels");
  const hits = el("div");
  hits.style.cssText = "position:absolute;inset:0;pointer-events:none";
  host.append(row, labelsRow, hits);

  let n = 2,
    labels: string[] | null = null;
  let W = 0,
    rowH = 0,
    s: (typeof PROGRESS_STEPS_SIZES)[ProgressStepsSize] = PROGRESS_STEPS_SIZES.md,
    dpr = 1;
  let X: number[] = [];
  let nodes: StepNodes[] = [],
    fills: HTMLElement[] = [],
    texts: HTMLElement[] = [];
  let grid: [number, number, number, number][] = [],
    dot = 0,
    M = 0;
  let D = new Float32Array(0),
    F = new Float32Array(0);
  let L: number[] = [],
    LF: number[] = [];
  let target = 0,
    origin = 0,
    req = false,
    flying = false,
    startAt = 0;
  let active = "#000",
    ink = "#fff";

  const clampCur = (c: number | undefined) => Math.max(0, Math.min(n, Math.round(c ?? 0)));

  function paint() {
    const o = p();
    const bg = rgbOf(token(host, "background", "#19191b"));
    const dark = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255 < 0.5;
    active = o.activeColor ?? token(host, "primary", dark ? "#ededed" : "#171717");
    ink = token(host, "primary-foreground", dark ? "#0f0f10" : "#ffffff");
    const surface = o.trackColor ?? token(host, "surface", dark ? "#232325" : "#f4f4f5");
    const border = token(host, "border", dark ? "#27272a" : "#e4e4e7");
    const track = o.trackColor ?? border;
    const a = rgbOf(active);
    for (const t of nodes) {
      t.hollow.style.background = surface;
      t.hollow.style.borderColor = border;
      t.solid.style.background = active;
      t.solid.style.color = ink;
      t.ring.style.borderColor = `rgba(${a[0]}, ${a[1]}, ${a[2]}, ${dark ? 0.28 : 0.24})`;
    }
    row.querySelectorAll<HTMLElement>(".dissolve-steps-track").forEach((x) => {
      x.style.background = track;
    });
    for (const f of fills) f.style.background = active;
  }

  /** Builds the nodes for the current steps and size. */
  function build() {
    const o = p();
    s = PROGRESS_STEPS_SIZES[o.size] ?? PROGRESS_STEPS_SIZES.md;
    labels = typeof o.steps === "number" ? null : o.steps;
    n = Math.max(2, typeof o.steps === "number" ? Math.floor(o.steps) : o.steps.length);
    rowH = s.disc + (s.ring + RING_W) * 2;
    row.replaceChildren();
    nodes = [];
    fills = [];
    for (let k = 0; k < n - 1; k++) {
      const track = el("div", "dissolve-steps-line dissolve-steps-track"),
        fill = el("div", "dissolve-steps-line dissolve-steps-fill");
      row.append(track, fill);
      fills.push(fill);
    }
    for (let i = 0; i < n; i++) {
      const ring = el("div", "dissolve-steps-ring");
      const hollow = el("div", "dissolve-steps-disc dissolve-steps-hollow", String(i + 1));
      const solid = el("div", "dissolve-steps-disc dissolve-steps-solid");
      const num = el("span", "", String(i + 1)),
        check = el("span", "dissolve-steps-check", CHECK);
      solid.append(num, check);
      row.append(ring, hollow, solid);
      nodes.push({ ring, hollow, solid, num, check });
    }
    row.append(cv);
    row.style.height = `${rowH}px`;
    labelsRow.replaceChildren();
    texts = [];
    labelsRow.hidden = !labels;
    if (labels) {
      for (const text of labels) {
        const t = el("span", `dissolve-steps-label ${o.labelClassName ?? ""}`.trim());
        t.textContent = text;
        t.style.fontSize = `${s.label}px`;
        labelsRow.append(t);
        texts.push(t);
      }
    }
    buildHits();
    ({ grid, dot } = grainGrid(s.disc));
    M = grid.length;
    D = new Float32Array(M * 4);
    F = new Float32Array(M * 4);
    host.setAttribute("aria-valuemin", "0");
    host.setAttribute("aria-valuemax", String(n));
  }

  const isRtl = () => getComputedStyle(host).direction === "rtl";

  /** Press targets over each column, only with onStepPress. */
  function buildHits() {
    hits.replaceChildren();
    if (!p().onStepPress) return;
    const rtl = isRtl();
    for (let i = 0; i < n; i++) {
      const b = el("button", "dissolve-steps-hit");
      b.type = "button";
      const leftPct = rtl ? ((n - 1 - i) / n) * 100 : (i / n) * 100;
      Object.assign(b.style, BUTTON, {
        left: `${leftPct}%`,
        width: `${100 / n}%`,
        pointerEvents: "auto",
      });
      b.setAttribute("aria-label", labels?.[i] ?? `Step ${i + 1}`);
      b.addEventListener("click", () => p().onStepPress?.(i));
      hits.append(b);
    }
  }

  /** Places everything for the host width, and snaps to the current step. */
  function layout() {
    W = host.clientWidth;
    if (W <= 0) return;
    const rtl = isRtl();
    const col = W / n,
      d = s.disc,
      outer = d + (s.ring + RING_W) * 2,
      cy = rowH / 2;
    X = Array.from({ length: n }, (_, i) => (rtl ? W - (i + 0.5) * col : (i + 0.5) * col));
    const box = (node: HTMLElement, x: number, size: number) =>
      Object.assign(node.style, {
        left: `${x - size / 2}px`,
        top: `${cy - size / 2}px`,
        width: `${size}px`,
        height: `${size}px`,
      });
    nodes.forEach((t, i) => {
      box(t.ring, X[i], outer);
      box(t.hollow, X[i], d);
      box(t.solid, X[i], d);
      t.ring.style.borderWidth = `${RING_W}px`;
      t.hollow.style.fontSize = t.solid.style.fontSize = `${s.font}px`;
    });
    const lines = row.querySelectorAll<HTMLElement>(".dissolve-steps-line");
    for (let k = 0; k < n - 1; k++) {
      const leftX = rtl ? X[k + 1] + d / 2 + GAP : X[k] + d / 2 + GAP;
      const w = Math.max(0, col - d - GAP * 2);
      for (const l of [lines[k * 2], lines[k * 2 + 1]]) {
        Object.assign(l.style, {
          left: `${leftX}px`,
          top: `${cy - s.line / 2}px`,
          width: `${w}px`,
          height: `${s.line}px`,
        });
      }
      fills[k].style.transformOrigin = rtl ? "right center" : "left center";
    }
    dpr = Math.min(3, devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round((rowH + PAD * 2) * dpr);
    cv.style.cssText = `left:0;top:${-PAD}px;width:${W}px;height:${rowH + PAD * 2}px`;
    flying = req = false;
    origin = target;
    L = levelsFor(n, target);
    LF = L.slice();
    ctx.clearRect(0, 0, cv.width, cv.height);
    apply();
  }

  function apply() {
    nodes.forEach((t, i) => {
      const fill = L[i * SF] ?? 0,
        check = L[i * SF + 1] ?? 0,
        ring = L[i * SF + 2] ?? 0;
      t.solid.style.opacity = String(fill);
      t.solid.style.transform = `scale(${0.6 + 0.4 * fill})`;
      t.num.style.opacity = String(1 - check);
      t.check.style.opacity = String(check);
      t.check.style.transform = `scale(${0.5 + 0.5 * check})`;
      t.ring.style.opacity = String(ring);
      t.ring.style.transform = `scale(${0.85 + 0.15 * ring})`;
    });
    fills.forEach((f, k) => {
      f.style.transform = `scaleX(${Math.max(0.0001, L[n * SF + k] ?? 0)})`;
    });
  }

  function syncLabels() {
    texts.forEach((t, i) => {
      t.classList.toggle("is-reached", i <= target);
      t.classList.toggle("is-current", i === target);
    });
    host.setAttribute("aria-valuenow", String(target));
    if (labels?.[target]) host.setAttribute("aria-valuetext", labels[target]);
    else host.removeAttribute("aria-valuetext");
  }

  function frame(now: number) {
    if (!req && !flying) return;
    if (X.length !== n) {
      req = flying = false;
      return;
    }
    const reduced = Boolean(p().reducedMotion) || reducedMotion(),
      b = target,
      cy = rowH / 2 + PAD;
    if (req) {
      req = false;
      // Start (or re-aim) from wherever everything is right now.
      LF = L.slice();
      if (flying && !reduced) {
        // Re-aim mid flight: the stream now leaves from the step nearest its cloud.
        F.set(D);
        let cx = 0;
        for (let i = 0; i < M; i++) cx += D[i * 4];
        cx /= Math.max(1, M);
        origin = X.reduce(
          (best, x, i) => (Math.abs(x - cx) < Math.abs(X[best] - cx) ? i : best),
          0,
        );
      } else {
        // The cloud starts on the disc the stream leaves.
        const ax0 = X[Math.min(n - 1, origin)];
        for (let i = 0; i < M; i++) {
          F[i * 4] = ax0 + grid[i][0];
          F[i * 4 + 1] = grid[i][1];
          F[i * 4 + 2] = origin < n ? 1 : 0;
          F[i * 4 + 3] = 1;
        }
      }
      startAt = now;
      flying = true;
    }
    const a = origin,
      ax = X[Math.min(n - 1, a)],
      bx = X[Math.min(n - 1, b)];
    const run = RUN + HOP * (Math.max(1, Math.abs(b - a)) - 1);
    const total = STAGGER + run * 1.15 + FADE;
    const since = now - startAt;
    const goal = levelsFor(n, b);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, rowH + PAD * 2);

    if (reduced || b >= n || a >= n) {
      // Plain: no grains, everything cross fades; all done (b = n) has no disc to stream to.
      const k = FLOW(clamp(since / PLAIN));
      for (let i = 0; i < L.length; i++) L[i] = LF[i] + (goal[i] - LF[i]) * k;
      if (since >= PLAIN) {
        flying = false;
        origin = b;
      }
      return apply();
    }

    // The front of the stream, from the old disc to the new one.
    const pk = FLOW(clamp(since / (STAGGER * 0.5 + run)));
    const front = ax + (bx - ax) * pk;
    const dir = bx >= ax ? 1 : -1;
    const lo = Math.min(a, b),
      hi = Math.max(a, b);
    // Steps on the way change state as the front crosses them.
    for (let i = 0; i < n; i++) {
      let k = 1;
      if (i >= lo && i <= hi) {
        const at = Math.abs(X[i] - ax) / (Math.abs(bx - ax) + 1e-3);
        k =
          i === b
            ? clamp((since - (STAGGER * 0.5 + run - LAND)) / LAND)
            : clamp((pk - at * (1 - WINDOW)) / WINDOW);
      }
      for (let f = 0; f < SF; f++)
        L[i * SF + f] = LF[i * SF + f] + (goal[i * SF + f] - LF[i * SF + f]) * k;
    }
    // Lines between the two discs fill (or empty) right behind the front.
    const rtl = isRtl();
    for (let k = 0; k < n - 1; k++) {
      const o = n * SF + k;
      if (k < lo || k >= hi) {
        L[o] = goal[o];
        continue;
      }
      if (rtl) {
        const xStart = X[k] - s.disc / 2 - GAP,
          xEnd = X[k + 1] + s.disc / 2 + GAP;
        L[o] = clamp((xStart - front) / (xStart - xEnd + 1e-3));
      } else {
        const x0 = X[k] + s.disc / 2 + GAP,
          x1 = X[k + 1] - s.disc / 2 - GAP;
        L[o] = clamp((front - x0) / (x1 - x0 + 1e-3));
      }
    }

    // The grains: the cloud flattens onto the line and streams, leading edge first.
    const out = clamp((since - (total - FADE)) / FADE);
    ctx.fillStyle = active;
    for (let i = 0; i < M; i++) {
      const g = grid[i],
        o = i * 4;
      const u = (g[0] / s.disc + 0.5) * dir;
      const delay = (0.5 - u * 0.5) * STAGGER * 0.6 + g[2] * STAGGER * 0.4;
      const e = FLOW(clamp((since - delay) / (run * (0.85 + 0.3 * hash(i, 9))))),
        bump = Math.sin(Math.PI * e);
      D[o] = F[o] + (bx + g[0] - F[o]) * e;
      D[o + 1] =
        (F[o + 1] + (g[1] - F[o + 1]) * e) * (1 - FLATTEN * bump) + (g[3] - 0.5) * s.line * bump;
      D[o + 2] = (F[o + 2] + (1 - F[o + 2]) * clamp(since / 60)) * (1 - out);
      D[o + 3] = (F[o + 3] + (1 - F[o + 3]) * e) * (1 - SHRINK * bump);
      if (D[o + 2] <= 0.003) continue;
      ctx.globalAlpha = D[o + 2];
      ctx.beginPath();
      ctx.arc(D[o], D[o + 1] + cy, (dot * D[o + 3]) / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (since >= total) {
      flying = false;
      origin = b;
      for (let i = 0; i < M; i++) D[i * 4 + 2] = 0;
      ctx.clearRect(0, 0, W, rowH + PAD * 2);
      L = goal;
    }
    apply();
  }
  const { kick } = loop(sc, host, frame, () => req || flying);

  /** Streams to step c. */
  function go(c: number) {
    if (c === target) return;
    target = c;
    req = true;
    syncLabels();
    kick();
    if (p().haptics) vibrate(4);
  }

  const ro = new ResizeObserver(() => {
    if (host.clientWidth !== W) layout();
  });
  ro.observe(host);
  onThemeChange(sc, () => {
    paint();
    kick();
  });

  build();
  target = origin = clampCur(p().current);
  syncLabels();
  paint();
  layout();

  return {
    update(next) {
      const changed = props.update(next);
      if (changed.has("steps") || changed.has("size") || changed.has("labelClassName")) {
        // Steps given inline are a new array on every render: rebuild only when they differ.
        const same =
          !changed.has("size") &&
          !changed.has("labelClassName") &&
          JSON.stringify(p().steps) === JSON.stringify(labels ?? n);
        if (!same) {
          build();
          target = origin = clampCur(p().current);
          syncLabels();
          paint();
          layout();
        }
      }
      if (changed.has("onStepPress") && !!p().onStepPress !== hits.childElementCount > 0)
        buildHits();
      if (changed.has("current")) go(clampCur(p().current));
      if (changed.has("activeColor") || changed.has("trackColor")) {
        paint();
        kick();
      }
    },
    destroy() {
      sc.dispose();
      ro.disconnect();
      row.remove();
      labelsRow.remove();
      hits.remove();
      for (const a of [
        "role",
        "aria-valuemin",
        "aria-valuemax",
        "aria-valuenow",
        "aria-valuetext",
        "data-dissolve",
      ])
        host.removeAttribute(a);
    },
  };
}

/** Bars: each move runs for BAR_RUN, plus BAR_HOP per extra segment. Dust lives for LIFE. */
const BAR_RUN = 380;
const BAR_HOP = 140;
const LIFE = 360;
const MAX_DUST = 48;
/** Room above and below the bars for the dust. */
const BAR_PAD = 14;

const BAR_CSS = `
:where([data-dissolve="progress-steps"][data-variant="bars"]) { display: flex; align-items: center; min-height: 24px; }
:where(.dissolve-bars) { position: relative; flex: 1; display: flex; }
:where(.dissolve-bar) { position: relative; flex: 1; overflow: hidden; border-radius: 999px; }
:where(.dissolve-bar-fill) { position: absolute; inset: 0; transform-origin: left center; will-change: transform; }
:where(.dissolve-bars-dust) { position: absolute; left: 0; pointer-events: none; }
:where(.dissolve-bars-hits) { position: absolute; inset: 0; display: flex; }
:where(.dissolve-bars-hits) > button { flex: 1; outline: none; }
:where(.dissolve-bars-hits) > button:focus-visible { outline: 2px solid var(--ring, var(--dissolve-accent)); outline-offset: 2px; border-radius: 6px; }
`;

/** Story style segments: the fill runs on through the steps, its head gathering from (or shedding) grains. */
function createBars(host: HTMLElement, initial: ProgressStepsProps): ProgressStepsInstance {
  injectStyle("dissolve-progress-bars", BAR_CSS);
  const props = propsOf(DEFAULTS, initial);
  const p = () => props.current;
  const sc = scope();

  host.dataset.dissolve = "progress-steps";
  host.dataset.variant = "bars";
  host.setAttribute("role", "progressbar");
  const wrap = el("div", "dissolve-bars");
  const cv = el("canvas", "dissolve-bars-dust");
  const ctx = cv.getContext("2d")!;
  const hits = el("div", "dissolve-bars-hits");
  host.append(wrap, hits);

  let n = 2,
    labels: string[] | null = null,
    s: (typeof PROGRESS_STEPS_SIZES)[ProgressStepsSize] = PROGRESS_STEPS_SIZES.md;
  let fills: HTMLElement[] = [],
    tracks: HTMLElement[] = [];
  let W = 0,
    seg = 0,
    dpr = 1,
    active = "#000";
  let pos = 0,
    from = 0,
    to = 0,
    req = false,
    flying = false,
    startAt = 0;

  const isRtl = () => getComputedStyle(host).direction === "rtl";
  const fillOf = (c: number | undefined) => Math.min(n, Math.max(0, Math.round(c ?? 0)) + 1);
  const headX = (q: number, rtl: boolean) => {
    const raw =
      q <= 0
        ? 0
        : (() => {
            const k = Math.min(n - 1, Math.floor(q - 1e-6));
            return k * (seg + s.barGap) + clamp(q - k) * seg;
          })();
    return rtl ? W - raw : raw;
  };

  function paint() {
    const o = p();
    const bg = rgbOf(token(host, "background", "#19191b"));
    const dark = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255 < 0.5;
    active = o.activeColor ?? token(host, "primary", dark ? "#ededed" : "#171717");
    const track = o.trackColor ?? token(host, "border", dark ? "#27272a" : "#e4e4e7");
    for (const t of tracks) t.style.background = track;
    for (const f of fills) f.style.background = active;
  }

  function build() {
    const o = p();
    s = PROGRESS_STEPS_SIZES[o.size] ?? PROGRESS_STEPS_SIZES.md;
    labels = typeof o.steps === "number" ? null : o.steps;
    n = Math.max(2, typeof o.steps === "number" ? Math.floor(o.steps) : o.steps.length);
    wrap.replaceChildren();
    wrap.style.gap = `${s.barGap}px`;
    wrap.style.height = `${s.bar}px`;
    tracks = [];
    fills = [];
    for (let k = 0; k < n; k++) {
      const t = el("div", "dissolve-bar"),
        f = el("div", "dissolve-bar-fill");
      t.append(f);
      wrap.append(t);
      tracks.push(t);
      fills.push(f);
    }
    wrap.append(cv);
    hits.replaceChildren();
    hits.style.gap = `${s.barGap}px`;
    if (o.onStepPress) {
      for (let i = 0; i < n; i++) {
        const b = el("button");
        b.type = "button";
        Object.assign(b.style, BUTTON);
        b.setAttribute("aria-label", labels?.[i] ?? `Step ${i + 1}`);
        b.addEventListener("click", () => p().onStepPress?.(i));
        hits.append(b);
      }
    }
    host.setAttribute("aria-valuemin", "0");
    host.setAttribute("aria-valuemax", String(n));
  }

  function layout() {
    W = wrap.clientWidth;
    if (W <= 0) return;
    const rtl = isRtl();
    for (const f of fills) f.style.transformOrigin = rtl ? "right center" : "left center";
    seg = (W - s.barGap * (n - 1)) / n;
    dpr = Math.min(3, devicePixelRatio || 1);
    const H = s.bar + BAR_PAD * 2;
    cv.width = Math.round((W + BAR_PAD * 2) * dpr);
    cv.height = Math.round(H * dpr);
    cv.style.cssText = `left:${-BAR_PAD}px;top:${-BAR_PAD}px;width:${W + BAR_PAD * 2}px;height:${H}px`;
    flying = req = false;
    pos = to;
    ctx.clearRect(0, 0, cv.width, cv.height);
    apply();
  }

  const apply = () =>
    fills.forEach((f, k) => {
      f.style.transform = `scaleX(${Math.max(0.0001, clamp(pos - k))})`;
    });

  function frame(now: number) {
    if (!req && !flying) return;
    if (seg <= 0) {
      req = flying = false;
      return;
    }
    const reduced = Boolean(p().reducedMotion) || reducedMotion();
    const rtl = isRtl();
    const flowSign = rtl ? -1 : 1;
    if (req) {
      req = false;
      from = pos;
      startAt = now;
      flying = true;
    }
    const a = from,
      b = to;
    const dur = reduced ? PLAIN : BAR_RUN + BAR_HOP * (Math.max(1, Math.ceil(Math.abs(b - a))) - 1);
    const since = now - startAt;
    pos = a + (b - a) * FLOW(clamp(since / dur));
    const spread = 3 + s.bar * 1.5,
      fwd = b >= a,
      cy = BAR_PAD + s.bar / 2,
      dot = Math.max(2, s.bar * 0.85);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W + BAR_PAD * 2, s.bar + BAR_PAD * 2);
    ctx.fillStyle = active;
    // Grains are born at the head all along the move: forward they drift in from ahead and settle
    // into it, backward they come off the receding head and float away.
    if (!reduced)
      for (let i = 0; i < MAX_DUST; i++) {
        const born = (i / MAX_DUST) * dur,
          e = (since - born) / LIFE;
        if (e < 0 || e > 1) continue;
        const hx = headX(a + (b - a) * FLOW(clamp(born / dur)), rtl);
        const h1 = hash(i, 3),
          h2 = hash(i, 5) - 0.5;
        let x: number, y: number, alpha: number, sz: number;
        if (fwd) {
          const k = 1 - FLOW(e);
          x = hx + flowSign * (3 + h1 * 16) * k;
          y = h2 * 2 * spread * k;
          alpha = Math.min(1, e * 5) * (1 - e * e);
          sz = 0.55 + 0.45 * (1 - k);
        } else {
          x = hx + flowSign * (1 + h1 * 12) * e;
          y = h2 * 2 * spread * 1.4 * e - 3 * e * e;
          alpha = (1 - e) * Math.min(1, e * 8 + 0.4);
          sz = 1 - 0.5 * e;
        }
        if (alpha <= 0.003) continue;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x + BAR_PAD, y + cy, (dot * sz) / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    ctx.globalAlpha = 1;
    if (since >= dur + LIFE) {
      flying = false;
      pos = b;
      ctx.clearRect(0, 0, W + BAR_PAD * 2, s.bar + BAR_PAD * 2);
    }
    apply();
  }
  const { kick } = loop(sc, host, frame, () => req || flying);

  const syncAria = (c: number) => {
    host.setAttribute("aria-valuenow", String(c));
    const t = labels?.[Math.min(c, n - 1)];
    if (t) host.setAttribute("aria-valuetext", t);
    else host.removeAttribute("aria-valuetext");
  };

  const ro = new ResizeObserver(() => {
    if (wrap.clientWidth !== W) layout();
  });
  ro.observe(wrap);
  onThemeChange(sc, () => {
    paint();
    kick();
  });

  build();
  pos = from = to = fillOf(p().current);
  syncAria(Math.round(p().current));
  paint();
  layout();

  return {
    update(next) {
      const changed = props.update(next);
      if (
        changed.has("steps") ||
        changed.has("size") ||
        (changed.has("onStepPress") && !!p().onStepPress !== hits.childElementCount > 0)
      ) {
        const same =
          !changed.has("size") &&
          !changed.has("onStepPress") &&
          JSON.stringify(p().steps) === JSON.stringify(labels ?? n);
        if (!same) {
          build();
          to = fillOf(p().current);
          paint();
          layout();
        }
      }
      if (changed.has("current")) {
        const t = fillOf(p().current);
        syncAria(Math.round(p().current));
        if (t !== to) {
          to = t;
          req = true;
          kick();
          if (p().haptics) vibrate(4);
        }
      }
      if (changed.has("activeColor") || changed.has("trackColor")) {
        paint();
        kick();
      }
    },
    destroy() {
      sc.dispose();
      ro.disconnect();
      wrap.remove();
      hits.remove();
      for (const a of [
        "role",
        "aria-valuemin",
        "aria-valuemax",
        "aria-valuenow",
        "aria-valuetext",
        "data-dissolve",
        "data-variant",
      ])
        host.removeAttribute(a);
    },
  };
}

/** The steps, in the look of the variant prop. A new variant swaps the look in place. */
export function createProgressSteps(
  host: HTMLElement,
  initial: ProgressStepsProps = {},
): ProgressStepsInstance {
  let all: ProgressStepsProps = { ...initial };
  const make = () => (all.variant === "bars" ? createBars : createNumbers)(host, all);
  let inner = make();
  return {
    update(next) {
      const was = all.variant ?? "numbers";
      all = { ...all, ...next };
      if ((all.variant ?? "numbers") !== was) {
        inner.destroy();
        inner = make();
      } else inner.update(next);
    },
    destroy: () => inner.destroy(),
  };
}
