// Remove ALL demo data — no demo seed may come back (owner: "Live a demo gulo bad dao")
// Run: node tests/no-demo-data.test.mjs
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const data = read('src/data.ts')
const pages = read('src/pages.tsx')
const buddies = read('src/buddies.ts')

let n = 0
function check(name, fn) {
  n++
  try { fn(); console.log(`ok ${n} - ${name}`) }
  catch (e) { console.error(`not ok ${n} - ${name}\n  ${e.message}`); process.exitCode = 1 }
}

const DEMO_SERVICE_IDS = ['srv-1', 'srv-2', 'srv-3', 'srv-4', 'srv-5', 'srv-6']
const DEMO_DATING_IDS = ['dt-1', 'dt-2', 'dt-3', 'dt-4', 'dt-5', 'dt-6']
const DEMO_NAMES = ['Tania', 'Rakib', 'Sumaiya', 'Arif', 'Nusrat', 'Sajib']
const DEMO_PROVIDERS = ['CleanHome', 'CoolCare', 'FixIt', 'PowerFix', 'PixelStudio', 'Mehjabin']

check('data.ts: no demo service ids (srv-1..srv-6)', () => {
  for (const id of DEMO_SERVICE_IDS) assert.ok(!data.includes(id), `${id} ফিরে এসেছে`)
})

check('data.ts: no demo dating ids (dt-1..dt-6)', () => {
  for (const id of DEMO_DATING_IDS) assert.ok(!data.includes(id), `${id} ফিরে এসেছে`)
})

check('data.ts: no demo dating names', () => {
  for (const name of DEMO_NAMES) assert.ok(!data.includes(name), `${name} ফিরে এসেছে`)
})

check('data.ts: no demo service providers', () => {
  for (const p of DEMO_PROVIDERS) assert.ok(!data.includes(p), `${p} ফিরে এসেছে`)
})

check('data.ts: SERVICES and DATING_PROFILES are empty arrays', () => {
  assert.ok(/export const SERVICES: Service\[\] = \[\]/.test(data), 'SERVICES খালি নয়')
  assert.ok(/export const DATING_PROFILES: DatingProfile\[\] = \[\]/.test(data), 'DATING_PROFILES খালি নয়')
})

check('pages.tsx: no fake groups with invented member counts', () => {
  for (const s of ['IELTS Preparation', 'Freelancers Bangladesh', '12,400', '8,900', '3,200', '5,600']) {
    assert.ok(!pages.includes(s), `ভুয়া গ্রুপ "${s}" ফিরে এসেছে`)
  }
})

check('pages.tsx: no fake expert review', () => {
  assert.ok(!pages.includes('Got very good advice'), 'ভুয়া রিভিউ ফিরে এসেছে')
})

check('pages.tsx: no "Demo — local data" experts badge', () => {
  assert.ok(!pages.includes('Demo — local data'), 'ডেমো ব্যাজ ফিরে এসেছে')
})

check('pages.tsx: real empty states where demo lists went empty', () => {
  // 'No home services yet.' সরানো হয়েছে 2026-11-24: "Home Service"
  // (সামনাসামনি বুকিং) পাতাটি ভার্চুয়াল Services দিয়ে বদলে গেছে —
  // খালি অবস্থা এখন "No services yet. Offer the first one!" (services.test.mjs দেখে)।
  for (const s of ['No services yet.', 'No profiles yet', 'No groups or pages yet.', 'No reviews yet.', 'No user totals yet', 'No recordings yet.', 'No attempts logged yet.', 'No reported profiles.']) {
    assert.ok(pages.includes(s), `খালি অবস্থা নেই: "${s}"`)
  }
})

check('pages.tsx: no fake live-viewer simulation (was 14, random walk)', () => {
  assert.ok(!pages.includes('useState(14)'), 'ভুয়া ১৪ দর্শক ফিরে এসেছে')
  assert.ok(!pages.includes('Math.max(3, v + Math.floor'), 'ভুয়া দর্শক সিমুলেশন ফিরে এসেছে')
  assert.ok(pages.includes('Live server is not connected — nobody can watch yet.'), 'লাইভ সার্ভার বার্তা নেই')
})

check('pages.tsx: no fake admin totals or moderation counts', () => {
  for (const s of ['Total users (demo)', '1,240', '3 attempts logged', 'Reported dating profiles: 2', 'added in the demo', 'no real recording in the demo', 'Demo live — viewer count is demo data']) {
    assert.ok(!pages.includes(s), `ভুয়া অ্যাডমিন/লাইভ তথ্য ফিরে এসেছে: "${s}"`)
  }
})

check('buddies.ts: the 5 kept chat personas are untouched', () => {
  for (const id of ['bd-rima', 'bd-shakil', 'bd-fahim', 'bd-mim', 'bd-asha']) {
    assert.ok(buddies.includes(id), `পারসোনা নেই: ${id}`)
  }
})

const store = read('src/store.tsx')
const rules = read('firestore.rules')
const storageRules = read('storage.rules')
const profile = read('src/profile.ts')

