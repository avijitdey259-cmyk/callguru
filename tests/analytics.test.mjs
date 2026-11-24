// Analytics wiring — Meta Pixel + Google Analytics 4 + Microsoft Clarity.
// ID-driven: empty/missing ID = that tracker never loads, never errors.
// PageView on load, CompleteRegistration + sign_up on FIRST signup only.
// Run: node tests/analytics.test.mjs
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const pages = read('src/pages.tsx')
const store = read('src/store.tsx')
const main = read('src/main.tsx')
const firebaseSrc = read('src/firebase.ts')
const analyticsSrc = read('src/analytics.ts')
const workflow = read('.github/workflows/firebase-hosting-deploy.yml')

// analytics.ts is pure (DOM passed in) — bundle + import it for real checks.
const outDir = mkdtempSync(join(tmpdir(), 'picall-analytics-test-'))
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

// firestoreMapping pulls analytics in — bundle it for the config round-trip.
const mappingFile = join(outDir, 'mapping.mjs')
await build({
  entryPoints: [join(root, 'src/firestoreMapping.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: mappingFile,
  logLevel: 'silent',
})
const M = await import(mappingFile)

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

function makeFake() {
  const scripts = []
  const doc = {
    head: { appendChild(el) { scripts.push(el) } },
    createElement(tag) { return { tag, async: false, src: '' } },
  }
  const win = {}
  return { doc, win, scripts, target: { document: doc, window: win } }
}

console.log('Analytics tests:')

// ---------- খালি ID = কিছুই লোড হয় না, কোনো ভুল নেই ----------
check('empty IDs: init loads nothing, no scripts, no globals, no errors', () => {
  A.resetAnalyticsForTests()
  const f = makeFake()
  const r = A.initAnalytics({ pixelId: '', ga4Id: '', clarityId: '' }, f.target)
  assert.deepEqual(r, { pixel: false, ga4: false, clarity: false })
  assert.equal(f.scripts.length, 0)
  assert.equal('fbq' in f.win, false)
  assert.equal('gtag' in f.win, false)
  assert.equal('clarity' in f.win, false)
})

check('empty IDs: trackSignup before/after init never throws and fires nothing', () => {
  A.resetAnalyticsForTests()
  const f = makeFake()
  A.trackSignup('google', f.target)
  A.trackSignup('email_otp')
  const r = A.initAnalytics(A.EMPTY_ANALYTICS_IDS, f.target)
  assert.deepEqual(r, { pixel: false, ga4: false, clarity: false })
  assert.equal(f.scripts.length, 0)
})

// ---------- ID সমাধান ----------
check('resolveAnalyticsIds: env wins per-field, admin fills gaps, trims', () => {
  const r = A.resolveAnalyticsIds(
    { pixelId: ' 111 ', ga4Id: '', clarityId: '' },
    { pixelId: '222', ga4Id: 'G-ABC', clarityId: 'xyz' },
  )
  assert.equal(r.pixelId, '111')
  assert.equal(r.ga4Id, 'G-ABC')
  assert.equal(r.clarityId, 'xyz')
  assert.deepEqual(A.resolveAnalyticsIds(null, null), { pixelId: '', ga4Id: '', clarityId: '' })
})

check('envAnalyticsIds: no env in tests = all empty (no crash)', () => {
  assert.deepEqual(A.envAnalyticsIds(), { pixelId: '', ga4Id: '', clarityId: '' })
})

check('sanitizeAnalyticsId: strips quotes/semicolons, caps at 64 chars', () => {
  assert.equal(A.sanitizeAnalyticsId('123";alert(1)'), '123alert1')
  assert.equal(A.sanitizeAnalyticsId('G-ABC_123'), 'G-ABC_123')
  assert.equal(A.sanitizeAnalyticsId('x'.repeat(100)).length, 64)
  assert.equal(A.sanitizeAnalyticsId('  G-1  '), 'G-1')
  assert.equal(A.sanitizeAnalyticsId(undefined), '')
})

// ---------- Pixel ----------
check('Pixel: script loads, fbq stub queues init + PageView once', () => {
  A.resetAnalyticsForTests()
  const f = makeFake()
  const r = A.initAnalytics({ pixelId: '123456789012345', ga4Id: '', clarityId: '' }, f.target)
  assert.deepEqual(r, { pixel: true, ga4: false, clarity: false })
  assert.equal(f.scripts.length, 1)
  assert.equal(f.scripts[0].src, 'https://connect.facebook.net/en_US/fbevents.js')
  assert.equal(typeof f.win.fbq, 'function')
  const q = f.win.fbq.queue.map((a) => a.join(':'))
  assert.ok(q.includes('init:123456789012345'))
  assert.ok(q.includes('track:PageView'))
  // দ্বিতীয় init — আর স্ক্রিপ্ট নয়, আর PageView নয়
  A.initAnalytics({ pixelId: '123456789012345', ga4Id: '', clarityId: '' }, f.target)
  assert.equal(f.scripts.length, 1)
  assert.equal(f.win.fbq.queue.filter((a) => a[1] === 'PageView').length, 1)
})

// ---------- GA4 ----------
check('GA4: gtag.js loads with the ID, dataLayer gets js + config', () => {
  A.resetAnalyticsForTests()
  const f = makeFake()
  const r = A.initAnalytics({ pixelId: '', ga4Id: 'G-XXXXXXXXXX', clarityId: '' }, f.target)
  assert.deepEqual(r, { pixel: false, ga4: true, clarity: false })
  assert.equal(f.scripts.length, 1)
  assert.equal(f.scripts[0].src, 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX')
  assert.equal(typeof f.win.gtag, 'function')
  assert.equal(Array.isArray(f.win.dataLayer), true)
  assert.equal(f.win.dataLayer[0][0], 'js')
  assert.equal(f.win.dataLayer[1][0], 'config')
  assert.equal(f.win.dataLayer[1][1], 'G-XXXXXXXXXX')
})

// ---------- Clarity ----------
check('Clarity: tag loads with the project ID, clarity stub defined', () => {
  A.resetAnalyticsForTests()
  const f = makeFake()
  const r = A.initAnalytics({ pixelId: '', ga4Id: '', clarityId: 'abcdef1234' }, f.target)
  assert.deepEqual(r, { pixel: false, ga4: false, clarity: true })
  assert.equal(f.scripts.length, 1)
  assert.equal(f.scripts[0].src, 'https://www.clarity.ms/tag/abcdef1234')
  assert.equal(typeof f.win.clarity, 'function')
})

check('all three IDs together: three scripts, one init each', () => {
  A.resetAnalyticsForTests()
  const f = makeFake()
  const r = A.initAnalytics({ pixelId: '111', ga4Id: 'G-222', clarityId: 'ccc' }, f.target)
  assert.deepEqual(r, { pixel: true, ga4: true, clarity: true })
  assert.equal(f.scripts.length, 3)
})

// ---------- সাইন-আপ ইভেন্ট ----------
check('trackSignup after init: CompleteRegistration + sign_up with method', () => {
  A.resetAnalyticsForTests()
  const f = makeFake()
  A.initAnalytics({ pixelId: '111', ga4Id: 'G-222', clarityId: '' }, f.target)
  A.trackSignup('sms_otp', f.target)
  assert.ok(f.win.fbq.queue.some((a) => a[0] === 'track' && a[1] === 'CompleteRegistration'))
  assert.ok(f.win.dataLayer.some((a) => a[0] === 'event' && a[1] === 'sign_up' && a[2] && a[2].method === 'sms_otp'))
})

check('trackSignup before init: queued, flushed by the next init (no event lost)', () => {
  A.resetAnalyticsForTests()
  const f = makeFake()
  A.trackSignup('google', f.target)
  assert.equal('fbq' in f.win, false)
  A.initAnalytics({ pixelId: '111', ga4Id: 'G-222', clarityId: '' }, f.target)
  assert.ok(f.win.fbq.queue.some((a) => a[0] === 'track' && a[1] === 'CompleteRegistration'))
  assert.ok(f.win.dataLayer.some((a) => a[0] === 'event' && a[1] === 'sign_up' && a[2] && a[2].method === 'google'))
})

check('trackSignup with Pixel only: sign_up is skipped, CompleteRegistration fires', () => {
  A.resetAnalyticsForTests()
  const f = makeFake()
  A.initAnalytics({ pixelId: '111', ga4Id: '', clarityId: '' }, f.target)
  A.trackSignup('email_link', f.target)
  assert.ok(f.win.fbq.queue.some((a) => a[1] === 'CompleteRegistration'))
  assert.equal('gtag' in f.win, false)
})

// ---------- প্রথম সাইন-আপের রেকর্ড (OTP — Firebase ব্যবহারকারী নেই) ----------
check('wasSignupRecorded/markSignupRecorded: repeat OTP login is not a new signup', () => {
  const mem = new Map()
  const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, v) } }
  assert.equal(A.wasSignupRecorded('email:a@x.com', storage), false)
  A.markSignupRecorded('email:a@x.com', storage)
  assert.equal(A.wasSignupRecorded('email:a@x.com', storage), true)
  assert.equal(A.wasSignupRecorded('phone:01700000000', storage), false)
  A.markSignupRecorded('phone:01700000000', storage)
  assert.equal(A.wasSignupRecorded('phone:01700000000', storage), true)
  assert.equal(A.wasSignupRecorded('email:a@x.com', storage), true)
})

