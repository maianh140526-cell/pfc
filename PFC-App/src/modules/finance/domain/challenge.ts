export type ChallengeType = "saving" | "spending_limit";
export type ChallengeStatus = "active" | "success" | "failed";

/**
 * Challenge outcome after a check-in. Ported from PFC Quỹ (saving_challenge_service.dart)
 * with one fix: upstream marked a *saving* challenge failed on any check-in where savings
 * were still below target — i.e. on day 1 of almost every challenge. Here a saving challenge
 * only fails if the target is still not reached once all days are checked in.
 * Spending-limit behaviour is unchanged: fail as soon as spending exceeds the limit.
 */
export function evaluateChallengeStatus(input: {
  challengeType: ChallengeType;
  progressAmount: number;
  targetAmount: number;
  checkedDays: number;
  durationDays: number;
}): ChallengeStatus {
  const finished = input.checkedDays >= input.durationDays;
  if (input.challengeType === "spending_limit") {
    if (input.progressAmount > input.targetAmount) return "failed";
    return finished ? "success" : "active";
  }
  if (!finished) return "active";
  return input.progressAmount >= input.targetAmount ? "success" : "failed";
}

/**
 * Progress since the first check-in: total spending for a spending-limit challenge,
 * net savings (income − expense) for a saving challenge.
 */
export function challengeProgress(
  challengeType: ChallengeType,
  txs: ReadonlyArray<{ type: "income" | "expense"; amount: number }>,
): number {
  return txs.reduce((sum, t) => {
    if (challengeType === "spending_limit") return t.type === "expense" ? sum + t.amount : sum;
    return sum + (t.type === "income" ? t.amount : -t.amount);
  }, 0);
}
