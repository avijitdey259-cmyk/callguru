// সব আসল ব্যবহারকারী খোঁজা + অটোকমপ্লিট সাজেশন টেস্ট।
// চালানো: রিপো রুট থেকে `node tests/all-user-search.test.mjs`
// (esbuild দিয়ে src/friendSearch.ts + src/newMembers.ts বান্ডল করে Node-এ চালায়;
//  Firestore/পেজ/স্টোরের গঠন সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) publicProfiles-এর সব আসল ব্যবহারকারী নাম/আইডি খোঁজায় আসে
//   ২) নিজেকে কখনো দেখায় না
//   ৩) ৫ চ্যাট পারসোনা এখনো খোঁজায় পাওয়া যায়
//   ৪) একই ব্যবহারকারী বন্ধু হিসেবেও থাকলে একবারই দেখায় (id দিয়ে, নাম দিয়েও)
//   ৫) কিছু না মিললে খালি তালিকা (খালি অবস্থা)
//   ৬) সাজেশন: টাইপ করলে মেলা নাম/আইডি আসে, সর্বোচ্চ ৮টি, খালি কোয়েরিতে কিছু না
//   ৭) সাজেশনে ট্যাপ করলে তার নাম কোয়েরি হয় — ফলে ওই একজনই দেখায়
//   ৮) referralCode দিয়ে খুঁজলে মেলে (Firebase uid দেখানো হয় না)
//   ৯) Firestore না পেলে লোকাল তালিকাতেই খোঁজা চলে (ফলব্যাক — ক্র্যাশ নয়, ভুয়া নয়)
//  ১০) পাবলিক প্রোফাইলে শুধু নাম/সময়/রং/referralCode — ইমেইল/ফোন/ব্যালেন্স নয়
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fsSrc = readFileSync(join(root, 'src/firestore.ts'), 'utf8')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const searchUISrc = readFileSync(join(root, 'src/searchUI.tsx'), 'utf8')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
const nmSrc = readFileSync(join(root, 'src/newMembers.ts'), 'utf8')

const outDir = mkdtempSync(join(tmpdir(), 'picall-alluser-test-'))
async function bundle(entry, name) {
  const outFile = join(outDir, name)
  await build({ entryPoints: [join(root, entry)], bundle: true, format: 'esm', platform: 'node', outfile: outFile, logLevel: 'silent' })
  return import(outFile)
}
const FS = await bundle('src/friendSearch.ts', 'friendSearch.mjs')
const NM = await bundle('src/newMembers.ts', 'newMembers.mjs')

const FRIENDS = [
  { id: 'fr-1', name: 'রাফি আহমেদ', color: '#1877F2', online: true },
]
const SUGGESTIONS = []
const BUDDIES = [
  { id: 'bd-rima', name: 'রিমা', color: '#E91E63', online: true },
  { id: 'bd-shakil', name: 'শাকিল', color: '#1877F2', online: true },
  { id: 'bd-fahim', name: 'ফাহিম', color: '#27AE60', online: true },
  { id: 'bd-mim', name: 'মিম', color: '#9C27B0', online: true },
  { id: 'bd-asha', name: 'আশা', color: '#FF9800', online: true },
]
// আসল ব্যবহারকারী — publicProfiles থেকে (নতুন থেকে পুরনো)
const ALL_USERS = [
  { id: 'uid-avijit-2', displayName: 'আভিজিৎ দে', colour: '#1877F2', referralCode: 'cg-x7k2' },
  { id: 'uid-karim', displayName: 'করিম উদ্দিন', colour: '#27AE60', referralCode: 'cg-m9p4' },
  { id: 'uid-rahi', displayName: 'রাহি', colour: '#E91E63' }, // পুরোনো প্রোফাইল — কোড নেই
  { id: 'fr-1', displayName: 'রাফি আহমেদ', colour: '#1877F2', referralCode: 'cg-r4f1' }, // বন্ধু হিসেবেও আছে
]

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

