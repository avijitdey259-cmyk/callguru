// কল ইনভাইট (Firestore) — নতুন 1-to-1 কল পথের টেস্ট (২০২৬-১১-২৫ রিবিল্ড)।
// চালানো: রিপো রুট থেকে `node tests/call-invites.test.mjs`
// (esbuild দিয়ে src/*.ts বান্ডল করে Node-এ চালায় — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) ডক ম্যাপিং — ঠিক ডক মেলে, ভুল/অসম্পূর্ণ ডক null
//   ২) ডক → ওভারলে ইনভাইট আকৃতি + মেয়াদ
//   ৩) স্ট্যাটাস → কলকারীর কারণ
//   ৪) পেলোড বানানো — ভুল আকৃতি হলে null
//   ৫) কলযোগ্য টার্গেট — Firebase uid / cg- হ্যাঁ, পারসোনা/সিড id না
//   ৬) গেটের কারণ → ইনভাইট স্ট্যাটাস
//   ৭) ওয়্যারিং (সোর্স) — presence নেই, Firestore পথ আছে
import { build } from 'esbuild'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-ci-test-'))

async function loadModule(entry) {
  const outFile = join(outDir, entry.replace(/[^a-z]/gi, '') + '.mjs')
  await build({
    entryPoints: [join(root, 'src', entry)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: outFile,
    logLevel: 'silent',
    define: { 'import.meta.env.VITE_API_URL': '""' },
  })
  return import(outFile)
}

const CI = await loadModule('callInvites.ts')
const IC = await loadModule('incomingCall.ts')

let n = 0
function check(name, fn) {
  n += 1
  fn()
  console.log(`ok ${n} - ${name}`)
}

const NOW = Date.now()
const FIREBASE_UID = 'LXnGL8xA6VW8Gp7hvCaoakOha822'
const OTP_UID = 'cg-abc123'
const DOC = {
  fromUid: FIREBASE_UID,
  toUid: 'ZSv0IAhwjBabu09KeZGVFV2N2iF3',
  fromName: 'রিমা',
  fromColour: '#1877F2',
  fromPhoto: 'https://example.com/photo.jpg',
  fromNumericUid: 100001,
  kind: 'friend',
  code: 'abc123',
  status: 'ringing',
  createdAtMs: NOW,
}

// ---------- ১) ডক ম্যাপিং ----------
check('mapCallInviteDoc — ঠিক ডক মেলে, সব ক্ষেত্র থাকে', () => {
  const d = CI.mapCallInviteDoc('doc-1', DOC)
  assert.ok(d)
  assert.equal(d.id, 'doc-1')
  assert.equal(d.fromUid, FIREBASE_UID)
  assert.equal(d.toUid, 'ZSv0IAhwjBabu09KeZGVFV2N2iF3')
  assert.equal(d.fromName, 'রিমা')
  assert.equal(d.fromColour, '#1877F2')
  assert.equal(d.fromPhoto, 'https://example.com/photo.jpg')
  assert.equal(d.fromNumericUid, 100001)
  assert.equal(d.kind, 'friend')
  assert.equal(d.code, 'abc123')
  assert.equal(d.status, 'ringing')
  assert.equal(d.createdAtMs, NOW)
})
check('mapCallInviteDoc — নাম/রং/কোড/ধরন/স্ট্যাটাস/সময় ভুল হলে null', () => {
  assert.equal(CI.mapCallInviteDoc('x', { ...DOC, fromName: '' }), null)
  assert.equal(CI.mapCallInviteDoc('x', { ...DOC, fromName: 'x'.repeat(61) }), null)
  assert.equal(CI.mapCallInviteDoc('x', { ...DOC, fromColour: '' }), null)
  assert.equal(CI.mapCallInviteDoc('x', { ...DOC, code: 'bad!' }), null)
  assert.equal(CI.mapCallInviteDoc('x', { ...DOC, code: 'abc12' }), null)
  assert.equal(CI.mapCallInviteDoc('x', { ...DOC, kind: 'link' }), null)
  assert.equal(CI.mapCallInviteDoc('x', { ...DOC, status: 'pending' }), null)
  assert.equal(CI.mapCallInviteDoc('x', { ...DOC, createdAtMs: 'now' }), null)
  assert.equal(CI.mapCallInviteDoc('x', { ...DOC, fromUid: '' }), null)
  assert.equal(CI.mapCallInviteDoc('x', { ...DOC, toUid: '' }), null)
  assert.equal(CI.mapCallInviteDoc('x', null), null)
  assert.equal(CI.mapCallInviteDoc('', DOC), null)
})
check('mapCallInviteDoc — নিজেকে নিজের ইনভাইট নয়', () => {
  assert.equal(CI.mapCallInviteDoc('x', { ...DOC, toUid: FIREBASE_UID }), null)
})
check('mapCallInviteDoc — ভুল সংখ্যা-UID/ছবি বাদ যায়, ডক তবু মেলে', () => {
  const d = CI.mapCallInviteDoc('x', { ...DOC, fromNumericUid: 99999, fromPhoto: 'javascript:alert(1)' })
  assert.ok(d)
  assert.equal(d.fromNumericUid, undefined)
  assert.equal(d.fromPhoto, undefined)
  const d2 = CI.mapCallInviteDoc('x', { ...DOC, fromNumericUid: undefined, fromPhoto: undefined })
  assert.ok(d2)
  assert.equal(d2.fromNumericUid, undefined)
})
check('mapCallInviteDoc — OTP ব্যবহারকারীর cg- পরিচয়ও মেলে', () => {
  const d = CI.mapCallInviteDoc('x', { ...DOC, fromUid: OTP_UID })
  assert.ok(d)
  assert.equal(d.fromUid, OTP_UID)
})

// ---------- ২) ডক → ওভারলে ইনভাইট ----------
check('inviteDocToCallInvite — ওভারলে/গেটিং-এর আকৃতি, মেয়াদ ঠিক', () => {
  const inv = CI.inviteDocToCallInvite(CI.mapCallInviteDoc('doc-1', DOC))
  assert.equal(inv.code, 'abc123')
  assert.equal(inv.fromId, FIREBASE_UID)
  assert.equal(inv.fromName, 'রিমা')
  assert.equal(inv.fromColor, '#1877F2')
  assert.equal(inv.kind, 'friend')
  assert.equal(inv.at, NOW)
  assert.equal(IC.isInviteExpired(inv, NOW), false)
  assert.equal(IC.isInviteExpired(inv, NOW + 61000), true)
  // গেটিং আগের মতোই চলে — বন্ধু নয় হলে friends-প্রাইভেসিতে আটকায়
  const g = IC.shouldShowInvite(inv, { privacy: 'friends', isFriend: false, inCall: false, selfId: 'uid-me', now: NOW })
  assert.equal(g.show, false)
  assert.equal(g.reason, 'privacy-friends')
})

// ---------- ৩) স্ট্যাটাস → কারণ ----------
check('callInviteStatusToFailureReason — সব স্ট্যাটাস', () => {
  assert.equal(CI.callInviteStatusToFailureReason('declined'), 'declined')
  assert.equal(CI.callInviteStatusToFailureReason('busy'), 'busy')
  assert.equal(CI.callInviteStatusToFailureReason('not-friend'), 'not-friend')
  assert.equal(CI.callInviteStatusToFailureReason('not-accepting'), 'not-accepting')
  assert.equal(CI.callInviteStatusToFailureReason('ringing'), null)
  assert.equal(CI.callInviteStatusToFailureReason('accepted'), null)
  assert.equal(CI.callInviteStatusToFailureReason('cancelled'), null)
  assert.equal(CI.isTerminalCallInviteStatus('accepted'), true)
  assert.equal(CI.isTerminalCallInviteStatus('ringing'), false)
  assert.equal(CI.isCallInviteStatus('pending'), false)
})

// ---------- ৪) পেলোড ----------
check('buildCallInvitePayload — ঠিক পেলোড, ভুল আকৃতি হলে null', () => {
  const p = CI.buildCallInvitePayload({ fromUid: FIREBASE_UID, toUid: 'ZSv0IAhwjBabu09KeZGVFV2N2iF3', fromName: 'রিমা', fromColour: '#1877F2', kind: 'dating', code: 'xyz789' })
  assert.ok(p)
  assert.equal(p.kind, 'dating')
  assert.equal(p.status, undefined)
  assert.equal(CI.buildCallInvitePayload({ fromUid: FIREBASE_UID, toUid: FIREBASE_UID, fromName: 'রিমা', fromColour: '#1877F2', kind: 'friend', code: 'abc123' }), null)
  assert.equal(CI.buildCallInvitePayload({ fromUid: FIREBASE_UID, toUid: 'ZSv0IAhwjBabu09KeZGVFV2N2iF3', fromName: '', fromColour: '#1877F2', kind: 'friend', code: 'abc123' }), null)
  assert.equal(CI.buildCallInvitePayload({ fromUid: FIREBASE_UID, toUid: 'ZSv0IAhwjBabu09KeZGVFV2N2iF3', fromName: 'রিমা', fromColour: '#1877F2', kind: 'link', code: 'abc123' }), null)
  assert.equal(CI.buildCallInvitePayload({ fromUid: FIREBASE_UID, toUid: 'ZSv0IAhwjBabu09KeZGVFV2N2iF3', fromName: 'রিমা', fromColour: '#1877F2', kind: 'friend', code: 'bad!' }), null)
})
check('buildCallInvitePayload — OTP ব্যবহারকারীর cg- পরিচয়েও পেলোড হয়', () => {
  const p = CI.buildCallInvitePayload({ fromUid: OTP_UID, toUid: FIREBASE_UID, fromName: 'Avijit', fromColour: '#27AE60', kind: 'friend', code: 'abc123' })
  assert.ok(p)
  assert.equal(p.fromUid, OTP_UID)
})

// ---------- ৫) কলযোগ্য টার্গেট ----------
check('isCallableInviteTarget — Firebase uid / cg- হ্যাঁ, পারসোনা/সিড id না', () => {
  assert.equal(CI.isCallableInviteTarget(FIREBASE_UID), true)
  assert.equal(CI.isCallableInviteTarget('ZSv0IAhwjBabu09KeZGVFV2N2iF3'), true)
  assert.equal(CI.isCallableInviteTarget(OTP_UID), true)
  assert.equal(CI.isCallableInviteTarget('cg-zzz999'), true)
  assert.equal(CI.isCallableInviteTarget('bd-rima'), false)
  assert.equal(CI.isCallableInviteTarget('fr-1'), false)
  assert.equal(CI.isCallableInviteTarget('f1'), false)
  assert.equal(CI.isCallableInviteTarget('rq-1'), false)
  assert.equal(CI.isCallableInviteTarget('abc123'), false)
  assert.equal(CI.isCallableInviteTarget(''), false)
  assert.equal(CI.isCallableInviteTarget(null), false)
  assert.equal(CI.isCallableInviteTarget(undefined), false)
})

// ---------- ৬) গেটের কারণ → ইনভাইট স্ট্যাটাস ----------
check('gateReasonToInviteStatus — in-call→busy, friends→not-friend, nobody/blocked→not-accepting, বাকি null', () => {
  assert.equal(CI.gateReasonToInviteStatus('in-call'), 'busy')
  assert.equal(CI.gateReasonToInviteStatus('privacy-friends'), 'not-friend')
  assert.equal(CI.gateReasonToInviteStatus('privacy-nobody'), 'not-accepting')
  assert.equal(CI.gateReasonToInviteStatus('blocked'), 'not-accepting')
  assert.equal(CI.gateReasonToInviteStatus('expired'), null)
  assert.equal(CI.gateReasonToInviteStatus('ok'), null)
  assert.equal(CI.gateReasonToInviteStatus('self'), null)
})

// ---------- ৭) ওয়্যারিং (সোর্স) ----------
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const overlaySrc = readFileSync(join(root, 'src/IncomingCallOverlay.tsx'), 'utf8')
const firestoreSrc = readFileSync(join(root, 'src/firestore.ts'), 'utf8')
const callSrc = readFileSync(join(root, 'src/call.ts'), 'utf8')
const serverSrc = readFileSync(join(root, 'server/index.js'), 'utf8')
const rulesSrc = readFileSync(join(root, 'firestore.rules'), 'utf8')

check('presence মডিউল নেই — src/presence.ts মুছে গেছে', () => {
  assert.equal(existsSync(join(root, 'src/presence.ts')), false)
  assert.ok(!pagesSrc.includes("from './presence'"), 'pages.tsx এখনো presence ইমপোর্ট করে')
  assert.ok(!overlaySrc.includes("from './presence'"), 'ওভারলে এখনো presence ইমপোর্ট করে')
  assert.ok(!pagesSrc.includes('sendCallInvite'), 'CallPage এখনো presence ইনভাইট পাঠায়')
  assert.ok(!pagesSrc.includes('onInviteResponse') && !pagesSrc.includes('onInviteSent'), 'CallPage এখনো presence উত্তর শোনে')
  assert.ok(!pagesSrc.includes('inviteResponseToFailureReason') && !pagesSrc.includes('inviteSentToFailureReason'), 'পুরোনো presence ম্যাপিং এখনো আছে')
})
check('CallPage — Firestore ইনভাইট লেখে + ডক শোনে + ডেটিং কলেও ইনভাইট যায়', () => {
  assert.ok(pagesSrc.includes('createCallInvite(payload)'), 'CallPage ইনভাইট ডক লেখে না')
  assert.ok(pagesSrc.includes('subscribeCallInviteDoc(inviteId'), 'CallPage ইনভাইট ডক শোনে না')
  assert.ok(pagesSrc.includes('callInviteStatusToFailureReason(doc.status)'), 'ডকের স্ট্যাটাস থেকে কারণ নেওয়া হয় না')
  assert.ok(pagesSrc.includes("kind: type === 'service' ? 'service' : isDating ? 'dating' : 'friend'"), 'ডেটিং কলে ইনভাইট যায় না')
  assert.ok(pagesSrc.includes('triggerCallInvitePush({ toUid: inviteTarget, inviteId, code,'), 'ইনভাইটের পুশ ট্রিগার নেই')
  assert.ok(pagesSrc.includes('clearCallInvite()'), 'কল শেষে ইনভাইট ডক মোছা হয় না')
})
check('ওভারলে — Firestore ইনভাইট শোনে, ধরলে/কাটলে স্ট্যাটাস বদলায়', () => {
  assert.ok(overlaySrc.includes('subscribeIncomingCallInvites(myId'), 'ওভারলে Firestore ইনভাইট শোনে না')
  assert.ok(overlaySrc.includes("updateCallInviteStatus(docId, 'accepted')"), 'ধরলে accepted লেখা হয় না')
  assert.ok(overlaySrc.includes("updateCallInviteStatus(docId, 'declined')"), 'কাটলে declined লেখা হয় না')
  assert.ok(overlaySrc.includes('gateReasonToInviteStatus(gate.reason)'), 'গেটে আটকালে কারণসহ স্ট্যাটাস লেখা হয় না')
})
check('firestore.ts — callInvites লেখা/শোনা/বদলানো/মোছা আছে', () => {
  assert.ok(firestoreSrc.includes('export async function createCallInvite'), 'createCallInvite নেই')
  assert.ok(firestoreSrc.includes('export function subscribeIncomingCallInvites'), 'subscribeIncomingCallInvites নেই')
  assert.ok(firestoreSrc.includes('export function subscribeCallInviteDoc'), 'subscribeCallInviteDoc নেই')
  assert.ok(firestoreSrc.includes('export async function updateCallInviteStatus'), 'updateCallInviteStatus নেই')
  assert.ok(firestoreSrc.includes('export async function deleteCallInvite'), 'deleteCallInvite নেই')
})
check('call.ts — রুম-WS-এ ২০ সেকেন্ড হার্টবিট ping আছে', () => {
  assert.ok(callSrc.includes("type: 'ping'"), 'হার্টবিট ping নেই')
  assert.ok(callSrc.includes('20000'), 'হার্টবিট ২০ সেকেন্ড নয়')
})
check('সার্ভার — /api/call-invite/push এন্ডপয়েন্ট আছে', () => {
  assert.ok(serverSrc.includes("app.post('/api/call-invite/push'"), 'পুশ এন্ডপয়েন্ট নেই')
  assert.ok(serverSrc.includes('sendCallPush(toUid'), 'পুশ এন্ডপয়েন্ট sendCallPush ডাকে না')
})
check('firestore.rules — callInvites ম্যাচ + বেনামি হেল্পার আছে', () => {
  assert.ok(rulesSrc.includes('match /callInvites/{inviteId}'), 'callInvites নিয়ম নেই')
  assert.ok(rulesSrc.includes('function isAnon()'), 'isAnon হেল্পার নেই')
  assert.ok(rulesSrc.includes("status == 'ringing'"), 'ringing-শুধু তৈরি নেই')
})

console.log(`\n${n}/${n} call-invites tests passed`)
