/**
 * Shared Mistral AI JSON-completion client.
 *
 * Previously every route that talked to Mistral (Slack/Telegram/Twitter bots,
 * /magic, /negotiate, /arbitrate, /github/auto-invoice) hand-rolled the fetch,
 * the `response_format: json_object` body, the agent-vs-model endpoint
 * selection, and the `replace(/```json/g, ...)` markdown-stripping parse.
 * That logic now lives here.
 */

export interface MistralMessage {
  role: "system" | "user"
  content: string
}

export interface MistralJsonTextOptions {
  messages: MistralMessage[]
  /** Defaults to mistral-small-latest; ignored when `agentId` is set. */
  model?: string
  /** If set, calls the Agents completions endpoint with `agent_id` instead. */
  agentId?: string
  /** Defaults to 0.1; ignored when `agentId` is set. */
  temperature?: number
}

/**
 * Calls Mistral with a JSON response format and returns the raw content string,
 * or null when the model returned no content (so callers can decide how to
 * degrade gracefully). Throws on missing API key, HTTP errors, etc.
 */
export async function mistralJsonText(opts: MistralJsonTextOptions): Promise<string | null> {
  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) throw new Error("MISTRAL_API_KEY not configured")

  const requestBody: Record<string, unknown> = {
    response_format: { type: "json_object" },
    messages: opts.messages,
  }

  let endpoint = "https://api.mistral.ai/v1/chat/completions"
  if (opts.agentId) {
    requestBody.agent_id = opts.agentId
    endpoint = "https://api.mistral.ai/v1/agents/completions"
  } else {
    requestBody.model = opts.model ?? "mistral-small-latest"
    requestBody.temperature = opts.temperature ?? 0.1
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(requestBody),
  })
  if (!response.ok) {
    throw new Error(`Mistral request failed with status ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  return typeof content === "string" ? content : null
}

/**
 * Strips markdown code fences (```json / ```) and parses the response as JSON.
 * Throws (SyntaxError / TypeError) when the text is missing or invalid JSON.
 */
export function parseJsonResponse<T>(text: string | null | undefined): T {
  if (!text) throw new Error("Empty AI response")
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim()
  return JSON.parse(cleaned) as T
}