// ---------- config/public রাউন্ড-ট্রিপ ----------
check('toPublicConfig/fromPublicConfig: analytics IDs round-trip, bad ones dropped', () => {
  const doc = M.toPublicConfig(
    { piRateBDT: 100, usdtRateBDT: 120, piWithdrawFeePct: 1, datingRate: 0.1, liveRate: 0.05 },
    { bkash: '', nagad: '', rocket: '', usdtBep20: '', usdtErc20: '', binancePayId: '', piDepositAddress: '', piTestnetAddress: '' },
    '',
    { pixelId: '111', ga4Id: 'G-222', clarityId: 'ccc' },
  )
  assert.deepEqual(doc.analytics, { pixelId: '111', ga4Id: 'G-222', clarityId: 'ccc' })
  const back = M.fromPublicConfig(doc)
  assert.deepEqual(back.analytics, { pixelId: '111', ga4Id: 'G-222', clarityId: 'ccc' })
  // খালি analytics ডক থেকে ফেরে না (আগের মান বদলায় না)
  assert.equal('analytics' in M.fromPublicConfig({}), false)
  assert.equal('analytics' in M.fromPublicConfig({ analytics: { pixelId: '', ga4Id: '', clarityId: '' } }), false)
  // ক্ষতিকর অক্ষর সাফ হয়ে যায়
  assert.equal(M.fromPublicConfig({ analytics: { pixelId: '1";x', ga4Id: '', clarityId: '' } }).analytics.pixelId, '1x')
})

