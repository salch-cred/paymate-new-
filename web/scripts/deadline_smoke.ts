import { isOrderDeadlineExpired, findExpiredOrders, deadlineComplaint, renderDeadlineResolution, DEADLINE_DEFAULT_MAX_PER_RUN } from '../src/lib/services/deadline'
import { hydrateServices, hydrateOrders, addService } from '../src/lib/services/store'
import type { ServiceOrder } from '../src/lib/services/types'

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

const NOW = 1_750_000_000_000
const DAY = 24 * 60 * 60 * 1000
const serviceId = 'svc_deadline_test'
const provider = '0x' + 'aa'.repeat(20)
const buyer = '0x' + 'bb'.repeat(20)

function makeOrder(overrides: Partial<ServiceOrder> = {}): ServiceOrder {
  return {
    id: 'ord_' + Math.random().toString(36).slice(2, 10),
    serviceId,
    serviceTitle: 'Deadline job',
    category: 'development',
    buyer,
    provider,
    amountUsd: 100,
    status: 'funded',
    scope: 'Deliver a landing page.',
    fundTxHash: '0x' + '11'.repeat(32),
    releaseTxHash: null,
    deliverable: null,
    aiVerdict: null,
    dispute: null,
    buyerRating: null,
    providerRating: null,
    buyerReview: null,
    providerReview: null,
    createdAt: NOW - 20 * DAY,
    fundedAt: NOW - 10 * DAY,
    deliveredAt: null,
    completedAt: null,
    ...overrides,
  }
}

async function main() {
  // Seed a 5-day service
  hydrateServices([])
  hydrateOrders([])
  addService({
    title: 'Deadline job',
    description: 'Five-day delivery.',
    category: 'development',
    price: 100,
    deliveryDays: 5,
    provider,
    providerName: 'Test Provider',
    tags: [],
  }, serviceId)

  console.log('\n— isOrderDeadlineExpired —')
  // funded 10 days ago, 5-day deadline, nothing delivered → expired
  check('funded 10d ago with 5d deadline → expired', isOrderDeadlineExpired(makeOrder(), NOW))
  // delivered → not expired
  check('delivered → not expired', !isOrderDeadlineExpired(makeOrder({ deliverable: 'done', status: 'delivered' }), NOW))
  // already ruled → not expired
  check('already ruled → not expired', !isOrderDeadlineExpired(makeOrder({ dispute: { complaint: 'x', resolution: 'REFUND_CLIENT', reasoning: 'y', createdAt: NOW } }), NOW))
  // within deadline → not expired
  check('funded 2d ago with 5d deadline → not expired', !isOrderDeadlineExpired(makeOrder({ fundedAt: NOW - 2 * DAY }), NOW))
  // funded but not yet (fundedAt null) → not expired
  check('fundedAt null → not expired', !isOrderDeadlineExpired(makeOrder({ fundedAt: null, status: 'pending_funding' }), NOW))
  // refunded status → not expired
  check('refunded status → not expired', !isOrderDeadlineExpired(makeOrder({ status: 'refunded' }), NOW))

  console.log('\n— findExpiredOrders (capped, oldest-first) —')
  const expired1 = findExpiredOrders([makeOrder({ id: 'o_new', fundedAt: NOW - 2 * DAY }), makeOrder({ id: 'o_old', fundedAt: NOW - 10 * DAY })], NOW)
  check('only truly expired returned', expired1.length === 1 && expired1[0].id === 'o_old', JSON.stringify(expired1.map(o => o.id)))

  const many = Array.from({ length: 25 }, (_, i) => makeOrder({ id: `o_${i}`, fundedAt: NOW - 10 * DAY - i * DAY }))
  const capped = findExpiredOrders(many, NOW)
  check('capped at default max', capped.length === DEADLINE_DEFAULT_MAX_PER_RUN, `got ${capped.length}`)
  check('oldest first', capped[0].id === 'o_24', capped[0].id)

  const capped2 = findExpiredOrders(many, NOW, 3)
  check('custom max honored', capped2.length === 3)

  console.log('\n— deadlineComplaint —')
  const complaint = deadlineComplaint(makeOrder())
  check('mentions automated enforcement', complaint.includes('AUTOMATED DEADLINE ENFORCEMENT'))
  check('mentions refund default', complaint.toLowerCase().includes('refund'))

  console.log('\n— renderDeadlineResolution (fail-closed) —')
  const noMistral = await awaitRender(makeOrder(), false, false)
  check('no Mistral → REFUND_CLIENT', noMistral.resolution === 'REFUND_CLIENT')
  check('no Mistral → refund reasoning', noMistral.reasoning.includes('fail-closed'))

  const aiRefund = await awaitRender(makeOrder(), true, true)
  check('AI says refund → honored', aiRefund.resolution === 'REFUND_CLIENT')

  const aiFails = await awaitRender(makeOrder(), true, true, true)
  check('AI throws → fail-closed REFUND_CLIENT', aiFails.resolution === 'REFUND_CLIENT', JSON.stringify(aiFails))

  console.log(`\ndeadline_smoke: ${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

async function awaitRender(order: ServiceOrder, mistral: boolean, aiRefunds: boolean, aiThrows = false) {
  const arbitrate = async () => {
    if (aiThrows) throw new Error('arbitrator down')
    return aiRefunds
      ? { resolution: 'REFUND_CLIENT' as const, reasoning: 'nothing delivered' }
      : { resolution: 'PAY_FREELANCER' as const, reasoning: 'partial work shipped' }
  }
  return renderDeadlineResolution(order, arbitrate, () => mistral)
}

main()
