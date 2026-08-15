import {
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_MAP,
  type Service,
  type ServiceOrder,
  type JobPost,
  type JobProposal,
  type MarketEconomySnapshot,
  type OrderStatus,
} from './types';

// NOTE: this module must stay free of Node-only imports (fs, path, …) because
// client components import SERVICE_CATEGORIES from here. Durable persistence
// lives in lib/services/serverStore.ts, orchestrated ONLY by API route handlers.

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------
const services: Service[] = [];

/** Called once by the server API routes with services loaded from storage. */
export function hydrateServices(saved: Service[]): void {
  services.length = 0;
  services.push(...saved);
}

/** Current services (for persistence writes). */
export function getServices(): Service[] {
  return [...services];
}

export function listServices(): Service[] {
  return [...services];
}

export function getService(id: string): Service | undefined {
  return services.find((s) => s.id === id);
}

export function searchServices(query: string): Service[] {
  const q = query.trim().toLowerCase();
  if (!q) return listServices();
  return services.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.providerName.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q)) ||
      s.category.toLowerCase().includes(q)
  );
}

export function getServicesByCategory(category: string): Service[] {
  return services.filter((s) => s.category === category);
}

export function addService(
  data: Omit<Service, 'id' | 'rating' | 'reviewCount' | 'completedCount' | 'createdAt' | 'updatedAt' | 'active'>,
  id?: string
): Service {
  const now = new Date().toISOString();
  const service: Service = {
    ...data,
    id: id ?? `svc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
    rating: 0,
    reviewCount: 0,
    completedCount: 0,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  services.unshift(service);
  return service;
}

/** Record a completed engagement: bump completion count and fold in a rating. */
export function recordServiceCompletion(id: string, rating: number | null): Service | undefined {
  const service = services.find((s) => s.id === id);
  if (!service) return undefined;
  service.completedCount += 1;
  if (rating != null && rating >= 1 && rating <= 5) {
    service.rating = Number(
      ((service.rating * service.reviewCount + rating) / (service.reviewCount + 1)).toFixed(2)
    );
    service.reviewCount += 1;
  }
  service.updatedAt = new Date().toISOString();
  return service;
}

export function setServiceActive(id: string, active: boolean): Service | undefined {
  const service = services.find((s) => s.id === id);
  if (!service) return undefined;
  service.active = active;
  service.updatedAt = new Date().toISOString();
  return service;
}

// ---------------------------------------------------------------------------
// Jobs + proposals (Upwork-style job posts)
// ---------------------------------------------------------------------------
const jobs: JobPost[] = [];
const proposals: JobProposal[] = [];

/** Called once by the server API routes with jobs loaded from storage. */
export function hydrateJobs(saved: JobPost[]): void {
  jobs.length = 0;
  jobs.push(...saved);
}

/** Called once by the server API routes with proposals loaded from storage. */
export function hydrateProposals(saved: JobProposal[]): void {
  proposals.length = 0;
  proposals.push(...saved);
}

/** Current jobs (for persistence writes). */
export function getJobs(): JobPost[] {
  return [...jobs];
}

/** Current proposals (for persistence writes). */
export function getProposals(): JobProposal[] {
  return [...proposals];
}

export function listJobs(onlyOpen = true): JobPost[] {
  const list = onlyOpen ? jobs.filter((j) => j.status === 'open') : jobs;
  return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getJob(id: string): JobPost | undefined {
  return jobs.find((j) => j.id === id);
}

export function listProposalsForJob(jobId: string): JobProposal[] {
  return proposals
    .filter((p) => p.jobId === jobId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function listProposalsForProvider(provider: string): JobProposal[] {
  const w = provider.toLowerCase();
  return proposals.filter((p) => p.provider === w);
}

export function getProposal(id: string): JobProposal | undefined {
  return proposals.find((p) => p.id === id);
}

export function createJob(
  data: Pick<JobPost, 'title' | 'description' | 'category' | 'budgetMin' | 'budgetMax' | 'deadlineDays' | 'client' | 'clientName' | 'tags'>,
  id?: string
): JobPost {
  const now = new Date().toISOString();
  const job: JobPost = {
    ...data,
    id: id ?? `job_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
    status: 'open',
    acceptedProposalId: null,
    createdAt: now,
    updatedAt: now,
  };
  jobs.unshift(job);
  return job;
}

