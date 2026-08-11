import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { runInvoiceConversation } from "@/lib/chat-invoice";
import { TwitterApi } from "twitter-api-v2";

const BOT_USER_ID = process.env.PAYMATE_BOT_ID || "PAYMATE_BOT_ID";

/**
 * Verifies the Twitter Account Activity API webhook signature
 * (`x-twitter-webhooks-signature` = base64(HMAC-SHA256(consumerSecret, body))).
 * Fails closed: unconfigured secret or mismatched signature → reject.
 */
function verifyTwitterSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.TWITTER_CONSUMER_SECRET;
  if (!secret || !signature) return false
  try {
    const expected = createHmac("sha256", secret).update(rawBody).digest("base64")
    const a = Buffer.from(expected)
    const b = Buffer.from(signature)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/** Post a reply tweet from the @PayMate bot via OAuth 1.0a user context. */
async function replyToTweet(tweetId: string, text: string): Promise<boolean> {
  const apiKey = process.env.TWITTER_API_KEY
  const apiSecret = process.env.TWITTER_API_SECRET
  const accessToken = process.env.TWITTER_ACCESS_TOKEN
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET
  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    console.log("[Twitter Bot] Twitter reply credentials not configured (TWITTER_API_KEY/SECRET/ACCESS_TOKEN/ACCESS_TOKEN_SECRET) — reply not posted.")
    return false
  }
  try {
    const client = new TwitterApi({ appKey: apiKey, appSecret: apiSecret, accessToken, accessSecret })
    await client.v2.reply(text, tweetId)
    console.log(`[Twitter Bot] Replied to ${tweetId}`)
    return true
  } catch (error) {
    console.error("[Twitter Bot] Failed to post reply tweet:", error)
    return false
  }
}

/** Twitter Account Activity API webhook URL validation (GET crc_token challenge). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const crcToken = searchParams.get("crc_token")
  const secret = process.env.TWITTER_CONSUMER_SECRET
  if (!crcToken || !secret) {
    return NextResponse.json({ error: "Missing crc_token or TWITTER_CONSUMER_SECRET" }, { status: 400 })
  }
  // Echo sha256=base64(HMAC-SHA256(consumerSecret, crc_token)) — Twitter's
  // required response_token format for webhook registration.
  const responseToken = createHmac("sha256", secret).update(crcToken).digest("base64")
  return NextResponse.json({ response_token: `sha256=${responseToken}` })
}

export async function POST(request: Request) {
  try {
    // SECURITY: the webhook mints invoices on behalf of the tweeting wallet, so
    // a spoofed POST could spam invoice creation. Verify the Twitter HMAC.
    const rawBody = await request.text()
    if (!verifyTwitterSignature(rawBody, request.headers.get("x-twitter-webhooks-signature"))) {
      console.error("[twitter/webhook] Invalid or missing signature — TWITTER_CONSUMER_SECRET must match the webhook config.")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }
    const payload = JSON.parse(rawBody);

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
        await replyToTweet(tweet.id_str, replyText);
      },
      onInvoiceCreated: async (_invoice, payUrl) => {
        await replyToTweet(tweet.id_str, `Your PayMate invoice is ready: ${payUrl}`);
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Twitter Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
