import { beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { members, memberships } from "@/db/schema";
import { migrateUp } from "@/db/migrate";
import { migrateDown } from "@/db/migrate-meta";
import type { SessionUser } from "@/lib/auth";
import * as clubs from "@/server/clubs";
import { eq } from "drizzle-orm";

function user(email: string): SessionUser {
  const id = nanoid();
  db.insert(members).values({ id, email, fullName: email, passwordHash: bcrypt.hashSync("PFC123!", 4), isSuperAdmin: false }).run();
  return { id, email, fullName: email, isSuperAdmin: false };
}

/** Join request → Pending → approve (Active) / reject; a rejected member can ask again on the same row. */
describe("private club join approval", () => {
  beforeEach(() => {
    migrateDown();
    migrateUp();
  });

  it("pending until a manager approves; members cannot approve; rejected can re-apply", () => {
    const owner = user("owner@pfc.vn");
    const club = clubs.createClub(owner, { name: "PFC", visibility: "private" });
    const a = user("a@pfc.vn");
    const b = user("b@pfc.vn");

    clubs.requestJoin(a, club.id, "Muốn học quản lý tài chính");
    const pending = clubs.getMyMembership(club.id, a.id)!;
    expect(pending.status).toBe("pending");
    expect(() => clubs.assertCanViewClub(a, club.id)).toThrow();
    expect(() => clubs.requestJoin(a, club.id, "Gửi lại yêu cầu tham gia câu lạc bộ")).toThrow(/pending/i);

    // A pending applicant cannot approve anyone (including themselves).
    expect(() => clubs.transitionMembership(a, pending.id, "active" as never)).toThrow();

    clubs.transitionMembership(owner, pending.id, "rejected" as never, "Chưa đủ thông tin");
    expect(clubs.getMyMembership(club.id, a.id)?.status).toBe("rejected");

    clubs.requestJoin(a, club.id, "Bổ sung: sinh viên năm 2 HVTC");
    const rows = db.select().from(memberships).where(eq(memberships.memberId, a.id)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("pending");
    expect(rows[0].rejectReason).toBeNull();

    clubs.transitionMembership(owner, rows[0].id, "active" as never);
    expect(clubs.getMyMembership(club.id, a.id)?.status).toBe("active");
    expect(() => clubs.assertCanViewClub(a, club.id)).not.toThrow();
    expect(() => clubs.assertCanViewClub(b, club.id)).toThrow();
  });
});
