import { draftInvoice } from "@/lib/draft"
import { checkAndConsumeRequestBudget } from "@/lib/rateLimit"

// SECURITY (audit fix 2026-08-13): bound the audio upload size — no auth on
// this route, so an unbounded blob is a cheap way to burn GEMINI_API_KEY
// quota/bandwidth. 10MB is generous for a few minutes of compressed speech.
const MAX_AUDIO_BYTES = 10 * 1024 * 1024

export async function POST(request: Request) {
  try {
    if (!(await checkAndConsumeRequestBudget("agent-voice", 100, 60 * 60 * 1000))) {
      return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 })
    }

    const formData = await request.formData()
    const audio = formData.get("audio") as Blob | null
    const history = formData.get("history") as string | null

    if (!audio) {
      return Response.json({ error: "No audio provided" }, { status: 400 })
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: "Audio too large." }, { status: 413 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return Response.json({ error: "No GEMINI_API_KEY" }, { status: 500 })
    }

    // Convert audio Blob to Base64
    const arrayBuffer = await audio.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")
    const mimeType = audio.type || "audio/webm"

    let parsedHistory: Array<{ role: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }> = []
    if (history) {
      try {
        parsedHistory = JSON.parse(history)
      } catch {
        // ignore
      }
    }

    // Construct the contents payload for Gemini
    const contents = [
      ...parsedHistory,
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio
            }
          }
        ]
      }
    ]

    const systemInstruction = {
      parts: {
        text: `You are "Cat", the official PayMate AI Voice Assistant — a friendly, professional, and knowledgeable voice agent for the PayMate platform (paymateagent.xyz).

## About PayMate
PayMate is a non-custodial, on-chain invoicing and payment platform built on the GOAT Network. Freelancers use it to:
- Create intelligent invoices with AI-assisted drafting
- Collect direct wallet-to-wallet USDC payments via the x402 protocol
- Build a portable, soulbound ERC-8004 reputation credential on GOAT Network
- Accept cross-chain payments from 39 networks (Ethereum, Base, Arbitrum, Optimism, BSC, Polygon, Avalanche, zkSync, Linea, Scroll, Blast, Fantom, Celo, Metis, Mantle, opBNB, Polygon zkEVM, Arbitrum Nova, Cronos, Gnosis, Aurora, Moonbeam, Moonriver, Klaytn, Harmony, Core, Fraxtal, Mode, Immutable zkEVM, Telos, Meter, Astar, OKC, Kava, Rootstock, Sonic, Zora, GOAT Network, Robinhood Chain) via ClawUp
- Escrow payments tied to GitHub PRs with AI-powered dispute resolution
- Split payments across multiple wallets, set milestones, and stream payments in real-time

## Your Personality
- Warm, professional, and concise — like a sharp freelancer's assistant
- Use natural, spoken language (you will be read aloud via text-to-speech)
- Never use markdown, bullet points, asterisks, or formatting symbols
- Keep responses under 3 sentences unless the user asks for details
- Be encouraging: "Great, let's get that invoice set up!" not "Please provide the following fields."

## Your Job
Help the user create invoices by voice. You need these details:
1. Project title or scope of work (what was delivered)
2. Amount in USD (USDC)
3. Client's Ethereum wallet address (0x...)
4. Optional: due date, description, milestones

## Conversation Flow
- Start by understanding what they need. If they say something like "I need an invoice for 500 dollars for web design", extract what you can and ask only for what's missing.
- If they give a vague description, help them refine it professionally. For example, if they say "I did some coding", ask "Got it! Can you tell me more about the project? Was it frontend, backend, a smart contract?"
- When you have enough info (at minimum: title, amount), confirm it naturally: "Perfect — so that's a 2,480 dollar invoice for brand identity and visual design. Should I draft that up?"
- If they confirm, output the JSON block.

## Important Rules
- All payments settle in USDC on the GOAT Network — always refer to amounts in USD or USDC, never ETH or other tokens
- Never mention competitors. You are PayMate's voice agent.
- If asked about features you don't handle (like swap, bridge, staking), say "That's available in the PayMate dashboard! I'm here specifically to help you draft invoices by voice."
- If the user asks something completely unrelated to PayMate, gently redirect: "I'd love to help, but I'm best at creating invoices. Want to draft one?"

## Output Format
When you have enough information to draft an invoice, confirm with the user first. Once confirmed, include a JSON block at the very end of your response:
\`\`\`json
{"title": "...", "description": "...", "amountUsd": 100, "dueDate": "YYYY-MM-DD"}
\`\`\`
Only include the JSON block when the user has confirmed the details. Do not include it while still gathering information.`
      }
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction,
        contents,
        generationConfig: {
          temperature: 0.5
        }
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      console.error("Gemini API Error:", data)
      return Response.json({ error: "Gemini API error" }, { status: 500 })
    }

    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || ""
    
    // Parse out JSON if available
    let draftData = null
    let spokenText = replyText
    
    const jsonMatch = replyText.match(/```json\n([\s\S]*?)\n```/)
    if (jsonMatch) {
      try {
        draftData = JSON.parse(jsonMatch[1])
        spokenText = replyText.replace(jsonMatch[0], "").trim()
        
        // Enhance draft with lib/draft logic
        const enhancedDraft = await draftInvoice(JSON.stringify(draftData))
        draftData = { ...draftData, ...enhancedDraft }
      } catch (e) {
        console.error("Failed to parse JSON from Gemini response", e)
      }
    }

    return Response.json({ 
      text: spokenText, 
      draft: draftData,
      role: "model"
    })
  } catch (error) {
    console.error("Error in /api/agent/voice:", error)
    return Response.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
