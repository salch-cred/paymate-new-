import { draftInvoice } from "@/lib/draft"

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const prompt = body?.prompt
  if (typeof prompt !== "string" || prompt.length < 12 || prompt.length > 6000) {
    return Response.json({ detail: "prompt must be between 12 and 6000 characters" }, { status: 422 })
  }
  const draft = await draftInvoice(prompt)
  return Response.json({ draft, requiresReview: true })
}
