import { NextResponse } from 'next/server';
import { initServicesStore, getOrder } from '@/lib/services/serverStore';
import { orderPaymentRequirements } from '@/lib/services/escrow';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await initServicesStore();
  const { id } = await params;
  const order = getOrder(id);
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  let paymentRequirements: ReturnType<typeof orderPaymentRequirements> | null = null;
  if (order.status === 'pending_funding') {
    try {
      paymentRequirements = orderPaymentRequirements(order);
    } catch (error) {
      // Escrow env not configured — surface a clear message instead of 500.
      return NextResponse.json({
        error: error instanceof Error ? error.message : 'Escrow is not configured on the API',
      }, { status: 503 });
    }
  }

  return NextResponse.json({ order, paymentRequirements });
}
