import { createInvoice, getChatState, saveChatState, clearChatState } from "@/lib/db";
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

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "AI drafting is currently offline. Use exact format: `/invoice 0xYourWalletAddress $500 for landing page`" })
      });
      return new Response("OK");
    }

    const agentId = process.env.MISTRAL_AGENT_ID;

    const state = await getChatState(chatId.toString());
    const aiPrompt = `You are the PayMate Telegram AI Agent. You are a helpful, friendly, and intelligent assistant. 
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

If the user is asking a question about the current details (e.g. "what wallet address did I use?"), answer them naturally in the 'reply' field.

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
      
      // Update state if AI returned explicit values, otherwise keep existing state
      if (result.address !== undefined) state.address = result.address;
      if (result.amountUsd !== undefined) state.amountUsd = result.amountUsd;
      if (result.description !== undefined) state.description = result.description;
      state.updatedAt = Date.now();
      await saveChatState(state);
      
      if (result.ready === true && state.address && state.amountUsd && state.description) {
        // We have everything and AI confirms readiness, generate the invoice!
        const invoice = await createInvoice({
          freelancer: getAddress(state.address),
          client: getAddress("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"), // dummy client
          title: result.title || "PayMate Invoice",
          description: state.description,
          amountUsd: Number(state.amountUsd),
          webhookUrl: "telegram-bot",
          signature: "0xtelegram_signature_placeholder",
        });

        // Do not clear the state, so the AI can answer questions about the generated invoice later.
        // Instead, we just let the AI rely on the user's next message to decide what to do.

        const payUrl = `https://www.paymateagent.xyz/pay/${invoice.id}`;

        const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `✅ **Invoice Generated Successfully by AI!**\n\nFreelancer: \`${state.address}\`\nTitle: ${invoice.title}\nScope: ${invoice.description}\nAmount: $${invoice.amountUsd} USDC\n\n**Client Payment Link:**\n${payUrl}\n\n*Log in to your PayMate dashboard with your wallet to track this payment in real-time!*`,
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
