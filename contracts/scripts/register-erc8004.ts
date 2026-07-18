import { network } from "hardhat"

const REGISTRY_ABI = [
  "function register(string name) external",
  "function getAgentWallet(uint256) view returns (address)",
]

const EXPLORERS: Record<string, string> = {
  goatTestnet3: "https://explorer.testnet3.goat.network",
  goat: "https://explorer.goat.network",
}

async function main() {
  const registryAddress = process.env.REGISTRY_CONTRACT
  const agentName = process.env.AGENT_NAME
  const agentUri = process.env.AGENT_URI
  if (!registryAddress) throw new Error("Set REGISTRY_CONTRACT in contracts/.env")
  if (!agentName) throw new Error("Set AGENT_NAME in contracts/.env")
  if (!agentUri) throw new Error("Set AGENT_URI in contracts/.env")

  const connection = await network.connect()
  const { ethers } = connection
  const [signer] = await ethers.getSigners()
  if (!signer) throw new Error("No signer available — set PRIVATE_KEY in contracts/.env")
  const registry = new ethers.Contract(registryAddress, REGISTRY_ABI, signer)

  console.log("ERC-8004 registration plan")
  console.log("  network:       ", connection.networkName)
  console.log("  registry:      ", registryAddress)
  console.log("  agent name:    ", agentName)
  console.log("  agent URI:     ", agentUri)
  console.log("  signer wallet: ", await signer.getAddress())

  if (process.env.CONFIRM_REGISTER !== "yes") {
    console.log("\nDry run only — no transaction sent.")
    console.log("Re-run with CONFIRM_REGISTER=yes to broadcast this registration.")
    return
  }

  const tx = await registry.register(agentName)
  console.log("\nSubmitted:", tx.hash)
  const receipt = await tx.wait()
  if (!receipt || receipt.status !== 1) throw new Error("Registration transaction reverted")

  const transferTopic = ethers.id("Transfer(address,address,uint256)")
  const transferLog = receipt.logs.find((log) => log.topics[0] === transferTopic)
  const agentId = transferLog ? BigInt(transferLog.topics[3]).toString() : null

  let verifiedWallet: string | null = null
  if (agentId) {
    verifiedWallet = await registry.getAgentWallet(agentId)
  }

  const explorer = EXPLORERS[connection.networkName]
  console.log("\nRegistration complete")
  console.log("  tx hash:   ", receipt.hash)
  if (explorer) console.log("  explorer:  ", `${explorer}/tx/${receipt.hash}`)
  console.log("  agent id:  ", agentId ?? "(could not parse Transfer log)")
  console.log("  wallet:    ", verifiedWallet ?? "(unverified)")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
