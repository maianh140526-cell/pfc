import { SearchX } from "lucide-react";
import { ButtonLink, EmptyState } from "@/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center pt-[var(--safe-top)]">
      <EmptyState
        icon={SearchX}
        title="Không tìm thấy trang"
        description="Trang bạn tìm không tồn tại hoặc đã được chuyển."
        action={
          <ButtonLink href="/home" block>
            Về trang chủ
          </ButtonLink>
        }
      />
    </main>
  );
}