const local = FS.buildSearchablePeople(FRIENDS, SUGGESTIONS, BUDDIES)
const merged = FS.mergeAllUsers(local, ALL_USERS, 'uid-self-123')

check('সব আসল ব্যবহারকারী খোঁজায় আসে (নামে)', () => {
  assert.equal(FS.searchPeople(merged, 'করিম').length, 1)
  assert.equal(FS.searchPeople(merged, 'করিম')[0].name, 'করিম উদ্দিন')
  assert.equal(FS.searchPeople(merged, 'আভিজিৎ').length, 1)
})

check('নিজেকে কখনো দেখায় না', () => {
  const withSelf = FS.mergeAllUsers(local, [...ALL_USERS, { id: 'uid-self-123', displayName: 'আমি', colour: '#000000', referralCode: 'cg-me00' }], 'uid-self-123')
  assert.equal(withSelf.some(p => p.id === 'uid-self-123'), false)
  assert.equal(FS.searchPeople(withSelf, 'আমি').length, 0)
})

check('৫ পারসোনা এখনো খোঁজায় পাওয়া যায়', () => {
  for (const n of ['রিমা', 'শাকিল', 'ফাহিম', 'মিম', 'আশা']) {
    assert.equal(FS.searchPeople(merged, n).length, 1, n)
  }
})

check('একই ব্যবহারকারী বন্ধু + প্রোফাইলে থাকলে একবারই (বন্ধুর তথ্য থাকে)', () => {
  const rafis = merged.filter(p => p.name === 'রাফি আহমেদ')
  assert.equal(rafis.length, 1)
  assert.equal(rafis[0].isFriend, true)
  assert.equal(rafis[0].id, 'fr-1')
})

check('কিছু না মিললে খালি তালিকা', () => {
  assert.deepEqual(FS.searchPeople(merged, 'zzz-কেউ-না'), [])
  assert.deepEqual(FS.searchPeople(merged, 'অচেনা নাম'), [])
})

check('referralCode দিয়ে খুঁজলে মেলে (uid দিয়েও ভেতরে মেলে, কিন্তু UI-তে দেখায় না)', () => {
  const byCode = FS.searchPeople(merged, 'cg-m9p4')
  assert.equal(byCode.length, 1)
  assert.equal(byCode[0].name, 'করিম উদ্দিন')
  assert.equal(FS.searchPeople(merged, 'CG-X7K2').length, 1) // কেস-ইনসেনসিটিভ
  // uid লিখলেও ভেতরে মেলে (আইডি সার্চ) — তবে ফলের সারিতে uid দেখানো হয় না
  assert.equal(FS.searchPeople(merged, 'uid-karim').length, 1)
})

check('সাজেশন: টাইপ করলে মেলা নাম আসে, সর্বোচ্চ ৮টি', () => {
  const s = FS.suggestionsFor(merged, 'র')
  assert.ok(s.length >= 2 && s.length <= 8, `got ${s.length}`)
  assert.ok(s.every(p => p.name.toLowerCase().includes('র') || p.id.toLowerCase().includes('র')))
  const many = Array.from({ length: 20 }, (_, i) => ({ id: `u${i}`, name: `রহিম ${i}`, color: '#000', online: true, isFriend: false }))
  assert.equal(FS.suggestionsFor(many, 'রহিম').length, 8)
})

check('সাজেশন: খালি কোয়েরিতে কিছু না (ড্রপডাউন লুকানো থাকে)', () => {
  assert.deepEqual(FS.suggestionsFor(merged, ''), [])
  assert.deepEqual(FS.suggestionsFor(merged, '   '), [])
})

check('সাজেশনে ট্যাপ করলে তার নাম কোয়েরি হয় — ওই একজনই ফলে আসে', () => {
  const s = FS.suggestionsFor(merged, 'করি')
  assert.equal(s.length, 1)
  const pickedQuery = s[0].name // ট্যাপ করলে কোয়েরি = সাজেশনের নাম
  const r = FS.searchPeople(merged, pickedQuery)
  assert.equal(r.length, 1)
  assert.equal(r[0].name, 'করিম উদ্দিন')
})

