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
/** Chain ids that can be used as a ClawUp cross-chain settlement source. */
export const SUPPORTED_CROSS_CHAIN_IDS: number[] = [
  1, 56, 8453, 10, 42161, 137, 43114, 250, 42220, 324, 59144, 534352, 81457,
  1088, 5000, 204, 1101, 42170, 25, 100, 1313161554, 1284, 1285, 8217, 1666600000,
  1116, 252, 34443, 13371, 40, 82, 592, 66, 2222, 30, 146, 7777777,
  2345, 4663,
]

const COIN_ID_BY_CHAIN_ID: Record<number, string> = {
  1: "ethereum",          // ETH (Mainnet)
  56: "binancecoin",      // BNB (BSC)
  8453: "ethereum",       // ETH (Base)
  10: "ethereum",         // ETH (Optimism)
  42161: "ethereum",      // ETH (Arbitrum)
  137: "matic-network",   // MATIC/POL (Polygon)
  43114: "avalanche-2",   // AVAX
  250: "fantom",          // FTM (Fantom)
  42220: "celo",          // CELO
  324: "ethereum",        // ETH (zkSync)
  59144: "ethereum",      // ETH (Linea)
  534352: "ethereum",     // ETH (Scroll)
  81457: "ethereum",      // ETH (Blast)
  // Expanded cross-chain support (ClawUp routing)
  1088: "metis-token",    // METIS
  5000: "mantle",         // MNT
  204: "binancecoin",     // BNB (opBNB)
  1101: "ethereum",       // ETH (Polygon zkEVM)
  42170: "ethereum",      // ETH (Arbitrum Nova)
  25: "crypto-com-chain", // CRO (Cronos)
  100: "xdai",            // xDAI (Gnosis)
  1313161554: "ethereum",// ETH (Aurora)
  1284: "moonbeam",       // GLMR (Moonbeam)
  1285: "moonriver",      // MOVR (Moonriver)
  8217: "klay-token",     // KLAY (Klaytn)
  1666600000: "harmony", // ONE (Harmony)
  1116: "coredaoorg",     // CORE (Core)
  252: "frax-ether",      // frxETH (Fraxtal)
  34443: "ethereum",      // ETH (Mode)
  13371: "immutable-x",   // IMX (Immutable zkEVM)
  40: "telos",            // TLOS (Telos)
  82: "meter",            // MTR (Meter)
  592: "astar",           // ASTR (Astar)
  66: "oec-token",        // OKT (OKC)
  2222: "kava",           // KAVA
  30: "rootstock",        // RBTC (Rootstock)
  146: "sonic-3",         // S (Sonic)
  7777777: "ethereum",    // ETH (Zora)
  2345: "bitcoin",       // BTC (GOAT Network native gas)
  4663: "ethereum",      // ETH (Robinhood Chain)
}

let cache: { at: number; prices: Record<string, number> } | null = null
const TTL_MS = 60_000

async function fetchPrices(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.prices

  const ids = Array.from(new Set([...Object.values(COIN_ID_BY_CHAIN_ID), "dogecoin"])).join(",")
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

/**
 * Live USD price of DOGE (CoinGecko "dogecoin"), or null when unavailable.
 * Used by the direct-to-freelancer rail to size the BSC DOGEB swap + bridge
 * so the freelancer receives the exact invoice value on GOAT. Fails closed
 * (null → the plan/verify refuses) rather than settling against a stale guess.
 */
export async function getDogeUsdPrice(): Promise<number | null> {
  try {
    const prices = await fetchPrices()
    return prices["dogecoin"] ?? null
  } catch {
    return null
  }
}
