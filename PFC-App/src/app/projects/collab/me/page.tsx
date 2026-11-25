import { requireMember, toActor } from "@/platform/auth/session";
import { AVAILABILITY, myCollabProfile } from "@/modules/projects/server/collab";
import { CollabForm } from "@/modules/projects/ui/CollabForm";
import { AppHeader } from "@/ui";

export const metadata = { title: "Hồ sơ cộng sự" };
export const dynamic = "force-dynamic";

/** PRO-32 Collaborator profile. */
export default async function MyCollabPage() {
  const me = await requireMember("/projects/collab/me");
  const p = await myCollabProfile(toActor(me));
  return (
    <>
      <AppHeader back backFallback="/projects/collab" title="Hồ sơ cộng sự" />
      <CollabForm availability={Object.entries(AVAILABILITY)} initial={p ? { headline: p.headline, skills: p.skills, lookingFor: p.lookingFor, availability: p.availability, open: p.open } : null} />
    </>
  );
}
