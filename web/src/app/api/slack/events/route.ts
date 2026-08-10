import { NextResponse } from "next/server";
import { verifyHmacSignature } from "@/lib/auth";
import { runInvoiceConversation } from "@/lib/chat-invoice";

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";

export async function POST(request: Request) {
  try {
    // SECURITY (audit fix H-3): verify Slack's request signature so this
    // endpoint can't be spoofed to create fake invoices.
    const signingSecret = process.env.SLACK_SIGNING_SECRET;
    const rawBody = await request.text();
    if (!signingSecret) {
      console.error("[slack/events] SLACK_SIGNING_SECRET is not configured. Refusing request.");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }
    const timestamp = request.headers.get("x-slack-request-timestamp");
    const isVerified = verifyHmacSignature({
      rawBody,
      secret: signingSecret,
      signature: request.headers.get("x-slack-signature"),
      sigPrefix: "v0=",
      base: `v0:${timestamp}:${rawBody}`,
      timestamp,
      maxAgeSec: 60 * 5,
    });
    if (!isVerified) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    const body = JSON.parse(rawBody);

    // 1. Handle Slack URL Verification Challenge
    if (body.type === "url_verification") {
      return NextResponse.json({ challenge: body.challenge });
    }

    // 2. Ignore anything that isn't an event callback for a message
    if (body.type !== "event_callback" || !body.event) {
      return NextResponse.json({ ok: true });
    }

    const event = body.event;

    // Ignore bot messages to prevent infinite loops
    if (event.bot_id) {
      return NextResponse.json({ ok: true });
    }

    // Only process app_mentions or direct messages
    if (event.type !== "app_mention" && event.type !== "message") {
      return NextResponse.json({ ok: true });
    }

    const channelId = event.channel;
    // Strip out the bot mention (e.g., "<@U123456> ") from the text
    const text = (event.text || "").replace(/<@U[A-Z0-9]+>/g, "").trim();

    const postMessage = (payload: Record<string, unknown>) =>
      fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SLACK_BOT_TOKEN}` },
        body: JSON.stringify(payload),
      });

    await runInvoiceConversation({
      platform: "Slack",
      chatKey: "slack_" + channelId,
      userText: text,
      extraInstruction: "If the user is asking a question about the current details, answer them naturally in the 'reply' field.",
      offlineReply: async () => {
        await postMessage({ channel: channelId, text: "AI drafting is currently offline. Please configure MISTRAL_API_KEY." });
      },
      onReply: async (replyText) => {
        await postMessage({ channel: channelId, text: replyText });
      },
      onInvoiceCreated: async (invoice, payUrl) => {
        await postMessage({
          channel: channelId,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `✅ *Invoice Generated Successfully!* \n\n*Freelancer:* \`${invoice.freelancer}\`\n*Title:* ${invoice.title}\n*Scope:* ${invoice.description}\n*Amount:* $${invoice.amountUsd} USDC`
              }
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Pay on GOAT Network" },
                  style: "primary",
                  url: payUrl
                },
                {
                  type: "button",
                  text: { type: "plain_text", text: "View Dashboard" },
                  url: "https://paymateagent.xyz/dashboard"
                }
              ]
            }
          ]
        });
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Slack Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
