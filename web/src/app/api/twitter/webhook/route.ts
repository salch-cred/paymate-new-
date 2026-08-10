import { NextResponse } from "next/server";
import { runInvoiceConversation } from "@/lib/chat-invoice";

const BOT_USER_ID = process.env.PAYMATE_BOT_ID || "PAYMATE_BOT_ID";

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
    if (userId === BOT_USER_ID) {
      return NextResponse.json({ ok: true });
    }

    await runInvoiceConversation({
      platform: "Twitter",
      chatKey: "twitter_" + userId,
      userText: text,
      offlineReply: async () => {
        console.log("[Twitter Bot] Missing MISTRAL_API_KEY");
      },
      onReply: async (replyText) => {
        // Normally we would post a reply tweet here
        console.log(`[Twitter Bot] Replying to ${tweet.id_str}: ${replyText}`);
      },
      onInvoiceCreated: async (_invoice, payUrl) => {
        // Normally we would post a reply tweet here
        console.log(`[Twitter Bot] Replying to ${tweet.id_str}: Invoice generated! ${payUrl}`);
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Twitter Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
