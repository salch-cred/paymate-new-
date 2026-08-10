// Reputation-mint multiplier tag. Only PayMate's own authenticated
// /api/clawup/intent route may set this value on an invoice (server-side);
// the public /api/invoices route explicitly nulls it out when a caller tries
// to pass it from the request body. Keeping it in one place prevents drift.
export const REFERRAL_MULTIPLIER_TAG = "clawup-referral-1.2x"

// Stand-in client address used by automated/bot invoice flows (Slack,
// Telegram, Twitter, GitHub, OpenClaw) when the user hasn't named a real client.
export const DUMMY_CLIENT_ADDRESS = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
