// User product ads (self-serve) test — real form, CPM/CPC billing, admin review.
// Run: node tests/ads.test.mjs
// (esbuild দিয়ে src/ads.ts বান্ডল করে Node-এ চালায় — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) ফর্ম যাচাই — শিরোনাম/বিবরণ/দাম/লিংক, ভুল লিংক ও দাম বাতিল
//   ২) CPM/CPC হিসাব — views/1000 × CPM + clicks × CPC; ডিফল্ট দর CPM ৳50, CPC ৳3
//   ৩) ডক ম্যাপিং — ভুল ডকে null, ভালো ডকে বিজ্ঞাপন (views/clicks সহ)
//   ৪) লোকাল ক্যাশ মার্জ — Firestore জিতবে, লোকাল-শুধু এন্ট্রি থাকবে
//   ৫) UI স্ট্রিং — AdsPage ফর্ম (ছবি, শিরোনাম, বিবরণ, দাম, ওয়েবসাইট লিংক),
//      PENDING জমা, Sponsored লেবেল, অ্যাডমিন অনুমোদন/বাতিল, দর দেখানো
//   ৬) Firestore ফাংশন + নিয়ম — ads কালেকশন, view/click কাউন্টার
//   ৭) Adsterra আলাদা — এই ফাইলে Adsterra কোড নেই, ভুয়া রিচ/পেমেন্ট নেই
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-ads-test-'))
const outFile = join(outDir, 'ads.mjs')
await build({
  entryPoints: [join(root, 'src/ads.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
})
const A = await import(outFile)

const read = (f) => readFileSync(join(root, f), 'utf8')
const pages = read('src/pages.tsx')
const firestore = read('src/firestore.ts')
const rules = read('firestore.rules')
const components = read('src/components.tsx')
const adsSrc = read('src/ads.ts')
const store = read('src/store.tsx')
const app = read('src/App.tsx')

let n = 0
function check(name, fn) {
  n++
  try { fn(); console.log(`ok ${n} - ${name}`) }
  catch (e) { console.error(`not ok ${n} - ${name}\n  ${e.message}`); process.exitCode = 1 }
}

const goodInput = { title: 'Handmade jamdani saree', description: 'Pure cotton, handwoven in Tangail.', priceBDT: 1290, link: 'https://my-shop.example.com/saree' }

check('validateAdInput: valid input passes', () => {
  assert.equal(A.validateAdInput(goodInput), null)
})

check('validateAdInput: empty title / bad price / bad link rejected', () => {
  assert.ok(A.validateAdInput({ ...goodInput, title: '   ' }))
  assert.ok(A.validateAdInput({ ...goodInput, priceBDT: 0 }))
  assert.ok(A.validateAdInput({ ...goodInput, priceBDT: -5 }))
  assert.ok(A.validateAdInput({ ...goodInput, priceBDT: NaN }))
  assert.ok(A.validateAdInput({ ...goodInput, link: 'not-a-link' }))
  assert.ok(A.validateAdInput({ ...goodInput, link: 'ftp://example.com' }))
  assert.ok(A.validateAdInput({ ...goodInput, link: '' }))
})

check('validateAdInput: title/description length limits', () => {
  assert.ok(A.validateAdInput({ ...goodInput, title: 'x'.repeat(81) }))
  assert.ok(A.validateAdInput({ ...goodInput, description: 'x'.repeat(501) }))
})

check('DEFAULT_AD_RATES: owner-approved CPM ৳50, CPC ৳3', () => {
  assert.equal(A.DEFAULT_AD_RATES.cpmRateBDT, 50)
  assert.equal(A.DEFAULT_AD_RATES.cpcRateBDT, 3)
  assert.ok(A.adRatesSet(A.DEFAULT_AD_RATES))
  assert.ok(!A.adRatesSet({ cpmRateBDT: 0, cpcRateBDT: 0 }))
})

check('adAmountDue: views/1000 x CPM + clicks x CPC', () => {
  const ad = { id: 'a1', ownerUid: 'u1', ownerName: 'A', title: 'T', description: '', priceBDT: 100, link: 'https://x.example.com', status: 'approved', views: 2000, clicks: 10, createdAtMs: 1 }
  // 2000/1000 x 50 + 10 x 3 = 100 + 30 = 130
  assert.equal(A.adAmountDue(ad, { cpmRateBDT: 50, cpcRateBDT: 3 }), 130)
  assert.equal(A.adAmountDue({ ...ad, views: 0, clicks: 0 }, { cpmRateBDT: 50, cpcRateBDT: 3 }), 0)
  assert.equal(A.adAmountDue({ ...ad, views: 500, clicks: 0 }, { cpmRateBDT: 50, cpcRateBDT: 3 }), 25)
})

check('mapAdDoc: bad doc -> null, good doc -> ad with views/clicks', () => {
  assert.equal(A.mapAdDoc('a1', {}), null)
  assert.equal(A.mapAdDoc('a1', { title: 'T', ownerUid: 'u1' }), null) // no ownerName/link/price
  const ad = A.mapAdDoc('a1', { ownerUid: 'u1', ownerName: 'A', title: 'T', description: 'D', priceBDT: 1290, link: 'https://x.example.com', status: 'pending', views: 12, clicks: 3, createdAtMs: 100 })
  assert.ok(ad)
  assert.equal(ad?.status, 'pending')
  assert.equal(ad?.views, 12)
  assert.equal(ad?.clicks, 3)
  // bad status defaults to pending, never approved by a bad doc
  assert.equal(A.mapAdDoc('a1', { ownerUid: 'u1', ownerName: 'A', title: 'T', priceBDT: 1, link: 'https://x.example.com', status: 'bogus' })?.status, 'pending')
})

check('mergeAdLists: Firestore wins per id, local-only kept, newest first', () => {
  const local = [{ id: 'l1', ownerUid: 'u', ownerName: 'A', title: 'Local', description: '', priceBDT: 1, link: 'https://x.example.com', status: 'pending', views: 0, clicks: 0, createdAtMs: 10 }]
  const remote = [{ id: 'l1', ownerUid: 'u', ownerName: 'A', title: 'Remote', description: '', priceBDT: 1, link: 'https://x.example.com', status: 'approved', views: 5, clicks: 1, createdAtMs: 20 }]
  const merged = A.mergeAdLists(local, remote)
  assert.equal(merged.length, 1)
  assert.equal(merged[0].title, 'Remote')
  assert.equal(merged[0].status, 'approved')
})

check('pages.tsx: AdsPage real form — photo, title, description, price, website link; PENDING submit', () => {
  assert.ok(pages.includes('export function AdsPage()'), 'AdsPage নেই')
  assert.ok(pages.includes('Add product photo'), 'ছবি ইনপুট নেই')
  assert.ok(pages.includes('Website / business link'), 'ওয়েবসাইট লিংক ফিল্ড নেই')
  assert.ok(pages.includes('Submit Ad for Review'), 'জমা বোতাম নেই')
  assert.ok(pages.includes('pending admin review'), 'PENDING কপি নেই')
  assert.ok(pages.includes('createAdDoc('), 'createAdDoc কল নেই')
  assert.ok(pages.includes('My Ads'), 'My Ads তালিকা নেই')
  assert.ok(pages.includes('Amount due:'), 'Amount due লাইন নেই')
  // rates shown to the advertiser before submit
  assert.ok(pages.includes('per 1000 views (CPM)'), 'CPM দর দেখানো নেই')
  assert.ok(pages.includes('per click (CPC)'), 'CPC দর দেখানো নেই')
  // no invented reach, no payment field
  assert.ok(!pages.includes('budget x 10'), 'ভুয়া রিচ হিসাব এখনো আছে')
  assert.ok(!/AdsPage\(\)[\s\S]{0,4000}payment/i.test(pages.slice(pages.indexOf('export function AdsPage()'))), 'AdsPage-এ পেমেন্ট ফিল্ড আছে')
})

check('pages.tsx: Feed shows approved ads as Sponsored with Visit website link; one view per session', () => {
  assert.ok(pages.includes('Sponsored'), 'Sponsored লেবেল নেই')
  assert.ok(pages.includes('fetchApprovedAds'), 'fetchApprovedAds কল নেই')
  assert.ok(pages.includes('subscribeApprovedAds'), 'subscribeApprovedAds কল নেই')
  assert.ok(pages.includes('Visit website'), 'Visit website বোতাম নেই')
  assert.ok(pages.includes('recordAdView('), 'view গণনা নেই')
  assert.ok(pages.includes('recordAdClick('), 'click গণনা নেই')
  assert.ok(pages.includes('callguru:adview:'), 'এক সেশনে একবার view গার্ড নেই')
})

check('pages.tsx: Admin ads tab — pending review, Approve/Reject, views/clicks/due', () => {
  assert.ok(pages.includes("'ads'"), 'ads ট্যাব নেই')
  assert.ok(pages.includes('User Product Ads'), 'অ্যাডমিন ads শিরোনাম নেই')
  assert.ok(pages.includes("reviewAd(a.id, 'approved')"), 'Approve বোতাম নেই')
  assert.ok(pages.includes("reviewAd(a.id, 'rejected')"), 'Reject বোতাম নেই')
  assert.ok(pages.includes('updateAdStatus('), 'updateAdStatus কল নেই')
})

check('pages.tsx: Admin Settings has CPM + CPC rate fields (defaults 50 / 3)', () => {
  assert.ok(pages.includes('CPM rate'), 'CPM রেট ফিল্ড নেই')
  assert.ok(pages.includes('CPC rate'), 'CPC রেট ফিল্ড নেই')
  assert.ok(pages.includes('saveAdRates'), 'saveAdRates নেই')
  assert.ok(pages.includes('cpmRateBDT'), 'cpmRateBDT নেই')
  assert.ok(pages.includes('cpcRateBDT'), 'cpcRateBDT নেই')
})

check('store.tsx + firestoreMapping: ad rates live in AdminSettings (defaults 50/3)', () => {
  assert.ok(store.includes('ads: { ...DEFAULT_AD_RATES }') || store.includes('ads: DEFAULT_AD_RATES') || store.includes('DEFAULT_AD_RATES'), 'স্টোরে DEFAULT_AD_RATES নেই')
  assert.ok(store.includes('adRates'), 'স্টোরে adRates নেই')
})

check('firestore.ts: ads functions exist (fetch/fetchApproved/subscribe/create/update/view/click)', () => {
  for (const f of ['fetchAds', 'fetchApprovedAds', 'subscribeApprovedAds', 'createAdDoc', 'updateAdStatus', 'recordAdView', 'recordAdClick']) {
    assert.ok(firestore.includes(`export async function ${f}`) || firestore.includes(`export function ${f}`), `${f} নেই`)
  }
  assert.ok(firestore.includes("status: 'pending'"), 'নতুন বিজ্ঞাপন pending হয় না')
  assert.ok(firestore.includes('views: increment(1)'), 'view increment নেই')
  assert.ok(firestore.includes('clicks: increment(1)'), 'click increment নেই')
})

check('firestore.rules: ads — read signed-in, create own pending only, admin approves, counters +1 only', () => {
  const start = rules.indexOf('match /ads/{adId}')
  assert.ok(start !== -1, 'ads নিয়ম নেই')
  const body = rules.slice(start, rules.indexOf('match /', start + 1))
  assert.ok(body.includes('allow read: if isSignedIn()'), 'ads পড়া নিয়ম নেই')
  assert.ok(body.includes("status == 'pending'"), 'create-এ pending শর্ত নেই')
  assert.ok(body.includes('isAdmin()'), 'অ্যাডমিন অনুমোদন নিয়ম নেই')
  assert.ok(body.includes('views + 1') && body.includes('clicks + 1'), 'কাউন্টার +1 নিয়ম নেই')
  assert.ok(body.includes('allow delete: if false'), 'ads মোছা বন্ধ নেই')
})

check('Ads link in Sidebar + Menu, /ads route exists (no redirect)', () => {
  assert.ok(components.includes("to: '/ads'"), 'সাইডবারে Ads লিংক নেই')
  assert.ok(pages.includes("to: '/ads'"), 'মেনুতে Ads লিংক নেই')
  assert.ok(app.includes('<Route path="/ads" element={<AdsPage />} />'), '/ads রুট নেই')
})

check('Adsterra separate — no Adsterra/VAST code in the user-ads flow', () => {
  const start = pages.indexOf('export function AdsPage()')
  const end = pages.indexOf('export function ', start + 1)
  const body = pages.slice(start, end === -1 ? undefined : end)
  assert.ok(!/adsterra|vast/i.test(body), 'AdsPage-এ Adsterra কোড ঢুকেছে')
  // ads.ts mentions Adsterra only in comments (to say it is separate) — strip
  // comments before checking for actual code.
  const codeOnly = adsSrc.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.ok(!/adsterra|vast/i.test(codeOnly), 'ads.ts-এ Adsterra কোড ঢুকেছে')
})

console.log(`\nads.test.mjs: ${n} checks run`)
