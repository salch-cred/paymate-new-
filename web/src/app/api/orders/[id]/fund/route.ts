import { NextResponse } from 'next/server';
import { initServicesStore, getOrder, patchOrder } from '@/lib/services/serverStore';
import {
  ensureEscrowRegistered,
  confirmEscrowFunded,
  verifyOrderEscrowFunding,
  PaymentError,
} from '@/lib/services/escrow';
import { verifyFreshWalletProof } from '@/lib/walletProof';

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await initServicesStore();
  const { id } = await params;
  const order = getOrder(id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.status !== 'pending_funding') {
    return NextResponse.json({ error: `Order is already ${order.status}` }, { status: 409 });
  }

  let body: { txHash?: unknown; callerAddress?: unknown; message?: unknown; signature?: unknown; ts?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const callerAddress = typeof body.callerAddress === 'string' ? body.callerAddress.toLowerCase() : '';
  if (!ETH_ADDRESS_RE.test(callerAddress) || callerAddress !== order.buyer) {
    return NextResponse.json({ error: 'callerAddress must be this order\'s buyer' }, { status: 403 });
  }

  const expectedMessage = `PayMate fund order ${order.id} at ${body?.ts}`;
  const validProof = await verifyFreshWalletProof(
    { wallet: callerAddress, message: body?.message, signature: body?.signature, ts: body?.ts },
    expectedMessage
  );
  if (!validProof) {
    return NextResponse.json(
      { error: `Wallet ownership proof required. Sign exactly: "PayMate fund order ${order.id} at <ts>" and provide { callerAddress, message, signature, ts }.` },
      { status: 401 }
    );
  }

  const txHash = typeof body.txHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(body.txHash) ? body.txHash : '';
  if (!txHash) {
    return NextResponse.json({ error: 'txHash must be a valid 0x… transaction hash' }, { status: 400 });
  }

  try {
    // 1. Verify the buyer really paid the order amount into the escrow
    //    contract (not to the provider) — real on-chain proof.
    const { payer } = await verifyOrderEscrowFunding(txHash, order);
    if (payer.toLowerCase() !== order.buyer) {
      return NextResponse.json({ error: 'Funding must come from the buyer wallet that placed the order' }, { status: 402 });
    }
    // 2. Register the escrow with the real payer + provider (idempotent).
    await ensureEscrowRegistered(order.id, payer, order.provider);
    // 3. Confirm the funds are locked on-chain (owner-only, re-reads balance).
    const confirmTxHash = await confirmEscrowFunded(order.id, order.amountUsd);
    const updated = await patchOrder(order.id, { status: 'funded', fundTxHash: txHash, fundedAt: Date.now() });
    return NextResponse.json({ order: updated, onChain: { confirmed: true, confirmTxHash } });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[orders/fund] failed:', error);
    return NextResponse.json({ error: 'Failed to confirm escrow funding on-chain.' }, { status: 500 });
  }
}
