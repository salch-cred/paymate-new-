import { requireBearerAuth } from '@/lib/auth';
import { initServicesStore, getOrder, patchOrder, markServiceCompleted } from '@/lib/services/serverStore';
import { listOrders } from '@/lib/services/store';
import {
  findExpiredOrders,
  renderDeadlineResolution,
  DEADLINE_DEFAULT_MAX_PER_RUN,
  deadlineComplaint,
  type DeadlineResult,
  type DeadlineOutcome,
} from '@/lib/services/deadline';
import { arbitrateOrder } from '@/lib/services/ai';
import { resolveDisputeOnChain, mintReputation, RESOLUTION_TO_ENUM, PaymentError } from '@/lib/services/escrow';
import { addTreasuryRevenue, computePaymateFee } from '@/lib/db';
import type { OrderResolution } from '@/lib/services/types';

export const dynamic = 'force-dynamic';

/**
 * Deadline auto-enforcement — wired to a Vercel cron (vercel.json).
 *
 *   GET /api/orders/expire                  → run (honors ORDERS_EXPIRE_DRY_RUN)
 *   GET /api/orders/expire?dryRun=true      → audit only, nothing moves
 *
 * Finds funded orders past their deliveryDays deadline with no deliverable,
 * auto-opens the AI dispute, executes the binding verdict on-chain
 * (REFUND_CLIENT / PAY_FREELANCER / SPLIT_50_50), mints reputation when the
 * provider keeps any share, and captures the treasury fee.
 *
 * Requires CRON_SECRET (same guard as the other crons). Fail-closed:
 * - 401 without the bearer secret
 * - no MISTRAL_API_KEY → refund the buyer (nothing delivered = refund)
 * - no ESCROW_CONTRACT/USDC → order stays funded, error recorded, no funds stranded
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    console.error('[orders/expire] CRON_SECRET is not configured. Refusing to run.');
  }
  const unauthorized = requireBearerAuth(request, process.env.CRON_SECRET);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const dryRun = url.searchParams.get('dryRun') === 'true' || process.env.ORDERS_EXPIRE_DRY_RUN === 'true';
  const max = clampMax(url.searchParams.get('max'));

  const result: DeadlineResult = { dryRun, scanned: 0, expired: 0, executed: 0, skipped: [], outcomes: [], errors: [] };
  try {
    await initServicesStore();
    const orders = listOrders();
    result.scanned = orders.length;
    const expired = findExpiredOrders(orders, Date.now(), max);
    result.expired = expired.length;

    for (const order of expired) {
      const current = getOrder(order.id);
      if (!current) {
        result.skipped.push({ orderId: order.id, reason: 'gone' });
        continue;
      }
      if (current.dispute?.resolution) {
        result.skipped.push({ orderId: order.id, reason: 'already ruled' });
        continue;
      }
      if (current.status !== 'funded') {
        result.skipped.push({ orderId: order.id, reason: `status ${current.status}` });
        continue;
      }

      if (dryRun) {
        const decision = await renderDeadlineResolution(current, arbitrateOrder, () => !!process.env.MISTRAL_API_KEY);
        result.outcomes.push({
          orderId: order.id,
          serviceTitle: current.serviceTitle,
          amountUsd: current.amountUsd,
          resolution: decision.resolution,
          reasoning: `[DRY RUN] would auto-rule: ${decision.resolution} — ${decision.reasoning}`,
          resolutionTxHash: null,
          status: decision.resolution === 'REFUND_CLIENT' ? 'refunded' : 'completed',
          onChain: false,
        });
        result.executed += 1;
        continue;
      }

      try {
        const verdict = await renderDeadlineResolution(current, arbitrateOrder, () => !!process.env.MISTRAL_API_KEY);
        const resolution = verdict.resolution as OrderResolution;

        // Execute on-chain only if escrow was actually funded.
        let resolutionTxHash: string | null = null;
        let onChain = false;
        if (current.fundTxHash) {
          try {
            resolutionTxHash = await resolveDisputeOnChain(current.id, RESOLUTION_TO_ENUM[resolution]);
            onChain = true;
          } catch (error) {
            // Do NOT strand the order: record the verdict, keep it funded so a
            // human (or a later pass) can retry the on-chain step.
            const detail = error instanceof PaymentError ? error.message : error instanceof Error ? error.message : String(error);
            result.errors.push({ orderId: order.id, error: `on-chain resolution failed: ${detail}` });
            await patchOrder(current.id, {
              dispute: {
                complaint: deadlineComplaint(current),
                resolution,
                reasoning: verdict.reasoning,
                resolutionTxHash: null,
                createdAt: Date.now(),
              },
            });
            continue;
          }
        }

        // Provider keeps any share (PAY_FREELANCER or the provider half of
        // SPLIT_50_50) → record the completed engagement + reputation.
        if (resolution !== 'REFUND_CLIENT') {
          await markServiceCompleted(current.serviceId, null);
          try {
            await mintReputation(current.provider, current.amountUsd, resolution === 'SPLIT_50_50' ? 0.5 : 1.0);
          } catch (error) {
            console.log(`[orders/expire] reputation mint skipped: ${error}`);
          }
        }
        try {
          await addTreasuryRevenue(computePaymateFee(current.amountUsd));
        } catch (error) {
          console.error('[orders/expire] treasury fee failed:', error);
        }

        const refunded = resolution === 'REFUND_CLIENT';
        const now = Date.now();
        await patchOrder(current.id, {
          status: refunded ? 'refunded' : 'completed',
          dispute: {
            complaint: deadlineComplaint(current),
            resolution,
            reasoning: verdict.reasoning,
            resolutionTxHash,
            createdAt: now,
          },
          releaseTxHash: resolutionTxHash ?? current.releaseTxHash,
          completedAt: refunded ? null : now,
        });

        const outcome: DeadlineOutcome = {
          orderId: order.id,
          serviceTitle: current.serviceTitle,
          amountUsd: current.amountUsd,
          resolution,
          reasoning: verdict.reasoning,
          resolutionTxHash,
          status: refunded ? 'refunded' : 'completed',
          onChain,
        };
        result.outcomes.push(outcome);
        result.executed += 1;
      } catch (error) {
        result.errors.push({ orderId: order.id, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return Response.json(result);
  } catch (error) {
    console.error('[orders/expire] run failed:', error);
    return Response.json(
      { detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

function clampMax(raw: string | null): number {
  const v = Number(raw ?? DEADLINE_DEFAULT_MAX_PER_RUN);
  if (!Number.isFinite(v) || v < 1) return DEADLINE_DEFAULT_MAX_PER_RUN;
  return Math.min(50, Math.floor(v));
}
