// Virtual services + reviews test — real user services only, prepaid Pi/min.
// Run: node tests/services.test.mjs
// (esbuild দিয়ে src/services.ts বান্ডল করে Node-এ চালায় — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) সার্ভিস ফর্ম যাচাই — শিরোনাম/দর/বিবরণের সীমা, ফোন/লিংক ব্যান
//   ২) রিভিউ যাচাই — তারকা ১–৫, লেখার সীমা, ফোন/লিংক ব্যান
//   ৩) গড় রেটিং + সারাংশ, প্রিপেইড কল-চেক (ব্যালেন্স না থাকলে কল নয়)
//   ৪) ডক ম্যাপিং — ভুল ডকে null, ভালো ডকে লিস্টিং/রিভিউ
//   ৫) লোকাল ক্যাশ মার্জ — Firestore জিতবে, লোকাল-শুধু এন্ট্রি থাকবে
//   ৬) UI স্ট্রিং — Services সেকশন New Members-এর উপরে, Offer a service,
//      খালি অবস্থা, ভার্চুয়াল-শুধু কপি, রিভিউয়ারের নামসহ রিভিউ
//   ৭) প্রিপেইড কল পথ — /call/service/:id, অটো-কাট, নিজের সার্ভিসে কল নয়
//   ৮) Firestore ফাংশন + নিয়ম — services / reviews কালেকশন
//   ৯) মেনুতে Services সারি, + Add Friend সহজে খুঁজে পাওয়া যায়
//   ১০) ডেমো সার্ভিস/প্রোভাইডার ফিরে আসেনি; Reels ছোঁয়া হয়নি
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-svc-test-'))
const outFile = join(outDir, 'services.mjs')
await build({
  entryPoints: [join(root, 'src/services.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
})
const S = await import(outFile)

const read = (f) => readFileSync(join(root, f), 'utf8')
const pages = read('src/pages.tsx')
const firestore = read('src/firestore.ts')
const rules = read('firestore.rules')
const store = read('src/store.tsx')
const incoming = read('src/incomingCall.ts')
const components = read('src/components.tsx')
const servicesSrc = read('src/services.ts')

let n = 0
function check(name, fn) {
  n++
  try { fn(); console.log(`ok ${n} - ${name}`) }
  catch (e) { console.error(`not ok ${n} - ${name}\n  ${e.message}`); process.exitCode = 1 }
}

const goodInput = { title: 'English speaking practice', description: '30 minutes of conversation on video call.', ratePiPerMin: 0.15 }

check('validateServiceInput: valid input passes', () => {
  assert.equal(S.validateServiceInput(goodInput), null)
})

check('validateServiceInput: empty title rejected', () => {
  assert.ok(S.validateServiceInput({ ...goodInput, title: '   ' }))
})

check('validateServiceInput: title over 80 chars rejected', () => {
  assert.ok(S.validateServiceInput({ ...goodInput, title: 'x'.repeat(81) }))
})

check('validateServiceInput: zero / negative / tiny / huge rate rejected', () => {
  assert.ok(S.validateServiceInput({ ...goodInput, ratePiPerMin: 0 }))
  assert.ok(S.validateServiceInput({ ...goodInput, ratePiPerMin: -1 }))
  assert.ok(S.validateServiceInput({ ...goodInput, ratePiPerMin: 0.001 }))
  assert.ok(S.validateServiceInput({ ...goodInput, ratePiPerMin: 101 }))
  assert.equal(S.validateServiceInput({ ...goodInput, ratePiPerMin: 0.01 }), null)
  assert.equal(S.validateServiceInput({ ...goodInput, ratePiPerMin: 100 }), null)
})

check('validateServiceInput: description over 500 chars rejected', () => {
  assert.ok(S.validateServiceInput({ ...goodInput, description: 'x'.repeat(501) }))
})

check('validateServiceInput: phone number / link in title or description rejected', () => {
  assert.ok(S.validateServiceInput({ ...goodInput, title: 'Call me 01712345678' }))
  assert.ok(S.validateServiceInput({ ...goodInput, description: 'Find me on whatsapp please' }))
})

check('validateReviewInput: stars must be 1-5', () => {
  assert.ok(S.validateReviewInput(0, 'good'))
  assert.ok(S.validateReviewInput(6, 'good'))
  assert.ok(S.validateReviewInput(2.5, 'good'))
  assert.equal(S.validateReviewInput(1, ''), null)
  assert.equal(S.validateReviewInput(5, 'Great session!'), null)
})

check('validateReviewInput: long text / phone rejected', () => {
  assert.ok(S.validateReviewInput(5, 'x'.repeat(301)))
  assert.ok(S.validateReviewInput(5, 'my number is 01812345678'))
})

check('averageRating: empty, half-star average, rounding', () => {
  assert.deepEqual(S.averageRating([]), { avg: 0, count: 0 })
  assert.deepEqual(S.averageRating([{ stars: 5 }, { stars: 4 }]), { avg: 4.5, count: 2 })
  assert.deepEqual(S.averageRating([{ stars: 5 }, { stars: 5 }, { stars: 4 }]), { avg: 4.7, count: 3 })
})

check('ratingSummary: no reviews, singular, plural', () => {
  assert.equal(S.ratingSummary(0, 0), 'No reviews yet')
  assert.equal(S.ratingSummary(5, 1), '⭐ 5 • 1 Review')
  assert.equal(S.ratingSummary(4.5, 12), '⭐ 4.5 • 12 Reviews')
})

check('canStartServiceCall: free minute covers zero balance; otherwise balance must cover one minute', () => {
  assert.equal(S.canStartServiceCall(0, 0.15, true), true)
  assert.equal(S.canStartServiceCall(0.15, 0.15, false), true)
  assert.equal(S.canStartServiceCall(0.14, 0.15, false), false)
  assert.equal(S.canStartServiceCall(0, 0.15, false), false)
  assert.equal(S.canStartServiceCall(10, 0, false), false)
})

check('serviceRateLabel: Pi per minute', () => {
  assert.equal(S.serviceRateLabel(0.15), 'π 0.15/minute')
  assert.equal(S.serviceRateLabel(1), 'π 1/minute')
})

check('mapServiceDoc: valid doc maps; bad docs become null', () => {
  const doc = { providerUid: 'u1', providerName: 'Asha', title: 'Math help', description: 'Algebra on video call.', ratePiPerMin: 0.2, createdAtMs: 123 }
  const m = S.mapServiceDoc('svc-1', doc)
  assert.ok(m)
  assert.equal(m.id, 'svc-1')
  assert.equal(m.ratePiPerMin, 0.2)
  assert.equal(S.mapServiceDoc('x', { ...doc, title: '' }), null)
  assert.equal(S.mapServiceDoc('x', { ...doc, providerUid: '' }), null)
  assert.equal(S.mapServiceDoc('x', { ...doc, ratePiPerMin: 0 }), null)
  assert.equal(S.mapServiceDoc('x', { ...doc, ratePiPerMin: '0.2' }), null)
  assert.equal(S.mapServiceDoc('x', { ...doc, providerName: '' }), null)
})

check('mapReviewDoc: valid review maps; bad stars / nameless review become null', () => {
  const doc = { reviewerUid: 'u2', reviewerName: 'Rahim', stars: 4, text: 'Very helpful.', createdAtMs: 5 }
  const m = S.mapReviewDoc('r1', 'svc-1', doc)
  assert.ok(m)
  assert.equal(m.reviewerName, 'Rahim')
  assert.equal(S.mapReviewDoc('r1', 'svc-1', { ...doc, stars: 6 }), null)
  assert.equal(S.mapReviewDoc('r1', 'svc-1', { ...doc, stars: 0 }), null)
  assert.equal(S.mapReviewDoc('r1', 'svc-1', { ...doc, reviewerName: '' }), null)
})

check('mergeServiceLists: remote wins per id, local-only kept, newest first', () => {
  const local = [
    { id: 'a', providerUid: 'u1', providerName: 'A', title: 'Old', description: '', ratePiPerMin: 0.1, createdAtMs: 10 },
    { id: 'local-1', providerUid: 'u1', providerName: 'A', title: 'Mine offline', description: '', ratePiPerMin: 0.1, createdAtMs: 30 },
  ]
  const remote = [
    { id: 'a', providerUid: 'u1', providerName: 'A', title: 'New', description: '', ratePiPerMin: 0.2, createdAtMs: 10 },
    { id: 'b', providerUid: 'u2', providerName: 'B', title: 'Other', description: '', ratePiPerMin: 0.1, createdAtMs: 20 },
  ]
  const merged = S.mergeServiceLists(local, remote)
  assert.equal(merged.length, 3)
  assert.equal(merged[0].id, 'local-1')
  assert.equal(merged.find(s => s.id === 'a').title, 'New')
  assert.ok(merged.some(s => s.id === 'b'))
})

check('pages.tsx: Services section sits ABOVE New Members on Home', () => {
  assert.ok(pages.includes('<ServicesSection />'), 'ServicesSection নেই')
  assert.ok(pages.indexOf('<ServicesSection />') < pages.indexOf('<NewMembersSection />'), 'Services New Members-এর উপরে নেই')
  assert.ok(pages.includes('id="services-section"'), 'services-section anchor নেই')
})

check('pages.tsx: Offer a service + virtual-only copy + empty state', () => {
  for (const s of ['Offer a service', 'No services yet. Offer the first one!', 'All services are virtual, by video call only', 'Virtual video call only — no in-person meeting.', 'Rate (Pi per minute)']) {
    assert.ok(pages.includes(s), `"${s}" নেই`)
  }
  for (const s of ['Home visit', 'Meet in person']) {
    assert.ok(!pages.includes(s), `"${s}" ফিরে এসেছে`)
  }
  // "Price (Tk)" is banned only inside the Services flow (services are Pi/min,
  // never Tk) — the user product Ads form legitimately has a Tk price field.
  for (const fn of ['export function ServicesPage()', 'export function ServicesSection()', 'export function CreateService()']) {
    const start = pages.indexOf(fn)
    assert.ok(start !== -1, `${fn} নেই`)
    const end = pages.indexOf('export function ', start + 1)
    const body = pages.slice(start, end === -1 ? undefined : end)
    assert.ok(!body.includes('Price (Tk)'), `"Price (Tk)" ${fn}-এ ফিরে এসেছে`)
  }
})

check('pages.tsx: service card shows provider, rate, rating, Call + Reviews with reviewer name', () => {
  for (const s of ['serviceRateLabel(service.ratePiPerMin)', 'ratingSummary(avg, count)', 'Reviews ({count})', 'r.reviewerName', '/call/service/${service.id}']) {
    assert.ok(pages.includes(s), `"${s}" নেই`)
  }
  assert.ok(pages.includes('Top up Pi to call'), 'ব্যালেন্স না থাকলে Top up লিংক নেই')
})

check('pages.tsx: review form after a service call ends', () => {
  for (const s of ['ServiceReviewForm', 'Rate this service', 'Your review — with your name — will be visible to everyone on the service.', 'Submit Review']) {
    assert.ok(pages.includes(s), `"${s}" নেই`)
  }
})

check('pages.tsx: prepaid service call — auto-cut, no balance no call, own service blocked', () => {
  for (const s of ['Service not found', 'This is your own service', 'will cut itself when your Pi balance ends', 'Prepaid service call']) {
    assert.ok(pages.includes(s), `"${s}" নেই`)
  }
  assert.ok(pages.includes("type === 'service' ? 'service'"), 'service ইনভাইট kind নেই')
})

check('firestore.ts: services + reviews functions exist', () => {
  for (const s of ['fetchServices', 'fetchService', 'subscribeServices', 'createServiceDoc', 'fetchServiceReviews', 'subscribeServiceReviews', 'submitServiceReview']) {
    assert.ok(firestore.includes(s), `firestore.ts-এ ${s} নেই`)
  }
  assert.ok(firestore.includes("collection(d, 'services'"), 'services কালেকশন নেই')
  assert.ok(firestore.includes("'reviews'"), 'reviews সাবকালেকশন নেই')
})

check('firestore.rules: services public-read + owner-only write, reviews named + owner-only create', () => {
  assert.ok(rules.includes('match /services/{serviceId}'), 'services নিয়ম নেই')
  assert.ok(rules.includes('match /services/{serviceId}/reviews/{reviewId}'), 'reviews নিয়ম নেই')
  assert.ok(rules.includes('request.resource.data.providerUid == request.auth.uid'), 'providerUid চেক নেই')
  assert.ok(rules.includes('request.resource.data.reviewerUid == request.auth.uid'), 'reviewerUid চেক নেই')
})

check('store.tsx + incomingCall.ts: Service call type + invite kind', () => {
  assert.ok(store.includes("'Service'"), 'CallRecord-এ Service নেই')
  assert.ok(incoming.includes("'service'"), 'CallInvite kind-এ service নেই')
})

check('pages.tsx: Profile menu Services row links to the Services page (More link list, no Marketplace)', () => {
  assert.ok(pages.includes("to: '/services', label: 'Services'"), 'মেনুতে Services সারি নেই')
  assert.ok(pages.includes('const moreLinks = ['), 'মেনুতে moreLinks তালিকা নেই')
  assert.ok(components.includes("label: 'Services'"), 'সাইডবারে Services লেবেল নেই')
  assert.ok(!components.includes('Home Service'), 'সাইডবারে Home Service এখনো আছে')
  // Marketplace আর Services একই — নেভিগেশনে Marketplace লিংক নেই, /marketplace রুট Services-এ যায়
  const app = read('src/App.tsx')
  assert.ok(!pages.includes("to: '/marketplace', label: 'Marketplace'"), 'মেনুতে Marketplace সারি এখনো আছে')
  assert.ok(!components.includes("to: '/marketplace'"), 'সাইডবারে Marketplace লিংক এখনো আছে')
  assert.ok(app.includes('<Route path="/marketplace" element={<Navigate to="/services" replace />} />'), '/marketplace রুট Services-এ রিডাইরেক্ট করে না')
})

check('pages.tsx: + Add Friend is unmissable — card button, top entry, guide line', () => {
  assert.ok(pages.includes('>+ Add Friend</Btn>'), 'New Member কার্ডে + Add Friend নেই')
  assert.ok(pages.includes('Find friends'), 'উপরে Find friends এন্ট্রি নেই')
  assert.ok(pages.includes('tap + Add Friend on any New Member card below'), 'গাইড লাইন নেই')
})

check('no demo services came back', () => {
  for (const id of ['srv-1', 'srv-2', 'srv-3', 'srv-4', 'srv-5', 'srv-6']) {
    assert.ok(!servicesSrc.includes(id), `${id} ফিরে এসেছে`)
    assert.ok(!pages.includes(id), `pages.tsx-এ ${id} ফিরে এসেছে`)
  }
  for (const p of ['CleanHome', 'CoolCare', 'FixIt', 'PowerFix', 'PixelStudio', 'Mehjabin']) {
    assert.ok(!servicesSrc.includes(p), `${p} ফিরে এসেছে`)
    assert.ok(!pages.includes(p), `pages.tsx-এ ${p} ফিরে এসেছে`)
  }
})

check('Reels untouched — no service code leaked into ReelsPage', () => {
  // NOTE: remote head a96f21eb already has an "Upload Reel" button in
  // ReelsPage (owner's later change, not mine) — this check only proves MY
  // work did not touch Reels: no service/review code inside ReelsPage.
  const start = pages.indexOf('export function ReelsPage()')
  assert.ok(start !== -1, 'ReelsPage নেই')
  const end = pages.indexOf('export function ', start + 1)
  // strip comments — the AdsPage header comment sits between ReelsPage and
  // the next export; comments are not code leaking into ReelsPage.
  const reelsBody = pages.slice(start, end === -1 ? undefined : end).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.ok(!/service/i.test(reelsBody), 'সার্ভিস কোড Reels-এ ঢুকেছে')
  assert.ok(!/review/i.test(reelsBody), 'রিভিউ কোড Reels-এ ঢুকেছে')
})

console.log(`\nservices.test.mjs: ${n} checks run`)
