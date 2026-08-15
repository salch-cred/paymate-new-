import { mistralJsonText, parseJsonResponse } from '@/lib/mistral';
import type { ServiceOrder, AiVerdict, OrderResolution } from './types';

const VERDICTS: AiVerdict['verdict'][] = ['complete', 'incomplete', 'ambiguous'];
const RESOLUTIONS: OrderResolution[] = ['PAY_FREELANCER', 'REFUND_CLIENT', 'SPLIT_50_50'];

function hasMistralKey(): boolean {
  return !!process.env.MISTRAL_API_KEY;
}

/**
 * Auto-release gate for the escrow-protected jobs rail. When the AI verifier
 * returns a high-confidence "complete" verdict, the escrow auto-releases to the
 * provider — no buyer signature needed. Controlled by:
 *   - ORDER_AUTO_RELEASE          (default "on")
 *   - ORDER_AUTO_RELEASE_CONFIDENCE (default 0.75)
 * Fail-closed: auto-release only ever happens on an explicit "complete" verdict
 * at or above the confidence floor; anything ambiguous stays on the manual
 * accept path so the buyer keeps control.
 */
export function shouldAutoRelease(verdict: AiVerdict | null): boolean {
  if (!verdict) return false;
  if ((process.env.ORDER_AUTO_RELEASE ?? 'on') !== 'on') return false;
  if (verdict.verdict !== 'complete') return false;
  const floor = Number(process.env.ORDER_AUTO_RELEASE_CONFIDENCE ?? '0.75');
  const threshold = Number.isFinite(floor) ? Math.min(1, Math.max(0, floor)) : 0.75;
  return verdict.confidence >= threshold;
}

/** Human-readable note appended to the order when escrow auto-releases. */
export function autoReleaseReason(verdict: AiVerdict): string {
  return `AI verifier scored the delivery ${verdict.verdict} at ${Math.round(verdict.confidence * 100)}% confidence (threshold ${Math.round((Number(process.env.ORDER_AUTO_RELEASE_CONFIDENCE ?? '0.75')) * 100)}%) — escrow auto-released to the provider.`;
}

/**
 * AI verification of a delivered engagement: the model checks the provider's
 * deliverable against the agreed scope + the service description and returns a
 * verdict + confidence. The buyer sees this recommendation before accepting or
 * disputing; the dispute route turns it into a binding on-chain resolution.
 *
 * Degrades gracefully: without MISTRAL_API_KEY the API returns a neutral
 * "ambiguous" verdict at zero confidence so the marketplace still functions in
 * demo environments (the buyer's explicit accept/refuse is what moves funds).
 */
export async function verifyDeliverable(order: ServiceOrder, deliverable: string): Promise<AiVerdict> {
  if (!hasMistralKey()) {
    return {
      verdict: 'ambiguous',
      confidence: 0,
      reasoning: 'AI verifier not configured (MISTRAL_API_KEY missing) — buyer acceptance is required to release escrow.',
    };
  }
  const systemPrompt = `You are the AI Delivery Verifier for the PayMate services marketplace.
A provider has delivered work for a paid engagement. Verify the delivery against the agreed scope.

Service: "${order.serviceTitle}"
Agreed scope: "${order.scope}"
Price: $${order.amountUsd} USDC
Provider's delivery notes: "${deliverable.slice(0, 3000)}"

Your task:
1. Check whether the delivery plausibly satisfies the agreed scope.
2. Look for obvious signs of non-delivery (empty/missing work, refusal, off-scope output).
3. Return a verdict and a confidence score.

Output ONLY a valid JSON object matching this schema:
{
  "verdict": "complete" | "incomplete" | "ambiguous",
  "confidence": 0.0 to 1.0,
  "reasoning": "Concise, specific explanation referencing the scope and the delivery."
}`;

  try {
    const text = await mistralJsonText({ messages: [{ role: 'user', content: systemPrompt }], model: 'mistral-large-latest' });
    const parsed = parseJsonResponse(text) as Partial<{ verdict: string; confidence: number; reasoning: string }>;
    const verdict = VERDICTS.includes(parsed.verdict as AiVerdict['verdict']) ? (parsed.verdict as AiVerdict['verdict']) : 'ambiguous';
    const confidence = typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0;
    const reasoning = typeof parsed.reasoning === 'string' && parsed.reasoning.trim() ? parsed.reasoning.trim() : 'No detailed reasoning provided.';
    return { verdict, confidence, reasoning };
  } catch (error) {
    console.error('[services/ai] verifyDeliverable failed:', error);
    return {
      verdict: 'ambiguous',
      confidence: 0,
      reasoning: 'AI verifier could not be reached — buyer acceptance is required to release escrow.',
    };
  }
}

/**
 * Binding AI arbitration for a disputed order. Mirrors the invoice arbitrator:
 * the model reviews the scope + dispute and renders PAY_FREELANCER /
 * REFUND_CLIENT / SPLIT_50_50, which the caller enforces on-chain through the
 * escrow contract.
 */
export async function arbitrateOrder(order: ServiceOrder, complaint: string): Promise<{ resolution: OrderResolution; reasoning: string }> {
  const systemPrompt = `You are the Supreme AI Arbitrator for the PayMate services marketplace escrow protocol.
A dispute has been raised on a paid engagement. Act as an impartial judge and decide who should receive the escrowed USDC.

Case Details:
Service: "${order.serviceTitle}"
Agreed scope of work: "${order.scope}"
Engagement amount: $${order.amountUsd} USDC
Buyer wallet: ${order.buyer}
Provider wallet: ${order.provider}
Provider's delivery notes: "${(order.deliverable || '').slice(0, 3000)}"
Dispute conversation (complaint / evidence, in order): "${complaint.slice(0, 4000)}"

Your task:
1. Analyze the agreed scope of work.
2. Evaluate the delivery and the dispute for evidence the work was or was not delivered as agreed.
3. Render a final, binding verdict.

Output ONLY a valid JSON object matching this schema:
{
  "resolution": "PAY_FREELANCER" | "REFUND_CLIENT" | "SPLIT_50_50",
  "reasoning": "Concise, specific explanation referencing the scope, the delivery, and the dispute."
}`;

  const text = await mistralJsonText({ messages: [{ role: 'user', content: systemPrompt }], model: 'mistral-large-latest' });
  const parsed = parseJsonResponse(text) as Partial<{ resolution: string; reasoning: string }>;
  const resolution = RESOLUTIONS.includes(parsed.resolution as OrderResolution)
    ? (parsed.resolution as OrderResolution)
    : 'SPLIT_50_50'; // fail safe to the most neutral outcome
  const reasoning = typeof parsed.reasoning === 'string' && parsed.reasoning.trim()
    ? parsed.reasoning.trim()
    : 'The arbitrator did not provide detailed reasoning.';
  return { resolution, reasoning };
}
