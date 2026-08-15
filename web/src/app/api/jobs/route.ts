import { NextRequest, NextResponse } from 'next/server';
import { listJobs, getJob } from '@/lib/services/store';
import { initServicesStore, createJobPersisted } from '@/lib/services/serverStore';
import { SERVICE_CATEGORIES, type JobPost } from '@/lib/services/types';
import { verifyFreshWalletProof } from '@/lib/walletProof';

const MAX_BODY_BYTES = 64 * 1024;
const MAX_TAGS = 10;
const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export async function GET(request: NextRequest) {
  await initServicesStore();
  const { searchParams } = new URL(request.url);
  const mine = searchParams.get('mine');
  const wallet = (searchParams.get('wallet') || '').trim().toLowerCase();

  let jobs = listJobs(true);
  if (mine === 'true' && ETH_ADDRESS_RE.test(wallet)) {
    jobs = jobs.filter((j) => j.client === wallet);
  }
  return NextResponse.json({ jobs, total: jobs.length });
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }

  let body: Partial<JobPost> & { clientProof?: { message?: unknown; signature?: unknown; ts?: unknown } };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  for (const field of ['title', 'description', 'category', 'client', 'clientName'] as const) {
    if (!body[field] || typeof body[field] !== 'string' || !body[field].trim()) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
    }
  }

  if (!SERVICE_CATEGORIES.some((c) => c.id === body.category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  const budgetMin = Number(body.budgetMin);
  const budgetMax = Number(body.budgetMax);
  if (!Number.isFinite(budgetMin) || !Number.isFinite(budgetMax) || budgetMin < 0.01 || budgetMax < budgetMin || budgetMax > 100000) {
    return NextResponse.json({ error: 'budgetMax must be ≥ budgetMin, both between 0.01 and 100000 USDC' }, { status: 400 });
  }

  const deadlineDays = Number(body.deadlineDays);
  if (!Number.isInteger(deadlineDays) || deadlineDays < 1 || deadlineDays > 365) {
    return NextResponse.json({ error: 'deadlineDays must be between 1 and 365' }, { status: 400 });
  }

  const client = (body.client as string).toLowerCase();
  if (!ETH_ADDRESS_RE.test(client)) {
    return NextResponse.json({ error: 'client must be a valid 0x… Ethereum address' }, { status: 400 });
  }

  // SECURITY: wallet-ownership proof — nobody can post a job as a wallet they
  // don't control (same pattern as the service publish route).
  const expectedMessage = `PayMate job post by ${client} at ${body.clientProof?.ts}`;
  const validProof = await verifyFreshWalletProof(
    { wallet: client, message: body.clientProof?.message, signature: body.clientProof?.signature, ts: body.clientProof?.ts },
    expectedMessage
  );
  if (!validProof) {
    return NextResponse.json(
      { error: `Wallet ownership proof required. Sign exactly: "PayMate job post by ${client} at <ts>" and provide clientProof: { message, signature, ts }.` },
      { status: 401 }
    );
  }

  const tags = Array.isArray(body.tags) ? body.tags : [];
  if (tags.length > MAX_TAGS || tags.some((t) => typeof t !== 'string' || t.length > 24)) {
    return NextResponse.json({ error: `Tags: max ${MAX_TAGS} tags, each ≤ 24 characters` }, { status: 400 });
  }

  const job = await createJobPersisted({
    title: (body.title as string).trim(),
    description: (body.description as string).trim(),
    category: body.category as JobPost['category'],
    budgetMin,
    budgetMax,
    deadlineDays,
    client,
    clientName: (body.clientName as string).trim().slice(0, 60),
    tags: tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean),
  });

  return NextResponse.json({ job }, { status: 201 });
}
