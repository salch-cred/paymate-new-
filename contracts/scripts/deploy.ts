import { network } from "hardhat"

async function main() {
  const { ethers } = await network.connect()
  const C = await ethers.getContractFactory("PayMateReputation")
  const c = await C.deploy()
  await c.waitForDeployment()
  console.log("PayMateReputation deployed to:", await c.getAddress())
}
main().catch((e) => { console.error(e); process.exit(1) })
