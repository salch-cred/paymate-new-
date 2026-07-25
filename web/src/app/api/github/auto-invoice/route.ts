import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { repoUrl, prNumber } = await request.json();
    const apiKey = process.env.MISTRAL_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Missing MISTRAL_API_KEY" }, { status: 500 });
    }

    // In a full implementation, we would use octokit to fetch the actual PR diffs here.
    // For this hackathon demo, we will pass the repo URL to Mistral and ask it to infer
    // the scope of work based on standard open-source PR structures.

    const aiPrompt = `You are a technical AI agent for PayMate. A freelancer has submitted a GitHub URL: ${repoUrl} (PR #${prNumber || 'latest'}).
Analyze the likely scope of work for a typical pull request in this context and generate a professional invoice draft.
Output a JSON object with:
{
  "title": "<A short professional title for the PR/work>",
  "description": "<A detailed breakdown of the likely deliverables and code changes>",
  "amountUsd": <A suggested fair bounty amount between 50 and 5000 based on standard dev rates>
}`;

    const aiResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "mistral-small-latest",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: aiPrompt }]
      })
    });

    const data = await aiResponse.json();
    const aiContent = data.choices?.[0]?.message?.content;
    
    if (!aiContent) throw new Error("AI generation failed");

    let draft;
    try {
      draft = JSON.parse(aiContent.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch(e) {
      draft = { title: "GitHub Bounty", description: `Bounty payout for ${repoUrl}`, amountUsd: 150 };
    }

    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    console.error("Auto Invoice Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
