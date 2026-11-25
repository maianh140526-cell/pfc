"use client";

import { useParams, useRouter } from "next/navigation";
import { UserX } from "lucide-react";
import { useState } from "react";
import { useClub } from "@/modules/club/session";
import { MEMBERSHIP_LABEL, MEMBERSHIP_NEXT, POSITION_LABEL, fmtDate, type MembershipStatus, type Position } from "@/modules/club/types";
import { Avatar } from "@/modules/club/ui/Avatar";
import { AppHeader, Badge, Button, Card, EmptyState, Section } from "@/ui";
import { ConfirmSheet } from "@/ui/ConfirmSheet";
import { FormError, SelectInput, TextArea } from "@/ui/Form";

const TRANSITION_LABEL: Partial<Record<MembershipStatus, string>> = {
  active: "Kích hoạt",
  rejected: "Từ chối",
  inactive: "Tạm dừng",
  alumni: "Chuyển cựu thành viên",
  left: "Cho rời CLB",
};

/** COM-10 Member Profile + admin actions (approve, position, team, lifecycle). */
export default function ClubMemberPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { home, can, act } = useClub();
  const m = home.members.find((x) => x.id === id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<MembershipStatus | null>(null);
  const [kicking, setKicking] = useState(false);
  const [kickReason, setKickReason] = useState("");

  if (!m) {
    return (
      <>
        <AppHeader back backFallback="/club/members" title="Thành viên" />
        <EmptyState icon={UserX} title="Không tìm thấy thành viên" />
      </>
    );
  }
  const canManage = can("manage_members");
  const canApprove = can("approve_memberships");
  const canRoles = can("manage_roles");
  const isMe = m.memberId === home.user.id;

  async function run(action: string, body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await act(action, body);
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Thao tác thất bại.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const transitions = MEMBERSHIP_NEXT[m.status].filter((to) => (m.status === "pending" ? canApprove : canManage) && !isMe);

  return (
    <>
      <AppHeader back backFallback="/club/members" title="Hồ sơ thành viên" />
      <div className="flex flex-col items-center px-4 pt-2 text-center">
        <Avatar name={m.fullName} size={80} />
        <h1 className="mt-3 text-[20px] font-extrabold text-ink">{m.fullName}</h1>
        <p className="text-[14px] text-muted">{m.email}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Badge>{POSITION_LABEL[m.position]}</Badge>
          <Badge tone={m.status === "active" ? "income" : m.status === "pending" ? "warning" : "muted"}>{MEMBERSHIP_LABEL[m.status]}</Badge>
        </div>
      </div>

      <Section>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Việc xong", `${m.tasksDone ?? 0}/${m.tasksTotal ?? 0}`],
            ["Sự kiện", String(m.eventsJoined ?? 0)],
            ["Tham gia", fmtDate(m.joinedAt ?? m.createdAt)],
          ].map(([k, v]) => (
            <Card key={k} className="p-3">
              <p className="text-[16px] font-extrabold text-ink">{v}</p>
              <p className="text-[11px] text-muted">{k}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section>
        <dl className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
          {[
            ["Ban", m.teamName ?? "Chưa xếp ban"],
            ["Mã sinh viên", m.studentCode ?? "—"],
            ["Lý do tham gia", m.joinReason ?? "—"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-[14px] text-muted">{k}</dt>
              <dd className="text-right text-[14px] font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {(canRoles || canManage) && m.status === "active" && !isMe && m.position !== "owner" && (
        <Section title="Phân quyền">
          <div className="space-y-3">
            {canRoles && (
              <SelectInput label="Vị trí" value={m.position} disabled={busy} onChange={(e) => run("assign_position", { membershipId: m.id, position: e.target.value as Position })}>
                {(Object.keys(POSITION_LABEL) as Position[])
                  .filter((p) => p !== "owner")
                  .map((p) => (
                    <option key={p} value={p}>
                      {POSITION_LABEL[p]}
                    </option>
                  ))}
              </SelectInput>
            )}
            {canManage && (
              <SelectInput label="Ban" value={m.teamId ?? ""} disabled={busy} onChange={(e) => run("assign_team", { membershipId: m.id, teamId: e.target.value || null })}>
                <option value="">Chưa xếp ban</option>
                {home.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </SelectInput>
            )}
          </div>
        </Section>
      )}

      {transitions.length > 0 && (
        <Section title={m.status === "pending" ? "Duyệt yêu cầu tham gia" : "Trạng thái thành viên"}>
          <div className="flex flex-wrap gap-2">
            {transitions.map((to) => (
              <Button
                key={to}
                variant={to === "active" ? "primary" : to === "rejected" || to === "left" ? "danger" : "secondary"}
                className="min-h-10 text-[14px]"
                disabled={busy}
                onClick={() => (to === "active" ? run("membership_transition", { membershipId: m.id, to }) : setConfirm(to))}
              >
                {TRANSITION_LABEL[to] ?? MEMBERSHIP_LABEL[to]}
              </Button>
            ))}
          </div>
        </Section>
      )}
      {canManage && !isMe && m.position !== "owner" && (m.status === "active" || m.status === "inactive") && (
        <Section title="Xóa khỏi CLB">
          {kicking ? (
            <div className="space-y-2">
              <TextArea label="Lý do (tối thiểu 8 ký tự, lưu vào lịch sử thành viên)" value={kickReason} onChange={(e) => setKickReason(e.target.value)} maxLength={300} />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" className="min-h-10 text-[14px]" onClick={() => (setKicking(false), setKickReason(""))}>
                  Thôi
                </Button>
                <Button
                  variant="danger"
                  className="min-h-10 text-[14px]"
                  disabled={busy || kickReason.trim().length < 8}
                  onClick={async () => {
                    if (await run("kick_member", { membershipId: m.id, note: kickReason.trim() })) router.replace("/club/members");
                  }}
                >
                  Xóa khỏi CLB
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" className="min-h-10 text-[14px] text-expense" onClick={() => setKicking(true)}>
              Xóa {m.fullName} khỏi CLB
            </Button>
          )}
          <p className="mt-1 text-[12px] text-muted">Thành viên mất quyền xem nội dung CLB; công việc đã làm vẫn được giữ lại.</p>
        </Section>
      )}

      {err && (
        <div className="px-4 pt-3">
          <FormError message={err} />
        </div>
      )}

      <ConfirmSheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={`${confirm ? TRANSITION_LABEL[confirm] : ""}?`}
        message={`Chuyển ${m.fullName} sang trạng thái “${confirm ? MEMBERSHIP_LABEL[confirm] : ""}”. Thao tác được ghi vào lịch sử thành viên.`}
        confirmLabel="Xác nhận"
        pending={busy}
        onConfirm={async () => {
          if (confirm && (await run("membership_transition", { membershipId: m.id, to: confirm }))) {
            setConfirm(null);
            if (confirm === "rejected") router.replace("/club/members");
          }
        }}
      />
    </>
  );
}
