import Image from "next/image";
import { AppHeader } from "@/ui";
import pkg from "../../../../../package.json";

export const metadata = { title: "Về ứng dụng" };

export default function AboutPage() {
  return (
    <>
      <AppHeader back backFallback="/more" title="Về ứng dụng" />
      <div className="flex flex-col items-center px-6 pt-6 text-center">
        <Image src="/brand/pfc-logo-512.png" alt="Personal Finance Club" width={160} height={160} className="rounded-3xl" />
        <p className="mt-4 text-[15px] font-semibold text-primary">Manage · Learn · Build · Earn · Grow · Contribute</p>
        <p className="mt-2 text-[13px] text-muted">Phiên bản {pkg.version}</p>
        <p className="mt-6 text-[14px] leading-relaxed text-ink-2">
          PFC Digital Hub là nền tảng kết nối tài chính cá nhân, học tập, dự án, marketplace, cơ hội và cộng đồng
          dành cho người trẻ.
        </p>
        <p className="mt-6 text-[12px] text-muted">
          Các công cụ tính toán tài chính chỉ mang tính tham khảo, không thay thế tư vấn tài chính, đầu tư hoặc thuế.
        </p>
      </div>
    </>
  );
}
