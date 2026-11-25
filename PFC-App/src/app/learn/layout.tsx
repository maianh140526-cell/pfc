import { EduTabBar } from "@/modules/education/ui/EduTabBar";

export const metadata = { title: { default: "Học tập", template: "%s · Học tập · PFC" } };

/** Education Hub interior (FR-EDU). Browsing published content is open; learning actions need a PFC account. */
export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="with-tabbar">{children}</div>
      <EduTabBar />
    </>
  );
}
