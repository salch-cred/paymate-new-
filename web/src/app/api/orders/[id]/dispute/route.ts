import { NextResponse } from 'next/server';
import { initServicesStore, getOrder, patchOrder, markServiceCompleted } from '@/lib/services/serverStore';
import { arbitrateOrder } from '@/lib/services/ai';
import { resolveDisputeOnChain, mintReputation, RESOLUTION_TO_ENUM, PaymentError } from '@/lib/services/escrow';
import { verifyFreshWalletProof } from '@/lib/walletProof';
import { addTreasuryRevenue } from '@/lib/db';
import type { OrderResolution } from '@/lib/services/types';

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await initServicesStore();
  const { id } = await params;
  const order = getOrder(id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.status !== 'funded' && order.status !== 'delivered') {
    return NextResponse.json({ error: `Order is ${order.status} — disputes are only open while funded or delivered` }, { status: 409 });
  }
  if (order.dispute && order.dispute.resolution) {
    return NextResponse.json({ error: 'This order already has a binding verdict' }, { status: 409 });
  }

  let body: { complaint?: unknown; callerAddress?: unknown; message?: unknown; signature?: unknown; ts?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const callerAddress = typeof body.callerAddress === 'string' ? body.callerAddress.toLowerCase() : '';
  const isParty = callerAddress === order.buyer || callerAddress === order.provider;
  if (!ETH_ADDRESS_RE.test(callerAddress) || !isParty) {
    return NextResponse.json({ error: 'callerAddress must be this order\'s buyer or provider' }, { status: 403 });
  }

  const expectedMessage = `PayMate dispute order ${order.id} at ${body?.ts}`;
  const validProof = await verifyFreshWalletProof(
    { wallet: callerAddress, message: body?.message, signature: body?.signature, ts: body?.ts },
    expectedMessage
  );
  if (!validProof) {
    return NextResponse.json(
      { error: `Wallet ownership proof required. Sign exactly: "PayMate dispute order ${order.id} at <ts>" and provide { callerAddress, message, signature, ts }.` },
      { status: 401 }
    );
  }

  const complaint = typeof body.complaint === 'string' ? body.complaint.trim() : '';
  if (complaint.length < 5 || complaint.length > 4000) {
    return NextResponse.json({ error: 'complaint must be between 5 and 4000 characters' }, { status: 422 });
  }

  if (!process.env.MISTRAL_API_KEY) {
    return NextResponse.json({ error: 'Mistral API key not configured for arbitration.' }, { status: 500 });
  }

  let verdict: { resolution: OrderResolution; reasoning: string };
  try {
    verdict = await arbitrateOrder(order, complaint);
  } catch (error) {
    console.error('[orders/dispute] arbitration failed:', error);
    return NextResponse.json({ error: 'Arbitrator failed to render a valid verdict.' }, { status: 502 });
  }

  let resolutionTxHash: string | null = null;
  let onChain = { executed: false, note: '' };
  try {
    if (order.fundTxHash) {
      resolutionTxHash = await resolveDisputeOnChain(order.id, RESOLUTION_TO_ENUM[verdict.resolution]);
      onChain = { executed: true, note: '' };
    } else {
      onChain = { executed: false, note: 'No escrowed funds on-chain — verdict recorded, no funds moved.' };
    }
  } catch (error) {
    const detail = error instanceof PaymentError
      ? error.message
      : `Failed to move escrowed funds on-chain: ${error instanceof Error ? error.message : String(error)}`;
    onChain = { executed: false, note: detail };
  }

  const refunded = verdict.resolution === 'REFUND_CLIENT';
  const finalStatus = refunded ? 'refunded' : 'completed';
  const now = Date.now();

  if (!refunded) {
    // PAY_FREELANCER (and SPLIT_50_50, where the provider keeps their share)
    // count as delivered work — bump the service's completed count.
    await markServiceCompleted(order.serviceId, null);
    try {
      await mintReputation(order.provider, order.amountUsd, 1.0);
    } catch (error) {
      console.log(`[orders/dispute] reputation mint skipped: ${error}`);
    }
  }
  try {
    await addTreasuryRevenue(order.amountUsd * 0.01);
  } catch (error) {
    console.error('[orders/dispute] treasury fee failed:', error);
  }

  const updated = await patchOrder(order.id, {
    status: finalStatus,
    dispute: { complaint, resolution: verdict.resolution, reasoning: verdict.reasoning, resolutionTxHash, createdAt: now },
    releaseTxHash: resolutionTxHash ?? order.releaseTxHash,
    completedAt: refunded ? null : now,
  });

  return NextResponse.json({
    ok: true,
    order: updated,
    decision: { resolution: verdict.resolution, reasoning: verdict.reasoning },
    onChain,
  });
}
