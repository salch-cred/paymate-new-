import { verifyTypedData, getAddress } from "viem";

export const DOMAIN = {
  name: "PayMate",
  version: "1",
  chainId: 2345, // GOAT Network (mainnet)
  verifyingContract: "0x0000000000000000000000000000000000000000" as `0x${string}`,
};

export const INVOICE_TYPES = {
  Invoice: [
    { name: "freelancer", type: "address" },
    { name: "client", type: "address" },
    { name: "amountUsd", type: "uint256" },
  ],
};

/** EIP-712 payload the client signs once to authorize a streaming invoice. */
export const STREAM_ALLOWANCE_TYPES = {
  StreamAllowance: [
    { name: "invoiceId", type: "string" },
    { name: "maxAmountUsd", type: "uint256" },
  ],
} as const;

export async function verifyStreamAllowance(
  signature: `0x${string}`,
  expectedSigner: string,
  invoiceId: string,
  maxAmountUsd: number
): Promise<boolean> {
  try {
    return await verifyTypedData({
      domain: DOMAIN,
      types: STREAM_ALLOWANCE_TYPES,
      primaryType: "StreamAllowance",
      message: {
        invoiceId,
        maxAmountUsd: BigInt(Math.round(maxAmountUsd)),
      },
      address: getAddress(expectedSigner),
      signature,
    });
  } catch (error) {
    console.error("Stream allowance verification failed:", error);
    return false;
  }
}

export async function verifyInvoiceSignature(
  freelancer: string,
  client: string,
  amountUsd: number,
  signature: `0x${string}`,
  expectedSigner: string
): Promise<boolean> {
  try {
    const valid = await verifyTypedData({
      domain: DOMAIN,
      types: INVOICE_TYPES,
      primaryType: "Invoice",
      message: {
        freelancer: getAddress(freelancer),
        client: getAddress(client),
        amountUsd: BigInt(Math.round(amountUsd)),
      },
      address: getAddress(expectedSigner),
      signature,
    });
    return valid;
  } catch (error) {
    console.error("Signature verification failed:", error);
    return false;
  }
}
