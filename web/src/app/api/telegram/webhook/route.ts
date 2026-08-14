import { timingSafeEqual } from "crypto";
import { runInvoiceConversation, tgMiniAppUrl } from "@/lib/chat-invoice";

const TELEGRAM_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();

// SECURITY (audit fix 2026-08-13): constant-time comparison, consistent with
// the pattern already used for every other secret in lib/auth.ts.
function secretsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// A lightweight webhook to handle incoming messages from Telegram
export async function POST(request: Request) {
  try {
    // SECURITY (audit fix H-1): verify Telegram's secret token so this
    // endpoint can't be spoofed by an arbitrary POST from the internet.
    // Set the same value as `secret_token` when calling setWebhook, and
    // configure TELEGRAM_WEBHOOK_SECRET here.
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expectedSecret) {
      console.error("[telegram/webhook] TELEGRAM_WEBHOOK_SECRET is not configured. Refusing request.");
      return new Response("Server misconfigured", { status: 500 });
    }
    const providedSecret = request.headers.get("x-telegram-bot-api-secret-token") || "";
    if (!secretsMatch(providedSecret, expectedSecret)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const update = await request.json();

    // Ignore updates that aren't messages
    if (!update.message || !update.message.text) {
      return new Response("OK");
    }

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();

    const sendMessage = (payload: Record<string, unknown>) =>
      fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

    await runInvoiceConversation({
      platform: "Telegram",
      chatKey: chatId.toString(),
      userText: text,
      extraInstruction: "If the user is asking a question about the current details, answer them naturally in the 'reply' field. Never ask the user to use a command or a specific format — they should always talk to you in plain natural language.",
      offlineReply: async () => {
        await sendMessage({ chat_id: chatId, text: "I can draft your invoice from plain words — just tell me your wallet address, the amount, and what the work is. For example: \"my wallet is 0x... and I want a $500 invoice for a landing page\"." });
      },
      onReply: async (replyText) => {
        await sendMessage({ chat_id: chatId, text: replyText });
      },
      onInvoiceCreated: async (invoice, payUrl) => {
        // Do not clear the state, so the AI can answer questions about the
        // generated invoice later.
        const miniAppUrl = tgMiniAppUrl(invoice.id);
        await sendMessage({
          chat_id: chatId,
          text: `✅ **Invoice Generated Successfully by AI!**\n\nFreelancer: \`${invoice.freelancer}\`\nTitle: ${invoice.title}\nScope: ${invoice.description}\nAmount: $${invoice.amountUsd} USDC\n\n**Client Payment Link:**\n${payUrl}\n\n*Log in to your PayMate dashboard with your wallet to track this payment in real-time!*`,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: "🧾 Open Mini App", web_app: { url: miniAppUrl } }]],
          },
        });
      },
    });

    return new Response("OK");
  } catch (error) {
    console.error("Telegram Webhook Error:", error);
    return new Response("Error", { status: 500 });
  }
}
