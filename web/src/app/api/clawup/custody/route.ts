import { getCustodyAddress } from "@/lib/chain"

export const dynamic = "force-dynamic"

/**
 * Public custody address for cross-chain (ClawUp routing) payments.
 * Clients send the source-chain native token here; the settle route verifies
 * the deposit on the source chain, then pays the freelancer USDC on GOAT from
 * this same wallet. Fail-closed: 503 (not a fake address) when PRIVATE_KEY
 * isn't configured.
 */
export async function GET() {
  try {
    return Response.json({ address: getCustodyAddress() })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ detail: message, address: null }, { status: 503 })
  }
}