check('সাজেশন আইডি দিয়েও মেলে', () => {
  const s = FS.suggestionsFor(merged, 'cg-m9')
  assert.equal(s.length, 1)
  assert.equal(s[0].name, 'করিম উদ্দিন')
})

check('Firestore না পেলে লোকাল তালিকাতেই খোঁজা চলে (ফলব্যাক)', () => {
  assert.ok(fsSrc.includes('fetchAllPublicProfiles'), 'fetchAllPublicProfiles নেই')
  assert.ok(fsSrc.includes('catch { return [] }'), 'fetch ব্যর্থতায় [] ফেরে না')
  const localOnly = FS.mergeAllUsers(local, [], 'uid-self-123')
  assert.deepEqual(localOnly, local)
  assert.equal(FS.searchPeople(localOnly, 'রিমা').length, 1)
  assert.equal(FS.suggestionsFor(localOnly, 'রি').length, 1)
  assert.ok(searchUISrc.includes('allUsers ?? []'), 'searchUI-তে allUsers ?? [] ফলব্যাক নেই')
})

check('পাবলিক প্রোফাইলে শুধু নাম/সময়/রং/referralCode — গোপন কিছু নয়', () => {
  const m = NM.mapPublicProfile('uid-1', { displayName: 'করিম', createdAt: 1700000000000, colour: '#123456', referralCode: 'cg-m9p4', email: 'x@y.com', piBalance: 99, phone: '01xxx' })
  assert.deepEqual(Object.keys(m).sort(), ['colour', 'createdAtMs', 'displayName', 'id', 'referralCode'])
  assert.equal(m.referralCode, 'cg-m9p4')
  const old = NM.mapPublicProfile('uid-2', { displayName: 'রাহি', createdAt: null })
  assert.equal(old.referralCode, undefined)
  assert.equal(old.displayName, 'রাহি')
})

check('স্টোর লগইনে referralCode পাবলিক প্রোফাইলে লেখে (নতুন + ব্যাকফিল)', () => {
  assert.ok(storeSrc.includes('writePublicProfile(uid, user.name, referralCode)'), 'referralCode-সহ writePublicProfile কল নেই')
  assert.ok(fsSrc.includes('referralCode: code'), 'firestore.ts referralCode লেখে না')
})

check('দুটো জায়গায় সাজেশন ড্রপডাউন আছে (হেডার সার্চ + Friends)', () => {
  // Friends পেজের বাক্সে <SearchSuggestions />; হেডারের বাক্সে (searchUI.tsx-এর
  // HeaderSearch) বন্ধু + পোস্টের একসাথে ড্রপডাউন — দুটোতেই ট্যাপে ড্রপডাউন লুকায়।
  const count = (pagesSrc.match(/<SearchSuggestions /g) || []).length
  assert.equal(count, 1, `SearchSuggestions ${count} বার — Friends বাক্সে ১ বার হওয়ার কথা`)
  assert.ok(pagesSrc.includes('useAllUserSearch(friends, query)'), 'useAllUserSearch ব্যবহার হয়নি')
  assert.ok(pagesSrc.includes('setShowSugg(false)'), 'ট্যাপে ড্রপডাউন লুকায় না')
  assert.ok(searchUISrc.includes('export function HeaderSearch'), 'HeaderSearch নেই')
  assert.ok(searchUISrc.includes('👥 বন্ধু'), 'হেডার ড্রপডাউনে বন্ধু সেকশন নেই')
  assert.ok(searchUISrc.includes('📝 পোস্ট'), 'হেডার ড্রপডাউনে পোস্ট সেকশন নেই')
  assert.ok(searchUISrc.includes('সব ফলাফল দেখুন'), 'হেডার ড্রপডাউনে সব-ফলাফল বোতাম নেই')
  assert.ok(searchUISrc.includes('setShowSugg(false)'), 'হেডার ড্রপডাউন ট্যাপে লুকায় না')
  assert.ok(searchUISrc.includes('fetchAllPublicProfiles(100)'), '১০০ সীমা নেই')
})

