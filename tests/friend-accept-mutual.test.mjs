// বন্ধু রিকোয়েস্ট একপাশে আটকে যাওয়া — গ্রহণে দুই দিকেই বন্ধু হয়
// (২০২৬-১১-২৬ লাইভ ব্রাউজার রি-টেস্ট, বান্ডল index-Bsr1CP0S.js)
//   • E (Sync Test E) F-কে (Sync Test F) রিকোয়েস্ট পাঠালো, F গ্রহণ করলো
//   • F-র দিকে "My Friends (12)"-এ E এলো + Chat এন্ট্রি; E-র দিকে
//     "My Friends (11)"-ই রইলো — F নেই, Chat এন্ট্রি নেই, সার্চে আবার
//     "Add Friend"; দুটো গ্রহণ-চক্র, রিলোড, দুজনের রি-সাইন-ইনেও একই
//   • কারণ (কোডে যাচাই): প্রেরকের দিকে গ্রহণ শুধু পাঠানো-রিকোয়েস্ট
//     সাবস্ক্রিপশনের কলব্যাকে যোগ হতো; লগইনে ওই স্ন্যাপশট
//     ডক-হাইড্রেশনের (applyHydrated) আগেই এসে F যোগ করত, তারপর
//     হাইড্রেশন ডকের ১১ বন্ধু বসিয়ে F মুছে ফেলত, আর write-through
//     মুছে যাওয়া তালিকাটাই ডকে লিখত; 'frAcceptedHandled' চিহ্ন
//     থাকায় আর কখনো ফিরত না
//   • নিয়মে গ্রহণকারীর অন্যের users ডক লেখার অনুমতি নেই
//     (firestore.rules: users/{uid} শুধু নিজের) — তাই প্রেরকের নিজের
//     ক্লায়েন্টকেই গ্রহণ প্রয়োগ করতে হয়; নিয়ম বদল লাগে না
// চালানো: রিপো রুট থেকে `node tests/friend-accept-mutual.test.mjs`
// (esbuild দিয়ে pure মডিউল বান্ডল করে Node-এ চালায়; স্টোর/ফায়ারস্টোরের
// গঠন সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) গ্রহণ-ডক থেকে ওপাশের বন্ধু — পাঠানো গ্রহণে প্রাপক, আসা গ্রহণে প্রেরক
//   ২) মেলানো — ডকের বন্ধু + গ্রহণ-ডক = দুই দিকেই বন্ধু, ডুপ্লিকেট নয়
//   ৩) রিগ্রেশন — হাইড্রেশনে মুছে গেলেও (ডকের তালিকায় ফিরে গেলেও)
//      আবার মেলালে বন্ধু ফিরে আসে (পুরোনো একবারের চিহ্ন এটা আটকাত)
//   ৪) আনফ্রেন্ড করা uid মেলানোয় বাদ যায়; চিহ্ন যোগ/মোছা pure
//   ৫) pending/declined/cancelled ডক কাউকে বন্ধু করে না
//   ৬) স্টোরে লগইন-সিঙ্কের মেলানো + সাবস্ক্রিপশনের মেলানো + আনফ্রেন্ড/
//      পাঠানো/গ্রহণের চিহ্ন-তারের গঠন আছে; পুরোনো চিহ্নের কোড নেই
//   ৭) নিয়ম অপরিবর্তিত — users ডক শুধু নিজের, friendRequests-এ
//      শুধু status বদলায় (ফিক্সে নিয়ম-পরিবর্তন লাগেনি)
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-friend-accept-test-'))
await build({
  entryPoints: [join(root, 'src/friendRequests.ts')],
  bundle: true, format: 'esm', platform: 'node', outdir: outDir, logLevel: 'silent',
})
const FR = await import(join(outDir, 'friendRequests.js'))

const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
const firestoreSrc = readFileSync(join(root, 'src/firestore.ts'), 'utf8')
const rulesSrc = readFileSync(join(root, 'firestore.rules'), 'utf8')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

// লাইভ কেসের মান (E/F-র নাম + রেফারেল আইডি; Firebase UID/সংখ্যার UID
// কাল্পনিক — শুধু আকৃতি মেলানো, আসল UID নয়)।
const E_UID = 'EEEEEEEEEEEEEEEEEEEEEEEEEEEE'
const F_UID = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFF'
const E_NAME = 'Sync Test E'
const F_NAME = 'Sync Test F'
const E_COLOUR = '#27AE60'
const F_COLOUR = '#1877F2'

// ১১ সিড বন্ধু (লাইভে নতুন অ্যাকাউন্টে যেমন থাকে)।
const SEED_FRIENDS = [
  'Rima', 'Shakil', 'Fahim', 'Mim', 'Asha',
  'Tanvir', 'Faysal', 'Imran', 'Sadia', 'Tanha', 'Nabila',
].map((name, i) => ({ id: `bd-${name.toLowerCase()}`, name, color: '#1877F2', online: true }))

