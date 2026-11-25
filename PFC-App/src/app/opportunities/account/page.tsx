"use client";

import { Building2, ClipboardCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { hubFetch } from "@/platform/hub-proxy/client";
import { OppGate } from "@/modules/opportunity/ui/OppGate";
import { AppHeader, Badge, ListGroup, ListItem, Section } from "@/ui";
import { Toggle } from "@/ui/Form";

type Prefs = { enabled: boolean; inApp: boolean; email: boolean; push: boolean };
const ROLE_LABEL = { MEMBER: "Thành viên", PROVIDER: "Đơn vị đăng tin", REVIEWER: "Người kiểm duyệt" } as const;

/** Opportunity account: identity, reminder preferences, provider / reviewer entry points. */
export default function OppAccountPage() {
  return (
    <>
      <AppHeader title="Tài khoản Cơ hội" backHref="/opportunities" />
      <OppGate>{(user) => <Account name={user.name} email={user.email} role={user.role} />}</OppGate>
    </>
  );
}

function Account({ name, email, role }: { name: string; email: string; role: keyof typeof ROLE_LABEL }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    hubFetch<Prefs>("opp", "/me/reminder-preferences").then(setPrefs).catch(() => undefined);
  }, []);

  async function update(patch: Partial<Prefs>) {
    if (!prefs) return;
    const prev = prefs;
    setPrefs({ ...prefs, ...patch });
    try {
      setPrefs(await hubFetch<Prefs>("opp", "/me/reminder-preferences", { method: "PUT", json: patch }));
      setErr(null);
    } catch (e) {
      setPrefs(prev);
      setErr(e instanceof Error ? e.message : "Không lưu được.");
    }
  }

  return (
    <>
      <Section>
        <div className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4">
          <span className="grid size-12 place-items-center rounded-full bg-primary text-[16px] font-bold text-on-primary">
            {name.trim().split(/\s+/).at(-1)?.[0]?.toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-bold text-ink">{name}</p>
            <p className="truncate text-[13px] text-muted">{email}</p>
          </div>
          <Badge>{ROLE_LABEL[role]}</Badge>
        </div>
      </Section>

      {(role === "PROVIDER" || role === "REVIEWER") && (
        <Section>
          <ListGroup label="Quản lý">
            {(role === "PROVIDER" || role === "REVIEWER") && (
              <ListItem icon={Building2} title="Tin đăng của tôi" description="Tạo tin, gửi xác minh, xem ứng viên" href="/opportunities/provider" />
            )}
            {role === "REVIEWER" && (
              <ListItem icon={ClipboardCheck} title="Hàng chờ xác minh" description="Duyệt hoặc từ chối tin đăng" href="/opportunities/review" />
            )}
          </ListGroup>
        </Section>
      )}

      <Section title="Nhắc hạn nộp hồ sơ">
        <div className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface px-4">
          {prefs ? (
            <>
              <Toggle label="Nhắc hạn" description="Nhắc trước hạn của cơ hội đã lưu / đã ứng tuyển" checked={prefs.enabled} onChange={(v) => update({ enabled: v })} />
              <Toggle label="Trong ứng dụng" checked={prefs.inApp} onChange={(v) => update({ inApp: v })} />
              <Toggle label="Email" checked={prefs.email} onChange={(v) => update({ email: v })} />
              <Toggle label="Thông báo đẩy" description="Cần cài PFC lên điện thoại (P5)" checked={prefs.push} onChange={(v) => update({ push: v })} />
            </>
          ) : (
            <p className="py-4 text-[14px] text-muted">Đang tải…</p>
          )}
        </div>
        {err && <p className="mt-2 text-[13px] text-expense">{err}</p>}
      </Section>

      <Section>
        <p className="text-center text-[12px] text-muted">Bạn đang dùng tài khoản PFC. Đăng xuất ở mục Thêm của trang chủ PFC.</p>
      </Section>
    </>
  );
}
