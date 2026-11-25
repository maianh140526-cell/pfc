import { createHmac } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { migrateUp } from "@/db/migrate";
import { members, memberships } from "@/db/schema";
import { SESSION_COOKIE_NAME } from "@/lib/session-token";

const { cookieJar } = vi.hoisted(() => ({ cookieJar: { value: undefined as string | undefined } }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.value && name === SESSION_COOKIE_NAME ? { name, value: cookieJar.value } : undefined),
    set: (name: string, value: string) => {
      if (name === SESSION_COOKIE_NAME) cookieJar.value = value;
    },
    delete: () => {
      cookieJar.value = undefined;
    },
  }),
}));

import { POST } from "./route";

const SECRET = "test-platform-sso-secret";

function token(claims: Record<string, unknown>, secret = SECRET) {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ iss: "pfc-platform", aud: "pfc-club", iat: now, exp: now + 60, ...claims });
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

function req(idToken: string) {
  return new Request("http://local/api/club/sso/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
}

describe("POST /api/club/sso/session (PFC App gateway exchange)", () => {
  beforeAll(() => {
    migrateUp();
    process.env.PLATFORM_SSO_MODE = "oidc";
    process.env.PLATFORM_SSO_SHARED_SECRET = SECRET;
    process.env.CLUB_FLAG_SSO = "1";
  });
  beforeEach(() => {
    cookieJar.value = undefined;
  });

  it("signs a platform user in without creating or activating a club membership", async () => {
    const email = `sso-${Date.now()}@pfc.test`;
    const res = await POST(req(token({ sub: `plat-${Date.now()}`, email, name: "SSO Test" })));
    expect(res.status).toBe(200);
    expect(cookieJar.value).toBeTruthy();
    const m = db.select().from(members).where(eq(members.email, email)).all()[0];
    expect(m).toBeTruthy();
    const ms = db.select().from(memberships).where(eq(memberships.memberId, m!.id)).all();
    expect(ms).toHaveLength(0); // joining the private club still needs approval
  });

  it("rejects a token signed with another secret", async () => {
    const res = await POST(req(token({ sub: "x", email: "x@pfc.test", name: "X" }, "wrong-secret")));
    expect(res.status).toBe(401);
    expect(cookieJar.value).toBeUndefined();
  });

  it("rejects an expired token", async () => {
    const res = await POST(req(token({ sub: "y", email: "y@pfc.test", name: "Y", exp: Math.floor(Date.now() / 1000) - 5 })));
    expect(res.status).toBe(401);
  });
});
