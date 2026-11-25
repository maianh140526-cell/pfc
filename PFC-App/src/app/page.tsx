import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, Briefcase, ChevronDown, Rocket, ShoppingBag, Users, Wallet } from "lucide-react";
import { currentMember } from "@/platform/auth/session";
import { one } from "@/platform/db/client";
import { publicOpportunities } from "@/platform/hub-proxy/public";
import { ButtonLink } from "@/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "PFC — Personal Finance Club", description: "Quản lý tài chính · Học · Làm dự án · Tìm cơ hội · Kết nối cộng đồng" };

const BRANCHES = [
  { icon: Wallet, title: "Tài chính cá nhân", text: "Thu chi, ngân sách, mục tiêu tiết kiệm" },
  { icon: BookOpen, title: "Học tập", text: "Khóa học, bài kiểm tra, chứng chỉ" },
  { icon: Rocket, title: "Dự án", text: "Tìm đồng đội, mentor, ra sản phẩm" },
  { icon: ShoppingBag, title: "Marketplace", text: "Sách, dịch vụ, khóa học" },
  { icon: Briefcase, title: "Cơ hội", text: "Thực tập, việc làm, học bổng" },
  { icon: Users, title: "Câu lạc bộ", text: "Hoạt động, nhóm, sự kiện" },
];

const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}K+` : String(n));

/** SYS-01 Landing Page (mockup 1). Signed-in members go straight to Home. Numbers are live counts. */
export default async function LandingPage() {
  if (await currentMember()) redirect("/home");
  const [members, learning, opps] = await Promise.all([
    one<{ n: number }>("SELECT COUNT(*) AS n FROM members WHERE deleted_at IS NULL AND locked = 0"),
    one<{ n: number }>("SELECT (SELECT COUNT(*) FROM edu_courses WHERE status = 'published') + (SELECT COUNT(*) FROM edu_resources WHERE status = 'published') AS n"),
    publicOpportunities("", 1),
  ]);
  const stats = [
    { value: Number(members?.n ?? 0), label: "Thành viên" },
    { value: Number(learning?.n ?? 0), label: "Tài nguyên học tập" },
    ...(opps ? [{ value: opps.total, label: "Cơ hội" }] : []),
  ];

  return (
    <main className="page-enter mx-auto min-h-dvh w-full max-w-[480px] bg-bg pt-[var(--safe-top)] pb-[calc(var(--safe-bottom)+24px)]">
      <section className="relative overflow-hidden bg-linear-to-b from-primary-soft to-bg px-6 pt-6 pb-8">
        <div className="flex items-center gap-2">
          <Image src="/brand/pfc-mark.png" alt="" width={40} height={40} className="rounded-xl" priority />
          <span>
            <span className="block text-[22px] leading-none font-extrabold text-primary">PFC</span>
            <span className="block text-[10px] font-semibold tracking-wide text-muted uppercase">Personal Finance Club</span>
          </span>
        </div>
        <h1 className="mt-10 text-[34px] leading-[1.1] font-extrabold text-ink">
          Xây dựng
          <br />
          phiên bản tốt hơn
        </h1>
        <p className="mt-3 text-[14px] text-ink-2">Quản lý · Học · Xây dựng · Kiếm thu nhập · Phát triển · Cống hiến</p>
        <p className="mt-6 text-[22px] leading-snug font-bold text-primary italic">Small steps,
          <br />
          big future.</p>
        <Image src="/brand/pfc-logo-512.png" alt="" width={180} height={180} className="pointer-events-none absolute top-20 -right-8 opacity-20" />
      </section>

      <section className="px-6">
        <ul className="grid grid-cols-3 gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-4 text-center shadow-card">
          {stats.map((s) => (
            <li key={s.label}>
              <span className="block text-[20px] font-extrabold text-primary">{fmt(s.value)}</span>
              <span className="block text-[11px] leading-tight text-muted">{s.label}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 space-y-3">
          <ButtonLink href="/register" block>
            Tham gia PFC ngay
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary" block>
            Tôi đã có tài khoản
          </ButtonLink>
        </div>
        <a href="#nhanh" className="mx-auto mt-4 flex w-fit items-center gap-1 text-[13px] font-semibold text-muted">
          Tìm hiểu thêm <ChevronDown size={16} />
        </a>
      </section>

      <section id="nhanh" className="px-6 pt-10">
        <h2 className="text-[20px] font-extrabold text-ink">Một tài khoản, sáu nhánh</h2>
        <p className="mt-1 text-[14px] text-muted">Học → Áp dụng → Thực hành → Tạo giá trị → Phát triển → Cống hiến.</p>
        <ul className="mt-4 grid grid-cols-2 gap-3">
          {BRANCHES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
              <span className="grid size-10 place-items-center rounded-2xl bg-primary-soft text-primary">
                <Icon size={20} />
              </span>
              <span className="mt-2 block text-[14px] font-bold text-ink">{title}</span>
              <span className="block text-[12px] text-muted">{text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-center text-[12px] text-muted">
          <Link href="/home" className="font-semibold text-primary">
            Xem thử không cần đăng nhập
          </Link>{" "}
          ·{" "}
          <Link href="/more/policies" className="font-semibold text-primary">
            Chính sách & Điều khoản
          </Link>
        </p>
      </section>
    </main>
  );
}
