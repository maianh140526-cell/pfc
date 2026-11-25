import type { ReactNode } from "react";
import { isEnabled } from "@/platform/settings/service";
import { FeatureOff } from "@/ui/FeatureOff";

export default async function Layout({ children }: { children: ReactNode }) {
  if (!(await isEnabled("places"))) return <FeatureOff title="Ngon – Bổ – Rẻ" />;
  return children;
}
