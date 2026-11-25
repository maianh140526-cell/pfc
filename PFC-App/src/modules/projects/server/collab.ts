import "server-only";
import { z } from "zod";
import { all, one, run } from "@/platform/db/client";
import type { Actor } from "@/platform/roles";

/**
 * "Tìm cộng sự" (PRO-30…32): members publish what they can do and what kind of project they look for.
 * Only members who opted in AND whose profile is visible to members are listed. Contact happens through
 * PFC messages (privacy rules apply) — emails are never shown.
 */
export const AVAILABILITY = { few_hours: "Vài giờ / tuần", part_time: "Bán thời gian", full_time: "Toàn thời gian" } as const;
export type Availability = keyof typeof AVAILABILITY;

export type CollabProfile = { memberId: string; name: string; avatarUrl: string | null; headline: string; skills: string[]; lookingFor: string; availability: Availability; open: boolean; updatedAt: string; projects: number };

const like = (q: string) => `%${q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
type Row = { member_id: string; full_name: string; avatar_url: string | null; headline: string; skills: string; looking_for: string; availability: Availability; open: number; updated_at: string; projects: number };
const toProfile = (r: Row): CollabProfile => ({
  memberId: r.member_id,
  name: r.full_name,
  avatarUrl: r.avatar_url,
  headline: r.headline,
  skills: r.skills ? r.skills.split(",").filter(Boolean) : [],
  lookingFor: r.looking_for,
  availability: r.availability,
  open: !!r.open,
  updatedAt: r.updated_at,
  projects: Number(r.projects),
});
const SQL = `SELECT c.*, m.full_name, m.avatar_url, (SELECT COUNT(*) FROM prj_members pm WHERE pm.member_id = c.member_id AND pm.status = 'active') AS projects
  FROM prj_collab_profiles c JOIN members m ON m.id = c.member_id`;

export async function listCollaborators(actor: Actor, f: { q?: string; skill?: string; availability?: string } = {}): Promise<CollabProfile[]> {
  const where = ["c.open = 1", "m.deleted_at IS NULL", "m.locked = 0", "COALESCE(json_extract(m.privacy, '$.profileVisibility'), 'members') = 'members'", "c.member_id != ?"];
  const args: string[] = [actor.id];
  if (f.q?.trim()) (where.push("(m.full_name LIKE ? ESCAPE '\\' OR c.headline LIKE ? ESCAPE '\\' OR c.skills LIKE ? ESCAPE '\\' OR c.looking_for LIKE ? ESCAPE '\\')"), args.push(like(f.q), like(f.q), like(f.q), like(f.q)));
  if (f.skill?.trim()) (where.push("(',' || c.skills || ',') LIKE ? ESCAPE '\\'"), args.push(`%,${f.skill.trim().toLowerCase().replace(/[\\%_]/g, (m) => `\\${m}`)},%`));
  if (f.availability && f.availability in AVAILABILITY) (where.push("c.availability = ?"), args.push(f.availability));
  return (await all<Row>(`${SQL} WHERE ${where.join(" AND ")} ORDER BY c.updated_at DESC LIMIT 100`, args)).map(toProfile);
}

export async function myCollabProfile(actor: Actor): Promise<CollabProfile | null> {
  const r = await one<Row>(`${SQL} WHERE c.member_id = ?`, [actor.id]);
  return r ? toProfile(r) : null;
}

/** Popular skills among open profiles, for filter chips. */
export async function topSkills(limit = 12): Promise<string[]> {
  const rows = await all<{ skills: string }>("SELECT skills FROM prj_collab_profiles WHERE open = 1 AND skills != ''");
  const count = new Map<string, number>();
  for (const r of rows) for (const s of r.skills.split(",")) if (s) count.set(s, (count.get(s) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([s]) => s);
}

const schema = z.object({
  headline: z.string().trim().min(5, "Giới thiệu ngắn tối thiểu 5 ký tự.").max(120),
  skills: z
    .array(z.string().trim().toLowerCase().min(1).max(30))
    .max(12, "Tối đa 12 kỹ năng.")
    .transform((a) => [...new Set(a.map((s) => s.replace(/,/g, " ")))]),
  lookingFor: z.string().trim().max(500).default(""),
  availability: z.enum(Object.keys(AVAILABILITY) as [Availability, ...Availability[]]),
  open: z.boolean(),
});

export async function saveCollabProfile(actor: Actor, input: unknown): Promise<void> {
  const d = schema.parse(input);
  await run(
    `INSERT INTO prj_collab_profiles (member_id, headline, skills, looking_for, availability, open, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(member_id) DO UPDATE SET headline = excluded.headline, skills = excluded.skills, looking_for = excluded.looking_for, availability = excluded.availability, open = excluded.open, updated_at = excluded.updated_at`,
    [actor.id, d.headline, d.skills.join(","), d.lookingFor, d.availability, d.open ? 1 : 0, new Date().toISOString()],
  );
}
