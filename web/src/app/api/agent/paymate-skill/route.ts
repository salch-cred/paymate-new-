import { NextResponse } from "next/server";
import { createBotInvoice, tgMiniAppUrl } from "@/lib/chat-invoice";
import { getAddress } from "viem";
import { authenticateApiKey, assertApiQuota } from "@/lib/apikey";

export async function POST(request: Request) {
  // SECURITY (2026-08-11): this endpoint used to be fully open — any agent on
  // the internet could mint unlimited invoices. Now it requires a public API
  // key (mint one at /developers) and each invoice consumes the key's quota.
  const key = await authenticateApiKey(request)
  if (key instanceof NextResponse || key instanceof Response) return key

  try {
    const body = await request.json();
    const { title, description, amountUsd, freelancerWallet, clientWallet } = body;

    if (!title || !description || !amountUsd || !freelancerWallet) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!Number.isFinite(Number(amountUsd)) || Number(amountUsd) <= 0) {
      return NextResponse.json({ error: "amountUsd must be a positive number" }, { status: 422 });
    }

    // Reserve quota BEFORE creating the invoice so a key can't exceed its
    // monthly limit (fail closed).
    try {
      await assertApiQuota(key.id, Number(amountUsd))
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Quota exceeded" }, { status: 429 });
    }

    // Default client wallet to the zero address if not provided
    const clientAddress = clientWallet ? getAddress(clientWallet) : getAddress("0x0000000000000000000000000000000000000000");

    const { invoice, payUrl } = await createBotInvoice({
      source: "openclaw-agent",
      freelancer: freelancerWallet,
      client: clientAddress,
      title,
      description,
      amountUsd: Number(amountUsd),
      apiKeyId: key.id,
    });

    return NextResponse.json({ 
      ok: true, 
      invoiceId: invoice.id, 
      payUrl: payUrl,
      // Telegram Mini App checkout — present this when the client is on
      // Telegram: it opens the PayMate Mini App with the on-chain GOAT payment.
      tgMiniAppUrl: tgMiniAppUrl(invoice.id),
      message: `Invoice generated successfully. Present the payUrl to the client for settlement — if the client is on Telegram, send them the tgMiniAppUrl instead so they can pay on-chain USDC on GOAT Network inside the Mini App.`,
      apiKey: { name: key.name, quotaUsd: key.quotaUsd }
    });
  } catch (error) {
    console.error("OpenClaw Skill Error:", error);
    return NextResponse.json({ error: "Failed to generate invoice via skill" }, { status: 500 });
  }
}
