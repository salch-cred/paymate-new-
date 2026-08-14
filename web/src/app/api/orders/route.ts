import { NextRequest, NextResponse } from 'next/server';
import { listOrdersForWallet } from '@/lib/services/store';
import { initServicesStore, createOrderPersisted, getService } from '@/lib/services/serverStore';

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export async function GET(request: NextRequest) {
  await initServicesStore();
  const wallet = (request.nextUrl.searchParams.get('wallet') || '').trim().toLowerCase();
  if (!ETH_ADDRESS_RE.test(wallet)) {
    return NextResponse.json({ error: 'Provide a valid ?wallet= address' }, { status: 400 });
  }
  const orders = listOrdersForWallet(wallet);
  return NextResponse.json({ orders, total: orders.length });
}

export async function POST(request: NextRequest) {
  await initServicesStore();
  let body: { serviceId?: unknown; buyer?: unknown; scope?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const serviceId = typeof body.serviceId === 'string' ? body.serviceId : '';
  const buyer = typeof body.buyer === 'string' ? body.buyer.trim().toLowerCase() : '';
  const scope = typeof body.scope === 'string' ? body.scope.trim() : '';

  if (!serviceId) return NextResponse.json({ error: 'serviceId is required' }, { status: 400 });
  if (!ETH_ADDRESS_RE.test(buyer)) {
    return NextResponse.json({ error: 'buyer must be a valid 0x… Ethereum address' }, { status: 400 });
  }
  if (scope.length < 5 || scope.length > 4000) {
    return NextResponse.json({ error: 'scope must be between 5 and 4000 characters' }, { status: 422 });
  }

  const service = getService(serviceId);
  if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  if (!service.active) return NextResponse.json({ error: 'This service is no longer accepting hires' }, { status: 409 });
  if (service.provider === buyer) {
    return NextResponse.json({ error: 'You cannot hire your own service' }, { status: 409 });
  }

  const order = await createOrderPersisted({
    serviceId: service.id,
    serviceTitle: service.title,
    category: service.category,
    buyer,
    provider: service.provider,
    amountUsd: service.price,
    scope,
  });

  return NextResponse.json({ order }, { status: 201 });
}
