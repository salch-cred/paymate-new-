import { draftInvoice } from "@/lib/draft"
import { checkAndConsumeRequestBudget } from "@/lib/rateLimit"

export async function POST(request: Request) {
  // SECURITY (audit fix 2026-08-13): no auth on this route, and it calls a
  // paid third-party LLM — cap abuse.
  if (!(await checkAndConsumeRequestBudget("invoice-draft", 300, 60 * 60 * 1000))) {
    return Response.json({ detail: "Too many requests. Please try again later." }, { status: 429 })
  }
  const body = await request.json().catch(() => null)
  const prompt = body?.prompt
  if (typeof prompt !== "string" || prompt.length < 12 || prompt.length > 6000) {
    return Response.json({ detail: "prompt must be between 12 and 6000 characters" }, { status: 422 })
  }
  const draft = await draftInvoice(prompt)
  return Response.json({ draft, requiresReview: true })
}
