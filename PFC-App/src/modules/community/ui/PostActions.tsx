"use client";

import { Bookmark, Heart } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { toggleLikeAction, toggleSaveAction } from "../server/actions";
import { cx } from "@/ui/cx";

export function LikeButton({ postId, liked, count, disabled }: { postId: string; liked: boolean; count: number; disabled?: boolean }) {
  const [state, set] = useOptimistic({ liked, count });
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={state.liked}
      aria-label={state.liked ? "Bỏ thích" : "Thích"}
      disabled={disabled}
      onClick={() =>
        start(async () => {
          set({ liked: !state.liked, count: state.count + (state.liked ? -1 : 1) });
          await toggleLikeAction(postId);
        })
      }
      className={cx("flex min-h-11 items-center gap-1.5", state.liked && "text-expense")}
    >
      <Heart size={18} className={cx(state.liked && "fill-expense")} /> {state.count}
    </button>
  );
}

export function SaveButton({ postId, saved }: { postId: string; saved: boolean }) {
  const [state, set] = useOptimistic(saved);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={state}
      aria-label={state ? "Bỏ lưu" : "Lưu bài"}
      onClick={() =>
        start(async () => {
          set(!state);
          await toggleSaveAction(postId);
        })
      }
      className={cx("flex min-h-11 items-center gap-1.5", state && "text-primary")}
    >
      <Bookmark size={18} className={cx(state && "fill-primary")} /> {state ? "Đã lưu" : "Lưu"}
    </button>
  );
}
