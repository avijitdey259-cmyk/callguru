// ফিডের সাজানো — নতুন উপরে, ক্যাশ করা নিচে — চেক।
// চালানো: রিপো রুট থেকে `node tests/feed-order.test.mjs`
// (esbuild দিয়ে src/feedCache.ts বান্ডল করে Node-এ চালায়।)
// যাচাই করে:
//   ১) fresh পোস্ট উপরে, cached পোস্ট নিচে; ভেতরের ক্রম অটুট থাকে
//   ২) একই পোস্ট দুই জায়গায় থাকলে একবারই আসে, নতুনের জায়গায়
//   ৩) নিচে স্ক্রল করলে (পরের পাতা) ক্যাশ করা তালিকা থেকেই আসে —
//      কোনো নেটওয়ার্ক চাওয়া নেই, একই আইটেম দুবার আসে না
//   ৪) Feed আসলেই এই মার্জ ব্যবহার করে (কম্পোজারের নতুন পোস্ট fresh হয়)
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')

const outDir = mkdtempSync(join(tmpdir(), 'picall-feed-order-test-'))
const outFile = join(outDir, 'feedCache.mjs')
await build({
  entryPoints: [join(root, 'src/feedCache.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
})
const M = await import(outFile)

const feedCache = read('src/feedCache.ts')
const pages = read('src/pages.tsx')
const store = read('src/store.tsx')

let n = 0
function check(name, fn) {
  n++
  try { fn(); console.log(`ok ${n} - ${name}`) }
  catch (e) { console.error(`not ok ${n} - ${name}\n  ${e.message}`); process.exitCode = 1 }
}

const fresh = [{ id: 'p-new-1', text: 'just posted' }, { id: 'p-new-2', text: 'also new' }]
const cached = [
  { id: 'p-old-1', text: 'seen yesterday' },
  { id: 'p-old-2', text: 'seen last week' },
  { id: 'p-old-3', text: 'seed post' },
]

// ---------- ১) fresh উপরে, cached নিচে ----------
check('fresh পোস্ট উপরে, cached পোস্ট নিচে; ভেতরের ক্রম অটুট', () => {
  const out = M.mergeFeedPosts(fresh, cached)
  assert.deepEqual(out.map((p) => p.id), ['p-new-1', 'p-new-2', 'p-old-1', 'p-old-2', 'p-old-3'])
})
check('খালি fresh হলে cached-ই ফিড (আগের মতো দেখায়)', () => {
  assert.deepEqual(M.mergeFeedPosts([], cached).map((p) => p.id), ['p-old-1', 'p-old-2', 'p-old-3'])
})
check('খালি cached হলে fresh-ই ফিড', () => {
  assert.deepEqual(M.mergeFeedPosts(fresh, []).map((p) => p.id), ['p-new-1', 'p-new-2'])
})
check('split: freshIds দিয়ে ভাগ হয়, ক্রম বদলায় না', () => {
  const all = [fresh[0], cached[0], fresh[1], cached[1]]
  const { fresh: f, cached: c } = M.splitFeedPosts(all, ['p-new-1', 'p-new-2'])
  assert.deepEqual(f.map((p) => p.id), ['p-new-1', 'p-new-2'])
  assert.deepEqual(c.map((p) => p.id), ['p-old-1', 'p-old-2'])
})

// ---------- ২) ডিডুপ ----------
check('একই পোস্ট দুই জায়গায় থাকলে একবারই আসে — নতুনের জায়গায়', () => {
  const out = M.mergeFeedPosts(fresh, [{ id: 'p-new-1', text: 'stale copy' }, ...cached])
  assert.deepEqual(out.map((p) => p.id), ['p-new-1', 'p-new-2', 'p-old-1', 'p-old-2', 'p-old-3'])
  assert.equal(out[0].text, 'just posted', 'নতুন কপিটাই থাকে, ক্যাশ করা কপি নয়')
})
check('মার্জ মূল তালিকা বদলায় না', () => {
  const f = [...fresh]
  const c = [...cached]
  M.mergeFeedPosts(f, c)
  assert.deepEqual(f, fresh)
  assert.deepEqual(c, cached)
})

// ---------- ৩) স্ক্রল = ক্যাশ থেকে, রি-ফেচ নয় ----------
check('feedPage: নিচের পাতাগুলো একই ক্যাশ-তালিকা থেকে আসে, ওভারল্যাপ নেই', () => {
  const merged = M.mergeFeedPosts(fresh, cached)
  const p0 = M.feedPage(merged, 0, 2)
  const p1 = M.feedPage(merged, 1, 2)
  const p2 = M.feedPage(merged, 2, 2)
  assert.deepEqual(p0.map((p) => p.id), ['p-new-1', 'p-new-2'])
  assert.deepEqual(p1.map((p) => p.id), ['p-old-1', 'p-old-2'])
  assert.deepEqual(p2.map((p) => p.id), ['p-old-3'])
  const all = [...p0, ...p1, ...p2].map((p) => p.id)
  assert.equal(new Set(all).size, all.length, 'একই আইটেম দুই পাতায় এসেছে')
  assert.deepEqual(all, merged.map((p) => p.id), 'সব পাতা মিলে পুরো ফিডই আসে')
})
check('feedPage-এ কোনো নেটওয়ার্ক চাওয়া নেই (ফাংশন খাঁটি slice)', () => {
  assert.ok(!feedCache.includes('fetch('), 'feedCache.ts-এ fetch আছে — স্ক্রলে সার্ভারে যাবে')
  assert.ok(!/localStorage\s*\./.test(feedCache), 'feedCache.ts localStorage ছোঁয়')
  assert.deepEqual(M.feedPage(M.mergeFeedPosts(fresh, cached), 9, 2), [])
  assert.deepEqual(M.feedPage(M.mergeFeedPosts(fresh, cached), -1, 2), [])
})
check('দেখা পোস্ট (টেক্সট + ছবি) ক্যাশে থাকে — পোস্টের ছবি data URL, ভিডিও Storage URL', () => {
  // পোস্টের ছবি data URL হিসেবে পোস্টের ভেতরেই থাকে (localStorage-এ সংরক্ষণ হয়);
  // ভিডিও Firebase Storage URL — SW মিডিয়া-ক্যাশে cache-first হয়।
  assert.ok(pages.includes('imageUrl: composerPhoto'), 'পোস্টের ছবি পোস্টের সঙ্গে থাকে না')
  assert.ok(pages.includes('videoUrl: composerVideoUrl'), 'পোস্টের ভিডিও পোস্টের সঙ্গে থাকে না')
  assert.ok(store.includes("save('posts', posts.slice(0, 20))"), 'পোস্ট localStorage-এ সংরক্ষণ হয় না')
})

// ---------- ৪) Feed আসলেই এই মার্জ ব্যবহার করে ----------
check('Feed mergeFeedPosts/splitFeedPosts ব্যবহার করে; কম্পোজারের পোস্ট addPost-এ যায়', () => {
  const feedStart = pages.indexOf('export function Feed()')
  const feedEnd = pages.indexOf('export function Marketplace()')
  assert.ok(feedStart !== -1 && feedEnd > feedStart, 'Feed ফাংশন পাওয়া যায়নি')
  const feed = pages.slice(feedStart, feedEnd)
  assert.ok(feed.includes('splitFeedPosts(posts, freshPostIds)'), 'Feed split করে না')
  assert.ok(feed.includes('mergeFeedPosts(freshPosts, cachedPosts)'), 'Feed merge করে না')
  assert.ok(feed.includes('addPost({'), 'কম্পোজার addPost ব্যবহার করে না')
  assert.ok(!feed.includes('fetch('), 'Feed পোস্টের জন্য নেটওয়ার্ক fetch করে — নিচের দিক সার্ভারে চাইবে')
  assert.ok(store.includes('freshPostIds'), 'store freshPostIds দেয় না')
  assert.ok(store.includes('addPost:'), 'store addPost দেয় না')
})

console.log(`\nfeed-order: ${n} checks, ${process.exitCode ? 'FAILED' : 'all passed'}`)
