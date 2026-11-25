"use client";

import { FileText } from "lucide-react";
import { useClub } from "@/modules/club/session";
import { AppHeader, EmptyState } from "@/ui";

/** FR-CLB-008 Internal documents (metadata; access enforced by the Club service ACL). */
export default function ClubDocumentsPage() {
  const { home } = useClub();
  return (
    <>
      <AppHeader back backFallback="/club/more" title="Tài liệu nội bộ" />
      {home.documents.length === 0 ? (
        <EmptyState icon={FileText} title="Chưa có tài liệu" description="Tài liệu CLB chia sẻ cho thành viên sẽ hiện ở đây." />
      ) : (
        <ul className="mx-4 divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {home.documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                <FileText size={20} />
              </span>
              <span className="flex-1 text-[15px] font-semibold text-ink">{d.title}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
