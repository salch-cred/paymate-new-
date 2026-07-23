import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  try {
    const { clientOffer, freelancerCounter, history } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // The Agentic Client LLM
    const clientAgent = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const systemPrompt = `You are an Autonomous AI Agent representing a client. 
    Your goal is to negotiate a fair price for a freelance service.
    The freelancer's current counter-offer is $${freelancerCounter}. 
    Your original offer was $${clientOffer}.
    The negotiation history so far is: ${JSON.stringify(history)}.
    
    Decide whether to ACCEPT, REJECT, or COUNTER.
    Respond ONLY with a valid JSON object matching this schema:
    {"decision": "ACCEPT" | "REJECT" | "COUNTER", "amount": number, "reasoning": "string"}`;

    const result = await clientAgent.generateContent(systemPrompt);
    const text = result.response.text();
    
    let parsed;
    try {
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return Response.json({ error: "Agent negotiation failed" }, { status: 400 });
    }

    // If accepted, we would automatically trigger the createInvoice and autonomousAgentPay pipeline here
    if (parsed.decision === "ACCEPT") {
        // execute autonomous GOAT Network funding...
    }

    return Response.json({ success: true, agentResponse: parsed });
  } catch (error) {
    console.error("Negotiation Agent Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
