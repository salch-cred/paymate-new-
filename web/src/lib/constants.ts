// Reputation-mint multiplier tag. Only PayMate's own authenticated
// /api/clawup/intent route may set this value on an invoice (server-side);
// the public /api/invoices route explicitly nulls it out when a caller tries
// to pass it from the request body. Keeping it in one place prevents drift.
export const REFERRAL_MULTIPLIER_TAG = "clawup-referral-1.2x"

/** The referral tag stamped on invoices so ClawUp-originated activity counts
 *  in the growth metrics and earns the 1.2x reputation multiplier. Uses the
 *  configured CLAWUP_REFERRAL_ID when set, else the fixed fallback tag. */
export function resolveClawUpTag(): string {
  return process.env.CLAWUP_REFERRAL_ID || REFERRAL_MULTIPLIER_TAG
}

/** True when an invoice's webhookUrl carries the ClawUp referral tag (either
 *  the fixed fallback or a configured CLAWUP_REFERRAL_ID). */
export function isClawUpReferral(webhookUrl: string | null | undefined): boolean {
  if (!webhookUrl) return false
  if (webhookUrl === REFERRAL_MULTIPLIER_TAG) return true
  const configured = process.env.CLAWUP_REFERRAL_ID
  return !!configured && webhookUrl === configured
}

// Sentinel client address used by automated/bot invoice flows (Slack,
// Telegram, Twitter, GitHub, OpenClaw) when the user hasn't named a real
// client. The zero address means "open invoice" — any connected wallet can
// settle it (see the pay page's isPlaceholderClient check). This is a
// deliberate sentinel, not a fake wallet.
export const OPEN_CLIENT_ADDRESS = "0x0000000000000000000000000000000000000000"
