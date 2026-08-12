import { mistralJsonText, parseJsonResponse } from "@/lib/mistral";
import { checkAndConsumeRequestBudget } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    // SECURITY (audit fix 2026-08-13): no auth on this route, and it calls a
    // paid third-party LLM — cap abuse.
    if (!(await checkAndConsumeRequestBudget("magic", 300, 60 * 60 * 1000))) {
      return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const { prompt } = await request.json();

    if (typeof prompt !== "string" || prompt.trim().length < 3 || prompt.length > 6000) {
      return Response.json({ error: "prompt must be a string between 3 and 6000 characters" }, { status: 400 });
    }

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Mistral API key not configured" }, { status: 500 });
    }

    const systemPrompt = `You are an AI assistant that extracts invoice details from natural language.
    Given a prompt, extract:
    1. freelancer (Ethereum address — only include it if the user explicitly provided one)
    2. client (Ethereum address — only include it if the user explicitly provided one)
    3. title (short string)
    4. description (longer string)
    5. amountUsd (number)
    6. isStream (boolean - set true if the prompt mentions "per second", "stream", "streaming", "per token", etc.)
    7. streamRateUsd (number - the amount per tick if isStream is true, e.g. 0.05. null otherwise)
    
    Respond ONLY with a valid JSON object matching this schema. Do not include markdown blocks or any other text.
    Example: {"freelancer":"0x123...","client":"0x456...","title":"Web Dev","description":"Built a landing page","amountUsd":500, "isStream": false, "streamRateUsd": null}`;

    const text = await mistralJsonText({
      messages: [{ role: "user", content: `${systemPrompt}\n\nUser Prompt: ${prompt}` }],
    });

    let parsed;
    try {
      parsed = parseJsonResponse(text);
    } catch {
      console.error("Failed to parse output:", text);
      return Response.json({ error: "Failed to understand the invoice request" }, { status: 400 });
    }

    return Response.json({ success: true, invoiceData: parsed });
  } catch (error) {
    console.error("Magic API Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
