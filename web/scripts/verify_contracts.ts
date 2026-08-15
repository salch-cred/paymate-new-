/**
 * Verifies the deployed PayMate contracts on GOAT mainnet (chain 2345).
 *
 * Run with the same env as the app (web/.env or exported vars):
 *   RPC_GOAT_MAINNET, ESCROW_CONTRACT, REPUTATION_CONTRACT, TREASURY_CONTRACT, USDC_TOKEN
 *
 * Checks per contract:
 *   1. The address has deployed bytecode (is a contract, not EOA / not empty).
 *   2. A read call that matches our backend ABI succeeds (interface sanity).
 *
 * Usage:
 *   npx tsx scripts/verify_contracts.ts
 */
import { createPublicClient, http, getAddress, isAddress } from "viem";
import { goat } from "viem/chains";

const RPC_URL = process.env.RPC_GOAT_MAINNET || goat.rpcUrls.default.http[0];

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name} ${extra}`);
  }
}

const ESCROW_ABI = [
  { type: "function", name: "getEscrow", stateMutability: "view", inputs: [{ name: "invoiceId", type: "string" }], outputs: [{ name: "", type: "tuple", components: [
    { name: "client", type: "address" }, { name: "freelancer", type: "address" }, { name: "principalAmount", type: "uint256" },
    { name: "maturesAt", type: "uint256" }, { name: "funded", type: "bool" }, { name: "isResolved", type: "bool" },
  ] }] },
] as const;

const REPUTATION_ABI = [
  { type: "function", name: "getReputation", stateMutability: "view", inputs: [{ name: "freelancer", type: "address" }], outputs: [{ name: "", type: "tuple", components: [
    { name: "jobsCompleted", type: "uint256" }, { name: "totalEarnedUsd", type: "uint256" }, { name: "score", type: "uint256" },
  ] }] },
] as const;

const ERC20_ABI = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
] as const;

async function hasCode(client: ReturnType<typeof createPublicClient>, address: `0x${string}`): Promise<boolean> {
  try {
    const code = await client.getCode({ address });
    return !!code && code.length > 2;
  } catch {
    return false;
  }
}

async function main() {
  const client = createPublicClient({ chain: goat, transport: http(RPC_URL) });
  console.log(`Verifying on GOAT mainnet (${goat.id}) via ${RPC_URL}\n`);

  const escrow = process.env.ESCROW_CONTRACT || "";
  const reputation = process.env.REPUTATION_CONTRACT || "";
  const treasury = process.env.TREASURY_CONTRACT || "";
  const usdc = process.env.USDC_TOKEN || "";

  // --- USDC ---
  console.log("— USDC_TOKEN —");
  if (isAddress(usdc)) {
    check("address is valid", true);
    check("has deployed bytecode", await hasCode(client, getAddress(usdc)));
    if (await hasCode(client, getAddress(usdc))) {
      try {
        const [symbol, decimals] = await Promise.all([
          client.readContract({ address: getAddress(usdc), abi: ERC20_ABI, functionName: "symbol" }),
          client.readContract({ address: getAddress(usdc), abi: ERC20_ABI, functionName: "decimals" }),
        ]);
        check(`ERC20 read OK: symbol=${symbol}, decimals=${decimals}`, true, `(expect USDC / 6)`);
      } catch (e) {
        check("ERC20 read", false, String(e));
      }
    }
  } else {
    check("address is valid", false, "ESCROW needs USDC_TOKEN set — set it to the real bridged USDC on GOAT");
  }

  // --- YieldEscrow ---
  console.log("\n— ESCROW_CONTRACT (YieldEscrow) —");
  if (isAddress(escrow)) {
    check("address is valid", true);
    check("has deployed bytecode", await hasCode(client, getAddress(escrow)));
    if (await hasCode(client, getAddress(escrow))) {
      try {
        const result = await client.readContract({
          address: getAddress(escrow),
          abi: ESCROW_ABI,
          functionName: "getEscrow",
          args: ["verify_probe"],
        });
        const isZero = result.client === "0x0000000000000000000000000000000000000000";
        check(`getEscrow read OK (unknown id → zero client: ${isZero})`, true);
      } catch (e) {
        check("getEscrow read (ABI match)", false, String(e));
      }
    }
  } else {
    check("ESCROW_CONTRACT not set", false, "→ the marketplace order funding + auto-release + GitHub escrow all fail closed (503) until this is deployed and wired");
  }

  // --- PayMateReputation ---
  console.log("\n— REPUTATION_CONTRACT (PayMateReputation) —");
  if (isAddress(reputation)) {
    check("address is valid", true);
    check("has deployed bytecode", await hasCode(client, getAddress(reputation)));
    if (await hasCode(client, getAddress(reputation))) {
      try {
        const result = await client.readContract({
          address: getAddress(reputation),
          abi: REPUTATION_ABI,
          functionName: "getReputation",
          args: ["0x0000000000000000000000000000000000000001"],
        });
        check(`getReputation read OK: jobs=${result.jobsCompleted}, earned=${result.totalEarnedUsd}`, true);
      } catch (e) {
        check("getReputation read (ABI match)", false, String(e));
      }
    }
  } else {
    check("REPUTATION_CONTRACT not set", false, "→ reputation minting is skipped (best-effort, payments still work)");
  }

  // --- PayMateTreasury ---
  console.log("\n— TREASURY_CONTRACT (PayMateTreasury) —");
  if (isAddress(treasury)) {
    check("address is valid", true);
    check("has deployed bytecode", await hasCode(client, getAddress(treasury)));
  } else {
    check("TREASURY_CONTRACT not set", false, "→ fees are tracked in Postgres until this is wired (non-blocking)");
  }

  console.log(`\nverify_contracts: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
