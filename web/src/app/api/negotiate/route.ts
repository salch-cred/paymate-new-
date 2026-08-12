import { mistralJsonText, parseJsonResponse } from "@/lib/mistral";
import { checkAndConsumeRequestBudget } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    // SECURITY (audit fix 2026-08-13): no auth on this route, and it calls a
    // paid third-party LLM — cap abuse and bound the untrusted input we
    // forward into the prompt (both cost-DoS and prompt-injection surface).
    if (!(await checkAndConsumeRequestBudget("negotiate", 300, 60 * 60 * 1000))) {
      return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const { clientOffer, freelancerCounter, history } = await request.json();

    const offer = Number(clientOffer);
    const counter = Number(freelancerCounter);
    if (!Number.isFinite(offer) || !Number.isFinite(counter) || offer < 0 || counter < 0 || offer > 10_000_000 || counter > 10_000_000) {
      return Response.json({ error: "clientOffer and freelancerCounter must be valid, bounded numbers" }, { status: 422 });
    }
    const boundedHistory = Array.isArray(history) ? history.slice(-20) : [];
    const historyJson = JSON.stringify(boundedHistory);
    if (historyJson.length > 8000) {
      return Response.json({ error: "history is too large" }, { status: 422 });
    }

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Mistral API key not configured" }, { status: 500 });
    }

    const systemPrompt = `You are an Autonomous AI Agent representing a client. 
    Your goal is to negotiate a fair price for a freelance service.
    The freelancer's current counter-offer is $${counter}. 
    Your original offer was $${offer}.
    The negotiation history so far is: ${historyJson}.
    
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
