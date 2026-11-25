import Image from "next/image";
import { Award } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { certificate } from "@/modules/education/server/service";
import { AppHeader, EmptyState } from "@/ui";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

/** EDU-15 Certificate (mockup 47). Issued only when every lesson is completed. */
export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember(`/learn/courses/${id}/certificate`);
  const cert = await certificate(toActor(me), id);
  if (!cert) {
    return (
      <>
        <AppHeader back backFallback={`/learn/courses/${id}`} title="Chứng chỉ" />
        <EmptyState icon={Award} title="Chưa đủ điều kiện" description="Hoàn thành tất cả bài học để nhận chứng chỉ." />
      </>
    );
  }
  const date = new Date(cert.completedAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  return (
    <>
      <AppHeader back backFallback={`/learn/courses/${id}`} title="Chứng chỉ của tôi" />
      <div className="px-4">
        <div className="rounded-[var(--radius-card)] border-4 border-double border-warning bg-surface p-6 text-center shadow-card">
          <Image src="/brand/pfc-mark.png" alt="" width={48} height={48} className="mx-auto rounded-xl" />
          <p className="mt-2 text-[12px] font-semibold tracking-widest text-primary uppercase">Personal Finance Club</p>
          <p className="mt-4 text-[18px] font-extrabold tracking-wide text-warning uppercase">Chứng chỉ hoàn thành</p>
          <p className="mt-4 text-[13px] text-muted">Chứng nhận</p>
          <p className="text-[22px] font-extrabold text-ink">{cert.memberName}</p>
          <p className="mt-3 text-[13px] text-muted">đã hoàn thành khóa học</p>
          <p className="text-[16px] font-bold text-ink">{cert.courseTitle}</p>
          <p className="mt-4 text-[12px] text-muted">Ngày {date}</p>
          <p className="mt-1 font-mono text-[12px] text-ink-2">Mã: {cert.code}</p>
        </div>
        <div className="mt-4">
          <PrintButton />
        </div>
      </div>
    </>
  );
}
