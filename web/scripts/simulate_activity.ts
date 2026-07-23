

import { createWalletClient, http, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const API_BASE = process.env.API_BASE || "http://localhost:3000";

// Mock addresses and keys for testing EIP-712
const FREELANCER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const CLIENT_PRIVATE_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
const clientAccount = privateKeyToAccount(CLIENT_PRIVATE_KEY);
const CLIENT = clientAccount.address;

const DOMAIN = {
  name: "PayMate",
  version: "1",
  chainId: 48816,
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
  console.log("Starting Live Network Simulation with EIP-712 Proofs...");

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
      title: "Simulated Automated Task",
      description: "AI-generated task for network activity simulation",
      amountUsd,
      dueDate: new Date().toISOString(),
      signature,
    }),
  });

  if (!createRes.ok) {
    console.error("Failed to create invoice", await createRes.text());
    return;
  }

  const { invoice } = await createRes.json() as any;
  console.log(`Invoice created! ID: ${invoice.id}`);

  // 2. Trigger AI Agent to auto-pay
  console.log(`2. Triggering AI Agent to settle invoice ${invoice.id}...`);
  const payRes = await fetch(`${API_BASE}/api/agent/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoiceId: invoice.id }),
  });

  if (!payRes.ok) {
    console.error("Agent failed to pay", await payRes.text());
    return;
  }

  const payData = await payRes.json() as any;
  console.log(`Success! AI Agent settled invoice. TxHash: ${payData.agentTxHash}`);
}

simulate().catch(console.error);