function sentAcceptedDoc(over = {}) {
  return {
    id: 'req-live-1',
    fromUid: E_UID, toUid: F_UID,
    fromName: E_NAME, fromColour: E_COLOUR, fromNumericUid: 100007,
    toName: F_NAME, toColour: F_COLOUR, toNumericUid: 100008,
    status: 'accepted', createdAtMs: 1000,
    ...over,
  }
}

check('পাঠানো গ্রহণ-ডক থেকে প্রাপক বন্ধু হয় (E-র দিক)', () => {
  const f = FR.friendFromAcceptedDoc(sentAcceptedDoc(), E_UID)
  assert.ok(f)
  assert.equal(f.id, F_UID)
  assert.equal(f.name, F_NAME)
  assert.equal(f.color, F_COLOUR)
  assert.equal(f.numericUid, 100008)
  assert.equal(f.requestId, undefined)
})

check('আসা গ্রহণ-ডক থেকে প্রেরক বন্ধু হয় (F-র দিক)', () => {
  const f = FR.friendFromAcceptedDoc(sentAcceptedDoc(), F_UID)
  assert.ok(f)
  assert.equal(f.id, E_UID)
  assert.equal(f.name, E_NAME)
  assert.equal(f.numericUid, 100007)
})

check('pending/declined/cancelled ডক থেকে বন্ধু হয় না; অচেনা ডক থেকে নয়', () => {
  for (const status of ['pending', 'declined', 'cancelled']) {
    assert.equal(FR.friendFromAcceptedDoc(sentAcceptedDoc({ status }), E_UID), null)
    assert.equal(FR.friendFromAcceptedDoc(sentAcceptedDoc({ status }), F_UID), null)
  }
  assert.equal(FR.friendFromAcceptedDoc(sentAcceptedDoc(), 'ZZZZZZZZZZZZZZZZZZZZZZZZZZ'), null)
})

check('মেলানো — ১১ সিড বন্ধু + গ্রহণ = ১২, F আছে, ডুপ্লিকেট নয়', () => {
  const merged = FR.mergeAcceptedFriends(SEED_FRIENDS, [sentAcceptedDoc()], E_UID, [])
  assert.equal(merged.length, 12)
  assert.ok(merged.some(f => f.id === F_UID && f.name === F_NAME))
  assert.equal(SEED_FRIENDS.length, 11, 'ইনপুট বদলায় না')
  const again = FR.mergeAcceptedFriends(merged, [sentAcceptedDoc()], E_UID, [])
  assert.equal(again.length, 12, 'আবার মেলালে ডুপ্লিকেট হয় না')
  assert.notEqual(again, merged, 'নতুন array ফেরে')
})

check('রিগ্রেশন — হাইড্রেশনে মুছে গেলেও আবার মেলালে F ফিরে আসে', () => {
  // লাইভের ক্রম: সাবস্ক্রিপশন F যোগ করে (১২) → লগইন-সিঙ্কের
  // applyHydrated ডকের ১১ বসিয়ে F মোছে → মেলানো আবার F ফেরায়।
  const afterSubscribe = FR.mergeAcceptedFriends(SEED_FRIENDS, [sentAcceptedDoc()], E_UID, [])
  assert.equal(afterSubscribe.length, 12)
  const afterHydration = [...SEED_FRIENDS] // ডকের তালিকা — F নেই
  assert.equal(afterHydration.length, 11)
  const afterLoginMerge = FR.mergeAcceptedFriends(afterHydration, [sentAcceptedDoc()], E_UID, [])
  assert.equal(afterLoginMerge.length, 12)
  assert.ok(afterLoginMerge.some(f => f.id === F_UID))
  // পুরোনো একবারের চিহ্ন থাকলে দ্বিতীয় মেলানো আটকে যেত — নতুন
  // মেলানোয় কোনো চিহ্ন নেই, তাই রিলোড/রি-সাইন-ইনেও ফেরে।
  const afterSecondLogin = FR.mergeAcceptedFriends([...SEED_FRIENDS], [sentAcceptedDoc()], E_UID, [])
  assert.equal(afterSecondLogin.length, 12)
})

check('আসা গ্রহণ-ডক মেলালে প্রেরক ফেরে (গ্রহণকারীর দ্রুত সাইন-আউট কেস)', () => {
  const merged = FR.mergeAcceptedFriends(SEED_FRIENDS, [sentAcceptedDoc()], F_UID, [])
  assert.equal(merged.length, 12)
  assert.ok(merged.some(f => f.id === E_UID && f.name === E_NAME))
})

