// চ্যাট বন্ধু (পারসোনা) টেস্ট — বন্ধু তালিকা আর ফিড ভরা, কিন্তু ডেটিংয়ে
// কেউ নেই, New Members-এ কেউ নেই (মালিকের নির্দেশ ২০২৬-১১-২৪)।
// চালানো: রিপো রুট থেকে `node tests/persona-friends.test.mjs`
// (esbuild দিয়ে src/buddies.ts + src/data.ts বান্ডল করে Node-এ চালায়;
// pages.tsx সোর্স পড়ে।)
// যাচাই করে:
//   ১) ১১ পারসোনা: আগের ৫ জন আগে (রিমা প্রথম), নতুন ৬ জন (ছেলে ৩ + মেয়ে ৩)
//   ২) সরানো ডেমো নাম ফিরে আসেনি (রাফি/সাবরিনা/তানিয়া/সুমাইয়া/নুসরাত/রাহাত/মেহজাবিন)
//   ৩) ফিড পোস্ট: ১২টি, সব লেখকই পারসোনা, ৪টিতে ছবি (জেনেরিক দৃশ্য)
//   ৪) Dating-এ পারসোনা নেই (DATING_PROFILES খালি + DatingPage-এ BUDDIES নেই)
//   ৫) New Members-এ পারসোনা নেই (আগেই লক — এখানে নামের তালিকা ধরা হয়)
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-persona-test-'))
const read = (p) => readFileSync(join(root, p), 'utf8')

async function loadModule(entry) {
  const outFile = join(outDir, entry.replace(/[^a-z]/gi, '') + '.mjs')
  await build({
    entryPoints: [join(root, 'src', entry)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: outFile,
    logLevel: 'silent',
  })
  return import(outFile)
}

const B = await loadModule('buddies.ts')
const D = await loadModule('data.ts')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

const ORIGINAL_IDS = ['bd-rima', 'bd-shakil', 'bd-fahim', 'bd-mim', 'bd-asha']
const NEW_IDS = ['bd-tanvir', 'bd-faysal', 'bd-imran', 'bd-sadia', 'bd-tanha', 'bd-nabila']
const BANNED_NAMES = ['Rafi', 'Sabrina', 'Tania', 'Sumaiya', 'Nusrat', 'Rahat', 'Mehezabin']

check('১১ পারসোনা: আগের ৫ জন আগে (রিমা প্রথম), নতুন ৬ জন পরে', () => {
  assert.equal(B.BUDDIES.length, 11)
  assert.deepEqual(B.BUDDIES.slice(0, 5).map(b => b.id), ORIGINAL_IDS)
  assert.deepEqual(B.BUDDIES.slice(5).map(b => b.id), NEW_IDS)
  assert.equal(B.BUDDIES[0].name, 'Rima')
})

check('নতুন ৬ জন: ছেলে ৩ + মেয়ে ৩, সবাই অনলাইন, স্বর বৈধ', () => {
  const news = B.BUDDIES.slice(5)
  assert.deepEqual(news.map(b => b.name), ['Tanvir', 'Faysal', 'Imran', 'Sadia', 'Tanha', 'Nabila'])
  for (const b of B.BUDDIES) {
    assert.ok(b.online, `${b.id} অফলাইন`)
    assert.ok(['funny', 'caring', 'helpful', 'music', 'dreamy'].includes(b.voice), `${b.id} স্বর ভুল`)
    assert.ok(b.about.length > 0, `${b.id} about নেই`)
  }
  assert.equal(new Set(B.BUDDIES.map(b => b.id)).size, 11, 'ডুপ্লিকেট id')
  assert.equal(new Set(B.BUDDIES.map(b => b.name)).size, 11, 'ডুপ্লিকেট নাম')
})

check('সরানো ডেমো নাম ফিরে আসেনি', () => {
  const names = B.BUDDIES.map(b => b.name)
  for (const bad of BANNED_NAMES) assert.ok(!names.includes(bad), `${bad} ফিরে এসেছে`)
  assert.ok(!D.SEED_POSTS.some(p => BANNED_NAMES.includes(p.author)), 'ডেমো নামের পোস্ট আছে')
})

check('ফিড পোস্ট: ১২টি, সব লেখকই পারসোনা (৪টিতে ছবি)', () => {
  assert.equal(D.SEED_POSTS.length, 12)
  const names = new Set(B.BUDDIES.map(b => b.name))
  for (const p of D.SEED_POSTS) {
    assert.ok(names.has(p.author), `পোস্টের লেখক পারসোনা নয়: ${p.author}`)
    assert.ok(p.text.length > 0, 'খালি পোস্ট')
  }
  // ৪টি JPG এখন GitHub-এ আছে (public/persona-*.jpg, ব্রাউজার দিয়ে আপলোড)
  // — Tanvir/Faysal/Imran/Sadia পোস্টে ছবি, Tanha/Nabila লেখা-পোস্টই থাকবে।
  const withPhoto = D.SEED_POSTS.filter(p => p.imageUrl)
  assert.equal(withPhoto.length, 4, `ছবিসহ পোস্ট ${withPhoto.length}টি — ৪ চাই`)
  for (const p of withPhoto) {
    assert.equal(p.imageUrl, `/${p.id}.jpg`, `${p.id} imageUrl ভুল: ${p.imageUrl}`)
  }
  for (const id of ['persona-tanha-1', 'persona-nabila-1']) {
    const p = D.SEED_POSTS.find(x => x.id === id)
    assert.ok(p && !p.imageUrl, `${id} লেখা-পোস্টই থাকবে`)
  }
  assert.equal(new Set(D.SEED_POSTS.map(p => p.id)).size, 12, 'ডুপ্লিকেট পোস্ট id')
})

check('Dating-এ পারসোনা নেই: DATING_PROFILES খালি, DatingPage-এ BUDDIES নেই', () => {
  assert.deepEqual(D.DATING_PROFILES, [])
  const pages = read('src/pages.tsx')
  const start = pages.indexOf('export function DatingPage()')
  const end = pages.indexOf('export function LiveTV()', start)
  const body = pages.slice(start, end)
  assert.ok(!body.includes('BUDDIES'), 'DatingPage-এ BUDDIES আছে')
  for (const b of B.BUDDIES) assert.ok(!body.includes(`'${b.name}'`) && !body.includes(`"${b.name}"`), `DatingPage-এ ${b.name} আছে`)
})

check('New Members-এ পারসোনা নেই (আসল ব্যবহারকারীই শুধু)', () => {
  const pages = read('src/pages.tsx')
  const start = pages.indexOf('function NewMembersSection()')
  const end = pages.indexOf('// ---------- Feed ----------', start)
  const body = pages.slice(start, end)
  for (const b of B.BUDDIES) assert.ok(!body.includes(b.name), `New Members-এ ${b.name} আছে`)
})

console.log(`\n${passed}/6 passed`)
