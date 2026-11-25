"use client";

import { useEffect, useState } from "react";
import { previewAudienceAction, sendCampaignAction } from "@/platform/admin/console-actions";
import { Button } from "@/ui";
import { ConfirmSheet } from "@/ui/ConfirmSheet";
import { FormError, TextArea, TextInput } from "@/ui/Form";
import { cx } from "@/ui/cx";
import { useAction } from "@/ui/use-action";

export function BroadcastForm({ roles, departments }: { roles: [string, string][]; departments: [string, string][] }) {
  const a = useAction();
  const preview = useAction();
  const [v, setV] = useState({ title: "", body: "", href: "" });
  const [aud, setAud] = useState<{ roles: string[]; departments: string[] }>({ roles: [], departments: [] });
  const [count, setCount] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [sent, setSent] = useState<number | null>(null);
  const toggle = (k: "roles" | "departments", x: string) => setAud({ ...aud, [k]: aud[k].includes(x) ? aud[k].filter((y) => y !== x) : [...aud[k], x] });

  useEffect(() => {
    preview.run(() => previewAudienceAction(aud), setCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aud]);

  const Chip = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
    <button type="button" aria-pressed={on} onClick={onClick} className={cx("min-h-10 rounded-full border px-3 text-[13px] font-semibold", on ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-ink-2")}>
      {label}
    </button>
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setConfirm(true);
      }}
    >
      <TextInput label="Tiêu đề" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={120} />
      <TextArea label="Nội dung" value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} maxLength={500} />
      <TextInput label="Mở trang khi bấm (không bắt buộc)" placeholder="/events" value={v.href} onChange={(e) => setV({ ...v, href: e.target.value })} maxLength={200} />
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-ink-2">Gửi tới vai trò (bỏ trống = mọi người)</legend>
        <div className="flex flex-wrap gap-2">
          {roles.map(([k, l]) => (
            <Chip key={k} on={aud.roles.includes(k)} label={l} onClick={() => toggle("roles", k)} />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-ink-2">Theo ban (bỏ trống = mọi ban)</legend>
        <div className="flex flex-wrap gap-2">
          {departments.map(([k, l]) => (
            <Chip key={k} on={aud.departments.includes(k)} label={l} onClick={() => toggle("departments", k)} />
          ))}
        </div>
      </fieldset>
      <p className="text-[14px] text-ink-2">{count === null ? "Đang đếm…" : `Sẽ gửi tới ${count.toLocaleString("vi-VN")} thành viên.`}</p>
      {sent !== null && <p className="rounded-xl bg-income-soft px-4 py-3 text-[14px] text-income">Đã gửi tới {sent.toLocaleString("vi-VN")} thành viên.</p>}
      <FormError message={a.error ?? preview.error} />
      <Button type="submit" block disabled={a.pending || v.title.trim().length < 5 || !count}>
        Gửi thông báo
      </Button>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Gửi thông báo này?"
        message={`“${v.title}” sẽ tới ${count ?? 0} thành viên ngay lập tức và không thu hồi được.`}
        confirmLabel="Gửi"
        danger={false}
        pending={a.pending}
        onConfirm={() =>
          a.run(
            () => sendCampaignAction({ ...v, audience: aud }),
            (r) => {
              setConfirm(false);
              setSent(r.recipients);
              setV({ title: "", body: "", href: "" });
            },
          )
        }
      />
    </form>
  );
}
