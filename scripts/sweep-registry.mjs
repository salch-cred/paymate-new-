// Read-only sweep of the ERC-8004 agent registry on GOAT mainnet.
// Collects agent id + name + url for registered agents in a range.
const RPC = process.env.REG_RPC ?? "https://rpc.goat.network";
const REG = process.env.REG_ADDR ?? "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const TOKEN_URI = "0xc87b56dd"; // tokenURI(uint256)
const OWNER = "0x6352211e";     // ownerOf(uint256)

function pad32(n) { return n.toString(16).padStart(64, "0"); }

async function call(data) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: REG, data }, "latest"] }),
  });
  return res.json();
}

function decodeString(resultHex) {
  const bytes = Buffer.from(resultHex.slice(2), "hex");
  const len = parseInt(bytes.subarray(32, 64).toString("hex"), 16);
  const str = bytes.subarray(64, 64 + len).toString();
  return str;
}

async function fetchJson(uri) {
  if (uri.startsWith("data:application/json;base64,")) {
    return JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString());
  }
  if (uri.startsWith("data:")) return null;
  const url = uri.startsWith("ipfs://") ? "https://ipfs.io/ipfs/" + uri.slice(7) : uri;
  if (!url.startsWith("http")) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function readAgent(id) {
  const uriRes = await call(TOKEN_URI + pad32(id));
  if (uriRes.error) return null; // not minted / no URI
  try {
    const uri = decodeString(uriRes.result);
    let meta = null;
    try {
      meta = await fetchJson(uri);
    } catch {}
    const ownerRes = await call(OWNER + pad32(id));
    return {
      id,
      name: meta?.name ?? "",
      url: meta?.url ?? "",
      desc: (meta?.description ?? "").slice(0, 90),
      owner: ownerRes.result ? "0x" + ownerRes.result.slice(26) : "",
    };
  } catch {
    return { id, name: "(undecodable)", url: "", desc: "", owner: "" };
  }
}

const START = Number(process.argv[2] ?? 1);
const END = Number(process.argv[3] ?? 400);
const CONCURRENCY = 24;

const ids = [];
for (let i = START; i <= END; i++) ids.push(i);

const out = [];
let cursor = 0;
async function worker() {
  while (cursor < ids.length) {
    const id = ids[cursor++];
    const a = await readAgent(id);
    if (a) out.push(a);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
out.sort((a, b) => a.id - b.id);
for (const a of out) {
  console.log(`${String(a.id).padStart(4)} | ${(a.name || "").padEnd(32)} | ${a.url} | ${a.owner} | ${a.desc}`);
}
console.log(`\nTotal registered (with URI) in range ${START}-${END}: ${out.length}`);