check('ফলে Firebase uid দেখানো হয় না — referralCode বা লোকাল id দেখায়', () => {
  assert.ok(!pagesSrc.includes('আইডি: {p.id}'), 'ফলে এখনো p.id দেখানো হয়')
  assert.ok(pagesSrc.includes('আইডি: {p.referralCode ?? p.id}'), 'referralCode ?? id দেখানো হয় না')
})

check('মোবাইল ও কম্পিউটারে একই — সার্চ/সাজেশনে ডিভাইস-ভেদ নেই', () => {
  // Friends বাক্সে <SearchSuggestions />; হেডার সার্চে (searchUI.tsx-এর
  // HeaderSearch) একই নিয়মের বন্ধু + পোস্ট ড্রপডাউন — মোবাইল/ডেস্কটপ
  // আলাদা সংস্করণ নেই, একই কম্পোনেন্ট/ক্লাস সব স্ক্রিনে।
  const uses = (pagesSrc.match(/<SearchSuggestions /g) || []).length
  assert.equal(uses, 1, 'Friends বাক্সে SearchSuggestions ১ বার থাকার কথা')
  assert.ok(searchUISrc.includes('export function HeaderSearch'), 'HeaderSearch নেই')
  // সার্চ/সাজেশন কোডে responsive লুকানো/দেখানো (আলাদা hidden ক্লাস, md:/sm:) নেই
  // (ড্রপডাউনের নিজের overflow-hidden গোনা হয় না — ওটা শুধু কোণ গোল করে)
  const searchStart = searchUISrc.indexOf('export function useAllUserSearch')
  const searchEnd = searchUISrc.indexOf('export function HeaderSearch')
  const searchCode = searchUISrc.slice(searchStart, searchEnd)
  assert.ok(searchStart !== -1 && searchEnd > searchStart, 'সার্চ কোডের span পাওয়া যায়নি')
  assert.ok(!/(^|[\s"'])hidden([\s"']|$)|md:|sm:|lg:|innerWidth|isMobile/.test(searchCode), 'সার্চ কোডে ডিভাইস-ভেদ আছে')
  // ট্যাপ/ক্লিক একই হ্যান্ডলার (onClick — মোবাইল ট্যাপেও চলে); hover-নির্ভর কিছু নেই
  assert.ok(searchCode.includes('onClick={() => onPick(p)}'), 'সাজেশন ট্যাপ হ্যান্ডলার নেই')
  assert.ok(!/onMouseDown|onMouseEnter/.test(searchCode), 'ডেস্কটপ-শুধু মাউস হ্যান্ডলার আছে')
  // Card-এ overflow-hidden নেই — absolute ড্রপডাউন কোনো স্ক্রিনেই কাটা পড়ে না
  const compSrc = readFileSync(join(root, 'src/components.tsx'), 'utf8')
  const cardStart = compSrc.indexOf('export function Card')
  const cardBody = compSrc.slice(cardStart, compSrc.indexOf('\n}\n', cardStart) + 3)
  assert.ok(!cardBody.includes('overflow-hidden'), 'Card ড্রপডাউন কেটে দেবে')
  // ড্রপডাউন কার্ডের পুরো প্রস্থে (left-0 right-0) — ছোট স্ক্রিনেও একইভাবে দেখায়
  assert.ok(searchCode.includes('absolute left-0 right-0 top-full'), 'ড্রপডাউন পুরো প্রস্থে নেই')
  assert.ok(searchUISrc.includes('absolute left-0 right-0 top-full'), 'হেডার ড্রপডাউন পুরো প্রস্থে নেই')
})

console.log(`\n${passed}/16 passed`)
