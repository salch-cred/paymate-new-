import { createFeedback, listFeedback, type FeedbackRole } from "@/lib/db"
import { checkAndConsumeRequestBudget } from "@/lib/rateLimit"

const VALID_ROLES: FeedbackRole[] = ["freelancer", "client", "other"]

export async function GET() {
  // SECURITY (audit fix 2026-08-13): listFeedback() now redacts `contact`
  // (PII) by default — this route is fully public/unauthenticated.
  const feedback = await listFeedback(100)
  return Response.json({ feedback })
}

export async function POST(request: Request) {
  // SECURITY (audit fix 2026-08-13): no auth on this route — cap spam.
  if (!(await checkAndConsumeRequestBudget("feedback-create", 300, 60 * 60 * 1000))) {
    return Response.json({ detail: "Too many submissions recently. Please try again later." }, { status: 429 })
  }
  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ detail: "Invalid request body" }, { status: 422 })
  const { role, name, contact, rating, comment, invoiceId } = body

  if (!VALID_ROLES.includes(role)) {
    return Response.json({ detail: "role must be one of: freelancer, client, other" }, { status: 422 })
  }
  if (typeof name !== "string" || name.trim().length < 1 || name.trim().length > 80) {
    return Response.json({ detail: "name must be between 1 and 80 characters" }, { status: 422 })
  }
  const ratingNum = Number(rating)
  if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return Response.json({ detail: "rating must be a number from 1 to 5" }, { status: 422 })
  }
  if (typeof comment !== "string" || comment.trim().length < 3 || comment.trim().length > 2000) {
    return Response.json({ detail: "comment must be between 3 and 2000 characters" }, { status: 422 })
  }

  const feedback = await createFeedback({
    role,
    name,
    contact: typeof contact === "string" ? contact : null,
    rating: ratingNum,
    comment,
    invoiceId: typeof invoiceId === "string" ? invoiceId : null,
  })
  return Response.json({ feedback }, { status: 201 })
}
