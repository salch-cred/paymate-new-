/**
 * Live native-token prices (USD) for the ClawUp cross-chain settlement paths.
 *
 * Cross-chain payments used to send a fixed 0.0001 dust and the settle route
 * accepted ANY native transfer to the freelancer as full settlement — a $2,480
 * invoice could be "paid" with ~$0.06. Now the client must send the invoice's
 * actual value in the source chain's native token, and the settle route
 * verifies the on-chain value against the live price before marking paid.
 *
 * Prices come from CoinGecko's public API and are cached in-process (60s TTL).
 * If prices cannot be fetched, verification fails closed (no silent settlement).
 */
const COIN_ID_BY_CHAIN_ID: Record<number, string> = {
  56: "binancecoin",      // BNB (BSC)
  8453: "ethereum",       // ETH (Base)
  10: "ethereum",         // ETH (Optimism)
  42161: "ethereum",      // ETH (Arbitrum)
  137: "matic-network",   // MATIC/POL (Polygon)
  43114: "avalanche-2",   // AVAX
  250: "fantom",          // FTM (Fantom)
  42220: "celo",          // CELO
}

let cache: { at: number; prices: Record<string, number> } | null = null
const TTL_MS = 60_000

async function fetchPrices(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.prices

  const ids = Array.from(new Set(Object.values(COIN_ID_BY_CHAIN_ID))).join(",")
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
    { headers: { accept: "application/json" }, cache: "no-store" }
  )
  if (!res.ok) throw new Error(`Price feed unavailable (${res.status})`)

  const data = (await res.json()) as Record<string, { usd?: number }>
  const prices: Record<string, number> = {}
  for (const [id, entry] of Object.entries(data)) {
    if (entry?.usd && entry.usd > 0) prices[id] = entry.usd
  }
  cache = { at: Date.now(), prices }
  return prices
}

/** USD price of the source chain's native token, or null if unsupported/unavailable. */
export async function getNativeUsdPrice(chainId: number): Promise<number | null> {
  const coinId = COIN_ID_BY_CHAIN_ID[chainId]
  if (!coinId) return null
  try {
    const prices = await fetchPrices()
    return prices[coinId] ?? null
  } catch {
    return null
  }
}


