"use client";

import { Network, Plus } from "lucide-react";
import { useState } from "react";
import { useClub } from "@/modules/club/session";
import { AppHeader, BottomSheet, Button, EmptyState, HeaderIconButton } from "@/ui";
import { FormError, TextArea, TextInput } from "@/ui/Form";

/** FR-CLB-002 Ban / Teams. */
export default function ClubTeamsPage() {
  const { home, can, act } = useClub();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState<{ pending?: boolean; error?: string }>({});
  const canManage = can("manage_members") || can("manage_club");
  const counts = new Map<string, number>();
  for (const m of home.members) if (m.status === "active" && m.teamId) counts.set(m.teamId, (counts.get(m.teamId) ?? 0) + 1);

  return (
    <>
      <AppHeader
        back
        backFallback="/club/more"
        title="Ban & đội nhóm"
        actions={
          canManage && (
            <HeaderIconButton label="Tạo ban" onClick={() => setOpen(true)}>
              <Plus size={24} />
            </HeaderIconButton>
          )
        }
      />
      {home.teams.length === 0 ? (
        <EmptyState icon={Network} title="Chưa có ban nào" />
      ) : (
        <ul className="mx-4 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {home.teams.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                <Network size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-ink">{t.name}</span>
                {t.description && <span className="block truncate text-[13px] text-muted">{t.description}</span>}
              </span>
              <span className="text-[13px] font-semibold text-ink-2">{t.memberCount ?? counts.get(t.id) ?? 0} người</span>
            </li>
          ))}
        </ul>
      )}
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Tạo ban mới"
        footer={
          <Button
            block
            disabled={state.pending || name.trim().length < 2}
            onClick={async () => {
              setState({ pending: true });
              try {
                await act("create_team", { name: name.trim(), description: description.trim() || undefined });
                setOpen(false);
                setName("");
                setDescription("");
                setState({});
              } catch (e) {
                setState({ error: e instanceof Error ? e.message : "Tạo ban thất bại." });
              }
            }}
          >
            {state.pending ? "Đang tạo…" : "Tạo ban"}
          </Button>
        }
      >
        <div className="space-y-4">
          <TextInput label="Tên ban" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <TextArea label="Mô tả" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
          <FormError message={state.error} />
        </div>
      </BottomSheet>
    </>
  );
}
