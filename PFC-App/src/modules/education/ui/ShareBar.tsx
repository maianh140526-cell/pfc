import { ClipboardCheck, FileUp } from "lucide-react";
import Link from "next/link";

/**
 * Entry points for every member to contribute: documents / exercises (with photos and files) and quizzes.
 * Items stay drafts until reviewed; the author follows them under "Của tôi → Đóng góp nội dung".
 */
export function ShareBar() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link href="/learn/manage/resources/new" className="pressable flex items-center gap-3 rounded-2xl bg-primary px-4 py-3.5 text-on-primary shadow-card">
        <FileUp size={22} className="shrink-0" />
        <span className="min-w-0">
          <span className="block text-[14px] font-bold">Đăng tài liệu</span>
          <span className="block text-[11px] opacity-90">Bài tập, ảnh chụp, file</span>
        </span>
      </Link>
      <Link href="/learn/manage/quizzes/new" className="pressable flex items-center gap-3 rounded-2xl border border-primary bg-surface px-4 py-3.5 text-primary shadow-card">
        <ClipboardCheck size={22} className="shrink-0" />
        <span className="min-w-0">
          <span className="block text-[14px] font-bold">Tạo bài kiểm tra</span>
          <span className="block text-[11px] text-ink-2">Kèm tài liệu ôn tập</span>
        </span>
      </Link>
    </div>
  );
}
