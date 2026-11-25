import { TabBar } from "@/ui";

/** Member app area: every screen here gets the fixed 5-tab bar. */
export default function MemberAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="with-tabbar">{children}</div>
      <TabBar />
    </>
  );
}
