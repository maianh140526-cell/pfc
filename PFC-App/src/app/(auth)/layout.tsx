/** Public auth screens: no tab bar, centred card on the app canvas. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="page-enter flex min-h-dvh flex-col px-6 pt-[calc(var(--safe-top)+24px)] pb-[calc(var(--safe-bottom)+24px)]">
      {children}
    </main>
  );
}
