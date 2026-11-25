/**
 * Posting / review rights that follow a member's PFC platform role (DEC-09, OPP-A02/A04). Pure, unit tested.
 *
 *  - Trưởng ban (any department)        → PROVIDER, posts as "<Ban …> · PFC", TRUSTED_PARTNER (posts go live, post-reviewed)
 *  - Ban điều hành, Chủ nhiệm           → REVIEWER (approve the queue) and may post as "Ban điều hành PFC", TRUSTED_PARTNER
 *  - Thành viên                          → no platform grant (external partners stay managed inside Opportunity Hub)
 *
 * Profiles created this way carry status "platform" so they can be withdrawn when the PFC role is removed,
 * without touching providers / reviewers that Opportunity Hub staff assigned themselves.
 */
export type HubRole = "MEMBER" | "PROVIDER" | "REVIEWER";
export type Grant = { role: Exclude<HubRole, "MEMBER">; providerName: string; tier: "TRUSTED_PARTNER" } | null;

const DEPARTMENT_NAME: Record<string, string> = {
  chuyen_mon: "Ban Chuyên môn",
  truyen_thong: "Ban Truyền thông",
  su_kien: "Ban Sự kiện",
};

export function platformGrant(pfcRole: string | null, pfcDepartment: string | null): Grant {
  if (pfcRole === "chu_nhiem" || pfcRole === "ban_dieu_hanh") return { role: "REVIEWER", providerName: "Ban điều hành PFC", tier: "TRUSTED_PARTNER" };
  if (pfcRole === "truong_ban") return { role: "PROVIDER", providerName: `${DEPARTMENT_NAME[pfcDepartment ?? ""] ?? "Ban"} · PFC`, tier: "TRUSTED_PARTNER" };
  return null;
}

/**
 * The hub role after sign-in. Never lowers a role that hub staff assigned (no platform profile involved);
 * a REVIEWER stays REVIEWER; a role that only came from the platform is withdrawn with the PFC role.
 */
export function nextHubRole(current: HubRole, grant: Grant, hadPlatformProfile: boolean, hasOtherActiveProfile: boolean): HubRole {
  if (grant) return current === "REVIEWER" ? "REVIEWER" : grant.role;
  if (!hadPlatformProfile) return current;
  return hasOtherActiveProfile ? "PROVIDER" : "MEMBER";
}
