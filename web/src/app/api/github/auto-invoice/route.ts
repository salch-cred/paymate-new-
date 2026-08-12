import { NextResponse } from "next/server";
import { Octokit } from "octokit";
import { mistralJsonText, parseJsonResponse } from "@/lib/mistral";
import { checkAndConsumeRequestBudget } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    // SECURITY (audit fix 2026-08-13): this endpoint has no auth and calls two
    // paid third-party APIs (GitHub, Mistral) per request — cap total abuse.
    if (!(await checkAndConsumeRequestBudget("github-auto-invoice", 100, 60 * 60 * 1000))) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
    }

    const { repoUrl, prNumber } = await request.json();
    const apiKey = process.env.MISTRAL_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "Missing MISTRAL_API_KEY" }, { status: 500 });
    }

    if (typeof repoUrl !== "string" || repoUrl.length > 300 || !prNumber || !Number.isFinite(Number(prNumber))) {
      return NextResponse.json({ error: "Missing or invalid repoUrl or prNumber" }, { status: 400 });
    }

    // Parse owner and repo from a genuine github.com URL (audit fix
    // 2026-08-13: anchor to the start of the hostname so a crafted string
    // like "evil.com/github.com/x/y" can't slip through the old loose match).
    const match = repoUrl.match(/^https:\/\/(?:www\.)?github\.com\/([^\/\s]+)\/([^\/\s]+)/);
    if (!match) {
      return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 });
    }
    const owner = match[1];
    const repo = match[2].replace(/\.git$/, "");

    let diffText = "";
    let prTitle = "";
    let prBody = "";

    try {
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      
      // Fetch PR details
      const pr = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: parseInt(prNumber, 10),
      });
      
      prTitle = pr.data.title;
      prBody = pr.data.body || "";

      // Fetch actual PR diff
      const diffResponse = await octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: parseInt(prNumber, 10),
        mediaType: {
          format: "diff",
        },
      });
      
      diffText = diffResponse.data as unknown as string;
      
      // Truncate diff if it's too huge for the LLM context
      if (diffText.length > 15000) {
         diffText = diffText.substring(0, 15000) + "\n...[DIFF TRUNCATED]";
      }
    } catch (err) {
      console.error("Failed to fetch GitHub PR data:", err);
      return NextResponse.json({ error: "Failed to fetch PR from GitHub. Check URL, PR number, or GITHUB_TOKEN." }, { status: 400 });
    }

    const aiPrompt = `You are a technical AI agent for PayMate. A freelancer has submitted a GitHub Pull Request for invoicing.
Here are the precise details fetched from GitHub:
Title: ${prTitle}
Body: ${prBody}

Code Diff:
\`\`\`diff
${diffText}
\`\`\`

Analyze the actual scope of work shown in this diff and generate a professional invoice draft based on the real code changes.
Output a JSON object with:
{
  "title": "<A short professional title for this specific work>",
  "description": "<A detailed breakdown of the exact deliverables and code changes based on the diff>",
  "amountUsd": <A suggested fair bounty amount between 50 and 5000 based on standard dev rates and the complexity of the diff>
}`;

    const aiContent = await mistralJsonText({
      messages: [{ role: "system", content: aiPrompt }],
      temperature: 0.2,
    });

    if (!aiContent) throw new Error("AI generation failed");

    let draft;
    try {
      draft = parseJsonResponse(aiContent);
    } catch {
      draft = { title: "GitHub Bounty", description: `Bounty payout for ${repoUrl}`, amountUsd: 150 };
    }

    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    console.error("Auto Invoice Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
