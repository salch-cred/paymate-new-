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

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: systemPrompt }],
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    
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
