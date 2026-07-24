import { createInvoice } from "@/lib/db";
import { getAddress } from "viem";

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// A lightweight webhook to handle incoming messages from Telegram
export async function POST(request: Request) {
  try {
    const update = await request.json();
    
    // Ignore updates that aren't messages
    if (!update.message || !update.message.text) {
      return new Response("OK");
    }

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();

    // Command: /invoice 0xWalletAddress $amount for [description]
    // Example: /invoice 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 $500 for landing page design
    if (text.startsWith("/invoice")) {
      const match = text.match(/^\/invoice\s+(0x[a-fA-F0-9]{40})\s+(?:\$|USDC\s*)?([\d,]+(?:\.\d{1,2})?)\s+(?:for\s+)?(.*)/i);
      
      if (match) {
        const freelancerAddress = getAddress(match[1]);
        const amountUsd = parseFloat(match[2].replace(/,/g, ""));
        const description = match[3].trim();

        const invoice = await createInvoice({
          freelancer: freelancerAddress,
          client: getAddress("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"), // dummy client for demo
          title: "Telegram Quick-Invoice",
          description: description,
          amountUsd: amountUsd,
          webhookUrl: "telegram-bot",
          signature: "0xtelegram_signature_placeholder",
        });

        const payUrl = `https://paymates.vercel.app/pay/${invoice.id}`;

        // Send the response back to the Telegram chat
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ **Invoice Generated!**\n\nFreelancer: \`${freelancerAddress}\`\nAmount: $${amountUsd} USDC\nScope: ${description}\n\nLink to Pay:\n${payUrl}\n\n*This invoice will now appear in your PayMate dashboard when you connect your wallet!*`,
            parse_mode: "Markdown"
          })
        });

        return new Response("OK");
      } else {
        // Send error back
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "❌ Invalid format. Use: `/invoice 0xYourWalletAddress $500 for landing page`",
            parse_mode: "Markdown"
          })
        });
      }
    }

    return new Response("OK");
  } catch (error) {
    console.error("Telegram Webhook Error:", error);
    return new Response("Error", { status: 500 });
  }
}