check('toPublicConfig without analytics arg: defaults to empty (old callers safe)', () => {
  const doc = M.toPublicConfig(
    { piRateBDT: 100, usdtRateBDT: 120, piWithdrawFeePct: 1, datingRate: 0.1, liveRate: 0.05 },
    { bkash: '', nagad: '', rocket: '', usdtBep20: '', usdtErc20: '', binancePayId: '', piDepositAddress: '', piTestnetAddress: '' },
  )
  assert.deepEqual(doc.analytics, { pixelId: '', ga4Id: '', clarityId: '' })
})

// ---------- ওয়্যারিং (সোর্স-টেক্সট) ----------
check('LoginPage: all signup paths report first signup (google/password)', () => {
  for (const call of ["noteSignup('google', 'google:' + u.email.toLowerCase())", "noteSignup('password', 'password:' + u.email.toLowerCase())"]) {
    assert.ok(pages.includes(call), `missing ${call}`)
  }
  // মালিকের সিদ্ধান্ত ২০২৬-১১-২৪: Email Link ও Email OTP লগইন পেজ থেকে গেছে,
  // তাই এই পেজে আর email_link/email_otp সাইন-আপ রিপোর্ট নেই (analytics
  // মডিউলে মেথডগুলো আছে; firebase-র লিংক হেল্পারও আছে)।
  assert.ok(!pages.includes("noteSignup('email_link'"), 'email_link সাইন-আপ এখনো লগইন পেজে আছে')
  assert.ok(!pages.includes("noteOtpSignup(`email:${mail}`, 'email_otp')"), 'email_otp সাইন-আপ এখনো লগইন পেজে আছে')
  // রিপিট লগইনে ইভেন্ট নয় — শুধু প্রথম সাইন-আপে (isNewUser দেখে)
  assert.ok(pages.includes('if (u.isNewUser) noteSignup'))
  // ডাবল ট্রিগারেও একবারই — key দিয়ে idempotency analytics মডিউলেই থাকে
  // (fireSignupOnce/firedSignupKeys, analytics-doublefire.test.mjs দেখে)
  assert.ok(pages.includes('trackSignup(method, undefined, key)'))
})

