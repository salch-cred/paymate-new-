import { HardhatUserConfig } from "hardhat/config"
import ethersPlugin from "@nomicfoundation/hardhat-ethers"
import "dotenv/config"

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  plugins: [ethersPlugin],
  networks: {
    goatTestnet3: {
      type: "http",
      url: process.env.RPC_GOAT_TESTNET || "https://rpc.testnet3.goat.network",
      chainId: 48816,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
}
export default config
