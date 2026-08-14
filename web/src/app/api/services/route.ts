import { NextRequest, NextResponse } from 'next/server';
import { listServices, searchServices, getServicesByCategory, SERVICE_CATEGORIES } from '@/lib/services/store';
import { initServicesStore, addServicePersisted } from '@/lib/services/serverStore';
import type { PublishServicePayload, ServiceCategory } from '@/lib/services/types';
import { verifyFreshWalletProof } from '@/lib/walletProof';

const MAX_BODY_BYTES = 64 * 1024;
const MAX_TAGS = 10;
const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export async function GET(request: NextRequest) {
  await initServicesStore();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const category = searchParams.get('category');
  const sort = searchParams.get('sort') ?? 'popular';

  let services = listServices().filter((s) => s.active);
  if (query) {
    services = searchServices(query);
  } else if (category && category !== 'all') {
    services = getServicesByCategory(category);
  }

  switch (sort) {
    case 'popular':
      services = [...services].sort((a, b) => b.completedCount - a.completedCount);
      break;
    case 'rating':
      services = [...services].sort((a, b) => b.rating - a.rating);
      break;
    case 'newest':
      services = [...services].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case 'price-low':
      services = [...services].sort((a, b) => a.price - b.price);
      break;
    case 'price-high':
      services = [...services].sort((a, b) => b.price - a.price);
      break;
  }

  return NextResponse.json({ services, total: services.length });
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }

  let body: Partial<PublishServicePayload>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  for (const field of ['title', 'description', 'category', 'providerName', 'providerAddress'] as const) {
    if (!body[field] || typeof body[field] !== 'string' || !body[field].trim()) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
    }
  }

  if (!SERVICE_CATEGORIES.some((c) => c.id === body.category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0.01 || price > 10000) {
    return NextResponse.json({ error: 'Price must be between 0.01 and 10000 USDC' }, { status: 400 });
  }

  const deliveryDays = Number(body.deliveryDays);
  if (!Number.isInteger(deliveryDays) || deliveryDays < 1 || deliveryDays > 365) {
    return NextResponse.json({ error: 'deliveryDays must be between 1 and 365' }, { status: 400 });
  }

  if (!ETH_ADDRESS_RE.test(body.providerAddress as string)) {
    return NextResponse.json({ error: 'providerAddress must be a valid 0x… Ethereum address' }, { status: 400 });
  }

  // SECURITY: same wallet-ownership proof as the plugin marketplace — nobody
  // can list services under a wallet they don't control.
  const providerAddress = (body.providerAddress as string).toLowerCase();
  const providerProof = (body as { providerProof?: { message?: unknown; signature?: unknown; ts?: unknown } }).providerProof;
  const expectedMessage = `PayMate service publish by ${providerAddress} at ${providerProof?.ts}`;
  const validProof = await verifyFreshWalletProof(
    { wallet: providerAddress, message: providerProof?.message, signature: providerProof?.signature, ts: providerProof?.ts },
    expectedMessage
  );
  if (!validProof) {
    return NextResponse.json(
      {
        error: `Wallet ownership proof required. Sign exactly: "PayMate service publish by ${providerAddress} at <ts>" and provide providerProof: { message, signature, ts }.`,
      },
      { status: 401 }
    );
  }

  const tags = Array.isArray(body.tags) ? body.tags : [];
  if (tags.length > MAX_TAGS || tags.some((t) => typeof t !== 'string' || t.length > 24)) {
    return NextResponse.json({ error: `Tags: max ${MAX_TAGS} tags, each ≤ 24 characters` }, { status: 400 });
  }

  const service = await addServicePersisted({
    title: (body.title as string).trim(),
    description: (body.description as string).trim(),
    category: body.category as ServiceCategory,
    price,
    deliveryDays,
    provider: providerAddress,
    providerName: (body.providerName as string).trim(),
    tags: tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean),
  });

  return NextResponse.json({ service }, { status: 201 });
}
