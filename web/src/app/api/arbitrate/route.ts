export async function POST(request: Request) {
  try {
    const { invoiceId, originalContract, freelancerEvidence, clientComplaint } = await request.json();

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Mistral API key not configured for arbitration." }, { status: 500 });
    }

    const systemPrompt = `You are the Supreme AI Arbitrator for the PayMate smart contract protocol.
A dispute has been raised on an escrowed invoice. You must act as an impartial judge and determine who should receive the locked funds.

Case Details:
Invoice ID: ${invoiceId}
Original Contract (Scope of Work): "${originalContract}"
Freelancer's Submitted Evidence of Completion: "${freelancerEvidence}"
Client's Complaint (Why they refuse to pay): "${clientComplaint}"

Your Task:
1. Analyze the original contract.
2. Evaluate if the freelancer's evidence satisfies the contract.
3. Consider the validity of the client's complaint.
4. Render a final, binding verdict.

Output ONLY a valid JSON object matching this schema:
{
  "verdict": "PAY_FREELANCER" | "REFUND_CLIENT" | "SPLIT_50_50",
  "reasoning": "Detailed legal/technical explanation of your decision."
}`;

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-large-latest",
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
      return Response.json({ error: "Arbitrator failed to render a valid verdict." }, { status: 400 });
    }

    // In a production environment, this verdict would immediately trigger
    // a backend wallet to call `resolveEscrow()` on the YieldEscrow.sol contract
    // based on the AI's cryptographic decision.
    
    // Example pseudocode:
    /*
    if (parsed.verdict === "PAY_FREELANCER") {
      await yieldEscrowContract.resolveInFavorOf(invoiceId, FREELANCER_ADDRESS);
    }
    */

    return Response.json({ success: true, arbitration: parsed });
  } catch (error) {
    console.error("Arbitration Error:", error);
    return Response.json({ error: "Internal server error during arbitration." }, { status: 500 });
  }
}
