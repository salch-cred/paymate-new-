import { verifyTypedData, getAddress } from "viem";

export const DOMAIN = {
  name: "PayMate",
  version: "1",
  chainId: 48816, // GOAT Testnet3
  verifyingContract: "0x0000000000000000000000000000000000000000" as `0x${string}`,
};

export const INVOICE_TYPES = {
  Invoice: [
    { name: "freelancer", type: "address" },
    { name: "client", type: "address" },
    { name: "amountUsd", type: "uint256" },
  ],
};

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
