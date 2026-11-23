// বন্ধু খোঁজা টেস্ট — নামে + আইডিতে সার্চ, ডুপ্লিকেট বাদ, খালি ফলাফল।
// চালানো: রিপো রুট থেকে `node tests/friend-search.test.mjs`
// (esbuild দিয়ে src/friendSearch.ts বান্ডল করে Node-এ চালায় — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) নামের অংশ (বাংলা) দিয়ে খুঁজলে মেলে
//   ২) আইডি/কোডের অংশ দিয়ে খুঁজলে মেলে (ল্যাটিন, কেস-ইনসেনসিটিভ)
//   ৩) কিছু না মিললে খালি তালিকা ফেরে
//   ৪) একই নাম দুবার থাকলে একবারই দেখায় (বন্ধু আগে)
//   ৫) ৫ চ্যাট পারসোনা (রিমা, শাকিল, ফাহিম, মিম, আশা) খোঁজায় পাওয়া যায়
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-fs-test-'))
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

const FRIENDS = [
  { id: 'fr-1', name: 'রাফি আহমেদ', color: '#1877F2', online: true },
  { id: 'bd-rima', name: 'রিমা', color: '#E91E63', online: true },
]
const SUGGESTIONS = [
  { id: 'f1', name: 'রাফি আহমেদ', color: '#1877F2', mutual: 12 },
  { id: 'f2', name: 'সাবরিনা খান', color: '#E91E63', mutual: 8 },
]
const BUDDIES = [
  { id: 'bd-rima', name: 'রিমা', color: '#E91E63', online: true },
  { id: 'bd-shakil', name: 'শাকিল', color: '#1877F2', online: true },
  { id: 'bd-fahim', name: 'ফাহিম', color: '#27AE60', online: true },
  { id: 'bd-mim', name: 'মিম', color: '#9C27B0', online: true },
  { id: 'bd-asha', name: 'আশা', color: '#FF9800', online: true },
]

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

const all = M.buildSearchablePeople(FRIENDS, SUGGESTIONS, BUDDIES)

check('নামের অংশ (বাংলা) দিয়ে খুঁজলে মেলে', () => {
  const r = M.searchPeople(all, 'রাফি')
  assert.equal(r.length, 1)
  assert.equal(r[0].name, 'রাফি আহমেদ')
})

check('একই নাম বন্ধু + সাজেশনে থাকলে একবারই দেখায় (বন্ধু আগে)', () => {
  const rafis = all.filter(p => p.name === 'রাফি আহমেদ')
  assert.equal(rafis.length, 1)
  assert.equal(rafis[0].isFriend, true)
  assert.equal(rafis[0].id, 'fr-1')
})

check('আইডির অংশ দিয়ে খুঁজলে মেলে', () => {
  const r = M.searchPeople(all, 'bd-rima')
  assert.equal(r.length, 1)
  assert.equal(r[0].name, 'রিমা')
})

check('আইডি প্রিফিক্সে ৫ পারসোনাই মেলে', () => {
  const r = M.searchPeople(all, 'bd-')
  assert.equal(r.length, 5)
})

check('ল্যাটিন সার্চ কেস-ইনসেনসিটিভ', () => {
  assert.equal(M.searchPeople(all, 'BD-ASHA').length, 1)
  assert.equal(M.searchPeople(all, 'BD-ASHA')[0].name, 'আশা')
  assert.equal(M.searchPeople(all, 'F2').length, 1)
  assert.equal(M.searchPeople(all, 'F2')[0].name, 'সাবরিনা খান')
})

check('৫ পারসোনা সবাই খোঁজায় পাওয়া যায়', () => {
  for (const n of ['রিমা', 'শাকিল', 'ফাহিম', 'মিম', 'আশা']) {
    const r = M.searchPeople(all, n)
    assert.equal(r.length, 1, n)
    assert.equal(r[0].name, n)
  }
})

check('কিছু না মিললে খালি তালিকা', () => {
  assert.deepEqual(M.searchPeople(all, 'zzz-কেউ-না'), [])
  assert.deepEqual(M.searchPeople(all, 'অচেনা নাম'), [])
})

check('খালি সার্চে সবাই ফেরে', () => {
  assert.equal(M.searchPeople(all, '').length, all.length)
  assert.equal(M.searchPeople(all, '   ').length, all.length)
})

check('সার্চে নামের আগে-পেছনের ফাঁকা জায়গা সমস্যা করে না', () => {
  assert.equal(M.searchPeople(all, '  রিমা  ').length, 1)
})

console.log(`\n${passed}/9 passed`)
