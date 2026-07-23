import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt) {
      return Response.json({ error: "Missing prompt" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `You are an AI assistant that extracts invoice details from natural language.
    Given a prompt, extract:
    1. freelancer (Ethereum address, default to 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 if none provided)
    2. client (Ethereum address, default to 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 if none provided)
    3. title (short string)
    4. description (longer string)
    5. amountUsd (number)
    
    Respond ONLY with a valid JSON object matching this schema. Do not include markdown blocks or any other text.
    Example: {"freelancer":"0x123...","client":"0x456...","title":"Web Dev","description":"Built a landing page","amountUsd":500}`;

    const result = await model.generateContent(`${systemPrompt}\n\nUser Prompt: ${prompt}`);
    const text = result.response.text();
    
    let parsed;
    try {
      // Clean up potential markdown formatting if the model still includes it
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse Gemini output:", text);
      return Response.json({ error: "Failed to understand the invoice request" }, { status: 400 });
    }

    return Response.json({ success: true, invoiceData: parsed });
  } catch (error) {
    console.error("Magic API Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
