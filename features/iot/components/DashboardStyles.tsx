"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  applyDashboardFontToDocument,
  type DashboardFontId,
  DEFAULT_DASHBOARD_FONT,
  getStoredDashboardFont,
} from "@/lib/fonts";
import {
  computeThemeCssVariables,
  getBaseStyles,
  getStaticThemeRules,
  getUtilityStyles,
} from "./styles";

interface DashboardStylesProps {
  accent3: string;
  accent4: string;
  isDark: boolean;
  animationsEnabled: boolean;
  darkBlackness?: number;
  lightWhiteness?: number;
  selectedFont?: DashboardFontId;
}

function suppressTransitionsTemporarily() {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.classList.add("theme-switching");

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove("theme-switching");
    });
  });
}

function applyChangedCssVars(
  rootStyle: CSSStyleDeclaration,
  nextVars: Record<string, string>,
  appliedCache: Record<string, string>,
): void {
  for (const [key, value] of Object.entries(nextVars)) {
    if (appliedCache[key] !== value) {
      rootStyle.setProperty(key, value);
      appliedCache[key] = value;
    }
  }
}

function DashboardStyles({
  accent3,
  accent4,
  isDark,
  animationsEnabled,
  darkBlackness,
  lightWhiteness,
  selectedFont = DEFAULT_DASHBOARD_FONT,
}: DashboardStylesProps) {
  const prevIsDarkRef = useRef(isDark);
  const appliedVarsRef = useRef<Record<string, string>>({});
  const pendingRafRef = useRef<number | null>(null);
  const hasHydratedVarsRef = useRef(false);

  useEffect(() => {
    const storedFont = getStoredDashboardFont();

    if (storedFont !== DEFAULT_DASHBOARD_FONT) {
      useIoTStore.getState().setSelectedFont(storedFont);
    } else {
      applyDashboardFontToDocument(DEFAULT_DASHBOARD_FONT);
    }
  }, []);

  useEffect(() => {
    applyDashboardFontToDocument(selectedFont);
  }, [selectedFont]);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => suppressTransitionsTemporarily();
    mql.addEventListener("change", handleChange);

    return () => mql.removeEventListener("change", handleChange);
  }, []);

  const themeVars = useMemo(
    () =>
      computeThemeCssVariables({
        accent3,
        accent4,
        isDark,
        darkBlackness,
        lightWhiteness,
        selectedFont,
      }),
    [accent3, accent4, isDark, darkBlackness, lightWhiteness, selectedFont],
  );

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;

    const polarityChanged = prevIsDarkRef.current !== isDark;

    if (polarityChanged) {
      prevIsDarkRef.current = isDark;
      suppressTransitionsTemporarily();
    }

    // Apply synchronously on first paint and dark/light switches (zero visual flash);
    // coalesce rapid slider/color-picker drags to a single animation frame.
    if (!hasHydratedVarsRef.current || polarityChanged) {
      hasHydratedVarsRef.current = true;
      if (pendingRafRef.current !== null) {
        cancelAnimationFrame(pendingRafRef.current);
        pendingRafRef.current = null;
      }
      applyChangedCssVars(document.documentElement.style, themeVars, appliedVarsRef.current);

      return;
    }

    if (pendingRafRef.current !== null) {
      cancelAnimationFrame(pendingRafRef.current);
    }

    pendingRafRef.current = requestAnimationFrame(() => {
      pendingRafRef.current = null;
      applyChangedCssVars(document.documentElement.style, themeVars, appliedVarsRef.current);
    });

    return () => {
      if (pendingRafRef.current !== null) {
        cancelAnimationFrame(pendingRafRef.current);
        pendingRafRef.current = null;
      }
    };
  }, [isDark, themeVars]);

  // Structural CSS only depends on dark/light polarity and animationsEnabled —
  // dragging darkness/whiteness/accent sliders never triggers <style> re-parsing.
  const staticCss = useMemo(
    () =>
      `${getBaseStyles(isDark)}${getStaticThemeRules(isDark)}${getUtilityStyles({ isDark, animationsEnabled })}`,
    [isDark, animationsEnabled],
  );

  return <style>{staticCss}</style>;
}

export default memo(DashboardStyles);
