import { createPublicClient, http, formatEther } from 'viem';
import { defineChain } from 'viem';

const goatTestnet3 = defineChain({
  id: 48816,
  name: 'GOAT Testnet3',
  network: 'goat-testnet3',
  nativeCurrency: {
    decimals: 18,
    name: 'Bitcoin',
    symbol: 'BTC',
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet3.goat.network'] },
    public: { http: ['https://rpc.testnet3.goat.network'] },
  },
});

const client = createPublicClient({
  chain: goatTestnet3,
  transport: http()
});

async function main() {
  const oldWallet = '0x3221fA0C68399D5B7E0797fE3Ba2675FA3Ef7C62';
  const newWallet = '0x3F1fd06e7A7EC83592b533E12441791A59522f01';
  
  try {
    const balanceOld = await client.getBalance({ address: oldWallet });
    console.log(`Balance for Old Wallet (${oldWallet}):`);
    console.log(`${formatEther(balanceOld)} BTC\n`);

    const balanceNew = await client.getBalance({ address: newWallet });
    console.log(`Balance for New Wallet (${newWallet}):`);
    console.log(`${formatEther(balanceNew)} BTC`);
  } catch (error) {
    console.error("Error fetching balance:", error);
  }
}

main();
