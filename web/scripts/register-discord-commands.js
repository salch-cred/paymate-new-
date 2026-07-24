import { REST, Routes } from 'discord.js';

const APP_ID = process.env.DISCORD_CLIENT_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

async function main() {
  const commands = [
    {
      name: "paymate",
      description: "Create verified invoices settling instantly on the GOAT Network.",
      type: 1,
      default_member_permissions: "8" // Administrator only
    },
    {
      name: "invoice",
      description: "Draft a new PayMate invoice from text details.",
      type: 1,
      default_member_permissions: "8", // Administrator only
      options: [
        {
          name: "details",
          description: "Describe the invoice (e.g. '500 USDC for marketing bounty')",
          type: 3, // STRING type
          required: true
        }
      ]
    }
  ];

  const response = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/commands`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bot ${BOT_TOKEN}`
    },
    body: JSON.stringify(commands)
  });

  if (response.ok) {
    const data = await response.json();
    console.log("Successfully registered commands:", data);
  } else {
    console.error("Error registering commands:", await response.text());
  }
}

main();
