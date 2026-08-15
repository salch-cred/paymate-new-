import { NextRequest, NextResponse } from 'next/server';
import { getJob, listProposalsForJob, getProposal } from '@/lib/services/store';
import { initServicesStore, createProposalPersisted, patchJob, patchProposal, createOrderPersisted, getService } from '@/lib/services/serverStore';
import type { JobProposal } from '@/lib/services/types';
import { verifyFreshWalletProof } from '@/lib/walletProof';

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initServicesStore();
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  const proposals = listProposalsForJob(job.id);
  return NextResponse.json({ job, proposals });
}

/** Apply to a job with a proposal (wallet-signed). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initServicesStore();
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  if (job.status !== 'open') {
    return NextResponse.json({ error: 'This job is no longer accepting proposals' }, { status: 409 });
  }

  let body: {
    provider?: unknown; providerName?: unknown; bidUsd?: unknown; deliveryDays?: unknown; message?: unknown;
    providerProof?: { message?: unknown; signature?: unknown; ts?: unknown };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const provider = (typeof body.provider === 'string' ? body.provider : '').trim().toLowerCase();
  const providerName = typeof body.providerName === 'string' ? body.providerName.trim() : '';
  const bidUsd = Number(body.bidUsd);
  const deliveryDays = Number(body.deliveryDays);
  const message = typeof body.message === 'string' ? body.message.trim() : '';

  if (!ETH_ADDRESS_RE.test(provider)) {
    return NextResponse.json({ error: 'provider must be a valid 0x… Ethereum address' }, { status: 400 });
  }
  if (!providerName || providerName.length > 60) {
    return NextResponse.json({ error: 'providerName is required (≤ 60 chars)' }, { status: 400 });
  }
  if (!Number.isFinite(bidUsd) || bidUsd < 0.01 || bidUsd > job.budgetMax * 3) {
    return NextResponse.json({ error: `bidUsd must be between 0.01 and ${job.budgetMax * 3} USDC` }, { status: 400 });
  }
  if (!Number.isInteger(deliveryDays) || deliveryDays < 1 || deliveryDays > 365) {
    return NextResponse.json({ error: 'deliveryDays must be between 1 and 365' }, { status: 400 });
  }
  if (message.length < 10 || message.length > 4000) {
    return NextResponse.json({ error: 'message must be between 10 and 4000 characters' }, { status: 422 });
  }
  if (provider === job.client) {
    return NextResponse.json({ error: 'You cannot propose on your own job' }, { status: 409 });
  }

  const expectedMessage = `PayMate proposal on ${job.id} by ${provider} at ${body.providerProof?.ts}`;
  const validProof = await verifyFreshWalletProof(
    { wallet: provider, message: body.providerProof?.message, signature: body.providerProof?.signature, ts: body.providerProof?.ts },
    expectedMessage
  );
  if (!validProof) {
    return NextResponse.json(
      { error: `Wallet ownership proof required. Sign exactly: "PayMate proposal on ${job.id} by ${provider} at <ts>" and provide providerProof: { message, signature, ts }.` },
      { status: 401 }
    );
  }

  // One active proposal per provider per job — no spam bids.
  const existing = listProposalsForJob(job.id).find((p) => p.provider === provider);
  if (existing && existing.status === 'pending') {
    return NextResponse.json({ error: 'You already have a pending proposal on this job' }, { status: 409 });
  }

  const proposal = await createProposalPersisted({
    jobId: job.id,
    provider,
    providerName,
    bidUsd: Math.round(bidUsd * 100) / 100,
    deliveryDays,
    message,
  });

  return NextResponse.json({ proposal }, { status: 201 });
}

/** Client accepts a proposal → job fills and an escrow order is created. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await initServicesStore();
  const { id } = await params;
  const job = getJob(id);
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  let body: { proposalId?: unknown; client?: unknown; clientProof?: { message?: unknown; signature?: unknown; ts?: unknown } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const proposalId = typeof body.proposalId === 'string' ? body.proposalId : '';
  const client = (typeof body.client === 'string' ? body.client : '').trim().toLowerCase();
  const proposal = getProposal(proposalId);
  if (!proposal || proposal.jobId !== job.id) {
    return NextResponse.json({ error: 'Proposal not found on this job' }, { status: 404 });
  }
  if (client !== job.client) {
    return NextResponse.json({ error: 'Only the job poster can accept a proposal' }, { status: 403 });
  }
  if (job.status !== 'open') {
    return NextResponse.json({ error: 'This job has already been filled' }, { status: 409 });
  }

  const expectedMessage = `PayMate accept proposal ${proposal.id} at ${body.clientProof?.ts}`;
  const validProof = await verifyFreshWalletProof(
    { wallet: client, message: body.clientProof?.message, signature: body.clientProof?.signature, ts: body.clientProof?.ts },
    expectedMessage
  );
  if (!validProof) {
    return NextResponse.json(
      { error: `Wallet ownership proof required. Sign exactly: "PayMate accept proposal ${proposal.id} at <ts>" and provide clientProof: { message, signature, ts }.` },
      { status: 401 }
    );
  }

  // Convert the accepted proposal into a real escrow-backed order (reuses the
  // full funding → AI verify → auto-release rail). Providers that also have a
  // service listing are credited to it for their marketplace record.
  const providerService = getService(proposal.provider);
  const order = await createOrderPersisted({
    serviceId: providerService?.id ?? `job_${job.id}`,
    serviceTitle: job.title,
    category: job.category,
    buyer: job.client,
    provider: proposal.provider,
    amountUsd: proposal.bidUsd,
    scope: `Hired via job "${job.title}" (${job.id}).\n\nClient brief:\n${job.description}`,
  });

  await patchJob(job.id, { status: 'in_progress', acceptedProposalId: proposal.id });
  await patchProposal(proposal.id, { status: 'accepted' });
  // Decline the other pending proposals so the job's decision is unambiguous.
  for (const other of listProposalsForJob(job.id)) {
    if (other.id !== proposal.id && other.status === 'pending') {
      await patchProposal(other.id, { status: 'declined' });
    }
  }

  return NextResponse.json({ job: getJob(job.id), proposal, order }, { status: 200 });
}
