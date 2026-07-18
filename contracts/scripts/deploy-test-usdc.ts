import { network } from "hardhat"

async function main() {
  const { ethers } = await network.connect()
  const initialSupply = 1_000_000n * 10n ** 6n // 1,000,000.00 pmUSDC
  const C = await ethers.getContractFactory("TestUSDC")
  const c = await C.deploy(initialSupply)
  await c.waitForDeployment()
  const address = await c.getAddress()
  const [deployer] = await ethers.getSigners()
  console.log("TestUSDC deployed to:", address)
  console.log("Minted", (initialSupply / 10n ** 6n).toString(), "pmUSDC to", deployer.address)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
