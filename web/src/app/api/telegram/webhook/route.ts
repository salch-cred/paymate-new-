import { createInvoice } from "@/lib/db";
import { getAddress } from "viem";

const TELEGRAM_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();


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

    // Conversational AI Invoice Agent
    const addressMatch = text.match(/(0x[a-fA-F0-9]{40})/);
    const freelancerAddress = addressMatch ? addressMatch[1] : null;

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "AI drafting is currently offline. Use exact format: `/invoice 0xYourWalletAddress $500 for landing page`" })
      });
      return new Response("OK");
    }

    const aiResponse = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "mistral-small-latest",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are the PayMate Telegram AI Agent. You are a helpful, friendly, and intelligent assistant. If the user greets you or asks a general question, reply to them naturally in a friendly tone in the 'reply' field. Your primary goal is to securely help the user create an invoice. To create an invoice, you need 3 things from the user: 1) Wallet address (MUST be exactly a 42-character 0x hex address for security), 2) Amount in USD (must be a positive number), 3) Description of the work. Return ONLY a JSON object. If the user provided an address which is already parsed as '" + (freelancerAddress || "missing") + "' and also provided the amount and description, return {\"ready\": true, \"amountUsd\": number, \"description\": \"clear scope\", \"title\": \"short title\"}. If they want to create an invoice but info is missing, return {\"ready\": false, \"reply\": \"Friendly message asking the user to provide ALL missing details in ONE SINGLE MESSAGE (e.g. 'Please reply with your 42-character 0x wallet address, the amount, and description all in one message'). NEVER ask them to provide just one thing at a time, because you do not have conversational memory.\"} If they are just chatting, return {\"ready\": false, \"reply\": \"Your conversational response here.\"}"
          },
          { role: "user", content: text }
        ]
      })
    });

    const data = await aiResponse.json();
    console.log("Mistral response:", data);
    const aiContent = data.choices?.[0]?.message?.content;
    
    if (aiContent) {
      let result;
      try {
        result = JSON.parse(aiContent);
      } catch(e) {
        // Strip markdown backticks if Mistral included them
        result = JSON.parse(aiContent.replace(/```json/g, '').replace(/```/g, '').trim());
      }
      
      console.log("Parsed AI result:", result);
      
      if (result.ready && freelancerAddress && result.amountUsd && result.description) {
        // We have everything, generate the invoice!
        const invoice = await createInvoice({
          freelancer: getAddress(freelancerAddress),
          client: getAddress("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"), // dummy client
          title: result.title || "PayMate Invoice",
          description: result.description,
          amountUsd: Number(result.amountUsd),
          webhookUrl: "telegram-bot",
          signature: "0xtelegram_signature_placeholder",
        });

        const payUrl = `https://paymates.vercel.app/pay/${invoice.id}`;

        const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ **Invoice Generated Successfully by AI!**\n\nFreelancer: \`${freelancerAddress}\`\nTitle: ${result.title}\nScope: ${result.description}\nAmount: $${result.amountUsd} USDC\n\n**Client Payment Link:**\n${payUrl}\n\n*Log in to your PayMate dashboard with your wallet to track this payment in real-time!*`,
            parse_mode: "Markdown"
          })
        });
        console.log("TG Send status:", tgRes.status);
      } else {
        // Need more info
        const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: result.reply || "I need your wallet address, the amount, and a description to create the invoice."
          })
        });
        console.log("TG Send status:", tgRes.status);
      }
    }

    return new Response("OK");
  } catch (error) {
    console.error("Telegram Webhook Error:", error);
    return new Response("Error", { status: 500 });
  }
}
