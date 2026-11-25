"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HubId } from "./config";

export class HubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
  get offline() {
    return this.code === "HUB_OFFLINE";
  }
  get unauthorized() {
    return this.status === 401;
  }
}

/** Turns the different hub error shapes into one readable Vietnamese message. */
function messageOf(body: unknown, status: number): { message: string; code?: string } {
  const b = body as Record<string, unknown> | null;
  const err = b?.error;
  if (typeof err === "string") return { message: err, code: typeof b?.code === "string" ? b.code : undefined };
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string") return { message: e.message, code: typeof e.code === "string" ? e.code : undefined };
    const fieldErrors = e.fieldErrors as Record<string, string[]> | undefined;
    const first = fieldErrors && Object.values(fieldErrors).flat()[0];
    if (first) return { message: first };
  }
  if (status === 401) return { message: "Bạn cần đăng nhập." };
  if (status === 403) return { message: "Bạn không có quyền thực hiện thao tác này." };
  if (status === 404) return { message: "Không tìm thấy." };
  if (status === 429) return { message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau." };
  return { message: "Đã có lỗi xảy ra. Vui lòng thử lại." };
}

export async function hubFetch<T>(hub: HubId, path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`/api/hub/${hub}${path}`, {
      ...rest,
      credentials: "same-origin",
      cache: "no-store",
      headers: json !== undefined ? { "content-type": "application/json", ...headers } : headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new HubError("Mất kết nối mạng.", 0, "NETWORK");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || (body && typeof body === "object" && "ok" in body && body.ok === false)) {
    const { message, code } = messageOf(body, res.status);
    throw new HubError(message, res.status, code);
  }
  return body as T;
}

/** Small SWR-style loader: data, error, loading, reload. Keeps old data while reloading. */
export function useHub<T>(hub: HubId, path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<HubError | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (path === null) return;
    const my = ++seq.current;
    setLoading(true);
    try {
      const d = await hubFetch<T>(hub, path);
      if (my === seq.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (my === seq.current) setError(e instanceof HubError ? e : new HubError("Đã có lỗi xảy ra.", 500));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [hub, path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}