check('pages.tsx: all removed "Demo" user-visible strings are gone', () => {
  for (const s of [
    'Demo note: referrals are tracked', 'Demo Pi', 'demo deposit', 'Connect π Pi (Demo)',
    'Add Demo Pi', 'Demo number', 'Demo ID', 'Demo rate', 'Processing (demo)',
    'Demo Pi Wallet', 'Demo KYC', 'Demo live', 'PiCall demo Pi address',
    'Your Pi address (demo)', 'demo Pi are outside', 'in the demo it stays',
    'in the demo they stay', 'submissions in this demo stay',
    'the wallet will show demo again', 'If empty, the earlier demo will show',
    'at demo rate', "', demo'",
  ]) assert.ok(!pages.includes(s), `"${s}" এখনো আছে`)
})

check('pages.tsx: honest replacement strings are present', () => {
  for (const s of [
    'Referrals are tracked on this device.',
    'Your submission is reviewed by the admin.',
    'Live server not connected — check your connection and try again.',
    'Not set up yet — ask the admin',
    'Same district', 'Pi Chain', 'Pi Mainnet',
    'Profile Settings', '% complete', 'Hide my address from other users',
    'Video (max 50 MB)', 'Set profile photo',
  ]) assert.ok(pages.includes(s), `"${s}" নেই`)
})

check('pages.tsx: Pi chain is Mainnet-only (owner: no Testnet, no BNB)', () => {
  assert.ok(!pages.includes('Pi Testnet'), 'Pi Testnet এখনো Wallet-এ আছে')
  assert.ok(pages.includes('Pi Mainnet (real Pi)'), 'Mainnet লেবেল নেই')
})

check('pages.tsx: Pi Wallet card comes before Top Up; only one Pi total on Wallet', () => {
  assert.ok(pages.indexOf('Pi Wallet</h2>') !== -1, 'Pi Wallet কার্ড নেই')
  assert.ok(pages.indexOf('Pi Wallet</h2>') < pages.indexOf('Top Up</h2>'), 'Pi Wallet উপরে নেই — Top Up আগে আছে')
  assert.ok(!pages.includes('Total Pi: <b>'), 'Pi Wallet-এ "Total Pi:" এখনো আছে')
  assert.ok(!pages.includes('Current Pi Balance: <b className="text-purple-600">'), 'Pi Report-এ "Current Pi Balance:" এখনো আছে')
})

check('chat: Firestore chat wiring exists (pages + rules)', () => {
  for (const s of ['sendChatMessage', 'subscribeChatMessages', 'chatRoomId']) assert.ok(pages.includes(s), `pages.tsx-এ ${s} নেই`)
  assert.ok(rules.includes('match /chats/{roomId}/messages/{msgId}'), 'firestore.rules-এ chats ব্লক নেই')
  assert.ok(rules.includes('request.resource.data.fromUid == request.auth.uid'), 'chats নিয়মে fromUid চেক নেই')
})

check('storage.rules: user uploads only, 50 MB max', () => {
  assert.ok(storageRules.includes('match /uploads/{userId}/{fileName}'), 'uploads নিয়ম নেই')
  assert.ok(storageRules.includes('request.resource.size < 50 * 1024 * 1024'), '50 MB সীমা নেই')
  assert.ok(storageRules.includes('request.auth.uid == userId'), 'নিজের ফোল্ডার চেক নেই')
})

check('data.ts: no demo payment constants; districts + interests exist', () => {
  assert.ok(!data.includes('PICALL-DEMO-0000'), 'BINANCE_PAY_ID ডেমো আইডি ফিরে এসেছে')
  assert.ok(!data.includes('PI_DEPOSIT_ADDRESS'), 'ডেমো Pi ঠিকানা ফিরে এসেছে')
  for (const d of ['Chattogram', 'Dhaka', 'Sylhet', 'Khulna', 'Barishal', 'Rangpur', 'Mymensingh', 'Rajshahi']) assert.ok(data.includes(d), `জেলা নেই: ${d}`)
  for (const i of ['Music', 'Movies', 'Travel', 'Cricket', 'Football', 'Cooking', 'Reading', 'Photography', 'Gaming', 'Gardening', 'Fishing', 'Shopping', 'Dance', 'Singing', 'Technology', 'Sports']) assert.ok(data.includes(i), `ইন্টারেস্ট নেই: ${i}`)
  assert.ok(data.includes('imageUrl'), 'Post-এ imageUrl নেই')
  assert.ok(data.includes('videoUrl'), 'Post-এ videoUrl নেই')
})

check('store.tsx: demo Pi helpers gone; profile + chain fields exist', () => {
  assert.ok(!store.includes('addDemoPi'), 'addDemoPi এখনো আছে')
  assert.ok(!store.includes('connectPiWallet'), 'connectPiWallet এখনো আছে')
  assert.ok(store.includes('Deposit recorded'), 'নতুন deposit স্ট্যাটাস নেই')
  assert.ok(store.includes('profileCompletion'), 'profileCompletion নেই')
  assert.ok(store.includes('piTestnetAddress'), 'piTestnetAddress নেই')
  assert.ok(store.includes('chain:'), 'PiTx-এ chain নেই')
})

check('profile.ts: completion helper exists', () => {
  assert.ok(profile.includes('export function profileCompletion'), 'profileCompletion নেই')
  assert.ok(profile.includes('hideAddress'), 'hideAddress নেই')
})
