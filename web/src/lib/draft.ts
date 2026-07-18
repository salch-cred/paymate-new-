export interface DraftLineItem {
  description: string
  amountUsd: number
}

export interface DraftResult {
  title: string
  description: string
  amountUsd: number
  dueDate: string
  lineItems: DraftLineItem[]
  paymentTerms: string
  confidence: number
  source: string
  warning?: string
}

function toTitleCase(value: string): string {
  return value.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

function addDaysIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function fallbackDraft(prompt: string): DraftResult {
  const clean = prompt.trim().split(/\s+/).join(" ")
  const moneyMatch = clean.match(/(?:\$|USD\s*|USDC\s*)([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:USD|USDC)/i)
  const amount = moneyMatch ? parseFloat((moneyMatch[1] || moneyMatch[2]).replace(/,/g, "")) : 0
  const titleSource = clean.split(/[.!?]|\s+(?:for|including|with|at|worth)\s+/i)[0]
  const title = toTitleCase(titleSource.slice(0, 72).trim()) || "Professional services"
  const dueMatch = clean.match(/(?:due|by)\s+(\d{4}-\d{2}-\d{2})/i)
  const dueDate = dueMatch ? dueMatch[1] : addDaysIso(14)
  const description = clean
    .replace(/\s*(?:for|at)\s+(?:\$|USDC\s*|USD\s*)?[\d,]+(?:\.\d{1,2})?\s*(?:USDC|USD)?/gi, "")
    .trim()
  return {
    title,
    description: description || clean,
    amountUsd: amount,
    dueDate,
    lineItems: amount ? [{ description: title, amountUsd: amount }] : [],
    paymentTerms: dueMatch ? `Due by ${dueDate}` : "Due within 14 days",
    confidence: amount ? 0.55 : 0.35,
    source: "structured-fallback",
  }
}

export async function draftInvoice(prompt: string): Promise<DraftResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return fallbackDraft(prompt)

  try {
    const { default: OpenAI } = await import("openai")
    const client = new OpenAI({ apiKey })
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You structure freelancer invoice drafts. Return JSON only with: " +
            "title (concise string), description (clear professional scope), " +
            "amountUsd (number; 0 if not explicitly provided), dueDate (YYYY-MM-DD or null), " +
            "lineItems (array of {description, amountUsd}), paymentTerms (string), " +
            "confidence (0 to 1). Never invent a price. Preserve the user's stated total.",
        },
        { role: "user", content: prompt },
      ],
    })
    const content = response.choices[0]?.message?.content
    if (!content) return fallbackDraft(prompt)
    const draft = JSON.parse(content) as DraftResult
    draft.amountUsd = Number(draft.amountUsd || 0)
    draft.confidence = Math.min(1, Math.max(0, Number(draft.confidence || 0)))
    draft.source = "ai"
    return draft
  } catch (error) {
    const fallback = fallbackDraft(prompt)
    fallback.warning = `AI drafting unavailable; used safe parser: ${
      error instanceof Error ? error.constructor.name : "Error"
    }`
    return fallback
  }
}
