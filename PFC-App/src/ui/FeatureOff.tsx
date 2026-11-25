import { PowerOff } from "lucide-react";
import { AppHeader } from "./AppHeader";
import { ButtonLink } from "./Button";
import { EmptyState } from "./States";

/** Shown in place of a hub section that PFC has switched off in Quản trị → Cấu hình. */
export function FeatureOff({ title }: { title: string }) {
  return (
    <>
      <AppHeader back backFallback="/home" title={title} />
      <EmptyState icon={PowerOff} title={`${title} đang tạm tắt`} description="Ban điều hành PFC đã tạm tắt tính năng này. Vui lòng quay lại sau." action={<ButtonLink href="/home" block>Về trang chủ</ButtonLink>} />
    </>
  );
}
