import { createBotInvoice } from "@/lib/chat-invoice";
import { verifyHmacSignature } from "@/lib/auth";
import { NextResponse } from "next/server";
import { Octokit } from "octokit";

export async function POST(request: Request) {
  try {
    // SECURITY (audit fix H-2): verify GitHub's HMAC signature so this
    // endpoint can't be spoofed to spawn fake bounty invoices / bot comments.
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    const rawBody = await request.text();
    if (!secret) {
      console.error("[github/webhook] GITHUB_WEBHOOK_SECRET is not configured. Refusing request.");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }
    if (!verifyHmacSignature({ rawBody, secret, signature: request.headers.get("x-hub-signature-256"), sigPrefix: "sha256=" })) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    const payload = JSON.parse(rawBody);

    // Only process pull request or issues events
    if (!payload.action || (!payload.pull_request && !payload.issue)) {
      return NextResponse.json({ ok: true, message: "Ignored event type" });
    }

    if (payload.action !== "closed" && payload.action !== "merged") {
      return NextResponse.json({ ok: true, message: "Only processing closed/merged events" });
    }

    const item = payload.pull_request || payload.issue;
    const body = item.body || "";

    // SECURITY (audit fix 2026-08-13): a valid GitHub HMAC signature only
    // proves the request came from GitHub, not that the PR/issue *content* is
    // trustworthy — on any public repo wired to this webhook, any GitHub user
    // could previously get an "official" bounty invoice minted for their own
    // wallet just by writing a wallet/amount into an issue/PR body. Require a
    // trusted label (only addable by repo collaborators) before minting.
    const bountyLabel = process.env.GITHUB_BOUNTY_LABEL || "paymate-bounty";
    const labels: { name?: string }[] = Array.isArray(item.labels) ? item.labels : [];
    const hasBountyLabel = labels.some((l) => (l?.name || "").toLowerCase() === bountyLabel.toLowerCase());
    if (!hasBountyLabel) {
      return NextResponse.json({ ok: true, message: `Ignored: no "${bountyLabel}" label present.` });
    }

    // Look for a wallet address and amount in the PR/Issue body
    // e.g., "Wallet: 0x123... Amount: $500"
    // SECURITY (audit fix 2026-08-13): require an explicit "$" prefix on the
    // amount so an arbitrary number elsewhere in the body (issue #, line
    // number, version string) can't be misread as the bounty amount.
    const walletMatch = body.match(/0x[a-fA-F0-9]{40}/);
    const amountMatch = body.match(/\$(\d{1,7}(?:\.\d{1,2})?)\b/);

    if (!walletMatch || !amountMatch) {
      return NextResponse.json({ ok: true, message: "No bounty info found in body" });
    }

    const wallet = walletMatch[0];
    const amount = Number(amountMatch[1]);
    const title = `GitHub Bounty: ${item.title}`;
    const url = item.html_url;

    const { invoice, payUrl } = await createBotInvoice({
      source: "github-bot",
      freelancer: wallet,
      title,
      description: `Bounty payout for ${url}`,
      amountUsd: amount,
    });

    if (process.env.GITHUB_TOKEN && payload.repository) {
      try {
        const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
        const owner = payload.repository.owner.login;
        const repo = payload.repository.name;
        const issue_number = item.number;

        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number,
          body: `🤖 **PayMate AI:** A $${amount} bounty payout invoice has been generated for ${wallet}.\n\n💳 **[Pay Invoice via PayMate](${payUrl})**`
        });
        console.log(`[GitHub Bot] Posted comment on ${owner}/${repo}#${issue_number}`);
      } catch (err) {
        console.log(`[GitHub Bot] Failed to post comment:`, err);
      }
    } else {
      console.log(`[GitHub Bot] Created invoice for ${title}. Pay here: ${payUrl}`);
    }

    return NextResponse.json({ ok: true, invoiceId: invoice.id, payUrl });
  } catch (error) {
    console.error("GitHub Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
