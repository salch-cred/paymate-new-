import { NextResponse } from 'next/server';
import { initServicesStore, getOrder, patchOrder, markServiceCompleted } from '@/lib/services/serverStore';
import { resolveEscrowOnChain, mintReputation, PaymentError } from '@/lib/services/escrow';
import { verifyFreshWalletProof } from '@/lib/walletProof';
import { addTreasuryRevenue, computePaymateFee } from '@/lib/db';

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await initServicesStore();
  const { id } = await params;
  const order = getOrder(id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.status !== 'delivered') {
    return NextResponse.json({ error: `Order is ${order.status} — only delivered work can be accepted` }, { status: 409 });
  }

  let body: { callerAddress?: unknown; message?: unknown; signature?: unknown; ts?: unknown; rating?: unknown; review?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const callerAddress = typeof body.callerAddress === 'string' ? body.callerAddress.toLowerCase() : '';
  if (!ETH_ADDRESS_RE.test(callerAddress) || callerAddress !== order.buyer) {
    return NextResponse.json({ error: 'callerAddress must be this order\'s buyer' }, { status: 403 });
  }

  const expectedMessage = `PayMate accept order ${order.id} at ${body?.ts}`;
  const validProof = await verifyFreshWalletProof(
    { wallet: callerAddress, message: body?.message, signature: body?.signature, ts: body?.ts },
    expectedMessage
  );
  if (!validProof) {
    return NextResponse.json(
      { error: `Wallet ownership proof required. Sign exactly: "PayMate accept order ${order.id} at <ts>" and provide { callerAddress, message, signature, ts }.` },
      { status: 401 }
    );
  }

  const rating = body.rating == null ? null : Number(body.rating);
  if (rating != null && (!Number.isFinite(rating) || rating < 1 || rating > 5)) {
    return NextResponse.json({ error: 'rating must be an integer between 1 and 5' }, { status: 422 });
  }
  const review = typeof body.review === 'string' ? body.review.trim().slice(0, 500) : null;

  try {
    // Release the escrowed USDC to the provider on-chain (real money movement).
    const releaseTxHash = order.fundTxHash
      ? await resolveEscrowOnChain(order.id)
      : null;

    // Portable ERC-8004 reputation for the provider (best-effort, mirrors the
    // invoice settle path).
    try {
      await mintReputation(order.provider, order.amountUsd, 1.0);
    } catch (error) {
      console.log(`[orders/accept] reputation mint skipped: ${error}`);
    }

    // Treasury captures the configured fee (PAYMATE_FEE_RATE) of settled
    // volume, keeping ledger stats consistent with the invoice path.
    try {
      await addTreasuryRevenue(computePaymateFee(order.amountUsd));
    } catch (error) {
      console.error('[orders/accept] treasury fee failed:', error);
    }

    await markServiceCompleted(order.serviceId, rating);

    const updated = await patchOrder(order.id, {
      status: 'completed',
      releaseTxHash,
      completedAt: Date.now(),
      buyerRating: rating,
      buyerReview: review,
    });

    return NextResponse.json({ order: updated, onChain: releaseTxHash ? { released: true, releaseTxHash } : { released: false, note: 'No escrowed funds on-chain to release' } });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[orders/accept] failed:', error);
    return NextResponse.json({ error: 'Failed to release escrow on-chain.' }, { status: 500 });
  }
}
