import { mistralJsonText, parseJsonResponse } from "@/lib/mistral";

export async function POST(request: Request) {
  try {
    const { clientOffer, freelancerCounter, history } = await request.json();

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Mistral API key not configured" }, { status: 500 });
    }

    const systemPrompt = `You are an Autonomous AI Agent representing a client. 
    Your goal is to negotiate a fair price for a freelance service.
    The freelancer's current counter-offer is $${freelancerCounter}. 
    Your original offer was $${clientOffer}.
    The negotiation history so far is: ${JSON.stringify(history)}.
    
    Decide whether to ACCEPT, REJECT, or COUNTER.
    Respond ONLY with a valid JSON object matching this schema:
    {"decision": "ACCEPT" | "REJECT" | "COUNTER", "amount": number, "reasoning": "string"}`;

    const text = await mistralJsonText({
      messages: [{ role: "user", content: systemPrompt }],
    });

    let parsed: { decision: string; amount: number; reasoning: string };
    try {
      parsed = parseJsonResponse(text);
    } catch {
      return Response.json({ error: "Agent negotiation failed" }, { status: 400 });
    }

    // NOTE: this endpoint only negotiates. Settlement is deliberately NOT
    // automatic: accepting a counter-offer must go through the standard
    // invoice → payUrl flow so the human client reviews before signing, and
    // autonomousAgentPay stays gated by its own budget + sybil checks.

    return Response.json({ success: true, agentResponse: parsed });
  } catch (error) {
    console.error("Negotiation Agent Error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
