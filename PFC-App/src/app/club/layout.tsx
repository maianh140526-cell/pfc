import { ClubShell } from "./ClubShell";

export const metadata = { title: { default: "Câu lạc bộ", template: "%s · Câu lạc bộ · PFC" } };

/** Club Management interior (FR-CLB). Data comes from the Club service via the hub gateway. */
export default function ClubLayout({ children }: { children: React.ReactNode }) {
  return <ClubShell>{children}</ClubShell>;
}
