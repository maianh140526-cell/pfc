import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { AppHeader, Section } from "@/ui";
import { SearchBox } from "@/ui/SearchBox";

export const metadata = { title: "Trợ giúp" };
export const dynamic = "force-dynamic";

/** SYS-16 Help / FAQ (mockup 16 / 107 / 144). Answers describe how the app actually works. */
const FAQ: { topic: string; q: string; a: string; link?: [string, string] }[] = [
  { topic: "Tài khoản", q: "Một tài khoản dùng được những gì?", a: "Một tài khoản PFC dùng cho cả 6 nhánh: Tài chính, Học tập, Dự án, Marketplace, Cơ hội và Câu lạc bộ. Đăng xuất ở PFC là đăng xuất khỏi mọi nhánh." },
  { topic: "Tài khoản", q: "Tôi quên mật khẩu?", a: "Ở màn hình đăng nhập, chọn “Quên mật khẩu?” và nhập email. Liên kết đặt lại có hiệu lực 30 phút, dùng một lần, và đăng xuất mọi thiết bị khác.", link: ["/forgot-password", "Đặt lại mật khẩu"] },
  { topic: "Tài khoản", q: "Vì sao tôi bị tạm khóa đăng nhập?", a: "Sau 5 lần nhập sai mật khẩu, đăng nhập bị tạm khóa 15 phút để chống dò mật khẩu. Bạn có thể đặt lại mật khẩu ngay." },
  { topic: "Bảo mật", q: "Bật xác thực hai lớp thế nào?", a: "Cài đặt tài khoản → Xác thực hai lớp. Quét mã QR bằng Google Authenticator / Microsoft Authenticator / Authy, nhập mã 6 số, rồi lưu 8 mã dự phòng.", link: ["/more/account/2fa", "Mở cài đặt 2FA"] },
  { topic: "Bảo mật", q: "Có thiết bị lạ đang đăng nhập?", a: "Vào Thiết bị đăng nhập để đăng xuất thiết bị đó, sau đó đổi mật khẩu.", link: ["/more/account/devices", "Xem thiết bị"] },
  { topic: "Quyền", q: "Ai được xóa hay loại thành viên?", a: "Thành viên không xóa hay loại được ai. Trong dự án chỉ chủ dự án loại được thành viên; trong Câu lạc bộ là Chủ nhiệm và Ban điều hành.", link: ["/more/roles", "Xem bảng phân quyền"] },
  { topic: "Tài chính", q: "Ai xem được dữ liệu tài chính của tôi?", a: "Chỉ mình bạn. Kể cả Chủ nhiệm cũng không xem được giao dịch, ngân sách hay mục tiêu của bạn." },
  { topic: "Marketplace", q: "Thanh toán đơn hàng thế nào?", a: "Hiện bạn thanh toán trực tiếp cho người bán (khi nhận hàng hoặc chuyển khoản). Với chuyển khoản, người bán chỉ giao hàng sau khi xác nhận đã nhận tiền." },
  { topic: "Marketplace", q: "Muốn mở cửa hàng?", a: "Vào Marketplace → Bán hàng, điền hồ sơ người bán. Hồ sơ được Chủ nhiệm / Ban điều hành duyệt trước khi bạn đăng tin.", link: ["/market/sell", "Mở cửa hàng"] },
  { topic: "Dữ liệu", q: "Tải về hoặc xóa dữ liệu của tôi?", a: "Cài đặt tài khoản → Dữ liệu cá nhân: tải tệp JSON hoặc xóa tài khoản.", link: ["/more/account/data", "Dữ liệu cá nhân"] },
  { topic: "Ứng dụng", q: "Cài PFC lên điện thoại?", a: "iPhone: mở bằng Safari → Chia sẻ → Thêm vào MH chính. Android: Chrome sẽ gợi ý “Cài đặt ứng dụng”, hoặc chọn ⋮ → Cài đặt ứng dụng." },
];

export default async function HelpPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const term = (q ?? "").trim().toLowerCase();
  const items = term ? FAQ.filter((f) => `${f.q} ${f.a} ${f.topic}`.toLowerCase().includes(term)) : FAQ;
  return (
    <>
      <AppHeader back backFallback="/more" title="Trợ giúp & câu hỏi" />
      <div className="px-4">
        <SearchBox placeholder="Tìm câu hỏi…" />
      </div>
      <Section>
        {items.length === 0 ? (
          <p className="text-[14px] text-muted">Không có câu hỏi phù hợp. Hãy gửi yêu cầu hỗ trợ bên dưới.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            {items.map((f) => (
              <li key={f.q}>
                <details className="group px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center gap-3 text-[15px] font-semibold text-ink">
                    <span className="flex-1">{f.q}</span>
                    <ChevronDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{f.a}</p>
                  {f.link && (
                    <Link href={f.link[0]} className="mt-2 inline-block text-[14px] font-semibold text-primary">
                      {f.link[1]} →
                    </Link>
                  )}
                </details>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Cần thêm trợ giúp?">
        <Link href="/more/support" className="pressable flex min-h-12 items-center justify-between rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3 text-[15px] font-semibold text-ink">
          Gửi yêu cầu hỗ trợ cho Ban điều hành <span className="text-primary">→</span>
        </Link>
        <div className="h-6" />
      </Section>
    </>
  );
}
