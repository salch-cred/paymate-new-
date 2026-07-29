import { createInvoice, getChatState, saveChatState } from "@/lib/db";
import { getAddress } from "viem";
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";

function isValidSlackSignature(rawBody: string, timestamp: string | null, signature: string | null, secret: string): boolean {
  if (!timestamp || !signature) return false;
  // Reject requests older than 5 minutes to prevent replay attacks
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 60 * 5) return false;
  const base = `v0:${timestamp}:${rawBody}`;
  const expected = "v0=" + createHmac("sha256", secret).update(base).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

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
    if (!isValidSlackSignature(rawBody, request.headers.get("x-slack-request-timestamp"), request.headers.get("x-slack-signature"), signingSecret)) {
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
    const rawText = event.text || "";
    const text = rawText.replace(/<@U[A-Z0-9]+>/g, "").trim();

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SLACK_BOT_TOKEN}` },
        body: JSON.stringify({ channel: channelId, text: "AI drafting is currently offline. Please configure MISTRAL_API_KEY." })
      });
      return NextResponse.json({ ok: true });
    }

    const agentId = process.env.MISTRAL_AGENT_ID;

    // Use channel ID as the chat session key
    const state = await getChatState("slack_" + channelId);
    
    const aiPrompt = `You are the PayMate Slack AI Agent. You are a helpful, friendly, and intelligent assistant. 
If the user greets you or asks a general question, reply to them naturally in a friendly tone in the 'reply' field. 

Your primary goal is to securely help the user create an invoice. To create an invoice, you need 3 things from the user.
Here is what we currently know about the user's request:
- Wallet address: ${state.address || "Missing"}
- Amount in USD: ${state.amountUsd || "Missing"}
- Description: ${state.description || "Missing"}

Look at the user's latest message and extract any of the missing information (if present).
A wallet address is a 42-character 0x hex address.
An amount is a positive number (e.g. 50).
A description is the scope of work (e.g. 'landing page').

If the user is asking a question about the current details, answer them naturally in the 'reply' field.

Return a JSON object with the UPDATED information:
{
  "ready": <true ONLY if all 3 fields are known AND the user is confirming/requesting to generate the invoice right now. If they are just asking a question, set to false>,
  "address": "<the known or newly provided wallet address, or null if changing it>",
  "amountUsd": "<the known or newly provided amount as a number, or null if changing it>",
  "description": "<the known or newly provided description, or null if changing it>",
  "title": "<short title if ready, or null>",
  "reply": "<Your natural text reply to the user. If ready is false, ask for missing details or answer their question. If ready is true, leave this null.>"
}`;

    const requestBody: any = {
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: aiPrompt },
        { role: "user", content: text }
      ]
    };

    let endpoint = "https://api.mistral.ai/v1/chat/completions";
    if (agentId) {
      requestBody.agent_id = agentId;
      endpoint = "https://api.mistral.ai/v1/agents/completions";
    } else {
      requestBody.model = "mistral-small-latest";
      requestBody.temperature = 0.1;
    }

    const aiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody)
    });

    const data = await aiResponse.json();
    const aiContent = data.choices?.[0]?.message?.content;
    
    if (aiContent) {
      let result;
      try {
        result = JSON.parse(aiContent);
      } catch(e) {
        result = JSON.parse(aiContent.replace(/```json/g, '').replace(/```/g, '').trim());
      }
      
      if (result.address !== undefined) state.address = result.address;
      if (result.amountUsd !== undefined) state.amountUsd = result.amountUsd;
      if (result.description !== undefined) state.description = result.description;
      state.updatedAt = Date.now();
      await saveChatState(state);
      
      if (result.ready === true && state.address && state.amountUsd && state.description) {
        const invoice = await createInvoice({
          freelancer: getAddress(state.address),
          client: getAddress("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"), // dummy client for now
          title: result.title || "PayMate Invoice",
          description: state.description,
          amountUsd: Number(state.amountUsd),
          webhookUrl: "slack-bot",
          signature: "0xslack_signature_placeholder",
        });

        const payUrl = `https://www.paymateagent.xyz/pay/${invoice.id}`;

        await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SLACK_BOT_TOKEN}` },
          body: JSON.stringify({
            channel: channelId,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `✅ *Invoice Generated Successfully!* \n\n*Freelancer:* \`${state.address}\`\n*Title:* ${invoice.title}\n*Scope:* ${invoice.description}\n*Amount:* $${invoice.amountUsd} USDC`
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
                    url: "https://www.paymateagent.xyz/dashboard"
                  }
                ]
              }
            ]
          })
        });
      } else {
        await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SLACK_BOT_TOKEN}` },
          body: JSON.stringify({
            channel: channelId,
            text: result.reply || "I need your wallet address, the amount, and a description to create the invoice."
          })
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Slack Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
