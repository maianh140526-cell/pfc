"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * Runs a server action with pending + error state, then refreshes server components.
 * Returns the data on success so callers can navigate (e.g. to the new item).
 */
export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    <T>(fn: () => Promise<Result<T>>, onSuccess?: (data: T) => void) => {
      setError(null);
      startTransition(async () => {
        try {
          const res = await fn();
          if (!res) return; // action redirected
          if (!res.ok) {
            setError(res.error);
            return;
          }
          onSuccess?.(res.data);
          router.refresh();
        } catch (err) {
          // Redirects from server actions surface as navigation, not errors.
          if (err && typeof err === "object" && "digest" in err) throw err;
          setError("Không kết nối được máy chủ. Kiểm tra mạng và thử lại.");
        }
      });
    },
    [router],
  );

  return { run, pending, error, setError };
}
