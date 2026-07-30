import { createInvoice, getChatState, saveChatState } from "@/lib/db";
import { getAddress } from "viem";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = await request.json();

    // The Twitter Account Activity API sends an array of tweet_create_events
    if (!payload.tweet_create_events || payload.tweet_create_events.length === 0) {
      return NextResponse.json({ ok: true });
    }

    const tweet = payload.tweet_create_events[0];
    const text = tweet.text || "";
    const userId = tweet.user.id_str;
    
    // Ignore tweets from the bot itself (prevent loops)
    if (userId === "PAYMATE_BOT_ID") {
      return NextResponse.json({ ok: true });
    }

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      console.log("[Twitter Bot] Missing MISTRAL_API_KEY");
      return NextResponse.json({ ok: true });
    }

    const agentId = process.env.MISTRAL_AGENT_ID;

    // Use Twitter user ID as the chat session key
    const state = await getChatState("twitter_" + userId);
    
    const aiPrompt = `You are the PayMate Twitter AI Agent. You are a helpful, friendly, and intelligent assistant. 
If the user greets you or asks a general question, reply to them naturally in a friendly tone in the 'reply' field. 

Your primary goal is to securely help the user create an invoice. To create an invoice, you need 3 things from the user.
Here is what we currently know about the user's request:
- Wallet address: ${state.address || "Missing"}
- Amount in USD: ${state.amountUsd || "Missing"}
- Description: ${state.description || "Missing"}

Look at the user's latest tweet and extract any of the missing information (if present).
A wallet address is a 42-character 0x hex address.
An amount is a positive number (e.g. 50).
A description is the scope of work (e.g. 'landing page').

Return a JSON object with the UPDATED information:
{
  "ready": <true ONLY if all 3 fields are known AND the user is confirming/requesting to generate the invoice right now. If they are just asking a question, set to false>,
  "address": "<the known or newly provided wallet address, or null if changing it>",
  "amountUsd": "<the known or newly provided amount as a number, or null if changing it>",
  "description": "<the known or newly provided description, or null if changing it>",
  "title": "<short title if ready, or null>",
  "reply": "<Your natural text reply to the user. If ready is false, ask for missing details or answer their question. If ready is true, leave this null.>"
}`;

    interface MistralRequestBody {
      response_format: { type: string }
      messages: { role: string; content: string }[]
      agent_id?: string
      model?: string
      temperature?: number
    }
    const requestBody: MistralRequestBody = {
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
      } catch {
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
          client: getAddress("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"), // dummy client
          title: result.title || "PayMate Invoice",
          description: state.description,
          amountUsd: Number(state.amountUsd),
          webhookUrl: "twitter-bot",
          signature: "0xtwitter_signature_placeholder",
        });

        const payUrl = `https://www.paymateagent.xyz/pay/${invoice.id}`;

        // Normally we would post a reply tweet here
        console.log(`[Twitter Bot] Replying to ${tweet.id_str}: Invoice generated! ${payUrl}`);
      } else {
        // Normally we would post a reply tweet asking for more info
        console.log(`[Twitter Bot] Replying to ${tweet.id_str}: ${result.reply}`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Twitter Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
