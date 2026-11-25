"use client";

import { Bookmark, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AmountInput, Button } from "@/ui";
import { FormError, TextArea } from "@/ui/Form";
import { cx } from "@/ui/cx";
import { useAction } from "@/ui/use-action";
import { deleteMyReviewAction, deletePlaceAction, reviewPlaceAction, setPlaceHiddenAction, toggleSavePlaceAction } from "../server/g6-actions";

export function SavePlaceButton({ id, initial }: { id: string; initial: boolean }) {
  const a = useAction();
  const [on, setOn] = useState(initial);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Bỏ lưu" : "Lưu địa điểm"}
      onClick={() => {
        setOn(!on);
        a.run(() => toggleSavePlaceAction(id), setOn);
      }}
      className="grid size-11 place-items-center rounded-full text-ink active:bg-surface-2"
    >
      <Bookmark size={22} className={on ? "fill-primary text-primary" : ""} />
    </button>
  );
}

export function ReviewForm({ placeId, initial }: { placeId: string; initial: { rating: number; comment: string; avgSpend: number | null } | null }) {
  const a = useAction();
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [spend, setSpend] = useState(initial?.avgSpend ? String(initial.avgSpend) : "");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        a.run(() => reviewPlaceAction(placeId, { rating, comment, avgSpend: spend || null }));
      }}
    >
      <div role="radiogroup" aria-label="Số sao" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} sao`} onClick={() => setRating(n)} className="grid size-11 place-items-center">
            <Star size={28} className={cx(n <= rating ? "fill-warning text-warning" : "text-line")} />
          </button>
        ))}
      </div>
      <TextArea label="Nhận xét" hint="Từ 20 ký tự để được cộng điểm thưởng" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
      <AmountInput label="Bạn đã chi khoảng (không bắt buộc)" value={spend} onChange={setSpend} />
      <FormError message={a.error} />
      <div className="grid grid-cols-2 gap-2">
        {initial && (
          <Button variant="ghost" disabled={a.pending} onClick={() => a.run(() => deleteMyReviewAction(placeId))}>
            Xóa đánh giá
          </Button>
        )}
        <Button type="submit" disabled={a.pending || rating === 0} className={initial ? "" : "col-span-2"}>
          {initial ? "Cập nhật" : "Gửi đánh giá"}
        </Button>
      </div>
    </form>
  );
}

export function PlaceModeration({ id, hidden, canModerate, isAuthor }: { id: string; hidden: boolean; canModerate: boolean; isAuthor: boolean }) {
  const a = useAction();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [ask, setAsk] = useState(false);
  return (
    <div className="space-y-2">
      {canModerate &&
        (hidden ? (
          <Button variant="secondary" block onClick={() => a.run(() => setPlaceHiddenAction(id, false))}>
            Hiện lại địa điểm
          </Button>
        ) : ask ? (
          <>
            <TextArea label="Lý do ẩn (người đăng sẽ thấy)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
            <Button variant="danger" block disabled={!reason.trim() || a.pending} onClick={() => a.run(() => setPlaceHiddenAction(id, true, reason))}>
              Ẩn địa điểm
            </Button>
          </>
        ) : (
          <Button variant="ghost" block onClick={() => setAsk(true)}>
            Ẩn vì vi phạm
          </Button>
        ))}
      {isAuthor && (
        <Button variant="ghost" block onClick={() => a.run(() => deletePlaceAction(id), () => router.replace("/finance/places"))}>
          Xóa địa điểm của tôi
        </Button>
      )}
      <FormError message={a.error} />
    </div>
  );
}
