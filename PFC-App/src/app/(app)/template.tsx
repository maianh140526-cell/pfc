/** Templates remount on every navigation, so each screen plays the enter animation. */
export default function ScreenTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
