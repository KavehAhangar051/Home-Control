"use client";

import { usePreferencesStore } from "@/features/iot/hooks/usePreferencesStore";
import { audioContextManager } from "@/lib/audio/context";
import { debugLog } from "@/lib/debug";
import { isHapticsSupported, triggerHaptic } from "@/lib/haptics";
import { isWakeLockSupported } from "@/lib/hooks/use-wake-lock";

export const DASHBOARD_CONSENT_COOKIE = "hc_permissions_consent_v1";
const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export type DashboardPermissionId =
  | "storage"
  | "microphone"
  | "audio"
  | "notifications"
  | "wakeLock";

export type PermissionStateStatus = "granted" | "prompt" | "denied" | "unsupported";

export interface DashboardConsentRecord {
  version: 1;
  completedAt: number;
  mode: "all" | "essential";
  permissions: Record<DashboardPermissionId, boolean>;
}

export interface DashboardPermissionSnapshot {
  id: DashboardPermissionId;
  status: PermissionStateStatus;
  detail?: string;
}

export type PermissionSelectionMap = Record<DashboardPermissionId, boolean>;

export interface RequestPermissionsResult {
  consent: DashboardConsentRecord;
  statuses: Record<DashboardPermissionId, DashboardPermissionSnapshot>;
  blockedIds: DashboardPermissionId[];
}

export const DEFAULT_PERMISSION_SELECTION: PermissionSelectionMap = {
  storage: true,
  microphone: true,
  audio: true,
  notifications: true,
  wakeLock: false,
};

const modalListeners = new Set<(open: boolean) => void>();

export function subscribePermissionsModal(listener: (open: boolean) => void): () => void {
  modalListeners.add(listener);

  return () => {
    modalListeners.delete(listener);
  };
}

export function openPermissionsSetupModal(): void {
  for (const listener of modalListeners) {
    listener(true);
  }
}

function isValidConsentRecord(value: unknown): value is DashboardConsentRecord {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DashboardConsentRecord>;

  return (
    candidate.version === 1 &&
    typeof candidate.completedAt === "number" &&
    (candidate.mode === "all" || candidate.mode === "essential") &&
    Boolean(candidate.permissions && typeof candidate.permissions === "object")
  );
}

function readCookieValue(name: string): string | null {
  if (typeof document === "undefined" || !document.cookie) return null;

  const prefix = `${name}=`;
  const parts = document.cookie.split(";");

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (part.startsWith(prefix)) {
      return part.slice(prefix.length);
    }
  }

  return null;
}

/**
 * Reads the persisted dashboard permission consent record from the browser Cookie first,
 * falling back to `localStorage` for non-HTTP WebView/Capacitor or strict iframe contexts.
 */
