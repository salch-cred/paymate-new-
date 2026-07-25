import { createInvoice } from "@/lib/db";
import { getAddress } from "viem";
import { NextResponse } from "next/server";
import { Octokit } from "octokit";

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // Only process pull request or issues events
    if (!payload.action || (!payload.pull_request && !payload.issue)) {
      return NextResponse.json({ ok: true, message: "Ignored event type" });
    }

    if (payload.action !== "closed" && payload.action !== "merged") {
      return NextResponse.json({ ok: true, message: "Only processing closed/merged events" });
    }

    const item = payload.pull_request || payload.issue;
    const body = item.body || "";

    // Look for a wallet address and amount in the PR/Issue body
    // e.g., "Wallet: 0x123... Amount: $500"
    const walletMatch = body.match(/0x[a-fA-F0-9]{40}/);
    const amountMatch = body.match(/\$?(\d+(\.\d{1,2})?)/);

    if (!walletMatch || !amountMatch) {
      return NextResponse.json({ ok: true, message: "No bounty info found in body" });
    }

    const wallet = walletMatch[0];
    const amount = Number(amountMatch[1]);
    const title = `GitHub Bounty: ${item.title}`;
    const url = item.html_url;

    const invoice = await createInvoice({
      freelancer: getAddress(wallet),
      client: getAddress("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"), // dummy
      title: title,
      description: `Bounty payout for ${url}`,
      amountUsd: amount,
      webhookUrl: "github-bot",
      signature: "0xgithub_signature_placeholder",
    });

    const payUrl = `https://www.paymateagent.xyz/pay/${invoice.id}`;

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
