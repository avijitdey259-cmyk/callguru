// Home TV প্রিভিউ টেস্ট — হোমের মাঝখানে Live TV সেকশন (ডেমোর মতো)।
// চালানো: রিপো রুট থেকে `node tests/home-tv-section.test.mjs`
// যাচাই করে:
//   ১) Feed()-এ <HomeTvSection /> আছে — NewMembersSection-এর পরে, ফিড পোস্টের আগে
//   ২) প্রিভিউ TV_CHANNELS + sortChannelsByPlayability + getCachedProbe ব্যবহার করে
//      (চলে এমন চ্যানেল উপরে, যাচাই হয়ে থাকলে)
//   ৩) "Live TV" শিরোনাম + "Watch all" বাটন /live-tv-তে যায়; ট্যাপে ভিডিও নয়,
//      শুধু নেভিগেশন (চালানো Live TV পেজে হয়)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const pages = read('src/pages.tsx')

let n = 0
const check = (name, fn) => { n++; try { fn(); console.log(`  ✓ ${name}`) } catch (e) { console.error(`  ✗ ${name}: ${e.message}`); process.exitCode = 1 } }

check('Feed renders <HomeTvSection /> between NewMembersSection and the feed', () => {
  const feedAt = pages.indexOf('export function Feed()')
  assert.ok(feedAt > -1, 'Feed() নেই')
  const feed = pages.slice(feedAt)
  const secAt = feed.indexOf('<HomeTvSection />')
  assert.ok(secAt > -1, 'Feed()-এ <HomeTvSection /> নেই')
  const nmAt = feed.indexOf('<NewMembersSection />')
  const filterAt = feed.indexOf("setFeedFilter(f)")
  assert.ok(nmAt > -1 && nmAt < secAt, 'TV সেকশন NewMembersSection-এর পরে থাকার কথা')
  assert.ok(filterAt > -1 && secAt < filterAt, 'TV সেকশন ফিড ফিল্টার/পোস্টের আগে থাকার কথা')
})

check('HomeTvSection uses TV_CHANNELS + cached probe ordering', () => {
  assert.ok(pages.includes('function HomeTvSection()'), 'HomeTvSection কম্পোনেন্ট নেই')
  const sec = pages.slice(pages.indexOf('function HomeTvSection()'), pages.indexOf('export function Feed()'))
  assert.ok(sec.includes('TV_CHANNELS'), 'TV_CHANNELS ব্যবহার হয়নি')
  assert.ok(sec.includes('sortChannelsByPlayability'), 'চলে এমন আগে সাজানো হয়নি')
  assert.ok(sec.includes('getCachedProbe'), 'ক্যাশে থাকা যাচাই-ফল পড়া হয়নি')
  assert.ok(sec.includes('.slice(0, 4)'), 'প্রিভিউতে ৪টা চ্যানেল থাকার কথা')
})

check('HomeTvSection heading + Watch all link to /live-tv, tiles navigate only', () => {
  const sec = pages.slice(pages.indexOf('function HomeTvSection()'), pages.indexOf('export function Feed()'))
  assert.ok(sec.includes('📺 Live TV'), '"📺 Live TV" শিরোনাম নেই')
  assert.ok(sec.includes('Watch all'), '"Watch all" বাটন নেই')
  assert.ok(sec.includes("navigate('/live-tv')"), '/live-tv-তে যাওয়ার কথা')
  assert.ok(!sec.includes('<video'), 'প্রিভিউতে ভিডিও চালানো যাবে না — শুধু নেভিগেশন')
  assert.ok(!sec.includes('probeChannels('), 'প্রিভিউ নিজে যাচাই চালাবে না — Live TV পেজে যাচাই হয়')
})

console.log(`\nAll ${n} home-tv-section tests passed.`)
