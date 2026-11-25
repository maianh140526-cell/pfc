import type { ReactNode } from "react";
import { isEnabled } from "@/platform/settings/service";
import { FeatureOff } from "@/ui/FeatureOff";

export default async function Layout({ children }: { children: ReactNode }) {
  if (!(await isEnabled("collab"))) return <FeatureOff title="Tìm cộng sự" />;
  return children;
}
