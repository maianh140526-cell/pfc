import Link from "next/link";
import { BookOpen, ClipboardCheck, FileText, Plus, ShieldAlert } from "lucide-react";
import { requireMember, toActor } from "@/platform/auth/session";
import { manageOverview, type ManagedItem } from "@/modules/education/server/service";
import { STATUS_LABEL, STATUS_TONE } from "@/platform/workflow";
import { AppHeader, Badge, ButtonLink, EmptyState, Section } from "@/ui";

export const metadata = { title: "Quản lý nội dung" };
export const dynamic = "force-dynamic";

const ICON = { course: BookOpen, quiz: ClipboardCheck, resource: FileText } as const;
const KIND = { course: "Khóa học", quiz: "Bài kiểm tra", resource: "Tài liệu" } as const;
const href = (i: ManagedItem) => `/learn/manage/${i.kind === "course" ? "courses" : i.kind === "quiz" ? "quizzes" : "resources"}/${i.id}`;

function ItemList({ items, showAuthor }: { items: ManagedItem[]; showAuthor?: boolean }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      {items.map((i) => {
        const Icon = ICON[i.kind];
        return (
          <li key={`${i.kind}-${i.id}`}>
            <Link href={href(i)} className="pressable flex items-center gap-3 px-4 py-3 active:bg-surface-2">
              <Icon size={20} className="shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-ink">{i.title}</span>
                <span className="block text-[12px] text-muted">
                  {KIND[i.kind]}
                  {showAuthor ? ` · ${i.authorName}` : ""}
                </span>
              </span>
              <Badge tone={STATUS_TONE[i.status]}>{STATUS_LABEL[i.status]}</Badge>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** EDU-A01 Content Management + review queue (FR-EDU-007). */
export default async function ManagePage() {
  const me = await requireMember("/learn/manage");
  const o = await manageOverview(toActor(me));
  if (!o.canCreate && !o.canApprove) {
    return (
      <>
        <AppHeader back backFallback="/learn/me" title="Quản lý nội dung" />
        <EmptyState icon={ShieldAlert} title="Không có quyền" description="Tài khoản đang bị khóa." />
      </>
    );
  }
  return (
    <>
      <AppHeader back backFallback="/learn/me" title="Quản lý nội dung" />
      {o.canCreate && (
        <Section>
          <p className="mb-2 text-[13px] text-ink-2">Mọi thành viên đều có thể đóng góp khóa học, bài kiểm tra và tài liệu. Nội dung được Ban Chuyên môn duyệt trước khi hiện công khai.</p>
          <div className="grid grid-cols-3 gap-2">
            <ButtonLink href="/learn/manage/courses/new" variant="secondary">
              <Plus size={16} /> Khóa học
            </ButtonLink>
            <ButtonLink href="/learn/manage/quizzes/new" variant="secondary">
              <Plus size={16} /> Bài KT
            </ButtonLink>
            <ButtonLink href="/learn/manage/resources/new" variant="secondary">
              <Plus size={16} /> Tài liệu
            </ButtonLink>
          </div>
        </Section>
      )}
      {o.canApprove && (
        <Section title={`Chờ duyệt (${o.queue.length})`}>
          {o.queue.length === 0 ? <p className="text-[14px] text-muted">Không có nội dung chờ duyệt.</p> : <ItemList items={o.queue} showAuthor />}
        </Section>
      )}
      <Section title="Nội dung của tôi">
        {o.mine.length === 0 ? <p className="text-[14px] text-muted">Bạn chưa tạo nội dung nào.</p> : <ItemList items={o.mine} />}
      </Section>
    </>
  );
}
