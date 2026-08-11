import { getNativeUsdPrice } from "@/lib/price"

const SUPPORTED_CHAINS = [56, 8453, 10, 42161, 137, 43114, 250, 42220]

/** Live native-token USD prices for the ClawUp cross-chain flow. */
export async function GET() {
  const prices: Record<number, number | null> = {}
  await Promise.all(
    SUPPORTED_CHAINS.map(async (chainId) => {
      prices[chainId] = await getNativeUsdPrice(chainId)
    })
  )
  return Response.json({ prices })
}
