import { NextResponse } from 'next/server';
import { initServicesStore, getOrder, patchOrder, markServiceCompleted } from '@/lib/services/serverStore';
import { verifyDeliverable, shouldAutoRelease, autoReleaseReason } from '@/lib/services/ai';
import { resolveEscrowOnChain, mintReputation, PaymentError } from '@/lib/services/escrow';
import { addTreasuryRevenue, computePaymateFee } from '@/lib/db';
import type { AiVerdict } from '@/lib/services/types';

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await initServicesStore();
  const { id } = await params;
  const order = getOrder(id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.status !== 'funded') {
    return NextResponse.json({ error: `Order is ${order.status} — deliverables can only be submitted once funded` }, { status: 409 });
  }

  let body: { deliverable?: unknown; callerAddress?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const callerAddress = typeof body.callerAddress === 'string' ? body.callerAddress.toLowerCase() : '';
  if (!ETH_ADDRESS_RE.test(callerAddress) || callerAddress !== order.provider) {
    return NextResponse.json({ error: 'callerAddress must be this order\'s provider' }, { status: 403 });
  }

  const deliverable = typeof body.deliverable === 'string' ? body.deliverable.trim() : '';
  if (deliverable.length < 10 || deliverable.length > 20000) {
    return NextResponse.json({ error: 'deliverable must be between 10 and 20000 characters' }, { status: 422 });
  }

  // AI verification: score the delivery against the agreed scope. Best-effort —
  // without MISTRAL_API_KEY the verifier returns a neutral verdict and the
  // buyer's explicit acceptance still drives the release.
  let aiVerdict: AiVerdict;
  try {
    aiVerdict = await verifyDeliverable(order, deliverable);
  } catch (error) {
    console.error('[orders/deliver] AI verification failed:', error);
    aiVerdict = {
      verdict: 'ambiguous',
      confidence: 0,
      reasoning: 'AI verifier unavailable — buyer acceptance is required to release escrow.',
    };
  }

  // AUTO-RELEASE: a high-confidence "complete" AI verdict releases the escrow
  // to the provider automatically — no buyer signature. This is the
  // escrow-protected jobs rail: AI verifies against the spec, then pays.
  if (shouldAutoRelease(aiVerdict)) {
    try {
      const releaseTxHash = order.fundTxHash
        ? await resolveEscrowOnChain(order.id)
        : null;
      try {
        await mintReputation(order.provider, order.amountUsd, 1.0);
      } catch (error) {
        console.log(`[orders/deliver] reputation mint skipped: ${error}`);
      }
      try {
        await addTreasuryRevenue(computePaymateFee(order.amountUsd));
      } catch (error) {
        console.error('[orders/deliver] treasury fee failed:', error);
      }
      await markServiceCompleted(order.serviceId, null);
      const updated = await patchOrder(order.id, {
        status: 'completed',
        deliverable,
        aiVerdict,
        deliveredAt: Date.now(),
        releaseTxHash,
        completedAt: Date.now(),
      });
      return NextResponse.json({
        order: updated,
        aiVerdict,
        autoReleased: true,
        autoReleaseReason: autoReleaseReason(aiVerdict),
        onChain: releaseTxHash ? { released: true, releaseTxHash } : { released: false, note: 'No escrowed funds on-chain to release' },
      });
    } catch (error) {
      // Fail-closed: if the on-chain release fails, keep the order delivered so
      // the buyer can still accept/dispute — never strand funds in a half state.
      if (error instanceof PaymentError) {
        const updated = await patchOrder(order.id, { status: 'delivered', deliverable, aiVerdict, deliveredAt: Date.now() });
        return NextResponse.json({ order: updated, aiVerdict, autoReleased: false, autoReleaseError: error.message });
      }
      console.error('[orders/deliver] auto-release failed:', error);
      const updated = await patchOrder(order.id, { status: 'delivered', deliverable, aiVerdict, deliveredAt: Date.now() });
      return NextResponse.json({ order: updated, aiVerdict, autoReleased: false, autoReleaseError: 'Auto-release failed on-chain — buyer acceptance can still release escrow.' });
    }
  }

  const updated = await patchOrder(order.id, { status: 'delivered', deliverable, aiVerdict, deliveredAt: Date.now() });
  return NextResponse.json({ order: updated, aiVerdict, autoReleased: false });
}