check('firebase: signInWithGoogle + completeEmailLink return isNewUser', () => {
  assert.ok(firebaseSrc.includes('isNewUser: getAdditionalUserInfo(result)?.isNewUser ?? false'))
  assert.equal((firebaseSrc.match(/isNewUser: getAdditionalUserInfo\(result\)\?\.isNewUser \?\? false/g) || []).length, 2)
  assert.ok(firebaseSrc.includes('getAdditionalUserInfo'))
})

check('Admin Settings: three ID fields with save/delete (existing pattern)', () => {
  for (const label of ['Meta Pixel ID', 'Google Analytics 4 — Measurement ID', 'Microsoft Clarity — Project ID']) {
    assert.ok(pages.includes(label), `missing ${label}`)
  }
  assert.ok(pages.includes('function saveAnalytics()'))
  assert.ok(pages.includes('function clearAnalytics()'))
  assert.ok(pages.includes("setAdminSettings({ ...adminSettings, analytics: cleaned })"))
})

check('store: adminSettings.analytics stored, synced to config/public, init effect', () => {
  assert.ok(store.includes('analytics: AnalyticsIds'))
  assert.ok(store.includes("analytics: { ...EMPTY_ANALYTICS_IDS }"))
  assert.ok(store.includes('analytics: { ...DEFAULT_ADMIN_SETTINGS.analytics, ...(v.analytics || {}) }'))
  assert.ok(store.includes('if (c.analytics !== undefined) setAdminSettingsState'))
  assert.ok(store.includes('initAnalytics(resolveAnalyticsIds(envAnalyticsIds(), adminSettings.analytics))'))
  assert.equal((store.match(/toPublicConfig\(\{ piRateBDT, usdtRateBDT, piWithdrawFeePct, datingRate, liveRate \}, adminSettings\.payments, tvPlaylistUrl, adminSettings\.analytics, adminSettings\.ads, bannedUids\)/g) || []).length, 2)
})

check('main.tsx: boot init from build env (logged-out PageView)', () => {
  assert.ok(main.includes('initAnalytics(resolveAnalyticsIds(envAnalyticsIds(), EMPTY_ANALYTICS_IDS))'))
})

check('workflow: optional VITE_PIXEL_ID / VITE_GA4_ID / VITE_CLARITY_ID build env', () => {
  for (const v of ['VITE_PIXEL_ID: ${{ secrets.VITE_PIXEL_ID }}', 'VITE_GA4_ID: ${{ secrets.VITE_GA4_ID }}', 'VITE_CLARITY_ID: ${{ secrets.VITE_CLARITY_ID }}']) {
    assert.ok(workflow.includes(v), `missing ${v}`)
  }
})

check('no hardcoded/placeholder IDs as configured values', () => {
  assert.equal(/pixelId:\s*'[^']+'/.test(analyticsSrc), false)
  assert.equal(/ga4Id:\s*'G-[^']+'/.test(analyticsSrc), false)
  assert.equal(analyticsSrc.includes('123456789'), false)
  // Admin input placeholders are hints only — they never configure a tracker:
  assert.ok(pages.includes('placeholder="e.g. 123456789012345"'))
  assert.ok(pages.includes('placeholder="e.g. G-XXXXXXXXXX"'))
})

console.log(`\nAnalytics tests: ${passed} passed`)
