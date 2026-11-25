/** Theme preference (mockup 101: Sáng / Tối / Tự động). Pure — no DOM access. */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "pfc-theme";
export const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#f7f6fc",
  dark: "#12111c",
};

export function parseThemePreference(raw: unknown): ThemePreference {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (pref === "system") return systemPrefersDark ? "dark" : "light";
  return pref;
}

/**
 * Inline script run in <head> before paint, so an explicit choice never flashes the
 * wrong theme. Only sets data-theme for explicit choices; "system" is left to CSS.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(p==="light"||p==="dark"){document.documentElement.setAttribute("data-theme",p);}}catch(e){}})();`;
