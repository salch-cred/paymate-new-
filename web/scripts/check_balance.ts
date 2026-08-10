import { createPublicClient, http, formatEther } from 'viem';
import { defineChain } from 'viem';

const goatMainnet = defineChain({
  id: 2345,
  name: 'GOAT Mainnet',
  network: 'goat-mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Bitcoin',
    symbol: 'BTC',
  },
  rpcUrls: {
    default: { http: ['https://rpc.goat.network'] },
    public: { http: ['https://rpc.goat.network'] },
  },
});

const client = createPublicClient({
  chain: goatMainnet,
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
