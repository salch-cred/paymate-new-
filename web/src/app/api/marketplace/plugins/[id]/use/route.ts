import { NextRequest, NextResponse } from "next/server";
import { isAddress, getAddress } from "viem";
import { initStore } from "@/lib/marketplace/serverStore";
import { getPluginById, incrementPluginUsage } from "@/lib/marketplace/store";
import { verifyPluginPayment, PaymentError, usdcAmount } from "@/lib/chain";
import {
  extractTxHash,
  PAYMENT_REQUIRED_HEADER,
  PAYMENT_RESPONSE_HEADER,
} from "@/lib/paywall";
import { reservePluginUsage, incrementPluginUsageInDb } from "@/lib/db";

/**
 * Pay-to-use for marketplace plugins (x402), mirroring the invoice paywall:
 *
 *   POST /api/marketplace/plugins/[id]/use
 *     → HTTP 402 + PAYMENT-REQUIRED header + x402 `accepts[]` body, telling the
 *       agent to pay `plugin.price` USDC on GOAT Network directly to the
 *       developer's wallet (non-custodial).
 *
 *   POST ... with PAYMENT-SIGNATURE: base64({"txHash":"0x..."})
 *     → verifies the transfer on-chain, counts the use (replay-guarded by the
 *       plugin_usage_log ledger), and returns the unlocked plugin details
 *       (deliverable + repo/docs links).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initStore();
    const { id } = await params;
    const plugin = getPluginById(id);
    if (!plugin) {
      return NextResponse.json({ error: "Plugin not found" }, { status: 404 });
    }
    if (!plugin.active) {
      return NextResponse.json({ error: "Plugin is not active" }, { status: 403 });
    }

    // --- Paid retry: verify the transfer on-chain, then count the use. ---
    const txHash = extractTxHash(request);
    if (txHash) {
      // Replay guard FIRST: the same tx hash can never unlock a use twice,
      // even if a concurrent/duplicate request races past verification.
      const reserved = await reservePluginUsage(txHash, plugin.id);
      if (!reserved) {
        return NextResponse.json(
          { error: "This transaction has already been used to unlock this plugin." },
          { status: 402 }
        );
      }
      // Real on-chain verification — same security bar as invoice settlement.
      await verifyPluginPayment(txHash, plugin.author, plugin.price);

      // Count the use (in-memory mirror + Postgres).
      const updated = incrementPluginUsage(plugin.id);
      try {
        await incrementPluginUsageInDb(plugin.id);
      } catch (e) {
        console.error(`[marketplace] Failed to persist usage count:`, e);
      }

      return NextResponse.json(
        {
          ok: true,
          pluginId: plugin.id,
          plugin: updated ?? plugin,
          txHash,
          explorerUrl: `https://explorer.goat.network/tx/${txHash}`,
          message: "Payment verified on-chain. Plugin unlocked.",
        },
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            // x402: server confirms settlement in the response headers.
            [PAYMENT_RESPONSE_HEADER]: Buffer.from(
              JSON.stringify({ ok: true, network: "goat", txHash })
            ).toString("base64"),
          },
        }
      );
    }

    // --- Challenge path: 402 + PAYMENT-REQUIRED. Nothing is unlocked. ---
    const usdcToken = process.env.USDC_TOKEN;
    if (!usdcToken || !isAddress(usdcToken)) {
      return NextResponse.json(
        { error: "Server misconfigured: USDC_TOKEN is not set" },
        { status: 503 }
      );
    }
    const requirements = {
      x402Version: 1,
      error: "Payment required",
      accepts: [
        {
          scheme: "exact",
          network: "goat",
          asset: getAddress(usdcToken),
          token: getAddress(usdcToken),
          payTo: getAddress(plugin.author),
          price: `$${plugin.price.toFixed(2)}`,
          maxAmountRequired: usdcAmount(plugin.price).toString(),
        },
      ],
    };
    return new NextResponse(
      JSON.stringify({
        x402Version: requirements.x402Version,
        error: requirements.error,
        pluginId: plugin.id,
        accepts: requirements.accepts,
      }),
      {
        status: 402,
        headers: {
          "Content-Type": "application/json",
          [PAYMENT_REQUIRED_HEADER]: Buffer.from(JSON.stringify(requirements)).toString("base64"),
        },
      }
    );
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[marketplace] Plugin use failed:`, error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
