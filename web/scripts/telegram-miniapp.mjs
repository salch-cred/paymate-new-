#!/usr/bin/env node
/**
 * Wires the PayMate Telegram bot to the Mini App.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=123:abc MINI_APP_URL=https://paymateagent.xyz/tg node scripts/telegram-miniapp.mjs
 *
 * One-time setup (do this before running):
 *   1. Create the bot with @BotFather and grab the token.
 *   2. Register the Mini App in BotFather (/newapp) pointing at MINI_APP_URL.
 *   3. Run this script to set the menu button + commands.
 */

const TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim()
const MINI_APP_URL = (process.env.MINI_APP_URL || "https://paymateagent.xyz/tg").trim()
const API = (method, payload = {}) =>
  fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((r) => r.json())

if (!TOKEN) {
  console.error("Set TELEGRAM_BOT_TOKEN first (e.g. 123456:ABC-DEF…).")
  process.exit(1)
}

const results = {}

// Menu button in chats → opens the Mini App.
results.setChatMenuButton = await API("setChatMenuButton", {
  menu_button: { type: "web_app", text: "PayMate", web_app: { url: MINI_APP_URL } },
})

// Commands shown in the bot's menu.
results.setMyCommands = await API("setMyCommands", {
  commands: [
    { command: "pay", description: "Pay an invoice via the Mini App (GOAT Network)" },
    { command: "invoice", description: "Draft an invoice from plain words" },
    { command: "help", description: "What PayMate can do" },
  ],
})

for (const [name, res] of Object.entries(results)) {
  console.log(`${name}: ${res.ok ? "OK ✅" : `FAILED ❌ ${JSON.stringify(res)}`}`)
}

console.log("\nNext steps:")
console.log(`  1. Open your bot in Telegram → tap the "PayMate" menu button → it should open ${MINI_APP_URL}`)
console.log("  2. Send an invoice payment link to the bot and pay it on GOAT Network from the Mini App")
