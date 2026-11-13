"use client";

import { useEffect, useMemo, useRef } from "react";
import { useIoTStore } from "@/features/iot/hooks/useIoTStore";
import {
  applyDashboardFontToDocument,
  type DashboardFontId,
  DEFAULT_DASHBOARD_FONT,
  getStoredDashboardFont,
} from "@/lib/fonts";
import { getBaseStyles, getThemeStyles, getUtilityStyles } from "./styles";

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

export default function DashboardStyles({
  accent3,
  accent4,
  isDark,
  animationsEnabled,
  darkBlackness,
  lightWhiteness,
  selectedFont = DEFAULT_DASHBOARD_FONT,
}: DashboardStylesProps) {
  const prevIsDarkRef = useRef(isDark);

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
    if (prevIsDarkRef.current !== isDark) {
      prevIsDarkRef.current = isDark;
      suppressTransitionsTemporarily();
    }
  }, [isDark]);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => suppressTransitionsTemporarily();
    mql.addEventListener("change", handleChange);

    return () => mql.removeEventListener("change", handleChange);
  }, []);

  const css = useMemo(
    () =>
      `${getBaseStyles(isDark)}${getThemeStyles({ accent3, accent4, isDark, darkBlackness, lightWhiteness, selectedFont })}${getUtilityStyles({ isDark, animationsEnabled })}`,
    [accent3, accent4, isDark, animationsEnabled, darkBlackness, lightWhiteness, selectedFont],
  );

  return <style>{css}</style>;
}
