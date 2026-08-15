/**
 * Agent Services Marketplace — types.
 *
 * PayMate's "market economy": providers (humans or agents) list paid services,
 * clients hire them, funds lock in the on-chain YieldEscrow until the work is
 * delivered, the AI verifier/arbitrator rules on quality and disputes, and
 * every completed engagement settles in real USDC on GOAT Network.
 */

export interface ServiceCategoryMeta {
  id: ServiceCategory
  label: string
  description: string
  color: string
  bgColor: string
}

export type ServiceCategory =
  | 'development'
  | 'design'
  | 'content'
  | 'data'
  | 'marketing'
  | 'ai-agents'
  | 'consulting'
  | 'integrations'
  | 'translation'
  | 'research';

export const SERVICE_CATEGORIES: ServiceCategoryMeta[] = [
  { id: 'development', label: 'Development', description: 'Web, mobile, smart contracts, automation', color: '#2563EB', bgColor: '#EFF6FF' },
  { id: 'design', label: 'Design', description: 'UI/UX, branding, motion, product design', color: '#DB2777', bgColor: '#FDF2F8' },
  { id: 'content', label: 'Content', description: 'Writing, copy, docs, and storytelling', color: '#7C3AED', bgColor: '#F5F3FF' },
  { id: 'data', label: 'Data', description: 'Cleaning, analysis, pipelines, oracles', color: '#0891B2', bgColor: '#ECFEFF' },
  { id: 'marketing', label: 'Marketing', description: 'Growth, social, SEO, launch strategy', color: '#EA580C', bgColor: '#FFF7ED' },
  { id: 'ai-agents', label: 'AI Agents', description: 'Custom agents, skills, and workflows', color: '#16A34A', bgColor: '#DCFCE7' },
  { id: 'consulting', label: 'Consulting', description: 'Advice, audits, strategy, code review', color: '#475569', bgColor: '#F1F5F9' },
  { id: 'integrations', label: 'Integrations', description: 'APIs, connectors, and platform wiring', color: '#4F46E5', bgColor: '#EEF2FF' },
  { id: 'translation', label: 'Translation', description: 'Human + AI translation and localization', color: '#CA8A04', bgColor: '#FEFCE8' },
  { id: 'research', label: 'Research', description: 'Market, technical, and deep research', color: '#DC2626', bgColor: '#FEF2F2' },
];

export const SERVICE_CATEGORY_MAP: Record<ServiceCategory, ServiceCategoryMeta> = Object.fromEntries(
  SERVICE_CATEGORIES.map((c) => [c.id, c])
) as Record<ServiceCategory, ServiceCategoryMeta>;

/** A provider's marketplace listing. */
export interface Service {
  id: string;
  title: string;
  description: string;
  category: ServiceCategory;
  price: number; // USDC per engagement
  deliveryDays: number;
  provider: string; // wallet address (lowercase)
  providerName: string;
  tags: string[];
  rating: number; // 0–5
  reviewCount: number;
  completedCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | 'pending_funding'
  | 'funded'
  | 'delivered'
  | 'disputed'
  | 'completed'
  | 'refunded'
  | 'cancelled';

export type AiVerdict = {
  verdict: 'complete' | 'incomplete' | 'ambiguous';
  confidence: number; // 0–1
  reasoning: string;
};

export type OrderResolution = 'PAY_FREELANCER' | 'REFUND_CLIENT' | 'SPLIT_50_50';

export interface OrderDispute {
  complaint: string;
  resolution: OrderResolution;
  reasoning: string;
  resolutionTxHash?: string | null;
  createdAt: number;
}

/** A hired engagement between a buyer and a provider, escrowed on-chain. */
export interface ServiceOrder {
  id: string;
  serviceId: string;
  serviceTitle: string;
  category: ServiceCategory;
  buyer: string; // wallet (lowercase)
  provider: string; // wallet (lowercase)
  amountUsd: number;
  status: OrderStatus;
  scope: string; // agreed scope of work
  fundTxHash: string | null;
  releaseTxHash: string | null;
  deliverable: string | null;
  aiVerdict: AiVerdict | null;
  dispute: OrderDispute | null;
  buyerRating: number | null;
  providerRating: number | null;
  buyerReview: string | null;
  providerReview: string | null;
  createdAt: number;
  fundedAt: number | null;
  deliveredAt: number | null;
  completedAt: number | null;
}

export interface PublishServicePayload {
  title: string;
  description: string;
  category: ServiceCategory;
  price: number;
  deliveryDays: number;
  providerName: string;
  providerAddress: string;
  tags?: string[];
  providerProof?: { message?: unknown; signature?: unknown; ts?: unknown };
}

/** A client-posted job (Upwork-style) that providers apply to with proposals. */
export interface JobPost {
  id: string;
  title: string;
  description: string;
  category: ServiceCategory;
  budgetMin: number;
  budgetMax: number;
  deadlineDays: number;
  client: string; // wallet (lowercase)
  clientName: string;
  tags: string[];
  status: 'open' | 'in_progress' | 'filled' | 'closed';
  acceptedProposalId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A provider's bid on a job post. */
export interface JobProposal {
  id: string;
  jobId: string;
  provider: string; // wallet (lowercase)
  providerName: string;
  bidUsd: number;
  deliveryDays: number;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface MarketEconomySnapshot {
  services: {
    total: number;
    active: number;
    byCategory: { category: ServiceCategory; label: string; count: number; avgPrice: number; color: string }[];
  };
  orders: {
    total: number;
    active: number;
    completed: number;
    volumeFundedUsd: number;
    volumeCompletedUsd: number;
  };
  topProviders: { provider: string; providerName: string; completed: number; earnedUsd: number }[];
  trending: Service[];
  recent: {
    id: string;
    serviceTitle: string;
    amountUsd: number;
    provider: string;
    providerName: string;
    status: OrderStatus;
    createdAt: number;
  }[];
  generatedAt: number;
}
