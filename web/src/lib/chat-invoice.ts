import { getAddress } from "viem"
import { createInvoice, getChatState, saveChatState, type ChatState, type Invoice } from "./db"
import { mistralJsonText, parseJsonResponse } from "./mistral"
import { OPEN_CLIENT_ADDRESS } from "./constants"

/**
 * Shared invoice-creation flow used by every automated/bot integration
 * (Slack, Telegram, Twitter, GitHub, OpenClaw). These flows previously each   * duplicated the same "open client + no fabricated signature + payUrl" logic.
   */
export async function createBotInvoice(opts: {
  /** webhookUrl tag recorded on the invoice, e.g. "slack-bot". */
  source: string
  freelancer: string
  title: string
  description: string
  amountUsd: number
  /** Optional real client address; defaults to the open-invoice sentinel. */
  client?: string
  /** Optional explicit signature; bot flows store none (no fabricated proofs). */
  signature?: string
  /** Optional public API key id that generated this invoice (for attribution). */
  apiKeyId?: string | null
  /** Optional paywall deliverable — served only after on-chain payment. */
  paywallContent?: string | null
}): Promise<{ invoice: Invoice; payUrl: string }> {
  const invoice = await createInvoice({
    freelancer: getAddress(opts.freelancer),
    client: getAddress(opts.client || OPEN_CLIENT_ADDRESS),
    title: opts.title,
    description: opts.description,
    amountUsd: opts.amountUsd,
    webhookUrl: opts.source,
    signature: opts.signature || null,
    apiKeyId: opts.apiKeyId || null,
    paywallContent: opts.paywallContent || null,
  })
  return { invoice, payUrl: `https://paymateagent.xyz/pay/${invoice.id}` }
}

interface ConversationResult {
  ready?: boolean
  address?: string | null
  amountUsd?: string | null
  description?: string | null
  title?: string | null
  reply?: string | null
}

/**
 * Lightweight natural-language extractor used when the AI model is offline
 * (no MISTRAL_API_KEY). Users talk to the bot in plain words — never in a
 * command format — and this pulls out the wallet address, amount, and work
 * description from their sentence so invoices can still be created.
 */
export function parseNaturalInvoiceInput(text: string): {
  address?: string | null
  amountUsd?: string | null
  description?: string | null
} {
  const out: { address?: string | null; amountUsd?: string | null; description?: string | null } = {}

  // Wallet: any 42-char 0x hex address mentioned in the message.
  const addr = text.match(/0x[a-fA-F0-9]{40}/)
  if (addr) out.address = addr[0]

  // Amount: "$500", "500 usdc", "500 dollars", "$500 for..."
  const amountMatch = text.match(/\$\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:usdc?|usd|dollars?|bucks)/i)
  if (amountMatch) {
    const raw = (amountMatch[1] ?? amountMatch[2] ?? "").replace(/,/g, "")
    if (raw) out.amountUsd = raw
  }

  // Description: the phrase after "for" / "for the" / "to build|create|do",
  // or a trailing "scope:" clause — with address/amount noise stripped.
  let rest = text
  if (addr) rest = rest.replace(addr[0], " ").replace(/\s+/g, " ").trim()
  const forMatch = rest.match(/(?:for(?: the| a)?|to (?:build|create|do|make|design|develop)|scope:?)\s+(.+)/i)
  if (forMatch) {
    let desc = forMatch[1].trim()
    // Drop the amount itself ("750 usdc", "$1200") wherever it appears.
    desc = desc.replace(/\$\s*\d+(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*(?:usdc?|usd|dollars?|bucks)/i, "").trim()
    // Drop leftover address chatter like ", my address 0x..." or "... to 0x...".
    desc = desc.replace(/0x[a-fA-F0-9]+/g, "").replace(/,?\s*(?:my|the)?\s*(?:address|wallet)\b.*$/i, "").trim()
    // If the amount sat mid-sentence, the description now reads "for logo design"
    // — keep only the final clause after the last "for".
    const lastClause = desc.match(/.*\bfor\s+(.+)$/i)
    if (lastClause) desc = lastClause[1].trim()
    desc = desc.replace(/\s+(?:to|for)\s*$/i, "").replace(/[.!?]+$/g, "").trim()
    if (desc) out.description = desc
  }

  return out
}

