// Analytics double-fire regression — one signup must fire CompleteRegistration
// (Pixel) + sign_up (GA4) exactly once, even when the signup path is
// triggered twice (double tap, double effect, queue flush + direct fire).
// A different account signing up later in the same page load still fires.
// Run: node tests/analytics-doublefire.test.mjs
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const pages = read('src/pages.tsx')
const analyticsSrc = read('src/analytics.ts')

const outDir = mkdtempSync(join(tmpdir(), 'picall-doublefire-test-'))
const analyticsFile = join(outDir, 'analytics.mjs')
await build({
  entryPoints: [join(root, 'src/analytics.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: analyticsFile,
  logLevel: 'silent',
})
const A = await import(analyticsFile)

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

const IDS = { pixelId: '111', ga4Id: 'G-222', clarityId: '' }
function makeFake() {
  const win = {}
  const doc = { head: { appendChild() {} }, createElement() { return { async: false, src: '' } } }
  return { target: { document: doc, window: win }, win }
}
const count = (f) => ({
  pixel: (f.win.fbq?.queue ?? []).filter((a) => a[1] === 'CompleteRegistration').length,
  ga4: (f.win.dataLayer ?? []).filter((a) => a[1] === 'sign_up').length,
})
// noteSignup as in src/pages.tsx: init first, then trackSignup with the key.
const noteSignup = (method, key, f) => {
  A.initAnalytics(IDS, f.target)
  A.trackSignup(method, f.target, key)
}

console.log('Analytics double-fire tests:')

check('normal flow, IDs present: one signup fires exactly once', () => {
  A.resetAnalyticsForTests()
  const f = makeFake()
  A.initAnalytics(IDS, f.target)
  noteSignup('google', 'google:a@x.com', f)
  assert.deepEqual(count(f), { pixel: 1, ga4: 1 })
})

check('IDs late: queued signup flushed once by the next init', () => {
  A.resetAnalyticsForTests()
  const f = makeFake()
  A.trackSignup('google', f.target, 'google:a@x.com')
  A.initAnalytics(IDS, f.target)
  assert.deepEqual(count(f), { pixel: 1, ga4: 1 })
})

check('REGRESSION double trigger, same signup: trackSignup x2 fires once', () => {
  A.resetAnalyticsForTests()
  const f = makeFake()
  A.initAnalytics(IDS, f.target)
  A.trackSignup('google', f.target, 'google:a@x.com')
  A.trackSignup('google', f.target, 'google:a@x.com')
  assert.deepEqual(count(f), { pixel: 1, ga4: 1 })
})

check('REGRESSION queue double: same signup queued twice, flushed once', () => {
  A.resetAnalyticsForTests()
  const f = makeFake()
  A.trackSignup('google', f.target, 'google:a@x.com')
  A.trackSignup('google', f.target, 'google:a@x.com')
  A.initAnalytics(IDS, f.target)
  assert.deepEqual(count(f), { pixel: 1, ga4: 1 })
})

check('REGRESSION queue flush + direct fire, same signup: fires once', () => {
  A.resetAnalyticsForTests()
  const f = makeFake()
  A.trackSignup('google', f.target, 'google:a@x.com')
  A.initAnalytics(IDS, f.target) // store effect flushes the queue
  A.trackSignup('google', f.target, 'google:a@x.com') // same signup again
  assert.deepEqual(count(f), { pixel: 1, ga4: 1 })
})

check('REGRESSION noteSignup x2 (double tap / double effect): fires once', () => {
  A.resetAnalyticsForTests()
  const f = makeFake()
  noteSignup('sms_otp', 'phone:01700000000', f)
  noteSignup('sms_otp', 'phone:01700000000', f)
  assert.deepEqual(count(f), { pixel: 1, ga4: 1 })
})

check('two different accounts in one page load: both fire', () => {
  A.resetAnalyticsForTests()
  const f = makeFake()
  A.initAnalytics(IDS, f.target)
  A.trackSignup('google', f.target, 'google:a@x.com')
  A.trackSignup('google', f.target, 'google:b@x.com')
  assert.deepEqual(count(f), { pixel: 2, ga4: 2 })
})

check('two different methods, different accounts: both fire', () => {
  A.resetAnalyticsForTests()
  const f = makeFake()
  A.initAnalytics(IDS, f.target)
  A.trackSignup('google', f.target, 'google:a@x.com')
  A.trackSignup('sms_otp', f.target, 'phone:01700000000')
  assert.deepEqual(count(f), { pixel: 2, ga4: 2 })
})

check('LoginPage: every signup path passes an account-identity key', () => {
  // মালিকের সিদ্ধান্ত ২০২৬-১১-২৪: Email Link ও Email OTP লগইন পেজ থেকে গেছে —
  // এই পেজে শুধু google + password সাইন-আপ রিপোর্ট থাকে।
  assert.ok(!pages.includes("noteSignup('email_link'"), 'email_link সাইন-আপ এখনো লগইন পেজে আছে')
  assert.ok(pages.includes("noteSignup('google', 'google:' + u.email.toLowerCase())"))
  // idempotency key এখন noteSignup-এর ভেতরেই trackSignup-এ যায়
  assert.ok(pages.includes('trackSignup(method, undefined, key)'))
  assert.ok(!pages.includes("noteOtpSignup(`email:${mail}`, 'email_otp')"), 'email_otp সাইন-আপ এখনো লগইন পেজে আছে')
  assert.ok(pages.includes("noteSignup('password', 'password:' + u.email.toLowerCase())"))
  assert.ok(analyticsSrc.includes('firedSignupKeys'))
  assert.ok(analyticsSrc.includes('fireSignupOnce'))
})

console.log(`\nAnalytics double-fire tests: ${passed} passed`)
