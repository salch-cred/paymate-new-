import { NextResponse } from 'next/server';
import { initServicesStore, getOrder, patchOrder } from '@/lib/services/serverStore';
import { verifyDeliverable } from '@/lib/services/ai';
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

  const updated = await patchOrder(order.id, { status: 'delivered', deliverable, aiVerdict, deliveredAt: Date.now() });
  return NextResponse.json({ order: updated, aiVerdict });
}