check('আনফ্রেন্ড করা uid মেলানোয় বাদ যায়; চিহ্ন যোগ/মোছা pure', () => {
  const merged = FR.mergeAcceptedFriends(SEED_FRIENDS, [sentAcceptedDoc()], E_UID, [F_UID])
  assert.equal(merged.length, 11)
  assert.ok(!merged.some(f => f.id === F_UID))
  let list = []
  list = FR.addUnfriendedUid(list, F_UID)
  assert.deepEqual(list, [F_UID])
  list = FR.addUnfriendedUid(list, F_UID)
  assert.deepEqual(list, [F_UID], 'দুবার যোগে ডুপ্লিকেট নয়')
  list = FR.addUnfriendedUid(list, E_UID)
  assert.deepEqual(list, [F_UID, E_UID])
  list = FR.removeUnfriendedUid(list, F_UID)
  assert.deepEqual(list, [E_UID])
  assert.deepEqual(FR.removeUnfriendedUid(list, F_UID), [E_UID], 'নেই এমন মোছা no-op')
  assert.deepEqual(FR.removeUnfriendedUid([], F_UID), [])
})

check('pending/declined/cancelled ডক মেলানোয় কাউকে যোগ করে না', () => {
  for (const status of ['pending', 'declined', 'cancelled']) {
    const merged = FR.mergeAcceptedFriends(SEED_FRIENDS, [sentAcceptedDoc({ status })], E_UID, [])
    assert.equal(merged.length, 11)
  }
})

check('স্টোরে লগইন-সিঙ্কে গ্রহণ-মেলানো আছে (হাইড্রেশনের পর, fsState on-এর আগে)', () => {
  assert.ok(storeSrc.includes("fetchSentFriendRequests(uid)"), 'পাঠানো রিকোয়েস্ট একবার পড়া হয়')
  assert.ok(storeSrc.includes("fetchIncomingFriendRequests(uid)"), 'আসা রিকোয়েস্ট একবার পড়া হয়')
  assert.ok(storeSrc.includes('mergeAcceptedFriends(prev, acceptedDocs, uid'), 'হাইড্রেশনের পর মেলানো হয়')
  const mergeAt = storeSrc.indexOf('mergeAcceptedFriends(prev, acceptedDocs, uid')
  const fsOnAt = storeSrc.indexOf("setFsState('on')", mergeAt)
  assert.ok(fsOnAt > mergeAt, 'মেলানো fsState on-এর আগেই — write-through মেলানো তালিকাই লেখে')
})

check('সাবস্ক্রিপশনের কলব্যাক গ্রহণ মেলায়; পুরোনো একবারের চিহ্নের কোড নেই', () => {
  assert.ok(storeSrc.includes('mergeAcceptedFriends(prev, docs, uid, getUnfriendedUids())'), 'পাঠানো-সাবস্ক্রিপশনে মেলানো')
  assert.ok(!storeSrc.includes('handledAcceptedRef'), 'পুরোনো ref নেই')
  assert.ok(!storeSrc.includes('getHandledAccepted'), 'পুরোনো getter নেই')
  assert.ok(!storeSrc.includes('markAcceptedHandled'), 'পুরোনো marker নেই')
  assert.ok(!storeSrc.includes("load<string[]>('frAcceptedHandled'"), 'পুরোনো চাবি পড়া হয় না')
  assert.ok(storeSrc.includes("load<string[]>('frUnfriendedUids'"), 'আনফ্রেন্ড-চিহ্নের নতুন চাবি আছে')
})

check('আনফ্রেন্ড/পাঠানো/গ্রহণে চিহ্নের তার ঠিক আছে', () => {
  assert.ok(storeSrc.includes('if (looksLikeFirebaseUid(id)) markUnfriended(id)'), 'আনফ্রেন্ডে চিহ্ন বসে')
  assert.ok(storeSrc.includes('clearUnfriended(f.id)'), 'নতুন রিকোয়েস্ট পাঠালে চিহ্ন মোছে')
  assert.ok(storeSrc.includes('clearUnfriended(r.id)'), 'গ্রহণ করলে চিহ্ন মোছে')
})

check('firestore.ts-এ পাঠানো/আসা রিকোয়েস্ট একবার পড়ার ফাংশন আছে', () => {
  assert.ok(firestoreSrc.includes('export async function fetchSentFriendRequests(uid: string)'), 'পাঠানো-ফেচ আছে')
  assert.ok(firestoreSrc.includes('export async function fetchIncomingFriendRequests(uid: string)'), 'আসা-ফেচ আছে')
  assert.ok(firestoreSrc.includes("where('fromUid', '==', uid)"), 'পাঠানো-কোয়েরি একটাই সমতা-শর্ত')
  assert.ok(firestoreSrc.includes("where('toUid', '==', uid)"), 'আসা-কোয়েরি একটাই সমতা-শর্ত')
})

check('নিয়ম অপরিবর্তিত — ফিক্সে নিয়ম-পরিবর্তন লাগেনি', () => {
  assert.ok(rulesSrc.includes('allow read, write: if isSignedIn() && request.auth.uid == uid;'), 'users ডক শুধু নিজেরই')
  assert.ok(rulesSrc.includes("request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status'])"), 'friendRequests-এ শুধু status বদলায়')
})

console.log(`\n${passed} passed`)
