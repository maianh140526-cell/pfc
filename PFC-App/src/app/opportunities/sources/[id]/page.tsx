import { CalendarClock, ExternalLink, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { currentMember, toActor } from "@/platform/auth/session";
import { can } from "@/platform/roles";
import { EXT_TYPE_LABEL, SOURCES } from "@/modules/oppfeed/domain/feed";
import { getExternal } from "@/modules/oppfeed/server/service";
import { OppThumb } from "@/modules/oppfeed/ui/ExtCard";
import { AppHeader, Badge, ButtonLink, Section, buttonClass } from "@/ui";

export const dynamic = "force-dynamic";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "long" }) : "");

/** Detail of a feed or leader posting. Applying always happens on the original site / form. */
export default async function SourceItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await getExternal(id);
  if (!o) notFound();
  const me = await currentMember();
  const mine = !!me && o.source === "pfc" && (o.authorId === me.id || can(toActor(me), "admin.dashboard"));
  return (
    <>
      <AppHeader back backFallback="/opportunities/sources" title={EXT_TYPE_LABEL[o.type]} />
      <div className="space-y-3 px-4">
        <OppThumb type={o.type} src={o.imageUrl} size="lg" />
        <h1 className="text-[20px] leading-tight font-extrabold text-ink">{o.title}</h1>
        {o.organization && <p className="text-[14px] font-semibold text-ink-2">{o.organization}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{EXT_TYPE_LABEL[o.type]}</Badge>
          <Badge tone={o.state.tone}>{o.state.label}</Badge>
          <Badge tone="muted">{SOURCES[o.source].label}</Badge>
        </div>
        <ul className="space-y-1.5 text-[14px] text-ink-2">
          {o.location && (
            <li className="flex items-center gap-2">
              <MapPin size={16} className="text-muted" /> {o.location}
            </li>
          )}
          {o.deadlineAt && (
            <li className="flex items-center gap-2">
              <CalendarClock size={16} className="text-muted" /> Hạn nộp: {fmt(o.deadlineAt)}
            </li>
          )}
          {o.postedAt && <li className="text-[13px] text-muted">Đăng ngày {fmt(o.postedAt)}</li>}
        </ul>
      </div>
      {o.summary && (
        <Section title="Mô tả">
          <p className="text-[15px] leading-relaxed whitespace-pre-line text-ink-2">{o.summary}</p>
        </Section>
      )}
      <Section>
        {o.url ? (
          <a href={o.url} target="_blank" rel="noopener noreferrer" className={buttonClass("primary", true)}>
            <ExternalLink size={16} /> {o.source === "pfc" ? "Mở link đăng ký" : "Xem và ứng tuyển ở trang gốc"}
          </a>
        ) : (
          <p className="rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-ink-2">Tin này không có link đăng ký. Liên hệ {o.authorName ?? "người đăng"} để biết cách nộp hồ sơ.</p>
        )}
        {o.source !== "pfc" && <p className="mt-2 text-[12px] text-muted">Nội dung do {SOURCES[o.source].label} cung cấp; PFC chỉ hiển thị lại tóm tắt và dẫn về trang gốc. Tình trạng có thể thay đổi, hãy kiểm tra ở trang gốc.</p>}
        {o.source === "pfc" && o.authorName && <p className="mt-2 text-[12px] text-muted">Đăng bởi {o.authorName}.</p>}
        {mine && (
          <div className="mt-3">
            <ButtonLink href={`/opportunities/sources/${o.id}/edit`} variant="secondary" block>
              Sửa / đóng tin
            </ButtonLink>
          </div>
        )}
      </Section>
    </>
  );
}
