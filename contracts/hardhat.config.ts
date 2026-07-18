import { HardhatUserConfig } from "hardhat/config"
import ethersPlugin from "@nomicfoundation/hardhat-ethers"
import "dotenv/config"

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  plugins: [ethersPlugin],
  networks: {
    metisTestnet: {
      type: "http",
      url: process.env.RPC_METIS_TESTNET || "https://sepolia.metisdevops.link",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
}
export default config
