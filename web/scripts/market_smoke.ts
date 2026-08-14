import { privateKeyToAccount } from 'viem/accounts'

const BASE = process.env.BASE || 'http://localhost:4180'
const provider = privateKeyToAccount(('0x' + 'aa'.repeat(32)) as `0x${string}`)
const buyer = privateKeyToAccount(('0x' + 'bb'.repeat(32)) as `0x${string}`)

let pass = 0
let fail = 0
function check(name: string, cond: boolean, extra = '') {
  if (cond) {
    pass++
    console.log(`  ✅ ${name}`)
  } else {
    fail++
    console.log(`  ❌ ${name} ${extra}`)
  }
}

async function proof(account: ReturnType<typeof privateKeyToAccount>, message: string) {
  const ts = Date.now()
  const signature = await account.signMessage({ message })
  return { message, signature, ts }
}

async function main() {
  // 1. Publish a service (wallet proof required)
  console.log('\n— publish service —')
  const addr = provider.address.toLowerCase()
  const pub = await proof(provider, `PayMate service publish by ${addr} at ${Date.now()}`)
  const publish = await fetch(`${BASE}/api/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Build a landing page',
      description: 'A polished one-page landing with animations and SEO meta.',
      category: 'development',
      price: 120,
      deliveryDays: 5,
      providerName: 'Dev Agent',
      providerAddress: addr,
      providerProof: pub,
      tags: ['landing', 'nextjs'],
    }),
  })
  const publishJson = await publish.json().catch(() => ({}))
  check('publish 201', publish.status === 201, `got ${publish.status}: ${JSON.stringify(publishJson).slice(0, 200)}`)
  const serviceId = publishJson.service?.id
  check('service has id', !!serviceId)

  // 1b. Publish without proof → 401
  const noProof = await fetch(`${BASE}/api/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Imposter service',
      description: 'Should be rejected.',
      category: 'design',
      price: 10,
      deliveryDays: 2,
      providerName: 'Scammer',
      providerAddress: '0x' + 'cc'.repeat(20),
    }),
  })
  check('publish without proof 401', noProof.status === 401, `got ${noProof.status}`)

  // 2. List services
  console.log('\n— list services —')
  const list = await fetch(`${BASE}/api/services`)
  const listJson = await list.json().catch(() => ({}))
  check('list 200', list.status === 200)
  check('new service listed', Array.isArray(listJson.services) && listJson.services.some((s: { id: string }) => s.id === serviceId))

  // 3. Hire (create order)
  console.log('\n— hire —')
  const hire = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceId,
      buyer: buyer.address.toLowerCase(),
      scope: 'Deliver a single-page landing with a hero, features section, and contact form.',
    }),
  })
  const hireJson = await hire.json().catch(() => ({}))
  check('hire 201', hire.status === 201, `got ${hire.status}: ${JSON.stringify(hireJson).slice(0, 200)}`)
  const orderId = hireJson.order?.id
  check('order pending_funding', hireJson.order?.status === 'pending_funding')

  // 4. My orders
  console.log('\n— my orders —')
  const mine = await fetch(`${BASE}/api/orders?wallet=${buyer.address.toLowerCase()}`)
  const mineJson = await mine.json().catch(() => ({}))
  check('orders for buyer contains order', Array.isArray(mineJson.orders) && mineJson.orders.some((o: { id: string }) => o.id === orderId))

  // 5. Order detail → escrow not configured (fail-closed) on this box
  console.log('\n— order detail —')
  const detail = await fetch(`${BASE}/api/orders/${orderId}`)
  check('detail 503 without escrow env', detail.status === 503, `got ${detail.status}`)

  // 6. Fund: wrong caller → 403
  console.log('\n— fund guards —')
  const fundWrong = await fetch(`${BASE}/api/orders/${orderId}/fund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txHash: '0x' + '12'.repeat(32), callerAddress: provider.address.toLowerCase() }),
  })
  check('fund wrong caller 403', fundWrong.status === 403, `got ${fundWrong.status}`)

  // 7. Fund: buyer but no proof → 401
  const fundNoProof = await fetch(`${BASE}/api/orders/${orderId}/fund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txHash: '0x' + '12'.repeat(32), callerAddress: buyer.address.toLowerCase() }),
  })
  check('fund no proof 401', fundNoProof.status === 401, `got ${fundNoProof.status}`)

  // 8. Fund: buyer with valid proof + fake tx → fails at on-chain verification
  const fundProof = await proof(buyer, `PayMate fund order ${orderId} at ${Date.now()}`)
  const fund = await fetch(`${BASE}/api/orders/${orderId}/fund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txHash: '0x' + '12'.repeat(32), callerAddress: buyer.address.toLowerCase(), ...fundProof }),
  })
  const fundJson = await fund.json().catch(() => ({}))
  check('fund fake tx rejected (5xx/4xx, not 201)', fund.status >= 400 && fund.status <= 599, `got ${fund.status}: ${JSON.stringify(fundJson).slice(0, 160)}`)

  // 9. Deliver before funding → 409
  console.log('\n— deliver guard —')
  const deliverEarly = await fetch(`${BASE}/api/orders/${orderId}/deliver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deliverable: 'Here is the landing page.', callerAddress: provider.address.toLowerCase() }),
  })
  check('deliver before funded 409', deliverEarly.status === 409, `got ${deliverEarly.status}`)

  // 10. Market economy snapshot reflects the activity
  console.log('\n— market economy —')
  const snap = await fetch(`${BASE}/api/market-economy`)
  const snapJson = await snap.json().catch(() => ({}))
  check('snapshot 200', snap.status === 200)
  check('snapshot services total 1', snapJson.services?.total === 1, `got ${snapJson.services?.total}`)
  check('snapshot orders total 1', snapJson.orders?.total === 1, `got ${snapJson.orders?.total}`)
  check('snapshot recent feed has order', Array.isArray(snapJson.recent) && snapJson.recent.some((r: { id: string }) => r.id === orderId))

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('smoke test crashed:', e)
  process.exit(1)
})
