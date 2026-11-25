import { describe, expect, it } from "vitest";
import { isIosSafari, isIosUserAgent, resolveInstallMode } from "./platform-detect";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1";
const IPADOS = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";

describe("platform detection", () => {
  it("detects iPhone and iPadOS-as-Mac", () => {
    expect(isIosUserAgent(IPHONE_SAFARI)).toBe(true);
    expect(isIosUserAgent(IPADOS, 5)).toBe(true);
    expect(isIosUserAgent(IPADOS, 0)).toBe(false);
    expect(isIosUserAgent(ANDROID)).toBe(false);
  });
  it("distinguishes Safari from other iOS browsers", () => {
    expect(isIosSafari(IPHONE_SAFARI)).toBe(true);
    expect(isIosSafari(IPHONE_CHROME)).toBe(false);
  });
  it("picks the install mode", () => {
    expect(resolveInstallMode({ standalone: true, hasDeferredPrompt: true, ios: false })).toBe("installed");
    expect(resolveInstallMode({ standalone: false, hasDeferredPrompt: true, ios: false })).toBe("native-prompt");
    expect(resolveInstallMode({ standalone: false, hasDeferredPrompt: false, ios: true })).toBe("ios-manual");
    expect(resolveInstallMode({ standalone: false, hasDeferredPrompt: false, ios: false })).toBe("unsupported");
  });
});
