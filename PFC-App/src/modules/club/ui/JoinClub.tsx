"use client";

import { Clock, Lock, XCircle } from "lucide-react";
import { useState } from "react";
import { useHub } from "@/platform/hub-proxy/client";
import { ListSkeleton } from "@/platform/hub-proxy/HubStates";
import { Button, Card } from "@/ui";
import { FormError, TextArea } from "@/ui/Form";
import { clubPost } from "../session";

type JoinStatus = { status: "none" | "pending" | "active" | "rejected" | "left" | string; joinReason: string | null; rejectReason: string | null; updatedAt: string | null; club?: { name: string } };

/** Same rule as the Club service (membership-policy MIN_JOIN_REASON_LEN). */
const MIN_REASON = 8;

/**
 * COM-13 Join Club / COM-20 Private Community. Non-members send a join request (→ Pending);
 * Club managers approve (→ Active, the Club tabs open) or reject it in "Hàng chờ duyệt".
 */
export function JoinClub({ onJoined }: { onJoined: () => void }) {
  const { data, loading, reload } = useHub<JoinStatus>("club", "?action=my_join_status");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<{ pending?: boolean; error?: string }>({});

  if (loading && !data) return <ListSkeleton />;
  const status = data?.status ?? "none";
  const when = data?.updatedAt ? new Date(data.updatedAt).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : null;

  if (status === "active") {
    // Approved since the page loaded.
    return (
      <div className="px-4 pt-6">
        <Button block onClick={onJoined}>
          Bạn đã là thành viên — mở Câu lạc bộ
        </Button>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="space-y-4 px-4 pt-4">
        <Card className="flex flex-col items-center text-center">
          <span className="grid size-14 place-items-center rounded-full bg-warning-soft text-warning">
            <Clock size={26} />
          </span>
          <h2 className="mt-3 text-[18px] font-bold text-ink">Yêu cầu đang chờ duyệt</h2>
          <p className="mt-1 text-[14px] text-muted">
            Trưởng ban hoặc Ban điều hành CLB sẽ xem xét{when ? ` (gửi ngày ${when})` : ""}. Khi được duyệt, bạn xem được Công việc, Thành viên và Hoạt động của CLB.
          </p>
        </Card>
        {data?.joinReason && (
          <div className="rounded-xl bg-surface-2 px-4 py-3 text-[14px] text-ink-2">
            <p className="text-[12px] font-semibold text-muted">Lý do bạn đã gửi</p>
            <p className="whitespace-pre-line">{data.joinReason}</p>
          </div>
        )}
        <Button variant="secondary" block onClick={() => reload()}>
          Kiểm tra lại
        </Button>
      </div>
    );
  }

  const rejected = status === "rejected";
  return (
    <div className="space-y-4 px-4 pt-4">
      <Card className="flex flex-col items-center text-center">
        <span className={`grid size-14 place-items-center rounded-full ${rejected ? "bg-expense-soft text-expense" : "bg-primary-soft text-primary"}`}>
          {rejected ? <XCircle size={26} /> : <Lock size={26} />}
        </span>
        <h2 className="mt-3 text-[18px] font-bold text-ink">{rejected ? "Yêu cầu trước chưa được duyệt" : "Câu lạc bộ riêng tư"}</h2>
        <p className="mt-1 text-[14px] text-muted">
          {rejected ? "Bạn có thể bổ sung thông tin và gửi lại yêu cầu." : "Chỉ thành viên mới xem được nội dung. Gửi yêu cầu tham gia để Trưởng ban / Ban điều hành CLB duyệt."}
        </p>
        {rejected && data?.rejectReason && <p className="mt-2 rounded-xl bg-expense-soft px-3 py-2 text-[13px] text-expense">Lý do: {data.rejectReason}</p>}
      </Card>
      <TextArea
        label="Vì sao bạn muốn tham gia?"
        hint={`Tối thiểu ${MIN_REASON} ký tự`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        placeholder="Giới thiệu ngắn về bạn và điều bạn muốn học hỏi / đóng góp"
      />
      <FormError message={state.error} />
      <Button
        block
        disabled={state.pending || reason.trim().length < MIN_REASON}
        onClick={async () => {
          setState({ pending: true });
          try {
            await clubPost("join_club", { joinReason: reason.trim() });
            setState({});
            setReason("");
            await reload();
          } catch (e) {
            setState({ error: e instanceof Error ? e.message : "Gửi yêu cầu thất bại." });
          }
        }}
      >
        {state.pending ? "Đang gửi…" : rejected ? "Gửi lại yêu cầu" : "Gửi yêu cầu tham gia"}
      </Button>
    </div>
  );
}
