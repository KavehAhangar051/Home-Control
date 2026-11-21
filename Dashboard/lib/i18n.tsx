"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef } from "react";

/**
 * A component's messages. Plain strings with `{name}` placeholders, so a
 * dictionary stays JSON-serializable and can be passed from a server layout.
 * There are no plural forms: write messages that read correctly for any count.
 */
export type Messages = Record<string, string>;

/** A language file: component namespace → any subset of that component's messages. */
export type LocaleMessages = Record<string, Partial<Messages>>;

type LocaleContextValue = {
  locale?: string;
  messages: LocaleMessages;
};

const NO_MESSAGES: LocaleMessages = {};
const PLACEHOLDER_REGEX = /\{(\w+)\}/g;
const MAX_NUMBER_FORMAT_CACHE = 16;
const numberFormatterCache = new Map<string, Intl.NumberFormat>();

const LocaleContext = createContext<LocaleContextValue>({ messages: NO_MESSAGES });

function shallowEqualRecord(
  a: Record<string, string | undefined> | undefined,
  b: Record<string, string | undefined> | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (a[key] !== b[key]) return false;
  }

  return true;
}

/** Without a locale, digits stay plain so server and client render the same text. */
function formatNumber(value: number, locale?: string) {
  if (!locale) return String(value);

  let formatter = numberFormatterCache.get(locale);

  if (!formatter) {
    if (numberFormatterCache.size >= MAX_NUMBER_FORMAT_CACHE) {
      const oldestKey = numberFormatterCache.keys().next().value;

      if (oldestKey !== undefined) {
        numberFormatterCache.delete(oldestKey);
      }
    }

    formatter = new Intl.NumberFormat(locale);
    numberFormatterCache.set(locale, formatter);
  }

  return formatter.format(value);
}

export interface LocaleProviderProps {
  /** BCP 47 tag, e.g. `de`, `pt-BR`. Drives `Intl` number formatting. */
  locale: string;
  /**
   * Component namespace → translated strings. Missing keys fall back to English.
   * Pass a stable object (a module constant, imported JSON or a memoized value):
   * a new object each render gives every translated component a new `t`.
   */
  messages?: LocaleMessages;
  children: ReactNode;
}

export function LocaleProvider({ locale, messages = NO_MESSAGES, children }: LocaleProviderProps) {
  const value = useMemo(() => ({ locale, messages }), [locale, messages]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export interface LocaleState {
  locale?: string;
}

export function useLocale(): LocaleState {
  return { locale: useContext(LocaleContext).locale };
}

/**
 * Resolves a component's strings: `labels` prop, then the provider's
 * messages for `namespace`, then the component's English `defaults`.
 * Numbers passed as values are formatted for the provider's locale.
 */
export function useMessages<T extends Messages>(
  namespace: string,
  defaults: T,
  labels?: Partial<T>,
) {
  const { locale, messages } = useContext(LocaleContext);
  const provided = messages[namespace];
  // Inline `labels={{ … }}` is a new object every render. Stabilizing by shallow
  // key/value comparison keeps `t` one identity without per-render JSON.stringify/parse.
  const stableLabelsRef = useRef<Partial<T> | undefined>(labels);

  if (!shallowEqualRecord(stableLabelsRef.current, labels)) {
    stableLabelsRef.current = labels;
  }

  const stableLabels = stableLabelsRef.current;

  return useCallback(
    (key: keyof T & string, values?: Record<string, string | number>) => {
      const template = stableLabels?.[key] ?? provided?.[key] ?? defaults[key];

      if (!values || !template.includes("{")) return template;

      return template.replace(PLACEHOLDER_REGEX, (match, name: string) => {
        const value = values[name];

        if (value === undefined) return match;

        return Number.isFinite(value) ? formatNumber(Number(value), locale) : String(value);
      });
    },
    [defaults, stableLabels, locale, provided],
  );
}
