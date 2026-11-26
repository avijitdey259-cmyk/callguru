// মিসড কল — গ্রহণকারী যেন উত্তর-না-আসা কলটা দেখতে পান (Messenger-এর মতো)।
// চালানো: রিপো রুট থেকে `node tests/missed-call.test.mjs`
// (src/missedCall.ts pure লজিক esbuild দিয়ে বান্ডল করে চালায়; ওভারলে/
// স্টোর/পেজের গঠন সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) no-answer → গ্রহণকারীর মিসড এন্ট্রি (কলকারীর নয়), খরচ π ০
//   ২) decline → মিসড
//   ৩) অফলাইন গ্রহণকারী → ইনভাইট স্ট্যাটাস থেকেই মিসড (লগইন-সিঙ্ক)
//   ৪) ইনভাইট যাওয়ার আগেই কাটা → মিসড নয় (ডকই নেই / এখনো ringing)
//   ৫) ব্লক/বন্ধু-নয়/ব্যস্ত/প্রাইভেসি → মিসড নয়
//   ৬) একই কল দুবার লিখলেও ডুপ্লিকেট নয় (id `missed-<inviteId>`)
//   ৭) এন্ট্রিতে কলকারীর নাম + সময়; রিলোড/রি-সাইন-ইনে মেলানো (সিঙ্ক)
//   ৮) ব্যাজ + চ্যাট থ্রেডের কার্ড + কল-ব্যাক
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-missed-test-'))
const outFile = join(outDir, 'missedCall.mjs')
await build({
  entryPoints: [join(root, 'src/missedCall.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
})
const M = await import(outFile)

const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
const overlaySrc = readFileSync(join(root, 'src/IncomingCallOverlay.tsx'), 'utf8')
const componentsSrc = readFileSync(join(root, 'src/components.tsx'), 'utf8')
const firestoreSrc = readFileSync(join(root, 'src/firestore.ts'), 'utf8')
const rulesSrc = readFileSync(join(root, 'firestore.rules'), 'utf8')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

const ME = 'LXnGL8xA6VW8Gp7hvCaoakOha822'
const CALLER = 'GGCZ2Ta9TlheIBtdvQSCceC6Yfv2'
const OTHER = 'ZSv0IAhwjBabu09KeZGVFV2N2iF3'

function inviteDoc(over = {}) {
  return {
    id: 'inv-abc123',
    fromUid: CALLER,
    toUid: ME,
    fromName: 'Susmita',
    fromColour: '#7C3AED',
    kind: 'friend',
    code: 'ndra94',
    status: 'cancelled',
    createdAtMs: 1764050000000,
    ...over,
  }
}

console.log('— মিসড হওয়ার শর্ত —')
check('no-answer (cancelled) → গ্রহণকারীর মিসড এন্ট্রি, খরচ ০, কলকারীর নাম + সময়', () => {
  const r = M.inviteToMissedCall(inviteDoc({ status: 'cancelled' }), ME, 0.1)
  assert.ok(r)
  assert.equal(r.status, 'Missed')
  assert.equal(r.name, 'Susmita')
  assert.equal(r.peerId, CALLER)
  assert.equal(r.cost, 0)
  assert.equal(r.durationSec, 0)
  assert.equal(r.type, 'Friend')
  assert.ok(r.time.length > 0)
  assert.equal(r.id, 'missed-inv-abc123')
})
check('decline → মিসড', () => {
  const r = M.inviteToMissedCall(inviteDoc({ status: 'declined' }), ME, 0.1)
  assert.ok(r)
  assert.equal(r.status, 'Missed')
  assert.equal(r.name, 'Susmita')
})
check('অফলাইন গ্রহণকারী → একই ইনভাইট স্ট্যাটাস থেকেই মিসড (লগইন-সিঙ্কের পথ)', () => {
  // কলকারীর টাইমার 'cancelled' লেখে; গ্রহণকারীর সিঙ্ক সেই ডক থেকেই রেকর্ড বানায়
  const r = M.inviteToMissedCall(inviteDoc({ status: 'cancelled' }), ME, 0.1)
  assert.ok(r)
  assert.equal(r.peerId, CALLER)
})

console.log('— মিসড নয় —')
check('ইনভাইট যাওয়ার আগেই কাটা → ডকই নেই; ringing ডকও মিসড নয়', () => {
  assert.equal(M.inviteToMissedCall(inviteDoc({ status: 'ringing' }), ME, 0.1), null)
  assert.equal(M.inviteToMissedCall(inviteDoc({ status: 'accepted' }), ME, 0.1), null)
})
check('ব্লক/বন্ধু-নয়/ব্যস্ত/প্রাইভেসি (গেট-স্ট্যাটাস) → মিসড নয়', () => {
  for (const s of ['busy', 'not-friend', 'not-accepting']) {
    assert.equal(M.inviteToMissedCall(inviteDoc({ status: s }), ME, 0.1), null, s)
  }
})
check('অন্যের কল (toUid আমি নই) → আমার তালিকায় নয়', () => {
  assert.equal(M.inviteToMissedCall(inviteDoc({ toUid: OTHER }), ME, 0.1), null)
})
check('নাম/uid না থাকলে রেকর্ড নয়', () => {
  assert.equal(M.inviteToMissedCall(inviteDoc({ fromName: '  ' }), ME, 0.1), null)
  assert.equal(M.inviteToMissedCall(inviteDoc({ fromUid: '' }), ME, 0.1), null)
})

console.log('— ডুপ্লিকেট নয় —')
check('একই কল দুবার লিখলেও একটাই এন্ট্রি (id দিয়েই মেলানো)', () => {
  const r1 = M.inviteToMissedCall(inviteDoc(), ME, 0.1)
  const r2 = M.inviteToMissedCall(inviteDoc(), ME, 0.1)
  assert.equal(r1.id, r2.id)
  const merged = M.mergeMissedCalls([r1], [r2])
  assert.equal(merged.length, 1)
})
check('আলাদা কল আলাদা এন্ট্রি — নতুনগুলো উপরে', () => {
  const a = M.inviteToMissedCall(inviteDoc({ id: 'inv-a' }), ME, 0.1)
  const b = M.inviteToMissedCall(inviteDoc({ id: 'inv-b' }), ME, 0.1)
  const merged = M.mergeMissedCalls([a], [b])
  assert.equal(merged.length, 2)
  assert.equal(merged[0].id, 'missed-inv-b')
})
check('ডেটিং/সার্ভিস কলের ধরন ঠিক থাকে', () => {
  assert.equal(M.inviteToMissedCall(inviteDoc({ kind: 'dating' }), ME, 0.2).type, 'Dating')
  assert.equal(M.inviteToMissedCall(inviteDoc({ kind: 'service' }), ME, 0.2).type, 'Service')
})

console.log('— ব্যাজ + দেখা —')
check('না-দেখা মিসড গোনা হয়; দেখলে ব্যাজ সরে', () => {
  const calls = [
    M.inviteToMissedCall(inviteDoc({ id: 'inv-a' }), ME, 0.1),
    M.inviteToMissedCall(inviteDoc({ id: 'inv-b' }), ME, 0.1),
    { id: 'call-1', name: 'X', status: 'Completed', peerId: 'u1' },
  ]
  assert.equal(M.unseenMissedCount(calls, []), 2)
  const seen = M.markMissedSeenIds([], calls)
  assert.equal(M.unseenMissedCount(calls, seen), 0)
  // একজনেরটা দেখলে শুধু তারটাই সরে
  const seenOne = M.markMissedSeenIds([], calls, 'Susmita')
  assert.equal(M.unseenMissedCount(calls, seenOne), 0) // দুটোই Susmita-র
  const mixed = [...calls, M.inviteToMissedCall(inviteDoc({ id: 'inv-c', fromName: 'Rima', fromUid: OTHER }), ME, 0.1)]
  const seenSusmita = M.markMissedSeenIds([], mixed, 'Susmita')
  assert.equal(M.unseenMissedCount(mixed, seenSusmita), 1)
})
check('চ্যাট থ্রেডে একজনের মিসডগুলোই আসে', () => {
  const calls = [
    M.inviteToMissedCall(inviteDoc({ id: 'inv-a' }), ME, 0.1),
    M.inviteToMissedCall(inviteDoc({ id: 'inv-c', fromName: 'Rima', fromUid: OTHER }), ME, 0.1),
  ]
  assert.equal(M.missedCallsOf(calls, CALLER).length, 1)
  assert.equal(M.missedCallsOf(calls, 'Rima').length, 1)
  assert.equal(M.missedCallsOf(calls, 'Nobody').length, 0)
})

console.log('— ওয়্যারিং (সোর্স-গঠন) —')
check('কলকারী: no-answer টাইমারে ইনভাইট cancelled লেখে', () => {
  assert.ok(pagesSrc.includes("void updateCallInviteStatus(id, 'cancelled')"), 'timer marks cancelled')
  assert.ok(pagesSrc.includes("inviteStatusRef.current = 'cancelled'"))
})
check('কলকারী: বাজতে থাকা ইনভাইট মোছে না — cancelled লেখে; ধরা/গেট-আটকা ডক মোছে', () => {
  assert.ok(pagesSrc.includes("void deleteCallInvite(id)"), 'accepted/gate docs deleted')
  assert.ok(pagesSrc.includes("ইতিমধ্যে মিসড হিসেবে চিহ্নিত"), 'declined/cancelled docs kept')
})
check('কলকারী: পিয়ার রুমে ঢুকলে ইনভাইট accepted লেখে (পুশ-লিংকে ঢুকলেও মিসড হবে না)', () => {
  assert.ok(pagesSrc.includes("inviteStatusRef.current = 'accepted'"))
})
check('গ্রহণকারী: decline / মেয়াদ শেষ / দেরিতে আসা / কলকারী কাটলে মিসড লেখে', () => {
  assert.ok(overlaySrc.includes("recordMissed(inviteDocRef.current, 'declined')"))
  assert.ok(overlaySrc.includes("recordMissed(inviteDocRef.current, 'cancelled')"))
  assert.ok(overlaySrc.includes("recordMissed(doc, 'cancelled')"))
  assert.ok(overlaySrc.includes("recordMissed(d2, d2.status)"))
})
check('গ্রহণকারী: গেটে আটকা (ব্লক/বন্ধু নয়/ব্যস্ত) কলে মিসড লেখা হয় না', () => {
  // recordMissed শুধু declined/cancelled পথেই ডাকা হয় — busy/not-friend/not-accepting পথে নয়
  assert.ok(!overlaySrc.includes("recordMissed(d2, 'busy')"))
  assert.ok(overlaySrc.includes("if (d2.status === 'declined' || d2.status === 'cancelled') recordMissed(d2, d2.status)"))
})
check('লগইন-সিঙ্ক: বন্ধ ইনভাইট থেকে মিসড মেলানো হয় (রিলোড/রি-সাইন-ইনে টিকে থাকে)', () => {
  assert.ok(storeSrc.includes('fetchIncomingMissedCallInvites(uid)'))
  assert.ok(storeSrc.includes('inviteToMissedCall(d, uid'))
  assert.ok(storeSrc.includes('mergeMissedCalls(prev, recs)'))
  assert.ok(firestoreSrc.includes('export async function fetchIncomingMissedCallInvites'))
})
check('নিয়ম: কলকারী cancelled লিখতে পারেন, গ্রহণকারী declined লিখতে পারেন', () => {
  assert.ok(rulesSrc.includes("'cancelled'") && rulesSrc.includes("'declined'"))
})
check('ব্যাজ: TopBar Messenger + Sidebar Call History-তে লাল মিসড-ব্যাজ', () => {
  assert.ok(componentsSrc.includes('missedUnseenCount'))
  assert.ok(componentsSrc.includes('bg-red-600'))
})
check('চ্যাট থ্রেডে মিসড কার্ড + Call back বোতাম', () => {
  assert.ok(pagesSrc.includes('Missed call</b> from {m.name}'))
  assert.ok(pagesSrc.includes('Call back</button>'))
  assert.ok(pagesSrc.includes('missedCallsOf(calls, activeFriend?.id ?? active)'))
})
check('কল হিস্ট্রি খুললে মিসড "দেখা" হয়', () => {
  assert.ok(pagesSrc.includes('markMissedCallsSeen()'))
})
check('মিসড রেকর্ডের ধরনে Missed আছে', () => {
  assert.ok(storeSrc.includes("'Completed' | 'Missed' | 'Auto-cut'"))
  assert.ok(overlaySrc.includes("import { inviteToMissedCall } from './missedCall'"))
})

console.log(`\n${passed} passed`)
