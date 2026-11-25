/**
 * Errors whose message is safe to show the user. Anything else becomes a generic message.
 * `code` lets a screen render a dedicated state (e.g. login: locked / unverified / rate_limited).
 */
export class ActionError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly meta?: Record<string, string | number>,
  ) {
    super(message);
  }
}
