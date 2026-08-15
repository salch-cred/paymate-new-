import { shouldAutoRelease, autoReleaseReason } from '../src/lib/services/ai'

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

function verdict(verdict: 'complete' | 'incomplete' | 'ambiguous', confidence: number) {
  return { verdict, confidence, reasoning: 'test' }
}

function main() {
  console.log('\n— auto-release decision (defaults: on, threshold 0.75) —')

  // 1. High-confidence complete → auto-release
  check('complete @ 0.95 auto-releases', shouldAutoRelease(verdict('complete', 0.95)) === true)
  // 2. Complete exactly at threshold → auto-release (>= floor)
  check('complete @ 0.75 auto-releases (>= floor)', shouldAutoRelease(verdict('complete', 0.75)) === true)
  // 3. Complete below threshold → no auto-release
  check('complete @ 0.5 does NOT auto-release', shouldAutoRelease(verdict('complete', 0.5)) === false)
  // 4. Incomplete → never auto-releases
  check('incomplete @ 0.99 does NOT auto-release', shouldAutoRelease(verdict('incomplete', 0.99)) === false)
  // 5. Ambiguous → never auto-releases (buyer keeps control)
  check('ambiguous @ 0.99 does NOT auto-release', shouldAutoRelease(verdict('ambiguous', 0.99)) === false)
  // 6. Null verdict → fail closed
  check('null verdict does NOT auto-release', shouldAutoRelease(null) === false)
  // 7. ORDER_AUTO_RELEASE=off disables even high-confidence passes
  process.env.ORDER_AUTO_RELEASE = 'off'
  check('ORDER_AUTO_RELEASE=off blocks complete @ 0.99', shouldAutoRelease(verdict('complete', 0.99)) === false)
  delete process.env.ORDER_AUTO_RELEASE
  // 8. Custom threshold: 0.9
  process.env.ORDER_AUTO_RELEASE_CONFIDENCE = '0.9'
  check('threshold 0.9: 0.85 does NOT auto-release', shouldAutoRelease(verdict('complete', 0.85)) === false)
  check('threshold 0.9: 0.95 auto-releases', shouldAutoRelease(verdict('complete', 0.95)) === true)
  delete process.env.ORDER_AUTO_RELEASE_CONFIDENCE
  // 9. Garbage threshold falls back to 0.75
  process.env.ORDER_AUTO_RELEASE_CONFIDENCE = 'not-a-number'
  check('garbage threshold falls back to 0.75 (0.8 passes)', shouldAutoRelease(verdict('complete', 0.8)) === true)
  check('garbage threshold falls back to 0.75 (0.5 blocked)', shouldAutoRelease(verdict('complete', 0.5)) === false)
  delete process.env.ORDER_AUTO_RELEASE_CONFIDENCE
  // 10. Reason string is informative
  const reason = autoReleaseReason(verdict('complete', 0.95))
  check('reason mentions confidence', reason.includes('95%'), reason)

  console.log(`\nauto_release_smoke: ${pass} passed, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main()
