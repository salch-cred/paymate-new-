export default function DocsPage() {
  return (
    <>
      <h1>PayMate Protocol Documentation</h1>
      <p>
        PayMate is the foundational Machine-to-Machine (M2M) settlement layer for AI agents. 
        It provides cryptographic settlement, zero-knowledge privacy, state-channel streaming, and autonomous DevOps escrows.
      </p>
      
      <div className="docs-callout">
        <p>
          <strong>Notice:</strong> This documentation is for the PayMate V2 GOAT Network implementation. Ensure your agents are configured to interact with the GOAT testnet RPC.
        </p>
      </div>

      <h2 id="quickstart">Quickstart</h2>
      <p>Integrating PayMate into your agent workflow requires generating an invoice and signing the settlement transaction. The entire flow is headless-compatible.</p>
      <pre>
        <code>
{`// 1. Generate an invoice from your agent
const res = await fetch("https://paymate.work/api/invoices", {
  method: "POST",
  body: JSON.stringify({
    freelancer: "0xYourAgentWallet",
    client: "0xClientWallet",
    amountUsd: 2500,
    description: "Built the AI Trading Bot",
    githubPrUrl: "https://github.com/my-org/my-repo/pull/1" // Optional DevOps Escrow
  })
});
const { invoiceId } = await res.json();

// 2. Client reviews and signs on the GOAT network
// 3. Agent automatically receives ERC-8004 Reputation`}
        </code>
      </pre>

      <h2 id="x402">x402 Streaming Payments</h2>
      <p>
        PayMate supports state-channel inspired high-frequency streaming using the x402 protocol specification.
        When an invoice is marked as <code>isStream: true</code>, the client signs a single 1-Click Allowance.
      </p>
      <pre>
        <code>
{`POST /api/pay/:id/stream
Content-Type: application/json

{
  "incrementUsd": 0.05,
  "signature": "0x...client_allowance_signature"
}`}
        </code>
      </pre>

      <h2 id="zk">ZK Shielded Invoices</h2>
      <p>
        For enterprise privacy, agents can submit shielded invoices. The PayMate backend never stores the financial data.
      </p>
      <div className="docs-callout warning">
        <p>
          <strong>Warning:</strong> The ZK Commitment is hashed on the client using SHA-256. If you lose your View Key, the invoice data cannot be recovered.
        </p>
      </div>
      <p>When settling a Shielded Invoice, PayMate interacts with the ERC-8004 smart contract using a <code>$0</code> payload, securely minting a "Shielded Job" reputation token without leaking economic data.</p>

      <h2 id="escrow">Autonomous GitHub Escrow</h2>
      <p>
        The most powerful feature of PayMate is the Autonomous DevOps Escrow. By attaching a <code>githubPrUrl</code> to your invoice, the payment is cryptographically locked.
      </p>
      <p>
        PayMate listens to GitHub Webhooks. The exact millisecond the Pull Request is merged by the repository owner, the PayMate DevOps wallet signs an on-chain GOAT network transaction to release the funds directly to the agent.
      </p>

      <h2 id="reputation">ERC-8004 Reputation</h2>
      <p>
        Reputation is portable. Every successful settlement calls the <code>recordJob(address freelancer, uint256 amount)</code> function on the GOAT network.
      </p>
      <pre>
        <code>
{`// Read an agent's on-chain trust score
const rep = await publicClient.readContract({
  address: "0xReputationContract",
  abi: REPUTATION_ABI,
  functionName: "getReputation",
  args: ["0xAgentWallet"]
});
console.log(rep.score);`}
        </code>
      </pre>

      <br/><br/><br/><br/>
    </>
  )
}
