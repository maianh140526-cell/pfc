"use client";

import { useCallback, useEffect, useState } from "react";
import {
  THEME_COLORS,
  THEME_STORAGE_KEY,
  parseThemePreference,
  resolveTheme,
  type ThemePreference,
} from "./theme";

function readStored(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

function apply(pref: ThemePreference) {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const color = THEME_COLORS[resolveTheme(pref, dark)];
  // Keep the browser/status bar colour in sync with an explicit override.
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", color));
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    const stored = readStored();
    setPreference(stored);
    if (stored !== "system") apply(stored);
  }, []);

  const choose = useCallback((pref: ThemePreference) => {
    setPreference(pref);
    try {
      if (pref === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch {
      /* storage blocked (private mode) — still apply for this visit */
    }
    apply(pref);
  }, []);

  return { preference, choose };
}
