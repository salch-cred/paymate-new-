import { createWalletClient, http, publicActions, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { config } from 'dotenv';

// Load test env
const envConfig = config({ path: './web/.env.test' }).parsed || {};
const pk = envConfig.TEST_PRIVATE_KEY;
if (!pk || !pk.startsWith('0x')) throw new Error("Invalid TEST_PRIVATE_KEY. Make sure it starts with 0x.");

const account = privateKeyToAccount(pk as `0x${string}`);
const client = createWalletClient({
  account,
  chain: base,
  transport: http()
}).extend(publicActions);

async function run() {
  console.log(`Connected wallet: ${account.address} on Base Mainnet`);
  
  // 1. Create Invoice for $15 USD
  console.log("\n1. Creating $15 invoice on paymateagent.xyz...");
  const invRes = await fetch("https://paymateagent.xyz/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      freelancer: account.address,
      client: account.address,
      title: "Test Base Cross-Chain",
      description: "Automated testing from Antigravity",
      amountUsd: 15
    })
  });
  const invData = await invRes.json();
  const invoiceId = invData.invoice.id;
  console.log(`   Created Invoice ID: ${invoiceId}`);

  // 2. Get Custody Address
  console.log("\n2. Fetching ClawUp custody address...");
  const custRes = await fetch("https://paymateagent.xyz/api/clawup/custody");
  const custData = await custRes.json();
  const custodyAddress = custData.address;
  console.log(`   Custody Address: ${custodyAddress}`);

  // 3. Send ETH on Base
  // $15 USD is roughly ~0.0057 ETH right now. 
  // Using 0.007 ETH (~$18) to safely satisfy the backend value check 
  // without burning a full 0.05 ETH (~$130) of your real funds unnecessarily!
  const amountEth = "0.007"; 
  console.log(`\n3. Sending ${amountEth} ETH on Base to ${custodyAddress}...`);
  
  const hash = await client.sendTransaction({
    to: custodyAddress as `0x${string}`,
    value: parseEther(amountEth)
  });
  console.log(`   Transaction sent! Hash: ${hash}`);
  
  console.log("   Waiting for blockchain confirmation...");
  await client.waitForTransactionReceipt({ hash });
  console.log("   Confirmed!");

  // 4. Settle Invoice
  console.log("\n4. Triggering settlement on PayMate backend...");
  const settleRes = await fetch(`https://paymateagent.xyz/api/pay/${invoiceId}/settle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PAYMENT": `CROSSCHAIN_8453_${hash}`
    },
    body: JSON.stringify({})
  });
  
  if (!settleRes.ok) {
    const err = await settleRes.text();
    console.error("   Settlement failed:", settleRes.status, err);
  } else {
    const settleData = await settleRes.json();
    console.log("   Settlement successful! Backend verified the Base transfer.");
    console.log("   Invoice Status:", settleData.invoice.status);
    console.log("   Check it out: https://paymateagent.xyz/pay/" + invoiceId);
  }
}

run().catch(console.error);
