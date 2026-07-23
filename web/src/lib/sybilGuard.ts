import { GoogleGenerativeAI } from "@google/generative-ai";

export interface SybilAnalysis {
  isFraud: boolean;
  probability: number;
  reasoning: string;
}

export async function analyzeInvoiceFraud(
  freelancer: string,
  client: string,
  title: string,
  description: string,
  amountUsd: number
): Promise<SybilAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // If no API key is provided, fail open (allow payment) for demo purposes,
    // but log the warning.
    console.warn("No GEMINI_API_KEY provided. Sybil-Guard disabled.");
    return { isFraud: false, probability: 0, reasoning: "AI Sybil-Guard disabled (no key)" };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `You are the AI Sybil-Guard for an ERC-8004 Reputation protocol. 
Your job is to detect wash-trading and fraud. Bad actors create fake invoices to farm reputation scores.

Analyze this invoice data:
Freelancer Address: ${freelancer}
Client Address: ${client}
Title: "${title}"
Description: "${description}"
Amount (USD): $${amountUsd}

Red Flags to watch out for:
1. Client and Freelancer addresses are exactly the same (100% fraud).
2. The description is extremely short, generic, or gibberish (e.g., "test", "asdf", "did work") combined with a high amount.
3. The amount is absurdly high for the scope of work described.

Output ONLY a valid JSON object matching this exact schema:
{"probability": number (0 to 100), "reasoning": "string"}
Do not include markdown or backticks.`;

    const result = await model.generateContent(systemPrompt);
    const text = result.response.text();
    
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const probability = Number(parsed.probability) || 0;
    
    return {
      isFraud: probability > 80,
      probability: probability,
      reasoning: parsed.reasoning || "Analyzed successfully",
    };
  } catch (error) {
    console.error("Sybil-Guard Error:", error);
    // Fail open if the AI service goes down, so we don't block legitimate payments
    return { isFraud: false, probability: 0, reasoning: "Error during AI analysis" };
  }
}
