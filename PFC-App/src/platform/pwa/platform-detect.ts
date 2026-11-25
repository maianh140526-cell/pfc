/** Pure helpers for install UX. Inputs are passed in so they can be unit tested. */

export type InstallMode = "installed" | "native-prompt" | "ios-manual" | "unsupported";

export function isIosUserAgent(ua: string, maxTouchPoints = 0): boolean {
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports itself as Mac; touch support gives it away.
  return /Macintosh/.test(ua) && maxTouchPoints > 1;
}

/** Only Safari can add to the iOS home screen on older iOS; other iOS browsers vary. */
export function isIosSafari(ua: string): boolean {
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
}

export function resolveInstallMode(input: {
  standalone: boolean;
  hasDeferredPrompt: boolean;
  ios: boolean;
}): InstallMode {
  if (input.standalone) return "installed";
  if (input.hasDeferredPrompt) return "native-prompt";
  if (input.ios) return "ios-manual";
  return "unsupported";
}
