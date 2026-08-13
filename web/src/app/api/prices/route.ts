import { getNativeUsdPrice, SUPPORTED_CROSS_CHAIN_IDS } from "@/lib/price"

/** Live native-token USD prices for the ClawUp cross-chain flow. */
export async function GET() {
  const prices: Record<number, number | null> = {}
  await Promise.all(
    SUPPORTED_CROSS_CHAIN_IDS.map(async (chainId) => {
      prices[chainId] = await getNativeUsdPrice(chainId)
    })
  )
  return Response.json({ prices })
}
