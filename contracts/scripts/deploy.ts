import { network } from "hardhat"

/**
 * Deploys the full PayMate contract suite to the target network
 * (default: `--network goat`, mainnet chain 2345).
 *
 * Env:
 *   PRIVATE_KEY                 — deployer + owner of every contract
 *   USDC_TOKEN                  — real USDC on the target network (required for YieldEscrow)
 *   TREASURY_AI_AGENT           — address granted AI_AGENT_ROLE on PayMateTreasury
 *                                (defaults to the deployer if unset)
 *
 * Prints every deployed address. Wire them into web/.env as:
 *   REPUTATION_CONTRACT, ESCROW_CONTRACT, TREASURY_CONTRACT
 */
async function main() {
  const { ethers } = await network.connect()
  const [deployer] = await ethers.getSigners()
  console.log("Deploying from:", deployer.address)

  const usdcToken = process.env.USDC_TOKEN || ""
  if (!usdcToken) throw new Error("USDC_TOKEN is required (real USDC on the target network)")

  // 1. ERC-8004 Portable Reputation
  const Reputation = await ethers.getContractFactory("PayMateReputation")
  const reputation = await Reputation.deploy()
  await reputation.waitForDeployment()
  console.log("PayMateReputation:", await reputation.getAddress())

  // 2. YieldEscrow (autonomous escrow + AI dispute enforcement)
  const Escrow = await ethers.getContractFactory("YieldEscrow")
  const escrow = await Escrow.deploy(usdcToken)
  await escrow.waitForDeployment()
  console.log("YieldEscrow:", await escrow.getAddress())

  // 3. SSAO Treasury (1% protocol fees + AI-agent Gitcoin routing)
  const aiAgent = process.env.TREASURY_AI_AGENT || deployer.address
  const Treasury = await ethers.getContractFactory("PayMateTreasury")
  const treasury = await Treasury.deploy(deployer.address, aiAgent)
  await treasury.waitForDeployment()
  console.log("PayMateTreasury:", await treasury.getAddress())

  console.log("\nAdd to web/.env:")
  console.log(`REPUTATION_CONTRACT=${await reputation.getAddress()}`)
  console.log(`ESCROW_CONTRACT=${await escrow.getAddress()}`)
  console.log(`TREASURY_CONTRACT=${await treasury.getAddress()}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
