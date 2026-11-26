// বন্ধু রিকোয়েস্ট — Facebook-এর মতো: Add Friend চাপলে ওপাশে আসল রিকোয়েস্ট
// যায়, গ্রহণ করলে দুই দিকেই বন্ধু হয়, বাতিল/প্রত্যাখ্যানে মিলিয়ে যায়।
// চালানো: রিপো রুট থেকে `node tests/friend-requests.test.mjs`
// (src/friendRequests.ts-এর pure লজিক esbuild দিয়ে বান্ডল করে চালায়;
//  পেজ/স্টোর/নিয়মের গঠন সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
const fsSrc = readFileSync(join(root, 'src/firestore.ts'), 'utf8')
const rulesSrc = readFileSync(join(root, 'firestore.rules'), 'utf8')

const outDir = mkdtempSync(join(tmpdir(), 'picall-friendreq-test-'))
const outFile = join(outDir, 'friendRequests.mjs')
await build({
  entryPoints: [join(root, 'src/friendRequests.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
})
const FR = await import(outFile)

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

const UID_A = 'LXnGL8xA6VW8Gp7hvCaoakOha822'
const UID_B = 'ZSv0IAhwjBabu09KeZGVFV2N2iF3'
const validDoc = {
  fromUid: UID_A, toUid: UID_B,
  fromName: 'Susmita', fromColour: '#27AE60',
  toName: 'Avijit Dey', toColour: '#FF9800',
  status: 'pending', createdAtMs: 1795510000000,
}

// ---- আসল UID চেনা (পারসোনা/সিড id নয়) ----
check('looksLikeFirebaseUid: আসল UID হ্যাঁ, পারসোনা/সিড id না', () => {
  assert.equal(FR.looksLikeFirebaseUid(UID_A), true)
  assert.equal(FR.looksLikeFirebaseUid(UID_B), true)
  assert.equal(FR.looksLikeFirebaseUid('bd-rima'), false)
  assert.equal(FR.looksLikeFirebaseUid('bd-shakil'), false)
  assert.equal(FR.looksLikeFirebaseUid('fr-1'), false)
  assert.equal(FR.looksLikeFirebaseUid('f1'), false)
  assert.equal(FR.looksLikeFirebaseUid('rq-2'), false)
  assert.equal(FR.looksLikeFirebaseUid(''), false)
  assert.equal(FR.looksLikeFirebaseUid('short'), false)
  assert.equal(FR.looksLikeFirebaseUid('a'.repeat(41)), false)
  assert.equal(FR.looksLikeFirebaseUid('abc-def-ghi-jkl-mno-pqr-stu'), false)
})

// ---- ডক ম্যাপিং ----
check('mapFriendRequestDoc: ঠিক ডক ম্যাপ হয়', () => {
  const m = FR.mapFriendRequestDoc('req-1', validDoc)
  assert.equal(m?.id, 'req-1')
  assert.equal(m?.fromUid, UID_A)
  assert.equal(m?.toUid, UID_B)
  assert.equal(m?.fromName, 'Susmita')
  assert.equal(m?.status, 'pending')
  assert.equal(m?.createdAtMs, 1795510000000)
})
check('mapFriendRequestDoc: খারাপ ডক null (কখনো ভাঙে না)', () => {
  assert.equal(FR.mapFriendRequestDoc('r', null), null)
  assert.equal(FR.mapFriendRequestDoc('r', { ...validDoc, fromUid: 'bd-rima' }), null)
  assert.equal(FR.mapFriendRequestDoc('r', { ...validDoc, toUid: 'nope' }), null)
  assert.equal(FR.mapFriendRequestDoc('r', { ...validDoc, fromUid: UID_B, toUid: UID_B }), null)
  assert.equal(FR.mapFriendRequestDoc('r', { ...validDoc, status: 'weird' }), null)
  assert.equal(FR.mapFriendRequestDoc('r', { ...validDoc, fromName: '' }), null)
  assert.equal(FR.mapFriendRequestDoc('r', { ...validDoc, fromName: 'x'.repeat(81) }), null)
  assert.equal(FR.mapFriendRequestDoc('r', { ...validDoc, toColour: '' }), null)
  assert.equal(FR.mapFriendRequestDoc('', validDoc), null)
})
check('mapFriendRequestDoc: ছবি শুধু data:/https: হলে থাকে, নইলে বাদ', () => {
  assert.equal(FR.mapFriendRequestDoc('r', { ...validDoc, fromPhoto: 'data:image/jpeg;base64,xx' })?.fromPhoto, 'data:image/jpeg;base64,xx')
  assert.equal(FR.mapFriendRequestDoc('r', { ...validDoc, fromPhoto: 'javascript:alert(1)' })?.fromPhoto, undefined)
  assert.equal(FR.mapFriendRequestDoc('r', { ...validDoc })?.createdAtMs, 1795510000000)
  assert.equal(FR.mapFriendRequestDoc('r', { ...validDoc, createdAtMs: undefined })?.createdAtMs, 0)
})

// ---- পাঠানোর ডেটা ----
check('buildFriendRequestData: ঠিক ডেটা বানায়, নাম trim হয়', () => {
  const d = FR.buildFriendRequestData(
    { uid: UID_A, name: '  Susmita ', colour: '#27AE60' },
    { uid: UID_B, name: 'Avijit Dey', colour: '#FF9800' },
  )
  assert.equal(d?.fromUid, UID_A)
  assert.equal(d?.toUid, UID_B)
  assert.equal(d?.fromName, 'Susmita')
  assert.equal(d && 'id' in d, false)
  assert.equal(d && 'status' in d, false)
})
check('buildFriendRequestData: নিজেকে / খালি নাম / আসল UID নয় → null', () => {
  assert.equal(FR.buildFriendRequestData({ uid: UID_A, name: 'A', colour: '#111' }, { uid: UID_A, name: 'A', colour: '#111' }), null)
  assert.equal(FR.buildFriendRequestData({ uid: UID_A, name: 'A', colour: '#111' }, { uid: UID_B, name: '  ', colour: '#222' }), null)
  assert.equal(FR.buildFriendRequestData({ uid: 'bd-rima', name: 'Rima', colour: '#E91E63' }, { uid: UID_B, name: 'B', colour: '#222' }), null)
  assert.equal(FR.buildFriendRequestData({ uid: UID_A, name: 'A', colour: '#111' }, { uid: UID_B, name: 'x'.repeat(81), colour: '#222' }), null)
})

// ---- পাঠানোর গার্ড ----
check('canSendFriendRequest: ok / self / already-friend / already-sent / blocked', () => {
  const base = { uid: UID_A, friendIds: [], sentToUids: [], blockedUids: [] }
  assert.equal(FR.canSendFriendRequest(UID_B, base), 'ok')
  assert.equal(FR.canSendFriendRequest(UID_A, base), 'self')
  assert.equal(FR.canSendFriendRequest(UID_B, { ...base, friendIds: [UID_B] }), 'already-friend')
  assert.equal(FR.canSendFriendRequest(UID_B, { ...base, sentToUids: [UID_B] }), 'already-sent')
  assert.equal(FR.canSendFriendRequest(UID_B, { ...base, blockedUids: [UID_B] }), 'blocked')
})

// ---- ম্যাপিং: ডক → Friend / sent এন্ট্রি ----
check('requestToFriend: প্রেরকই Friend এন্ট্রি, requestId-সহ', () => {
  const f = FR.requestToFriend(FR.mapFriendRequestDoc('req-9', validDoc))
  assert.equal(f.id, UID_A)
  assert.equal(f.name, 'Susmita')
  assert.equal(f.color, '#27AE60')
  assert.equal(f.online, true)
  assert.equal(f.requestId, 'req-9')
})
check('requestToSentEntry: toUid + requestId', () => {
  assert.deepEqual(FR.requestToSentEntry(FR.mapFriendRequestDoc('req-9', validDoc)), { toUid: UID_B, requestId: 'req-9' })
})
check('isIncomingVisible: ব্লক করা প্রেরকের রিকোয়েস্ট লুকানো থাকে', () => {
  const doc = FR.mapFriendRequestDoc('req-9', validDoc)
  assert.equal(FR.isIncomingVisible(doc, []), true)
  assert.equal(FR.isIncomingVisible(doc, [UID_A]), false)
  assert.equal(FR.isIncomingVisible(doc, [UID_B]), true)
})

// ---- Firestore স্তর (firestore.ts) ----
check('firestore.ts: create/update/subscribe হেল্পার আছে', () => {
  assert.ok(fsSrc.includes('export async function createFriendRequest('), 'createFriendRequest নেই')
  assert.ok(fsSrc.includes("status: 'pending'"), 'create-এ status pending নেই')
  assert.ok(fsSrc.includes('createdAt: serverTimestamp()'), 'create-এ serverTimestamp নেই')
  assert.ok(fsSrc.includes("export async function updateFriendRequestStatus(id: string, status: 'accepted' | 'declined' | 'cancelled')"), 'updateFriendRequestStatus নেই')
  assert.ok(fsSrc.includes('export function subscribeIncomingFriendRequests('), 'incoming সাবস্ক্রিপশন নেই')
  assert.ok(fsSrc.includes("where('toUid', '==', uid)"), 'incoming কোয়েরি toUid নয়')
  assert.ok(fsSrc.includes('export function subscribeSentFriendRequests('), 'sent সাবস্ক্রিপশন নেই')
  assert.ok(fsSrc.includes("where('fromUid', '==', uid)"), 'sent কোয়েরি fromUid নয়')
})
check('firestore.ts: friendRequests কোয়েরিতে orderBy নেই (কম্পোজিট ইনডেক্স লাগবে না)', () => {
  const start = fsSrc.indexOf('// ---------- friendRequests')
  const end = fsSrc.indexOf('// ---------- chats/', start)
  const section = fsSrc.slice(start, end === -1 ? start + 6000 : end)
  assert.ok(!section.includes('orderBy'), 'friendRequests সেকশনে orderBy আছে — কম্পোজিট ইনডেক্স লাগবে')
  assert.ok(section.includes("docs.sort((a, b) => b.createdAtMs - a.createdAtMs)"), 'ক্লায়েন্ট-সাইড সাজানো নেই')
})

// ---- নিয়ম (firestore.rules) ----
check('Rules: friendRequests — তৈরি শুধু প্রেরক, পড়া প্রেরক/প্রাপক, status-মাত্র বদল', () => {
  assert.ok(rulesSrc.includes('match /friendRequests/{reqId}'), 'friendRequests match নেই')
  assert.ok(rulesSrc.includes('request.resource.data.fromUid == request.auth.uid'), 'create-এ fromUid যাচাই নেই')
  assert.ok(rulesSrc.includes('request.resource.data.toUid != request.auth.uid'), 'নিজেকে রিকোয়েস্ট আটকানো নেই')
  assert.ok(rulesSrc.includes("request.resource.data.status == 'pending'"), 'create-এ status pending নেই')
  assert.ok(rulesSrc.includes('request.resource.data.fromName.size() <= 80'), 'নামের দৈর্ঘ্য যাচাই নেই')
  assert.ok(rulesSrc.includes('resource.data.fromUid == request.auth.uid || resource.data.toUid == request.auth.uid'), 'read-এ প্রেরক/প্রাপক যাচাই নেই')
  assert.ok(rulesSrc.includes("affectedKeys().hasOnly(['status'])"), 'update-এ শুধু status বদলের সীমা নেই')
  assert.ok(rulesSrc.includes("request.resource.data.status in ['accepted', 'declined']"), 'প্রাপকের accept/decline নেই')
  assert.ok(rulesSrc.includes("request.resource.data.status == 'cancelled'"), 'প্রেরকের cancel নেই')
  const start = rulesSrc.indexOf('match /friendRequests/{reqId}')
  const section = rulesSrc.slice(start, start + 1500)
  assert.ok(section.includes('allow delete: if false;'), 'delete বন্ধ করা হয়নি')
})

// ---- স্টোর (store.tsx) ----
check('Store: send/cancel/decline + async accept + sentRequests অবস্থা', () => {
  assert.ok(storeSrc.includes('sendFriendRequest: (f: Friend) => Promise<boolean>'), 'sendFriendRequest টাইপ নেই')
  assert.ok(storeSrc.includes('cancelFriendRequest: (toUid: string) => Promise<boolean>'), 'cancelFriendRequest নেই')
  assert.ok(storeSrc.includes('declineRequest: (id: string) => Promise<boolean>'), 'declineRequest নেই')
  assert.ok(storeSrc.includes('acceptRequest: (id: string) => Promise<boolean>'), 'acceptRequest async হয়নি')
  assert.ok(storeSrc.includes('sentRequests: { toUid: string; requestId: string }[]'), 'sentRequests টাইপ নেই')
  assert.ok(storeSrc.includes("useState<{ toUid: string; requestId: string }[]>([])"), 'sentRequests state নেই')
})
check('Store: আসা + পাঠানো সাবস্ক্রিপশন, গ্রহণে দুই দিকেই বন্ধু', () => {
  assert.ok(storeSrc.includes('subscribeIncomingFriendRequests(uid,'), 'incoming সাবস্ক্রিপশন ডাকা হয় না')
  assert.ok(storeSrc.includes('subscribeSentFriendRequests(uid,'), 'sent সাবস্ক্রিপশন ডাকা হয় না')
  assert.ok(storeSrc.includes('isIncomingVisible(d, blockedUidsRef.current)'), 'ব্লক করা প্রেরকের রিকোয়েস্ট ছাঁকা হয় না')
  assert.ok(storeSrc.includes("setRequests(visible.map(requestToFriend))"), 'আসা রিকোয়েস্ট Friend এন্ট্রি হয় না')
  // গ্রহণে বন্ধু যোগ — idempotent মেলানো, আনফ্রেন্ড-চিহ্ন (uid) দিয়ে গার্ড।
  // ২০২৬-১১-২৬: পুরোনো একবারের ডক-চিহ্ন ('frAcceptedHandled') লগইন-
  // হাইড্রেশনে মুছে যাওয়া বন্ধু আর ফেরাত না — প্রেরকের দিকে বন্ধুত্ব
  // একপাশে আটকে যেত; তাই মেলানো এখন চিহ্ন-ছাড়া, আনফ্রেন্ড-uid-ই গার্ড।
  assert.ok(storeSrc.includes('mergeAcceptedFriends(prev, docs, uid, getUnfriendedUids())'), 'গ্রহণে বন্ধু যোগের মেলানো নেই')
  assert.ok(storeSrc.includes("save('frUnfriendedUids'"), 'আনফ্রেন্ড-চিহ্ন মনে রাখা হয় না (আনফ্রেন্ডের পর ফিরে আসবে)')
})
check('Store: ডকের পুরোনো requests কপি আর hydrate করে না (সাবস্ক্রিপশনই সত্যি)', () => {
  assert.ok(!storeSrc.includes('if (h.requests !== undefined) setRequests(h.requests)'), 'applyHydrated এখনো ডকের requests বসায়')
})
check('Store: পারসোনা/লোকাল id সাথে সাথে লোকাল বন্ধু (রিকোয়েস্ট যায় না)', () => {
  assert.ok(storeSrc.includes('if (isBuddyId(f.id) || !looksLikeFirebaseUid(f.id)) { addFriendLocal(f); return true }'), 'পারসোনা লোকাল-অ্যাড নেই')
  assert.ok(storeSrc.includes('if (!uid) { addFriendLocal(f); return true }'), 'OTP লগইনে লোকাল-অ্যাড ফলব্যাক নেই')
  assert.ok(storeSrc.includes('sendInFlightRef.current.has(f.id)'), 'দ্রুত দুবার চাপলে ডুপ্লিকেট রিকোয়েস্ট আটকানো নেই')
})
check('Store: গ্রহণে প্রথমে ডকে লেখে, ব্যর্থ হলে বন্ধু দেখায় না', () => {
  assert.ok(storeSrc.includes("await updateFriendRequestStatus(r.requestId, 'accepted')"), 'accept-এ ডকে গ্রহণ লেখা হয় না')
  assert.ok(storeSrc.includes("await updateFriendRequestStatus(r.requestId, 'declined')"), 'decline-এ ডকে প্রত্যাখ্যান লেখা হয় না')
  assert.ok(storeSrc.includes("await updateFriendRequestStatus(sent.requestId, 'cancelled')"), 'cancel-এ ডকে বাতিল লেখা হয় না')
})

// ---- পেজ (pages.tsx) ----
check('New Members: Add Friend → আসল রিকোয়েস্ট, pending-এ Request Sent + Cancel', () => {
  assert.ok(pagesSrc.includes('sendFriendRequest({ id: m.id, name: m.displayName,'), 'New Members-এ sendFriendRequest নেই')
  assert.ok(pagesSrc.includes('cancelFriendRequest(m.id)}>Request Sent</Btn>'), 'New Members-এ Request Sent/Cancel নেই')
  assert.ok(!pagesSrc.includes('addFriend({ id: m.id,'), 'New Members-এ এখনো একতরফা addFriend আছে')
})
check('Search (Home + Friends): Add Friend → রিকোয়েস্ট, pending-এ Request Sent', () => {
  assert.ok(pagesSrc.includes('sendFriendRequest({ id: p.id, name: p.name,'), 'সার্চে sendFriendRequest নেই')
  assert.ok(pagesSrc.includes('cancelFriendRequest(p.id)}>Request Sent</Btn>'), 'সার্চে Request Sent/Cancel নেই')
  assert.ok(!pagesSrc.includes('addFriend({ id: p.id,'), 'সার্চে এখনো একতরফা addFriend আছে')
  assert.ok(pagesSrc.includes('async function addFromSearch(p: SearchablePerson)'), 'addFromSearch নেই')
  assert.ok(pagesSrc.includes('await sendFriendRequest({ id: p.id, name: p.name,'), 'addFromSearch রিকোয়েস্ট পাঠায় না')
})
check('Friend Requests সেকশন: Accept / Decline, পুরোনো Confirm/Delete নেই', () => {
  const start = pagesSrc.indexOf('Friend Requests ({requests.length})')
  const section = pagesSrc.slice(start, start + 1200)
  assert.ok(section.includes('>Accept</Btn>'), 'Accept বাটন নেই')
  assert.ok(section.includes('>Decline</Btn>'), 'Decline বাটন নেই')
  assert.ok(section.includes('handleAccept(r)'), 'Accept handleAccept ডাকে না')
  assert.ok(section.includes('handleDecline(r)'), 'Decline handleDecline ডাকে না')
  assert.ok(section.includes('r.requestId ?? r.id'), 'requestId দিয়ে ডক চেনা হয় না')
  assert.ok(!section.includes('>Confirm</Btn>'), 'পুরোনো Confirm এখনো আছে')
  assert.ok(!section.includes('removeFriend(r.id)'), 'Delete এখনো removeFriend ডাকে')
  assert.ok(pagesSrc.includes('Could not confirm the request'), 'গ্রহণ ব্যর্থ হলে ভুল দেখানো হয় না')
})
check('People You May Know: Add Friend → রিকোয়েস্ট', () => {
  assert.ok(pagesSrc.includes('sendFriendRequest({ id: s.id, name: s.name,'), 'PYMK-তে sendFriendRequest নেই')
  assert.ok(!pagesSrc.includes('addFriend({ id: s.id,'), 'PYMK-তে এখনো একতরফা addFriend আছে')
})
check('ডেটিং ম্যাচের চ্যাট-খোলা addFriend আগের মতোই আছে (roomId-র জন্য লাগে)', () => {
  // peerId = state.peerId ?? state.datingPartnerId ?? ?peer= — ডেটিং ম্যাচ
  // এখনো addFriend-এ যায় (peerId দিয়ে), তাই roomId null থাকে না।
  assert.ok(/addFriend\(\{ id: peerId/.test(pagesSrc), 'ডেটিং ম্যাচের addFriend উঠে গেছে — roomId null থাকবে')
  assert.ok(pagesSrc.includes("st?.peerId ?? st?.datingPartnerId"), 'peerId-তে datingPartnerId নেই')
})

console.log(`\nAll ${passed} friend-request tests passed.`)
