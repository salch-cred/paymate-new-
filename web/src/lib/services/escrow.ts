import { decodeFunctionData, getAddress, isAddress } from 'viem';
import {
  PaymentError,
  getEscrowAddress,
  getPublicClient,
  usdcAmount,
  ERC20_TRANSFER_ABI,
  ensureEscrowRegistered,
  confirmEscrowFunded,
  resolveEscrowOnChain,
  resolveDisputeOnChain,
  mintReputation,
} from '@/lib/chain';
import type { ServiceOrder, OrderResolution } from './types';

export { ensureEscrowRegistered, confirmEscrowFunded, resolveEscrowOnChain, resolveDisputeOnChain, mintReputation, PaymentError };

export const RESOLUTION_TO_ENUM: Record<OrderResolution, number> = {
  PAY_FREELANCER: 0,
  REFUND_CLIENT: 1,
  SPLIT_50_50: 2,
};

/**
 * x402-style payment requirements for a service order. Funds must be sent to
 * the YieldEscrow contract (not the provider directly) so delivery and
 * disputes can be enforced on-chain. Fail-closed without ESCROW_CONTRACT /
 * USDC_TOKEN, matching the invoice escrow path.
 */
export function orderPaymentRequirements(order: ServiceOrder) {
  const usdcToken = process.env.USDC_TOKEN;
  if (!usdcToken || !isAddress(usdcToken)) {
    throw new PaymentError(503, 'USDC_TOKEN is not configured on the API');
  }
  const escrowAddress = getEscrowAddress();
  return {
    x402Version: 1,
    error: 'Payment required',
    accepts: [
      {
        scheme: 'exact',
        network: 'goat',
        asset: getAddress(usdcToken),
        token: getAddress(usdcToken),
        payTo: escrowAddress,
        price: `$${order.amountUsd.toFixed(2)}`,
        maxAmountRequired: usdcAmount(order.amountUsd).toString(),
      },
    ],
  };
}

/**
 * Verifies that the buyer paid the exact order amount into the escrow contract
 * (not to the provider) and returns the real payer address. Fails closed on
 * any mismatch — same security bar as verifyEscrowFunding for invoices.
 */
export async function verifyOrderEscrowFunding(txHash: string, order: ServiceOrder): Promise<{ payer: string }> {
  const publicClient = getPublicClient();
  const usdcToken = process.env.USDC_TOKEN;
  const escrowAddress = getEscrowAddress();
  if (!usdcToken || !isAddress(usdcToken)) {
    throw new PaymentError(503, 'USDC_TOKEN is not configured on the API');
  }

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}`, timeout: 90_000 });
  if (receipt.status !== 'success') throw new PaymentError(402, `Transaction reverted: ${txHash}`);
  const tx = await publicClient.getTransaction({ hash: txHash as `0x${string}` });
  if (!tx.to || getAddress(tx.to) !== getAddress(usdcToken)) {
    throw new PaymentError(402, `Order funding used the wrong token in tx ${txHash}`);
  }
  const { functionName, args } = decodeFunctionData({ abi: ERC20_TRANSFER_ABI, data: tx.input });
  if (functionName !== 'transfer') {
    throw new PaymentError(402, `Transaction ${txHash} is not a transfer`);
  }
  const [recipient, amount] = args as [`0x${string}`, bigint];
  if (getAddress(recipient) !== escrowAddress) {
    throw new PaymentError(402, 'Order funding must be sent to the escrow contract');
  }
  if (amount < usdcAmount(order.amountUsd)) {
    throw new PaymentError(402, `Order funding is short: expected at least ${order.amountUsd} USDC`);
  }
  if (!tx.from) throw new PaymentError(402, 'Could not determine the payer of the order funding transaction');
  return { payer: getAddress(tx.from) };
}
