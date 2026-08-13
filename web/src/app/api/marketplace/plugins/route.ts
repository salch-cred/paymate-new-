import { NextRequest, NextResponse } from 'next/server';
import { getAllPlugins, searchPlugins, getPluginsByCategory, CATEGORY_META } from '@/lib/marketplace/store';
import { initStore, addPluginPersisted } from '@/lib/marketplace/serverStore';
import type { PublishPluginPayload } from '@/lib/marketplace/types';
import { verifyFreshWalletProof } from '@/lib/walletProof';
import { checkAndConsumeRequestBudget } from '@/lib/rateLimit';
import { verifyFreshWalletProof712, type WalletProof712 } from '@/lib/security';
import { claimProofNonce } from '@/lib/db';
import { goatChain } from '@/lib/chain';

const MAX_BODY_BYTES = 64 * 1024; // 64 KB
const MAX_TAGS = 10;
const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export async function GET(request: NextRequest) {
  await initStore();
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const category = searchParams.get('category');
  const sort = searchParams.get('sort') ?? 'popular';
  const featured = searchParams.get('featured');

  let plugins = getAllPlugins();

  if (query) {
    plugins = searchPlugins(query);
  } else if (category && category !== 'all') {
    plugins = getPluginsByCategory(category);
  }

  if (featured === 'true') {
    plugins = plugins.filter((p) => p.featured);
  }

  switch (sort) {
    case 'popular':
      plugins = [...plugins].sort((a, b) => b.usageCount - a.usageCount);
      break;
    case 'rating':
      plugins = [...plugins].sort((a, b) => b.rating - a.rating);
      break;
    case 'newest':
      plugins = [...plugins].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      break;
    case 'price-low':
      plugins = [...plugins].sort((a, b) => a.price - b.price);
      break;
    case 'price-high':
      plugins = [...plugins].sort((a, b) => b.price - a.price);
      break;
  }

  return NextResponse.json({ plugins, total: plugins.length });
}

export async function POST(request: NextRequest) {
  // Read raw text first so we can reject oversized bodies before parsing.
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
  }

  let body: Partial<PublishPluginPayload>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  for (const field of ['name', 'displayName', 'description', 'category', 'authorAddress', 'authorName'] as const) {
    if (!body[field] || typeof body[field] !== 'string' || !body[field].trim()) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 });
    }
  }

  if (!CATEGORY_META.some((c) => c.id === body.category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0.001 || price > 1000) {
    return NextResponse.json({ error: 'Price must be between 0.001 and 1000 USDC' }, { status: 400 });
  }

  if (!ETH_ADDRESS_RE.test(body.authorAddress as string)) {
    return NextResponse.json({ error: 'authorAddress must be a valid 0x… Ethereum address' }, { status: 400 });
  }

  // SECURITY (audit fix 2026-08-13): publishing used to accept ANY
  // authorAddress with zero proof of ownership, letting anyone impersonate a
  // legitimate developer's wallet in the public marketplace. Require the
  // same wallet-signed, timestamp-bound proof used by /api/apikeys.
  const authorAddress = (body.authorAddress as string).toLowerCase();
  const authorProof = (body as { authorProof?: { message?: unknown; signature?: unknown; ts?: unknown } }).authorProof;
  const expectedMessage = `PayMate marketplace publish by ${authorAddress} at ${authorProof?.ts}`;
  const legacyValid = await verifyFreshWalletProof(
    { wallet: authorAddress, message: authorProof?.message, signature: authorProof?.signature, ts: authorProof?.ts },
    expectedMessage
  );
  // EIP-712 typed-data proof (Tier-1 security): chain-scoped domain (GOAT
  // chainId) + nonce replay guard. Accepted as an ALTERNATIVE so existing
  // signers keep working unchanged.
  const typedProof = (body as { authorProof712?: WalletProof712 }).authorProof712;
  const typedValid = typedProof
    ? await verifyFreshWalletProof712(typedProof, goatChain.id, claimProofNonce)
    : { ok: false as const, reason: 'not provided' };
  if (!legacyValid && !typedValid.ok) {
    return NextResponse.json(
      {
        error: `Wallet ownership proof required. Either sign exactly: "PayMate marketplace publish by ${authorAddress} at <ts>" and provide authorProof: { message, signature, ts }, or provide an EIP-712 authorProof712: { action: "marketplace:publish", wallet: "${authorAddress}", nonce, expiresAt, signature } signed for chain ${goatChain.id} (domain: PayMate v1).`,
      },
      { status: 401 }
    );
  }

  if (!(await checkAndConsumeRequestBudget('marketplace-publish', 100, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many plugin publishes recently. Please try again later.' }, { status: 429 });
  }

  const tags = Array.isArray(body.tags) ? body.tags : [];
  if (tags.length > MAX_TAGS || tags.some((t) => typeof t !== 'string' || t.length > 24)) {
    return NextResponse.json({ error: `Tags: max ${MAX_TAGS} tags, each ≤ 24 characters` }, { status: 400 });
  }

  const plugin = await addPluginPersisted({
    name: (body.name as string).toLowerCase().replace(/\s+/g, '-'),
    displayName: (body.displayName as string).trim(),
    description: (body.description as string).trim(),
    longDescription: typeof body.longDescription === 'string' && body.longDescription.trim() ? body.longDescription.trim() : (body.description as string).trim(),
    category: body.category as PublishPluginPayload['category'],
    price,
    author: (body.authorAddress as string).toLowerCase(),
    authorName: (body.authorName as string).trim(),
    ipfsHash: typeof body.ipfsHash === 'string' ? body.ipfsHash.trim() : '',
    tags: tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean),
    version: typeof body.version === 'string' && body.version.trim() ? body.version.trim() : '1.0.0',
    githubUrl: typeof body.githubUrl === 'string' ? body.githubUrl.trim() : undefined,
    docsUrl: typeof body.docsUrl === 'string' ? body.docsUrl.trim() : undefined,
  });
  return NextResponse.json({ plugin }, { status: 201 });
}
