// পোস্ট খোঁজা টেস্ট — হোম পেজের সার্চ বক্সে পোস্টের লেখা + লেখকের নামে খোঁজা।
// চালানো: রিপো রুট থেকে `node tests/post-search.test.mjs`
// (esbuild দিয়ে src/friendSearch.ts বান্ডল করে Node-এ চালায় — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) পোস্টের লেখার অংশ (বাংলা) দিয়ে খুঁজলে মেলে
//   ২) লেখকের নামের অংশ দিয়ে খুঁজলে মেলে
//   ৩) ল্যাটিন সার্চ কেস-ইনসেনসিটিভ
//   ৪) কিছু না মিললে খালি তালিকা ফেরে
//   ৫) খালি কোয়েরিতে কিছু ফেরে না (পোস্টের তালিকা ফল হিসেবে দেখানো হয় না)
//   ৬) বন্ধু খোঁজা আগের মতোই কাজ করে (রিগ্রেশন নয়)
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-post-test-'))
const outFile = join(outDir, 'friendSearch.mjs')
await build({
  entryPoints: [join(root, 'src/friendSearch.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
})
const M = await import(outFile)

const POSTS = [
  { id: 'p1', author: 'ডা. রাহাত হোসেন', time: '২ ঘণ্টা আগে', text: 'শীতকালে শিশুদের সর্দি-কাশি বাড়ে। গরম পানি, বিশ্রাম আর প্রয়োজনে ডাক্তারের পরামর্শ নিন।' },
  { id: 'p2', author: 'মেহজাবিন চৌধুরী', time: '৫ ঘণ্টা আগে', text: 'IELTS Speaking-এ ভালো করতে প্রতিদিন ১৫ মিনিট ইংরেজিতে কথা বলার অভ্যাস করুন।' },
  { id: 'p3', author: 'PiCall', time: 'আজ সকালে', text: 'নতুন অফার! প্রথম কলের প্রথম ১ মিনিট সম্পূর্ণ ফ্রি — শুধু প্রথম ব্যবহারকারী ও প্রথম বন্ধুর জন্য।' },
]

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

check('পোস্টের লেখার অংশ (বাংলা) দিয়ে খুঁজলে মেলে', () => {
  const r = M.searchPosts(POSTS, 'সর্দি')
  assert.equal(r.length, 1)
  assert.equal(r[0].id, 'p1')
  assert.equal(M.searchPosts(POSTS, 'অফার').length, 1)
  assert.equal(M.searchPosts(POSTS, 'অফার')[0].id, 'p3')
})

check('লেখকের নামের অংশ দিয়ে খুঁজলে মেলে', () => {
  const r = M.searchPosts(POSTS, 'মেহজাবিন')
  assert.equal(r.length, 1)
  assert.equal(r[0].id, 'p2')
  assert.equal(M.searchPosts(POSTS, 'রাহাত').length, 1)
})

check('ল্যাটিন সার্চ কেস-ইনসেনসিটিভ', () => {
  assert.equal(M.searchPosts(POSTS, 'ielts').length, 1)
  assert.equal(M.searchPosts(POSTS, 'IELTS')[0].id, 'p2')
  assert.equal(M.searchPosts(POSTS, 'picall').length, 1)
  assert.equal(M.searchPosts(POSTS, 'PICALL')[0].id, 'p3')
})

check('কিছু না মিললে খালি তালিকা', () => {
  assert.deepEqual(M.searchPosts(POSTS, 'zzz-কেউ-না'), [])
  assert.deepEqual(M.searchPosts(POSTS, 'অচেনা কথা'), [])
})

check('খালি কোয়েরিতে কিছু ফেরে না', () => {
  assert.deepEqual(M.searchPosts(POSTS, ''), [])
  assert.deepEqual(M.searchPosts(POSTS, '   '), [])
})

check('বন্ধু খোঁজা আগের মতোই কাজ করে', () => {
  const people = M.buildSearchablePeople(
    [{ id: 'fr-1', name: 'রাফি আহমেদ', color: '#1877F2', online: true }],
    [{ id: 'f2', name: 'সাবরিনা খান', color: '#E91E63', mutual: 8 }],
    [{ id: 'bd-rima', name: 'রিমা', color: '#E91E63', online: true }],
  )
  assert.equal(M.searchPeople(people, 'রিমা').length, 1)
  assert.equal(M.searchPeople(people, 'bd-rima').length, 1)
  assert.deepEqual(M.searchPeople(people, 'zzz'), [])
})

console.log(`\n${passed}/6 passed`)
