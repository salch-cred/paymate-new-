/**
 * Seeds the marketplace with realistic plugins so the store is never empty
 * for demos / judges. Generates a THROWAWAY signing key per run (never a
 * fixed/committed key), derives the publisher wallet from it, signs the
 * `PayMate marketplace publish by <addr> at <ts>` ownership proof (the same
 * EIP-191 personal_sign the Publish page produces), and POSTs each plugin to
 * /api/marketplace/plugins.
 *
 * Usage:
 *   API_BASE=https://www.paymateagent.xyz npx tsx scripts/seed_marketplace.ts
 */
import { getAddress } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const API_BASE = process.env.API_BASE || "http://localhost:3000";

// A fresh throwaway key each run → the seed publisher wallet is derived from it.
const account = privateKeyToAccount(generatePrivateKey());
// The publish route builds the expected message from the LOWERCASED
// authorAddress — the signed message must match exactly.
const AUTHOR = account.address.toLowerCase();

type SeedPlugin = {
  name: string;
  displayName: string;
  description: string;
  longDescription: string;
  category: string;
  price: number;
  authorName: string;
  tags: string[];
  ipfsHash: string;
  githubUrl?: string;
  docsUrl?: string;
};

const PLUGINS: SeedPlugin[] = [
  {
    name: "cargo-trace",
    displayName: "Cargo Trace",
    description: "Live shipment tracking and delivery-ETA agent for logistics workflows.",
    longDescription:
      "Cargo Trace gives an AI agent real-time shipment status, carrier handoffs, and predictive delivery windows from major freight APIs. Agents can query a tracking number in plain language and get a structured status — perfect for logistics desks and supply-chain automation.",
    category: "logistics",
    price: 0.01,
    authorName: "PayMate Seed",
    tags: ["shipping", "tracking", "supply-chain"],
    ipfsHash: "QmCargoTraceSeed001",
    githubUrl: "https://github.com/paymate-seed/cargo-trace",
    docsUrl: "https://paymateagent.xyz/docs#cross-chain",
  },
  {
    name: "invoice-sweeper",
    displayName: "Invoice Sweeper",
    description: "Scans inboxes and turns payment emails into payable PayMate invoices.",
    longDescription:
      "Invoice Sweeper watches a mailbox, extracts amounts + wallet addresses from payment notifications, and drafts a PayMate invoice in one step. Combined with the x402 rail, an agent can reconcile and settle receivables autonomously.",
    category: "finance",
    price: 0.02,
    authorName: "PayMate Seed",
    tags: ["invoicing", "payments", "automation"],
    ipfsHash: "QmInvoiceSweeperSeed001",
    githubUrl: "https://github.com/paymate-seed/invoice-sweeper",
    docsUrl: "https://paymateagent.xyz/docs#x402",
  },
  {
    name: "market-feeds",
    displayName: "Market Feeds",
    description: "Live token-price and FX data agent with on-chain price sanity checks.",
    longDescription:
      "Market Feeds returns current USD prices for major tokens and fiat pairs, cross-checked against on-chain sources. Agents use it to quote invoices, compute cross-chain settlement values, or power treasury dashboards.",
    category: "data",
    price: 0.005,
    authorName: "PayMate Seed",
    tags: ["prices", "fx", "oracle"],
    ipfsHash: "QmMarketFeedsSeed001",
    githubUrl: "https://github.com/paymate-seed/market-feeds",
    docsUrl: "https://paymateagent.xyz/docs#cross-chain",
  },
  {
    name: "notify-everywhere",
    displayName: "Notify Everywhere",
    description: "Multi-channel notifications for agents — Telegram, Discord, email, Push.",
    longDescription:
      "Notify Everywhere lets an agent fan out alerts to Telegram, Discord, email, and Push Protocol from one call. Great for settlement confirmations, dispute escalations, and milestone updates.",
    category: "communication",
    price: 0.01,
    authorName: "PayMate Seed",
    tags: ["notifications", "telegram", "discord"],
    ipfsHash: "QmNotifyEverywhereSeed001",
    githubUrl: "https://github.com/paymate-seed/notify-everywhere",
    docsUrl: "https://paymateagent.xyz/docs",
  },
  {
    name: "sentiment-scan",
    displayName: "Sentiment Scan",
    description: "Real-time market sentiment analysis for social and news sources.",
    longDescription:
      "Sentiment Scan aggregates and scores sentiment across social platforms and news feeds, returning a structured bull/bear reading agents can act on. Built for traders, growth teams, and research agents.",
    category: "analytics",
    price: 0.03,
    authorName: "PayMate Seed",
    tags: ["sentiment", "analysis", "research"],
    ipfsHash: "QmSentimentScanSeed001",
    githubUrl: "https://github.com/paymate-seed/sentiment-scan",
    docsUrl: "https://paymateagent.xyz/docs",
  },
];

async function publish(p: SeedPlugin) {
  const ts = Date.now();
  const message = `PayMate marketplace publish by ${AUTHOR.toLowerCase()} at ${ts}`;
  const signature = await account.signMessage({ message });

  const res = await fetch(`${API_BASE}/api/marketplace/plugins`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: p.name,
      displayName: p.displayName,
      description: p.description,
      longDescription: p.longDescription,
      category: p.category,
      price: p.price,
      authorAddress: AUTHOR,
      authorName: p.authorName,
      tags: p.tags,
      ipfsHash: p.ipfsHash,
      githubUrl: p.githubUrl,
      docsUrl: p.docsUrl,
      authorProof: { message, signature, ts },
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (res.status === 201) {
    console.log(`✅ ${p.displayName} (${p.category}) → id ${body.plugin?.id}`);
  } else {
    console.log(`❌ ${p.displayName} → HTTP ${res.status}: ${body.error || JSON.stringify(body).slice(0, 200)}`);
  }
  return res.status;
}

async function main() {
  console.log(`Seed wallet: ${getAddress(AUTHOR)}`);
  console.log(`Target: ${API_BASE}/api/marketplace/plugins`);
  let ok = 0;
  for (const p of PLUGINS) {
    if ((await publish(p)) === 201) ok++;
    await new Promise((r) => setTimeout(r, 300)); // stay well under the 100/hr cap
  }
  console.log(`\nPublished ${ok}/${PLUGINS.length} plugins.`);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
