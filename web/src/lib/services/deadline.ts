/**
 * Deadline auto-enforcement for escrow-protected jobs.
 *
 * A funded order with no deliverable that passes its delivery deadline is a
 * stranded escrow. This engine finds those orders, auto-opens the AI dispute
 * ("delivery deadline passed, nothing delivered"), renders the binding verdict,
 * and executes it on-chain (REFUND_CLIENT / PAY_FREELANCER / SPLIT_50_50).
 *
 * Safety model (matches the relayer crons):
 *  - Fail-closed: requires CRON_SECRET (route), the AI arbitrator, and
 *    ESCROW_CONTRACT/USDC for on-chain movement.
 *  - Idempotent: skips orders that already have a binding verdict; a resolved
 *    dispute can never be re-executed.
 *  - Capped: max ORDERS_EXPIRE_MAX_PER_RUN per pass (default 10), honoring a
 *    dry-run flag for audits before anything moves.
 *  - No AI fallback to "pay the provider": with nothing delivered, the default
 *    resolution is REFUND_CLIENT (fair + safe); PAY_FREELANCER only comes from
 *    the arbitrator's explicit reasoning, never from an outage.
 */

import type { ServiceOrder, OrderResolution } from './types';
import { getService } from './store';

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEADLINE_DEFAULT_MAX_PER_RUN = 10;

/** An order is deadline-expired when funded, undelivered, and past deliveryDays. */
export function isOrderDeadlineExpired(order: ServiceOrder, now: number = Date.now()): boolean {
  if (order.status !== 'funded') return false;
  if (order.fundedAt == null) return false;
  if (order.deliverable) return false;
  if (order.dispute?.resolution) return false; // already ruled
  const service = getService(order.serviceId);
  const deliveryDays = service?.deliveryDays ?? 1; // fail closed: assume shortest
  const deadline = order.fundedAt + deliveryDays * DAY_MS;
  return now > deadline;
}

/** Human-readable complaint auto-filed for the expired order. */
export function deadlineComplaint(order: ServiceOrder): string {
  const service = getService(order.serviceId);
  const days = service?.deliveryDays ?? 1;
  return (
    `AUTOMATED DEADLINE ENFORCEMENT: This order was funded ${Math.max(0, Math.round((Date.now() - (order.fundedAt ?? Date.now())) / DAY_MS))} days ago ` +
    `with a ${days}-day delivery commitment and no deliverable was submitted. ` +
    `The escrow has been auto-opened for arbitration. Since nothing was delivered, the fair default is a full refund to the buyer.`
  );
}

export interface DeadlineOutcome {
  orderId: string;
  serviceTitle: string;
  amountUsd: number;
  resolution: OrderResolution;
  reasoning: string;
  resolutionTxHash: string | null;
  status: 'completed' | 'refunded';
  onChain: boolean;
}

export interface DeadlineResult {
  dryRun: boolean;
  scanned: number;
  expired: number;
  executed: number;
  skipped: { orderId: string; reason: string }[];
  outcomes: DeadlineOutcome[];
  errors: { orderId: string; error: string }[];
}

/** Candidate expired orders for a pass (pure, testable). */
export function findExpiredOrders(orders: ServiceOrder[], now: number = Date.now(), max = DEADLINE_DEFAULT_MAX_PER_RUN): ServiceOrder[] {
  return orders
    .filter((o) => isOrderDeadlineExpired(o, now))
    .sort((a, b) => (a.fundedAt ?? 0) - (b.fundedAt ?? 0)) // oldest first
    .slice(0, max);
}

/**
 * Renders the binding resolution for an expired order. When the AI arbitrator
 * is unavailable or errors, fail-closed to REFUND_CLIENT — nothing delivered,
 * so the buyer gets their money back. Never fabricates a PAY_FREELANCER.
 */
export async function renderDeadlineResolution(
  order: ServiceOrder,
  arbitrate: (order: ServiceOrder, complaint: string) => Promise<{ resolution: OrderResolution; reasoning: string }>,
  hasMistralKey: () => boolean
): Promise<{ resolution: OrderResolution; reasoning: string }> {
  const complaint = deadlineComplaint(order);
  if (!hasMistralKey()) {
    return {
      resolution: 'REFUND_CLIENT',
      reasoning: 'AI arbitrator unavailable — fail-closed default: nothing was delivered by the deadline, so the escrow is refunded to the buyer.',
    };
  }
  try {
    return await arbitrate(order, complaint);
  } catch (error) {
    console.error(`[deadline] arbitration failed for ${order.id}, fail-closed refund:`, error);
    return {
      resolution: 'REFUND_CLIENT',
      reasoning: 'AI arbitrator failed — fail-closed default: nothing was delivered by the deadline, so the escrow is refunded to the buyer.',
    };
  }
}
