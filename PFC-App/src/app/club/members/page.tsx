"use client";

import Link from "next/link";
import { Search, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useClub } from "@/modules/club/session";
import { MEMBERSHIP_LABEL, POSITION_LABEL, type Position } from "@/modules/club/types";
import { Avatar } from "@/modules/club/ui/Avatar";
import { PendingRequests } from "@/modules/club/ui/PendingRequests";
import { AppHeader, Badge, BottomSheet, Button, EmptyState, HeaderIconButton } from "@/ui";
import { FormError, SelectInput, TextInput } from "@/ui/Form";
import { cx } from "@/ui/cx";

/** COM-09 Member Directory / COM-15 Club Members / COM-A03 (mockup 125). */
export default function ClubMembersPage() {
  const { home, can, act } = useClub();
  const [q, setQ] = useState("");
  const [team, setTeam] = useState<string>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ email: "", position: "member" as Position, teamId: "" });
  const [state, setState] = useState<{ pending?: boolean; error?: string; done?: string }>({});
  const canManage = can("manage_members");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return home.members
      .filter((m) => (canManage ? m.status !== "rejected" : m.status === "active"))
      // Pending requests have their own block above the list (with Duyệt / Từ chối), except in the "Chờ duyệt" filter.
      .filter((m) => (team === "pending" ? m.status === "pending" : m.status !== "pending" && (team === "all" || m.teamId === team)))
      .filter((m) => !needle || `${m.fullName} ${m.email} ${m.studentCode ?? ""}`.toLowerCase().includes(needle))
      .sort((a, b) => (a.status === "pending" ? -1 : 0) - (b.status === "pending" ? -1 : 0));
  }, [home.members, q, team, canManage]);

  const chips = [
    { value: "all", label: `Tất cả (${home.members.filter((m) => m.status === "active").length})` },
    ...(canManage ? [{ value: "pending", label: `Chờ duyệt (${home.members.filter((m) => m.status === "pending").length})` }] : []),
    ...home.teams.map((t) => ({ value: t.id, label: t.name })),
  ];

  return (
    <>
      <AppHeader
        title="Thành viên"
        backHref="/club"
        actions={
          canManage && (
            <HeaderIconButton label="Mời thành viên" onClick={() => setInviteOpen(true)}>
              <UserPlus size={22} />
            </HeaderIconButton>
          )
        }
      />
      <div className="space-y-3 px-4">
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 focus-within:border-primary">
          <Search size={18} className="text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm thành viên…"
            aria-label="Tìm thành viên"
            className="min-h-12 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-muted"
          />
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="radiogroup" aria-label="Lọc theo ban">
          {chips.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={team === c.value}
              onClick={() => setTeam(c.value)}
              className={cx(
                "pressable shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold whitespace-nowrap",
                team === c.value ? "bg-primary text-on-primary" : "border border-line bg-surface text-ink-2",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {team !== "pending" && !q && <PendingRequests />}
      {list.length === 0 ? (
        <EmptyState icon={Users} title="Không tìm thấy thành viên" />
      ) : (
        <ul className="mx-4 mt-3 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {list.map((m) => (
            <li key={m.id}>
              <Link href={`/club/members/${m.id}`} className="pressable flex items-center gap-3 px-4 py-3 active:bg-surface-2">
                <Avatar name={m.fullName} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-ink">{m.fullName}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {POSITION_LABEL[m.position]}
                    {m.teamName ? ` · ${m.teamName}` : ""}
                  </span>
                </span>
                {m.status !== "active" && <Badge tone={m.status === "pending" ? "warning" : "muted"}>{MEMBERSHIP_LABEL[m.status]}</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <BottomSheet
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          setState({});
        }}
        title="Mời thành viên"
        footer={
          !state.done && (
            <Button
              block
              disabled={state.pending || !invite.email.trim()}
              onClick={async () => {
                setState({ pending: true });
                try {
                  await act("invite_member", { emailOrCode: invite.email.trim(), position: invite.position, teamId: invite.teamId || null });
                  setState({ done: invite.email.trim() });
                  setInvite({ email: "", position: "member", teamId: "" });
                } catch (e) {
                  setState({ error: e instanceof Error ? e.message : "Mời thất bại." });
                }
              }}
            >
              {state.pending ? "Đang mời…" : "Gửi lời mời"}
            </Button>
          )
        }
      >
        {state.done ? (
          <p className="py-6 text-center text-[15px] text-ink-2">Đã mời {state.done}.</p>
        ) : (
          <div className="space-y-4">
            <TextInput label="Email hoặc mã thành viên" type="email" inputMode="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
            <SelectInput label="Vị trí" value={invite.position} onChange={(e) => setInvite({ ...invite, position: e.target.value as Position })}>
              {(Object.keys(POSITION_LABEL) as Position[])
                .filter((p) => p !== "owner")
                .map((p) => (
                  <option key={p} value={p}>
                    {POSITION_LABEL[p]}
                  </option>
                ))}
            </SelectInput>
            <SelectInput label="Ban" value={invite.teamId} onChange={(e) => setInvite({ ...invite, teamId: e.target.value })}>
              <option value="">Chưa xếp ban</option>
              {home.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </SelectInput>
            {home.club.visibility === "private" && <p className="text-[12px] text-muted">CLB riêng tư: người được mời vẫn cần được duyệt nếu chính sách yêu cầu.</p>}
            <FormError message={state.error} />
          </div>
        )}
      </BottomSheet>
    </>
  );
}
