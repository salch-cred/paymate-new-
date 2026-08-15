import { NextRequest, NextResponse } from 'next/server';
import { initServicesStore } from '@/lib/services/serverStore';
import { listServices, listOrders, listProposalsForProvider } from '@/lib/services/store';
import { SERVICE_CATEGORIES } from '@/lib/services/types';

const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * Provider profile: services listed, orders as provider (completed earnings +
 * reviews), and open proposals — everything a client checks before hiring.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  try {
    await initServicesStore();
    const { address } = await params;
    const wallet = address.toLowerCase();
    if (!ETH_ADDRESS_RE.test(wallet)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    const services = listServices()
      .filter((s) => s.provider === wallet)
      .map((s) => ({
        id: s.id,
        title: s.title,
        category: s.category,
        categoryLabel: SERVICE_CATEGORIES.find((c) => c.id === s.category)?.label ?? s.category,
        price: s.price,
        deliveryDays: s.deliveryDays,
        rating: s.rating,
        reviewCount: s.reviewCount,
        completedCount: s.completedCount,
        providerName: s.providerName,
      }));

    const asProvider = listOrders().filter((o) => o.provider === wallet);
    const completed = asProvider.filter((o) => o.status === 'completed');
    const reviews = completed
      .filter((o) => o.buyerRating != null || o.buyerReview)
      .map((o) => ({
        orderId: o.id,
        serviceTitle: o.serviceTitle,
        amountUsd: o.amountUsd,
        rating: o.buyerRating,
        review: o.buyerReview,
        completedAt: o.completedAt,
      }));

    const profile = {
      address: wallet,
      name: services[0]?.providerName ?? null,
      servicesCount: services.length,
      completedJobs: completed.length,
      earnedUsd: Number(completed.reduce((sum, o) => sum + o.amountUsd, 0).toFixed(2)),
      avgRating: completed.length
        ? Number((completed.reduce((sum, o) => sum + (o.buyerRating ?? 0), 0) / completed.length).toFixed(2))
        : 0,
      openProposals: listProposalsForProvider(wallet).filter((p) => p.status === 'pending').length,
      services,
      reviews,
    };

    return NextResponse.json({ provider: profile });
  } catch (error) {
    console.error('[api/providers] failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
