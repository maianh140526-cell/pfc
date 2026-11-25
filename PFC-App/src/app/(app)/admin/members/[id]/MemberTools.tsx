"use client";

import { useState } from "react";
import { liftRestrictionAction, restrictAction } from "@/platform/admin/console-actions";
import { adjustPointsAction } from "@/modules/rewards/server/actions";
import { Button } from "@/ui";
import { FormError, SelectInput, TextArea, TextInput } from "@/ui/Form";
import { useAction } from "@/ui/use-action";

export function RestrictForm({ memberId, kinds }: { memberId: string; kinds: [string, string][] }) {
  const a = useAction();
  const [kind, setKind] = useState(kinds[0][0]);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("7");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        a.run(() => restrictAction(memberId, { kind, reason, days: days || null }), () => setReason(""));
      }}
    >
      <div className="grid grid-cols-[1fr_110px] gap-2">
        <SelectInput label="Hạn chế" value={kind} onChange={(e) => setKind(e.target.value)}>
          {kinds.map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </SelectInput>
        <TextInput label="Số ngày" hint="Trống = đến khi gỡ" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} />
      </div>
      <TextArea label="Lý do (thành viên sẽ thấy)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      <FormError message={a.error} />
      <Button type="submit" variant="danger" block disabled={a.pending || reason.trim().length < 5}>
        Áp dụng hạn chế
      </Button>
    </form>
  );
}

export function LiftButton({ id }: { id: string }) {
  const a = useAction();
  return (
    <>
      <Button variant="ghost" disabled={a.pending} onClick={() => a.run(() => liftRestrictionAction(id))}>
        Gỡ
      </Button>
      <FormError message={a.error} />
    </>
  );
}

export function AdjustPoints({ memberId }: { memberId: string }) {
  const a = useAction();
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        a.run(() => adjustPointsAction(memberId, Number(delta), note), () => (setDelta(""), setNote("")));
      }}
    >
      <TextInput label="Số điểm (+ cộng / − trừ)" inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value.replace(/[^\d-]/g, "").replace(/(?!^)-/g, ""))} />
      <TextInput label="Lý do" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      <FormError message={a.error} />
      <Button type="submit" variant="secondary" block disabled={a.pending || !Number(delta) || note.trim().length < 5}>
        Điều chỉnh điểm
      </Button>
    </form>
  );
}
