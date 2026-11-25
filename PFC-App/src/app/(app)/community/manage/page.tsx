import Link from "next/link";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { timeAgo } from "@/lib/time";
import { requireMember, toActor } from "@/platform/auth/session";
import { can } from "@/platform/roles";
import { REPORT_REASONS } from "@/modules/community/domain/rules";
import { reportQueue } from "@/modules/community/server/service";
import { AppHeader, Badge, Card, EmptyState, Section } from "@/ui";
import { DecideReport } from "./DecideReport";

export const metadata = { title: "Báo cáo vi phạm" };
export const dynamic = "force-dynamic";

const TARGET = { post: "Bài viết", comment: "Bình luận", group: "Nhóm", member: "Thành viên", message: "Tin nhắn" } as const;

/** COM-A05 Content Moderation · COM-A06 Report Queue. */
export default async function ManageCommunityPage() {
  const me = await requireMember("/community/manage");
  const actor = toActor(me);
  if (!can(actor, "community.moderate")) {
    return (
      <>
        <AppHeader back backFallback="/community" title="Báo cáo vi phạm" />
        <EmptyState icon={ShieldAlert} title="Không có quyền" description="Chủ nhiệm, Ban điều hành và Trưởng ban Truyền thông xử lý báo cáo cộng đồng." />
      </>
    );
  }
  const q = await reportQueue(actor);
  return (
    <>
      <AppHeader back backFallback="/community" title="Báo cáo vi phạm" />
      {q.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Không có báo cáo cần xử lý" />
      ) : (
        <Section>
          <ul className="space-y-3">
            {q.map((r) => (
              <li key={r.id}>
                <Card className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="warning">{TARGET[r.targetType]}</Badge>
                    <span className="text-[12px] text-muted">
                      {r.count > 1 ? `${r.count} báo cáo · ` : ""}
                      {timeAgo(r.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] text-ink">{r.preview}</p>
                  <p className="mt-1 text-[13px] text-muted">
                    {REPORT_REASONS[r.reason]}
                    {r.details ? ` — ${r.details}` : ""}
                  </p>
                  {r.href && (
                    <Link href={r.href} className="mt-1 inline-block text-[13px] font-semibold text-primary">
                      Xem nội dung →
                    </Link>
                  )}
                  <DecideReport id={r.id} canHide={r.targetType !== "member"} />
                </Card>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