export function readDashboardConsent(): DashboardConsentRecord | null {
  if (typeof window === "undefined") return null;

  const cookieRaw = readCookieValue(DASHBOARD_CONSENT_COOKIE);

  if (cookieRaw) {
    try {
      const parsed: unknown = JSON.parse(decodeURIComponent(cookieRaw));
      if (isValidConsentRecord(parsed)) return parsed;
    } catch {
      // Ignore malformed cookie and fall through to localStorage
    }
  }

  try {
    const storedRaw = window.localStorage.getItem(DASHBOARD_CONSENT_COOKIE);
    if (!storedRaw) return null;
    const parsed: unknown = JSON.parse(storedRaw);

    return isValidConsentRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function hasDashboardConsent(): boolean {
  return readDashboardConsent() !== null;
}

interface CookieStoreLike {
  set: (options: {
    name: string;
    value: string;
    path?: string;
    expires?: number;
    sameSite?: "strict" | "lax" | "none";
  }) => Promise<void>;
  delete: (options: { name: string; path?: string }) => Promise<void>;
}

function getCookieStore(): CookieStoreLike | undefined {
  if (typeof window === "undefined" || !("cookieStore" in window)) return undefined;

  return (window as Window & { cookieStore?: CookieStoreLike }).cookieStore;
}

/**
 * Persists the user's permission setup choices in a 1-year browser Cookie (`SameSite=Lax`)
 * and mirrors the record to `localStorage` so Web, PWA, and Capacitor Android builds all stay synced.
 */
export function writeDashboardConsent(record: DashboardConsentRecord): void {
  if (typeof window === "undefined") return;

  const serialized = JSON.stringify(record);
  const encoded = encodeURIComponent(serialized);
  const cookieStore = getCookieStore();

  if (cookieStore && window.isSecureContext) {
    void cookieStore
      .set({
        name: DASHBOARD_CONSENT_COOKIE,
        value: encoded,
        path: "/",
        expires: Date.now() + CONSENT_MAX_AGE_SECONDS * 1000,
        sameSite: "lax",
      })
      .catch(() => {
        // Ignore Cookie Store rejection in sandboxed or non-HTTP contexts
      });
  } else if (typeof document !== "undefined") {
    const secureFlag = window.location?.protocol === "https:" ? "; Secure" : "";
    // biome-ignore lint/suspicious/noDocumentCookie: Fallback for browsers/WebViews without async Cookie Store API
    document.cookie = `${DASHBOARD_CONSENT_COOKIE}=${encoded}; Path=/; Max-Age=${CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secureFlag}`;
  }

  try {
    window.localStorage.setItem(DASHBOARD_CONSENT_COOKIE, serialized);
  } catch (error) {
    debugLog.warn("Permissions", "Could not mirror consent record in localStorage.", error);
  }
}

export function clearDashboardConsent(): void {
  if (typeof window === "undefined") return;

  const cookieStore = getCookieStore();

  if (cookieStore && window.isSecureContext) {
    void cookieStore.delete({ name: DASHBOARD_CONSENT_COOKIE, path: "/" }).catch(() => {
      // Ignore Cookie Store rejection in sandboxed or non-HTTP contexts
    });
  } else if (typeof document !== "undefined") {
    const secureFlag = window.location?.protocol === "https:" ? "; Secure" : "";
    // biome-ignore lint/suspicious/noDocumentCookie: Fallback for browsers/WebViews without async Cookie Store API
    document.cookie = `${DASHBOARD_CONSENT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secureFlag}`;
  }

  try {
    window.localStorage.removeItem(DASHBOARD_CONSENT_COOKIE);
  } catch (error) {
    debugLog.warn("Permissions", "Could not clear consent record from localStorage.", error);
  }
}

async function probeStoragePermission(): Promise<DashboardPermissionSnapshot> {
  if (typeof window === "undefined") {
    return { id: "storage", status: "unsupported" };
  }

  let persisted = false;

  if (navigator.storage && typeof navigator.storage.persisted === "function") {
    try {
      persisted = await navigator.storage.persisted();
    } catch {
      persisted = false;
    }
  }

  const hasConsent = hasDashboardConsent();

  if (persisted || hasConsent) {
    return {
      id: "storage",
      status: "granted",
      detail: persisted ? "حافظه پایدار فعال است" : "کوکی و حافظه محلی فعال است",
    };
  }

  return { id: "storage", status: "prompt" };
}

async function probeMicrophonePermission(): Promise<DashboardPermissionSnapshot> {
  if (typeof navigator === "undefined") {
    return { id: "microphone", status: "unsupported" };
  }

  const hasSpeechOrMedia =
    Boolean(navigator.mediaDevices?.getUserMedia) ||
    "SpeechRecognition" in window ||
    "webkitSpeechRecognition" in window;

  if (!hasSpeechOrMedia) {
    return { id: "microphone", status: "unsupported" };
  }

  if (navigator.permissions && typeof navigator.permissions.query === "function") {
    try {
      const status = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });

      return { id: "microphone", status: status.state };
    } catch {
      // Safari/WebView may throw for "microphone" in permissions.query; fall back to prompt
    }
  }

  const saved = readDashboardConsent();
  if (saved?.permissions.microphone) {
    return { id: "microphone", status: "granted", detail: "تاییدشده در راه‌اندازی" };
  }

  return { id: "microphone", status: "prompt" };
}

function probeAudioPermission(): DashboardPermissionSnapshot {
  if (typeof window === "undefined") {
    return { id: "audio", status: "unsupported" };
  }

  const hasAudioApi = "AudioContext" in window || "webkitAudioContext" in window;
  if (!hasAudioApi) {
    return { id: "audio", status: "unsupported" };
  }

  if (audioContextManager.isUnlockedAndPrimed()) {
    return { id: "audio", status: "granted", detail: "موتور صدا آماده است" };
  }

  const saved = readDashboardConsent();
  if (saved?.permissions.audio) {
    return { id: "audio", status: "granted", detail: "آماده با اولین لمس" };
  }

  return { id: "audio", status: "prompt" };
}

function probeNotificationsPermission(): DashboardPermissionSnapshot {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { id: "notifications", status: "unsupported" };
  }

  switch (Notification.permission) {
    case "granted":
      return { id: "notifications", status: "granted" };
    case "denied":
      return { id: "notifications", status: "denied" };
    default:
      return { id: "notifications", status: "prompt" };
  }
}

function probeWakeLockPermission(): DashboardPermissionSnapshot {
  if (!isWakeLockSupported()) {
    return { id: "wakeLock", status: "unsupported" };
  }

  const enabled = usePreferencesStore.getState().wakeLockEnabled;

  return {
    id: "wakeLock",
    status: enabled ? "granted" : "prompt",
  };
}

