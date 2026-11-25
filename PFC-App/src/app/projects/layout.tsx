import { ProjectTabBar } from "@/modules/projects/ui/ProjectTabBar";

export const metadata = { title: { default: "Dự án", template: "%s · Dự án · PFC" } };

/** Project Marketplace interior (FR-PROJ). Every page needs a PFC account. */
export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="with-tabbar">{children}</div>
      <ProjectTabBar />
    </>
  );
}
