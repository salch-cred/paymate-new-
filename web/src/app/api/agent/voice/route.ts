import { draftInvoice } from "@/lib/draft"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const audio = formData.get("audio") as Blob | null
    const history = formData.get("history") as string | null

    if (!audio) {
      return Response.json({ error: "No audio provided" }, { status: 400 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return Response.json({ error: "No GEMINI_API_KEY" }, { status: 500 })
    }

    // Convert audio Blob to Base64
    const arrayBuffer = await audio.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")
    const mimeType = audio.type || "audio/webm"

    let parsedHistory = []
    if (history) {
      try {
        parsedHistory = JSON.parse(history)
      } catch {
        // ignore
      }
    }

    // Construct the contents payload for Gemini
    // System instruction tells the AI how to act.
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
        text: `You are the "PayMate AI", a helpful voice assistant for creating web3 invoices. 
Listen to the user's audio. Determine if they have provided enough information to draft an invoice (title/scope, amount, client wallet).
If they are missing details, ask them conversationally (e.g., "I can help with that. Who is the client?", or "Got it. What is the total amount?"). 
Keep your responses short, conversational, and suitable for being spoken out loud via text-to-speech. Do not use markdown.
If they have provided enough information, confirm it and output a JSON block at the very end of your response with the invoice draft data. 
Format the JSON block exactly like this:
\`\`\`json
{"title": "...", "description": "...", "amountUsd": 100, "dueDate": "YYYY-MM-DD"}
\`\`\``
      }
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction,
        contents,
        generationConfig: {
          temperature: 0.4
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