export function createProposal(
  data: Pick<JobProposal, 'jobId' | 'provider' | 'providerName' | 'bidUsd' | 'deliveryDays' | 'message'>,
  id?: string
): JobProposal {
  const proposal: JobProposal = {
    ...data,
    id: id ?? `prop_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  proposals.unshift(proposal);
  return proposal;
}

export function updateJob(id: string, patch: Partial<Pick<JobPost, 'status' | 'acceptedProposalId'>>): JobPost | undefined {
  const job = jobs.find((j) => j.id === id);
  if (!job) return undefined;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  return job;
}

export function updateProposal(id: string, patch: Partial<Pick<JobProposal, 'status'>>): JobProposal | undefined {
  const proposal = proposals.find((p) => p.id === id);
  if (!proposal) return undefined;
  Object.assign(proposal, patch);
  return proposal;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
const orders: ServiceOrder[] = [];

/** Called once by the server API routes with orders loaded from storage. */
export function hydrateOrders(saved: ServiceOrder[]): void {
  orders.length = 0;
  orders.push(...saved);
}

/** Current orders (for persistence writes). */
export function getOrders(): ServiceOrder[] {
  return [...orders];
}

export function listOrders(): ServiceOrder[] {
  return [...orders];
}

export function getOrder(id: string): ServiceOrder | undefined {
  return orders.find((o) => o.id === id);
}

/** Orders where the wallet is either buyer or provider. */
export function listOrdersForWallet(wallet: string): ServiceOrder[] {
  const w = wallet.toLowerCase();
  return orders
    .filter((o) => o.buyer === w || o.provider === w)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function createOrder(
  data: Pick<ServiceOrder, 'serviceId' | 'serviceTitle' | 'category' | 'buyer' | 'provider' | 'amountUsd' | 'scope'>,
  id?: string
): ServiceOrder {
  const order: ServiceOrder = {
    ...data,
    id: id ?? `ord_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
    status: 'pending_funding',
    fundTxHash: null,
    releaseTxHash: null,
    deliverable: null,
    aiVerdict: null,
    dispute: null,
    buyerRating: null,
    providerRating: null,
    buyerReview: null,
    providerReview: null,
    createdAt: Date.now(),
    fundedAt: null,
    deliveredAt: null,
    completedAt: null,
  };
  orders.unshift(order);
  return order;
}

export type OrderPatch = Partial<
  Pick<
    ServiceOrder,
    | 'status'
    | 'fundTxHash'
    | 'releaseTxHash'
    | 'deliverable'
    | 'aiVerdict'
    | 'dispute'
    | 'buyerRating'
    | 'providerRating'
    | 'buyerReview'
    | 'providerReview'
    | 'fundedAt'
    | 'deliveredAt'
    | 'completedAt'
  >
>;

export function updateOrder(id: string, patch: OrderPatch): ServiceOrder | undefined {
  const order = orders.find((o) => o.id === id);
  if (!order) return undefined;
  Object.assign(order, patch);
  return order;
}

// ---------------------------------------------------------------------------
// Market economy snapshot
// ---------------------------------------------------------------------------
const ACTIVE_STATUSES: OrderStatus[] = ['pending_funding', 'funded', 'delivered', 'disputed'];

export function getMarketSnapshot(): MarketEconomySnapshot {
  const activeServices = services.filter((s) => s.active);
  const volumeFunded = orders
    .filter((o) => o.fundTxHash)
    .reduce((sum, o) => sum + o.amountUsd, 0);
  const volumeCompleted = orders
    .filter((o) => o.status === 'completed')
    .reduce((sum, o) => sum + o.amountUsd, 0);

  // Provider earnings are only counted on completed engagements (escrow
  // actually released). Refunds and cancellations never count.
  const earnedByProvider = new Map<string, { name: string; completed: number; earnedUsd: number }>();
  for (const o of orders) {
    if (o.status !== 'completed') continue;
    const entry = earnedByProvider.get(o.provider) ?? { name: o.serviceTitle, completed: 0, earnedUsd: 0 };
    entry.completed += 1;
    entry.earnedUsd += o.amountUsd;
    earnedByProvider.set(o.provider, entry);
  }

  const providerNameOf = (wallet: string): string => {
    const svc = services.find((s) => s.provider === wallet);
    return svc?.providerName ?? wallet.slice(0, 6) + '…' + wallet.slice(-4);
  };

  return {
    services: {
      total: services.length,
      active: activeServices.length,
      byCategory: SERVICE_CATEGORIES.map((c) => {
        const inCat = activeServices.filter((s) => s.category === c.id);
        return {
          category: c.id,
          label: c.label,
          count: inCat.length,
          avgPrice: inCat.length
            ? Number((inCat.reduce((sum, s) => sum + s.price, 0) / inCat.length).toFixed(2))
            : 0,
          color: c.color,
        };
      }).filter((c) => c.count > 0),
    },
    orders: {
      total: orders.length,
      active: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
      completed: orders.filter((o) => o.status === 'completed').length,
      volumeFundedUsd: Number(volumeFunded.toFixed(2)),
      volumeCompletedUsd: Number(volumeCompleted.toFixed(2)),
    },
    topProviders: [...earnedByProvider.entries()]
      .map(([wallet, e]) => ({
        provider: wallet,
        providerName: providerNameOf(wallet),
        completed: e.completed,
        earnedUsd: Number(e.earnedUsd.toFixed(2)),
      }))
      .sort((a, b) => b.earnedUsd - a.earnedUsd)
      .slice(0, 10),
    trending: [...activeServices]
      .sort((a, b) => b.completedCount - a.completedCount || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6),
    recent: [...orders]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 12)
      .map((o) => ({
        id: o.id,
        serviceTitle: o.serviceTitle,
        amountUsd: o.amountUsd,
        provider: o.provider,
        providerName: providerNameOf(o.provider),
        status: o.status,
        createdAt: o.createdAt,
      })),
    generatedAt: Date.now(),
  };
}

export { SERVICE_CATEGORIES, SERVICE_CATEGORY_MAP };
