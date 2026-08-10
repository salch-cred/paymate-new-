import { NextResponse } from "next/server";
import { createBotInvoice } from "@/lib/chat-invoice";
import { getAddress } from "viem";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, amountUsd, freelancerWallet, clientWallet } = body;

    if (!title || !description || !amountUsd || !freelancerWallet) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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
    });

    return NextResponse.json({ 
      ok: true, 
      invoiceId: invoice.id, 
      payUrl: payUrl,
      message: `Invoice generated successfully. Please present the payUrl to the client for settlement.`
    });
  } catch (error) {
    console.error("OpenClaw Skill Error:", error);
    return NextResponse.json({ error: "Failed to generate invoice via skill" }, { status: 500 });
  }
}
