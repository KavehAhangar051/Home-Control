"use client";

import { useEffect, useMemo, useRef } from "react";
import { getBaseStyles, getThemeStyles, getUtilityStyles, getAnimationStyles } from "./styles";

interface DashboardStylesProps {
  accent3: string;
  accent4: string;
  isDark: boolean;
  animationsEnabled: boolean;
}

function suppressTransitionsTemporarily() {
  if (typeof document === "undefined") return;
  const style = document.createElement("style");
  style.append(document.createTextNode("*,*::before,*::after{transition:none !important}"));
  document.head.append(style);

  const _flushReflow = document.body.offsetHeight;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      style.remove();
    });
  });
}

export default function DashboardStyles({
  accent3,
  accent4,
  isDark,
  animationsEnabled,
}: DashboardStylesProps) {
  const prevIsDarkRef = useRef(isDark);

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
      `${getBaseStyles(isDark)}${getThemeStyles({ accent3, accent4, isDark })}${getUtilityStyles({ isDark, animationsEnabled })}${getAnimationStyles({ isDark })}`,
    [accent3, accent4, isDark, animationsEnabled],
  );
  return <style>{css}</style>;
}
