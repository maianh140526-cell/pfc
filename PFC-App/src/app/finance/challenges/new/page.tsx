"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createChallengeAction } from "@/modules/finance/server/actions";
import { AmountInput, AppHeader, Button, SegmentedTabs } from "@/ui";
import { FormError, TextInput } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

/** Create a saving / spending-limit challenge (FIN-16). */
export default function NewChallengePage() {
  const router = useRouter();
  const [type, setType] = useState<"saving" | "spending_limit">("saving");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [days, setDays] = useState("30");
  const { run, pending, error } = useAction();

  return (
    <>
      <AppHeader back backFallback="/finance/challenges" title="Thử thách mới" />
      <form
        className="space-y-4 px-4 pt-2"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => createChallengeAction({ title, type, target: Number(target), durationDays: Number(days) }),
            () => router.replace("/finance/challenges"),
          );
        }}
      >
        <SegmentedTabs
          label="Loại thử thách"
          stretch
          value={type}
          onChange={setType}
          options={[
            { value: "saving", label: "Tiết kiệm" },
            { value: "spending_limit", label: "Giới hạn chi tiêu" },
          ]}
        />
        <p className="text-[13px] leading-relaxed text-muted">
          {type === "saving"
            ? "Thành công khi số tiền tiết kiệm (thu − chi) từ ngày check-in đầu tiên đạt mục tiêu sau đủ số ngày."
            : "Thất bại ngay khi tổng chi tiêu từ ngày check-in đầu tiên vượt hạn mức; thành công nếu giữ được đủ số ngày."}
        </p>
        <TextInput label="Tên thử thách" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: 30 ngày không trà sữa" maxLength={60} />
        <AmountInput label={type === "saving" ? "Mục tiêu tiết kiệm (VND)" : "Hạn mức chi tiêu (VND)"} value={target} onChange={setTarget} />
        <TextInput label="Số ngày" type="number" inputMode="numeric" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />
        <FormError message={error} />
        <Button type="submit" block disabled={pending}>
          {pending ? "Đang tạo…" : "Bắt đầu thử thách"}
        </Button>
      </form>
    </>
  );
}
