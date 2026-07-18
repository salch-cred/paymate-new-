import { isAddress } from "viem"
import { getReputationData } from "@/lib/chain"

export async function GET(request: Request, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params
  if (!isAddress(address)) return Response.json({ detail: "Invalid wallet address" }, { status: 422 })
  const data = await getReputationData(address)
  return Response.json(data)
}