/**
 * Inspects real browser APIs for every permission/capability used by the dashboard.
 */
export async function probeAllDashboardPermissions(): Promise<
  Record<DashboardPermissionId, DashboardPermissionSnapshot>
> {
  const [storage, microphone] = await Promise.all([
    probeStoragePermission(),
    probeMicrophonePermission(),
  ]);

  return {
    storage,
    microphone,
    audio: probeAudioPermission(),
    notifications: probeNotificationsPermission(),
    wakeLock: probeWakeLockPermission(),
  };
}

async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;

  if (navigator.storage && typeof navigator.storage.persist === "function") {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }

  return true;
}

async function requestMicrophoneAccess(): Promise<PermissionStateStatus> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "unsupported";
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Immediately stop microphone capture tracks once permission is obtained
    for (const track of stream.getTracks()) {
      track.stop();
    }

    return "granted";
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        return "denied";
      }
      if (error.name === "NotFoundError" || error.name === "NotSupportedError") {
        return "unsupported";
      }
    }

    return "denied";
  }
}

async function requestNotificationAccess(): Promise<PermissionStateStatus> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";

  try {
    const result = await Notification.requestPermission();

    if (result === "granted") return "granted";
    if (result === "denied") return "denied";

    return "prompt";
  } catch {
    return "denied";
  }
}

/**
 * Requests all selected dashboard permissions inside a single user click gesture,
 * unlocks Web Audio + optional Wake Lock, and persists the resulting consent cookie.
 */
export async function requestSelectedDashboardPermissions(
  selection: PermissionSelectionMap,
  mode: "all" | "essential" = "all",
): Promise<RequestPermissionsResult> {
  // Synchronously initiate user-activation-sensitive browser calls on click tick
  if (selection.audio) {
    audioContextManager.unlock();
  }

  const storagePromise = requestStoragePersistence();
  const micPromise =
    mode === "all" && selection.microphone ? requestMicrophoneAccess() : Promise.resolve(null);
  const notificationPromise =
    mode === "all" && selection.notifications ? requestNotificationAccess() : Promise.resolve(null);

  if (mode === "all") {
    usePreferencesStore.getState().setWakeLockEnabled(Boolean(selection.wakeLock));
  }

  const [storagePersisted, micResult, notificationResult] = await Promise.all([
    storagePromise,
    micPromise,
    notificationPromise,
  ]);

  const initialStatuses = await probeAllDashboardPermissions();

  const effectiveMicStatus = micResult ?? initialStatuses.microphone.status;
  const effectiveNotifStatus = notificationResult ?? initialStatuses.notifications.status;

  const consent: DashboardConsentRecord = {
    version: 1,
    completedAt: Date.now(),
    mode,
    permissions: {
      storage: true,
      microphone: effectiveMicStatus === "granted",
      audio: Boolean(selection.audio),
      notifications: effectiveNotifStatus === "granted",
      wakeLock: mode === "all" && Boolean(selection.wakeLock) && isWakeLockSupported(),
    },
  };

  writeDashboardConsent(consent);

  const statuses: Record<DashboardPermissionId, DashboardPermissionSnapshot> = {
    storage: {
      id: "storage",
      status: "granted",
      detail: storagePersisted ? "حافظه پایدار تایید شد" : "کوکی رضایت ذخیره شد",
    },
    microphone: {
      id: "microphone",
      status: effectiveMicStatus,
    },
    audio: probeAudioPermission(),
    notifications: {
      id: "notifications",
      status: effectiveNotifStatus,
    },
    wakeLock: probeWakeLockPermission(),
  };

  const blockedIds: DashboardPermissionId[] = [];
  if (mode === "all" && selection.microphone && statuses.microphone.status === "denied") {
    blockedIds.push("microphone");
  }
  if (mode === "all" && selection.notifications && statuses.notifications.status === "denied") {
    blockedIds.push("notifications");
  }

  if (blockedIds.length === 0 && selection.audio) {
    if (isHapticsSupported()) {
      triggerHaptic("success");
    }
  }

  return {
    consent,
    statuses,
    blockedIds,
  };
}

/**
 * Dispatches a native OS/browser notification only when the dashboard tab is in the background
 * (`visibilityState === "hidden"`), Notification permission is granted, and user consented.
 */
export function notifyWhenBackgrounded(title: string, body: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (document.visibilityState !== "hidden") return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const consent = readDashboardConsent();
  if (consent && !consent.permissions.notifications) return;

  try {
    new Notification(title, {
      body,
      icon: "./icons/pwa-192x192.png",
      dir: "rtl",
      lang: "fa",
    });
  } catch (error) {
    debugLog.warn("Permissions", "Background notification could not be shown.", error);
  }
}