function buildConversationPrompt(platform: string, state: ChatState, extraInstruction?: string): string {
  return `You are the PayMate ${platform} AI Agent. You are a helpful, friendly, and intelligent assistant. 
If the user greets you or asks a general question, reply to them naturally in a friendly tone in the 'reply' field. 

Your primary goal is to securely help the user create an invoice. To create an invoice, you need 3 things from the user.
Here is what we currently know about the user's request:
- Wallet address: ${state.address || "Missing"}
- Amount in USD: ${state.amountUsd || "Missing"}
- Description: ${state.description || "Missing"}

Look at the user's latest message and extract any of the missing information (if present).
A wallet address is a 42-character 0x hex address.
An amount is a positive number (e.g. 50).
A description is the scope of work (e.g. 'landing page').

${extraInstruction || ""}
Return a JSON object with the UPDATED information:
{
  "ready": <true ONLY if all 3 fields are known AND the user is confirming/requesting to generate the invoice right now. If they are just asking a question, set to false>,
  "address": "<the known or newly provided wallet address, or null if changing it>",
  "amountUsd": "<the known or newly provided amount as a number, or null if changing it>",
  "description": "<the known or newly provided description, or null if changing it>",
  "title": "<short title if ready, or null>",
  "reply": "<Your natural text reply to the user. If ready is false, ask for missing details or answer their question. If ready is true, leave this null.>"
}`
}

/**
 * Runs the multi-turn invoice-drafting conversation used by the Slack /
 * Telegram / Twitter bots: load chat state, ask Mistral to extract/confirm
 * wallet + amount + description, persist updated state, and either generate
 * the invoice (via createBotInvoice) or reply asking for the missing details.
 *
 * The platform transport (verification, posting the reply) stays in the route;
 * this helper handles everything else. `platform` is used for the prompt and
 * for the invoice's webhookUrl/signature tags (e.g. "Slack" -> "slack-bot").
 */
export async function runInvoiceConversation(opts: {
  platform: string
  chatKey: string
  userText: string
  onReply: (text: string) => Promise<void>
  onInvoiceCreated?: (invoice: Invoice, payUrl: string) => Promise<void>
  offlineReply?: () => Promise<void>
  extraInstruction?: string
}): Promise<void> {
  const { platform, chatKey, userText } = opts

  // Natural-language fallback (no AI model, no command formats): parse the
  // user's plain sentence, persist the conversation state, and either create
  // the invoice or reply naturally asking only for what's still missing.
  if (!process.env.MISTRAL_API_KEY) {
    const state = await getChatState(chatKey)
    const parsed = parseNaturalInvoiceInput(userText)
    if (parsed.address !== undefined) state.address = parsed.address
    if (parsed.amountUsd !== undefined) state.amountUsd = parsed.amountUsd
    if (parsed.description !== undefined) state.description = parsed.description
    state.updatedAt = Date.now()
    await saveChatState(state)

    const wantsInvoice = /\b(generate|create|make|send|issue|confirm|go ahead|yes|please)\b/i.test(userText)
    if (wantsInvoice && state.address && state.amountUsd && state.description) {
      const tag = platform.toLowerCase()
      const { invoice, payUrl } = await createBotInvoice({
        source: `${tag}-bot`,
        freelancer: state.address,
        title: "PayMate Invoice",
        description: state.description,
        amountUsd: Number(state.amountUsd),
      })
      if (opts.onInvoiceCreated) await opts.onInvoiceCreated(invoice, payUrl)
      return
    }

    const missing: string[] = []
    if (!state.address) missing.push("your wallet address (0x...)")
    if (!state.amountUsd) missing.push("the amount in USD")
    if (!state.description) missing.push("a short description of the work")
    const reply = missing.length
      ? `Sure! To create your invoice I just need ${missing.join(", ")}. Just tell me in your own words — for example: "my wallet is 0x... and I want a $500 invoice for a landing page".`
      : `Got it! Here's what I have so far:\n• Wallet: ${state.address}\n• Amount: $${state.amountUsd} USDC\n• Work: ${state.description}\n\nJust say "create the invoice" and I'll generate it for you.`
    await opts.onReply(reply)
    return
  }

  const state = await getChatState(chatKey)

  const content = await mistralJsonText({
    messages: [
      { role: "system", content: buildConversationPrompt(platform, state, opts.extraInstruction) },
      { role: "user", content: userText },
    ],
    agentId: process.env.MISTRAL_AGENT_ID,
  })
  if (!content) return // model returned nothing; leave state untouched

  const result = parseJsonResponse<ConversationResult>(content)

  if (result.address !== undefined) state.address = result.address
  if (result.amountUsd !== undefined) state.amountUsd = result.amountUsd
  if (result.description !== undefined) state.description = result.description
  state.updatedAt = Date.now()
  await saveChatState(state)

  if (result.ready === true && state.address && state.amountUsd && state.description) {
    const tag = platform.toLowerCase()
    const { invoice, payUrl } = await createBotInvoice({
      source: `${tag}-bot`,
      freelancer: state.address,
      title: result.title || "PayMate Invoice",
      description: state.description,
      amountUsd: Number(state.amountUsd),
    })
    if (opts.onInvoiceCreated) await opts.onInvoiceCreated(invoice, payUrl)
  } else {
    await opts.onReply(result.reply || "I need your wallet address, the amount, and a description to create the invoice.")
  }
}
