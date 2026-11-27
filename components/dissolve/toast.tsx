"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { capture, reducedMotion } from "./kit";

export type ToastTone = "info" | "success" | "warning" | "error" | "neutral";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastInput {
  id?: string;
  title: string;
  message?: string;
  tone?: ToastTone;
  duration?: number;
  action?: ToastAction;
}

export interface ToastController {
  show: (input: ToastInput | string) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

interface ToastRecord extends Required<Pick<ToastInput, "id" | "title" | "tone" | "duration">> {
  message?: string;
  action?: ToastAction;
}

const MAX_VISIBLE_TOASTS = 3;
const DEFAULT_DURATION_MS = 4200;

const NOOP_CONTROLLER: ToastController = {
  show: () => "",
  dismiss: () => {},
  clear: () => {},
};

const ToastContext = createContext<ToastController>(NOOP_CONTROLLER);

export function useToast(): ToastController {
  return useContext(ToastContext);
}

function getToneAppearance(tone: ToastTone) {
  switch (tone) {
    case "success":
      return {
        border: "border-success/40",
        accent: "text-success",
        badge: "bg-success-soft text-success",
        icon: CheckCircle2,
        role: "status" as const,
      };
    case "error":
      return {
        border: "border-destructive/45",
        accent: "text-destructive",
        badge: "bg-destructive-soft text-destructive",
        icon: AlertCircle,
        role: "alert" as const,
      };
    case "warning":
      return {
        border: "border-warning/45",
        accent: "text-warning",
        badge: "bg-warning-soft text-warning",
        icon: AlertTriangle,
        role: "status" as const,
      };
    case "info":
      return {
        border: "border-info/45",
        accent: "text-info",
        badge: "bg-info-soft text-info",
        icon: Info,
        role: "status" as const,
      };
    default:
      return {
        border: "border-border-color",
        accent: "text-text-primary",
        badge: "bg-secondary text-text-secondary",
        icon: Info,
        role: "status" as const,
      };
  }
}

async function playDustExit(node: HTMLElement): Promise<void> {
  if (typeof window === "undefined" || reducedMotion()) return;
  try {
    const snap = await capture(node);
    if (!snap.w || !snap.h) return;

    const overlay = document.createElement("canvas");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pad = 28;
    overlay.width = Math.ceil((snap.w + pad * 2) * dpr);
    overlay.height = Math.ceil((snap.h + pad * 2) * dpr);
    overlay.style.cssText = `position:fixed;left:${snap.x - pad}px;top:${snap.y - pad}px;width:${snap.w + pad * 2}px;height:${snap.h + pad * 2}px;pointer-events:none;z-index:200;`;
    document.body.appendChild(overlay);

    const ctx = overlay.getContext("2d");
    if (!ctx) {
      overlay.remove();
      return;
    }

    const srcCtx = snap.source.getContext("2d");
    const step = 6;
    const cols = Math.max(1, Math.floor(snap.w / step));
    const rows = Math.max(1, Math.floor(snap.h / step));
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      color: string;
      size: number;
    }> = [];

    if (srcCtx) {
      const img = srcCtx.getImageData(0, 0, snap.source.width, snap.source.height).data;
      const sx = snap.source.width / snap.w;
      const sy = snap.source.height / snap.h;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const px = Math.min(snap.source.width - 1, Math.floor((c + 0.5) * step * sx));
          const py = Math.min(snap.source.height - 1, Math.floor((r + 0.5) * step * sy));
          const idx = (py * snap.source.width + px) * 4;
          const a = img[idx + 3];
          if (a < 24) continue;
          const rnd = Math.sin(c * 19.3 + r * 47.7) * 43758.5453;
          const f = rnd - Math.floor(rnd);
          particles.push({
            x: pad + (c + 0.5) * step,
            y: pad + (r + 0.5) * step,
            vx: (f - 0.5) * 46,
            vy: -14 - f * 28,
            color: `rgba(${img[idx]},${img[idx + 1]},${img[idx + 2]},${(a / 255).toFixed(2)})`,
            size: 2.2 + f * 1.4,
          });
        }
      }
    }

    if (particles.length === 0) {
      overlay.remove();
      return;
    }

    const start = performance.now();
    const duration = 340;
    const render = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, snap.w + pad * 2, snap.h + pad * 2);
      ctx.globalAlpha = 1 - t * t;
      for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x + p.vx * t, p.y + p.vy * t, p.size * (1 - t * 0.45), 0, Math.PI * 2);
        ctx.fill();
      }
      if (t < 1) {
        requestAnimationFrame(render);
      } else {
        overlay.remove();
      }
    };
    requestAnimationFrame(render);
  } catch {
    // Fallback cleanly if canvas capture is unavailable
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const nodeMapRef = useRef(new Map<string, HTMLDivElement>());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }

    const node = nodeMapRef.current.get(id);
    if (node) {
      void playDustExit(node);
    }

    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clear = useCallback(() => {
    for (const timer of timersRef.current.values()) {
      clearTimeout(timer);
    }
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const show = useCallback(
    (input: ToastInput | string): string => {
      const normalized: ToastInput = typeof input === "string" ? { title: input } : input;
      const title = normalized.title.trim();
      if (!title) return "";

      const id =
        normalized.id ||
        (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

      const duration = normalized.duration ?? DEFAULT_DURATION_MS;
      const record: ToastRecord = {
        id,
        title,
        message: normalized.message,
        tone: normalized.tone ?? "info",
        duration,
        action: normalized.action,
      };

      setToasts((prev) => {
        const filtered = prev.filter((item) => item.id !== id);
        const next = [...filtered, record];
        if (next.length > MAX_VISIBLE_TOASTS) {
          const overflow = next.slice(0, next.length - MAX_VISIBLE_TOASTS);
          for (const dropped of overflow) {
            const t = timersRef.current.get(dropped.id);
            if (t) {
              clearTimeout(t);
              timersRef.current.delete(dropped.id);
            }
            const droppedNode = nodeMapRef.current.get(dropped.id);
            if (droppedNode) {
              void playDustExit(droppedNode);
            }
          }
          return next.slice(-MAX_VISIBLE_TOASTS);
        }
        return next;
      });

      const existingTimer = timersRef.current.get(id);
      if (existingTimer) clearTimeout(existingTimer);

      if (duration > 0) {
        const timer = setTimeout(() => {
          dismiss(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const controller = useMemo<ToastController>(
    () => ({ show, dismiss, clear }),
    [show, dismiss, clear],
  );

  return (
    <ToastContext.Provider value={controller}>
      {children}
      {toasts.length > 0 && (
        <section
          aria-live="polite"
          aria-label="اعلان‌ها"
          dir="rtl"
          className="pointer-events-none fixed inset-x-3 bottom-24 z-[120] flex flex-col items-center gap-2 md:inset-x-auto md:start-6 md:bottom-6 md:items-start"
        >
          {toasts.map((item) => {
            const appearance = getToneAppearance(item.tone);
            const ToneIcon = appearance.icon;

            return (
              <div
                key={item.id}
                ref={(el) => {
                  if (el) nodeMapRef.current.set(item.id, el);
                  else nodeMapRef.current.delete(item.id);
                }}
                role={appearance.role}
                className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-2xl border bg-card-bg-solid/95 px-3.5 py-3 text-right text-text-primary shadow-lg backdrop-blur-md transition-all duration-200 animate-slide-in ${appearance.border}`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-xl ${appearance.badge}`}
                >
                  <ToneIcon className="size-4" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="line-clamp-2 text-xs font-semibold leading-5 text-text-primary">
                    {item.title}
                  </p>
                  {item.message && (
                    <p className="line-clamp-2 text-[11px] leading-4 text-text-secondary">
                      {item.message}
                    </p>
                  )}
                  {item.action && (
                    <button
                      type="button"
                      onClick={() => {
                        item.action?.onClick();
                        dismiss(item.id);
                      }}
                      className={`mt-1 inline-flex cursor-pointer items-center text-[11px] font-bold hover:underline ${appearance.accent}`}
                    >
                      {item.action.label}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  aria-label="بستن اعلان"
                  className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-card-hover-bg hover:text-text-primary"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </section>
      )}
    </ToastContext.Provider>
  );
}
