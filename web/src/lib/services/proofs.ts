import type { WalletClient } from 'viem';

/** Exact message strings verified by the API routes (keep in sync!). */
export const serviceProofMessage = (providerAddress: string, ts: number) =>
  `PayMate service publish by ${providerAddress} at ${ts}`;
export const fundOrderProofMessage = (orderId: string, ts: number) =>
  `PayMate fund order ${orderId} at ${ts}`;
export const acceptOrderProofMessage = (orderId: string, ts: number) =>
  `PayMate accept order ${orderId} at ${ts}`;
export const disputeOrderProofMessage = (orderId: string, ts: number) =>
  `PayMate dispute order ${orderId} at ${ts}`;

/** Signs the given message with the connected wallet and returns a proof tuple. */
export async function signWalletProof(
  walletClient: WalletClient,
  address: `0x${string}`,
  message: string
): Promise<{ message: string; signature: string; ts: number }> {
  const ts = Date.now();
  const signature = await walletClient.signMessage({ message, account: address });
  return { message, signature, ts };
}
