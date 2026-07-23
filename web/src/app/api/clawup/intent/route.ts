import { createInvoice } from "@/lib/db";
import { autonomousAgentPay } from "@/lib/agent";
import { getAddress, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

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

// Adapter for ClawUp Platform Intents
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.intent) {
      return Response.json({ detail: "Must provide a ClawUp intent" }, { status: 400 });
    }

    // ClawUp Intent handling
    if (body.intent === "create_and_pay_invoice") {
      const { freelancer, client, amountUsd } = body.payload;
      
      if (!isAddress(freelancer) || !isAddress(client)) {
         return Response.json({ detail: "Invalid addresses" }, { status: 400 });
      }

      // Generate a real EIP-712 signature for the demo
      // In production, the ClawUp agent passes this in the payload after client signs
      const dummyKey = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
      const dummyClient = privateKeyToAccount(dummyKey);

      const signature = await dummyClient.signTypedData({
        domain: DOMAIN,
        types: INVOICE_TYPES,
        primaryType: "Invoice",
        message: {
          freelancer: getAddress(freelancer),
          client: dummyClient.address,
          amountUsd: BigInt(Math.round(Number(amountUsd))),
        }
      });

      // 1. Create Invoice with ClawUp flag for the referral multiplier
      const invoice = await createInvoice({
        freelancer: getAddress(freelancer),
        client: dummyClient.address, // Enforce client is the signer
        title: "ClawUp Automated Gig",
        description: "Task autonomously assigned and executed by ClawUp Network",
        amountUsd: Number(amountUsd),
        webhookUrl: "clawup-referral-1.2x", 
        signature
      });

      // 2. Trigger auto-pay
      const txHash = await autonomousAgentPay(invoice);

      return Response.json({
        ok: true,
        message: "ClawUp intent executed",
        invoiceId: invoice.id,
        agentTxHash: txHash
      });
    }

    return Response.json({ detail: "Unsupported intent" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ detail: message }, { status: 500 });
  }
}
