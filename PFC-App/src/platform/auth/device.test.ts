import { describe, expect, it } from "vitest";
import { deviceLabel, ipHint } from "./device";

describe("device label", () => {
  it("recognises common phones and desktops", () => {
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1")).toBe("Safari · iPhone");
    expect(deviceLabel("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36")).toBe("Chrome · Android");
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 Edg/126.0")).toBe("Edge · Windows");
    expect(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Gecko/20100101 Firefox/127.0")).toBe("Firefox · macOS");
    expect(deviceLabel(null)).toBe("Trình duyệt · Thiết bị khác");
  });
  it("keeps only a coarse IP hint", () => {
    expect(ipHint("113.161.42.7")).toBe("113.161.x.x");
    expect(ipHint("2001:ee0:4f1::1")).toBe("2001:ee0:…");
    expect(ipHint("local")).toBeNull();
    expect(ipHint("garbage")).toBeNull();
  });
});
