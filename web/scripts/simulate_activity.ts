

import { getAddress } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const API_BASE = process.env.API_BASE || "http://localhost:3000";

// SECURITY (audit fix C-2): a real private key used to be hardcoded here and
// committed to the public repo, and the same value was copy-pasted into a
// live production API route. Local/demo scripts must never contain a fixed
// private key. Provide SIMULATE_CLIENT_PRIVATE_KEY via your local .env
// (never commit it) or a fresh throwaway key is generated per run.
// Fail closed: never fall back to a well-known test wallet. You must name the
// real freelancer wallet that should receive the settlement.
const FREELANCER_ENV = process.env.SIMULATE_FREELANCER_ADDRESS
if (!FREELANCER_ENV) {
  console.error("Set SIMULATE_FREELANCER_ADDRESS (the real receiving wallet) to run this script.")
  process.exit(1)
}
const FREELANCER: string = FREELANCER_ENV
const CLIENT_PRIVATE_KEY = (process.env.SIMULATE_CLIENT_PRIVATE_KEY as `0x${string}`) || generatePrivateKey();
const clientAccount = privateKeyToAccount(CLIENT_PRIVATE_KEY);
const CLIENT = clientAccount.address;

const DOMAIN = {
  name: "PayMate",
  version: "1",
  chainId: 2345,
  verifyingContract: "0x0000000000000000000000000000000000000000" as `0x${string}`,
};

const INVOICE_TYPES = {
  Invoice: [
    { name: "freelancer", type: "address" },
    { name: "client", type: "address" },
    { name: "amountUsd", type: "uint256" },
  ],
};

async function simulate() {
  console.log("Starting a real EIP-712-signed settlement on GOAT mainnet...");

  const amountUsd = 15.0;

  console.log("1. Signing EIP-712 Proof...");
  const signature = await clientAccount.signTypedData({
    domain: DOMAIN,
    types: INVOICE_TYPES,
    primaryType: "Invoice",
    message: {
      freelancer: getAddress(FREELANCER),
      client: getAddress(CLIENT),
      amountUsd: BigInt(Math.round(amountUsd)),
    }
  });

  // 1. Create an invoice
  console.log("2. Creating invoice...");
  const createRes = await fetch(`${API_BASE}/api/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      freelancer: FREELANCER,
      client: CLIENT,
      title: "Automated Agent Task",
      description: "Autonomous AI-agent work item settled through the PayMate billing rail",
      amountUsd,
      dueDate: new Date().toISOString(),
      signature,
    }),
  });

  if (!createRes.ok) {
    console.error("Failed to create invoice", await createRes.text());
    return;
  }

  const { invoice } = await createRes.json() as { invoice: { id: string } };
  console.log(`Invoice created! ID: ${invoice.id}`);

  // 2. Trigger AI Agent to auto-pay
  // NOTE (2026-07-30): /api/agent/pay now requires AGENT_PAY_ADMIN_SECRET
  // (it was previously unauthenticated - see the audit fix in that route).
  if (!process.env.AGENT_PAY_ADMIN_SECRET) {
    console.error("Set AGENT_PAY_ADMIN_SECRET in your env to run this demo script.");
    return;
  }
  console.log(`2. Triggering AI Agent to settle invoice ${invoice.id}...`);
  const payRes = await fetch(`${API_BASE}/api/agent/pay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.AGENT_PAY_ADMIN_SECRET}`,
    },
    body: JSON.stringify({ invoiceId: invoice.id }),
  });

  if (!payRes.ok) {
    console.error("Agent failed to pay", await payRes.text());
    return;
  }

  const payData = await payRes.json() as { agentTxHash: string };
  console.log(`Success! AI Agent settled invoice. TxHash: ${payData.agentTxHash}`);
}

simulate().catch(console.error);
