// সংখ্যার UID টেস্ট — প্রত্যেক ব্যবহারকারীর ৬ সংখ্যার পরিচয় নম্বর
// (১০০০০১ থেকে), একবার বসলে আর বদলায় না; নাম/UID দিয়ে খোঁজা যায়;
// রেফারেল কোড/?ref= লিংক আগের মতোই চলে।
// চালানো: রিপো রুট থেকে `node tests/numeric-uid.test.mjs`
// (esbuild দিয়ে pure মডিউলগুলো বান্ডল করে Node-এ চালায়; পেজ/স্টোর/নিয়মের
// গঠন সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) UID সীমা — ১০০০০১ থেকে শুরু, ৯৯৯৯৯৯ পর্যন্ত; তার বাইরে অবৈধ
//   ২) ডকের মান থেকে UID পড়া — সংখ্যা ও সংখ্যার স্ট্রিং চলে, ভুল মান বাদ
//   ৩) পরের UID — কাউন্টারের শেষ মান +১, শেষ হয়ে গেলে null
//   ৪) UID দিয়ে খোঁজা — সংখ্যার অংশ মিললেই হয় (আংশিকও মেলে)
//   ৫) friendSearch — UID দিয়ে খোঁজা মেলে; mergeAllUsers UID বয়ে নেয়
//   ৬) newMembers — প্রোফাইল থেকে UID পড়া; অ্যাডমিন খোঁজায় UID মেলে
//   ৭) friendRequests — রিকোয়েস্ট ডকে UID যায়, Friend-এ ফেরে
//   ৮) firestore.ts — কাউন্টার ট্রানজ্যাকশনে বরাদ্দ; ব্যাকফিল ক্রমানুসারে
//   ৯) store — লগইনে বরাদ্দ/ব্যাকফিল, প্রোফাইল + users ডকে লেখা হয়
//   ১০) পেজ — Your ID / খোঁজা / অ্যাডমিন Users-এ সংখ্যার UID দেখায়,
//       কাঁচা Firebase uid কোথাও ID হিসেবে দেখায় না
//   ১১) firestore.rules — কাউন্টার শুধু +১, UID একবার বসলে আর বদলায় না
//   ১২) রেফারেল অটুট — ?ref= লিংক ও referralCode আগের মতোই চলে
//   ১৩) BUG 1 — আগের ব্যবহারকারীর UID নতুন অ্যাকাউন্টে লাগে না:
//       resetSyncableState numericUid শূন্য করে; বরাদ্দ ব্যর্থ হলেও
//       state null হয় (শুধু সফল হলেই বসে না) — নইলে write-through
//       sync পুরোনো ১০০০০১ নতুন users ডকে লিখে দিত
//   ১৪) BUG 2 — writePublicProfile create-এ deleteField()/numericUid নয়:
//       ছবি না থাকলে create-এ photo ক্ষেত্রই থাকে না (deleteField শুধু
//       merge/update পথে); numericUid create-এর পর আলাদা merge-এ বসে —
//       নইলে নতুন ব্যবহারকারীর publicProfiles ডক তৈরি হতো না
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-uid-test-'))
await build({
  entryPoints: ['src/numericUid.ts', 'src/friendSearch.ts', 'src/newMembers.ts', 'src/friendRequests.ts'].map(p => join(root, p)),
  bundle: true, format: 'esm', platform: 'node', outdir: outDir, logLevel: 'silent',
})
const U = await import(join(outDir, 'numericUid.js'))
const FS = await import(join(outDir, 'friendSearch.js'))
const NM = await import(join(outDir, 'newMembers.js'))
const FR = await import(join(outDir, 'friendRequests.js'))

const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
const firestoreSrc = readFileSync(join(root, 'src/firestore.ts'), 'utf8')
const mappingSrc = readFileSync(join(root, 'src/firestoreMapping.ts'), 'utf8')
const rulesSrc = readFileSync(join(root, 'firestore.rules'), 'utf8')
const searchUISrc = readFileSync(join(root, 'src/searchUI.tsx'), 'utf8')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

check('UID সীমা — ১০০০০১ থেকে শুরু, ৯৯৯৯৯৯ পর্যন্ত', () => {
  assert.equal(U.UID_START, 100001)
  assert.equal(U.UID_MAX, 999999)
  assert.ok(U.isValidNumericUid(100001))
  assert.ok(U.isValidNumericUid(999999))
  assert.ok(!U.isValidNumericUid(99999))
  assert.ok(!U.isValidNumericUid(1000000))
  assert.ok(!U.isValidNumericUid(100001.5))
  assert.ok(!U.isValidNumericUid('100001'))
  assert.ok(!U.isValidNumericUid(null))
})

check('ডকের মান থেকে UID পড়া — সংখ্যা ও সংখ্যার স্ট্রিং চলে, ভুল মান বাদ', () => {
  assert.equal(U.numericUidFromDoc(100042), 100042)
  assert.equal(U.numericUidFromDoc('100042'), 100042)
  assert.equal(U.numericUidFromDoc(undefined), undefined)
  assert.equal(U.numericUidFromDoc('abc'), undefined)
  assert.equal(U.numericUidFromDoc(99), undefined)
  assert.equal(U.numericUidFromDoc(1000000), undefined)
})

check('পরের UID — কাউন্টারের শেষ মান +১, শেষ হয়ে গেলে null', () => {
  assert.equal(U.nextNumericUid(100000), 100001)
  assert.equal(U.nextNumericUid(100005), 100006)
  assert.equal(U.nextNumericUid(999999), null)
  assert.equal(U.nextNumericUid(1000000), null)
})

check('UID দিয়ে খোঁজা — সংখ্যার অংশ মিললেই হয় (আংশিকও মেলে)', () => {
  assert.equal(U.normalizeUidQuery('UID 100-001'), '100001')
  assert.equal(U.normalizeUidQuery('avijit'), '')
  assert.ok(U.uidQueryMatches(100001, '100'))
  assert.ok(U.uidQueryMatches(100001, '100001'))
  assert.ok(!U.uidQueryMatches(100001, '100002'))
  assert.ok(!U.uidQueryMatches(undefined, '100'))
  assert.ok(!U.uidQueryMatches(100001, 'avijit'))
})

check('friendSearch — নামের পাশাপাশি UID দিয়েও খোঁজা মেলে', () => {
  const p = { id: 'u1', name: 'Avijit Dey', referralCode: 'cg-x1', numericUid: 100001 }
  assert.ok(FS.personMatches(p, '100001'))
  // ২০২৬-১১-২৫: শুধু সংখ্যা লিখলে হুবহু মিলতে হবে — আংশিক "100" দিয়ে
  // 100001 মিলত বলে "100005" খুঁজে সুস্মিতা (100001) এসেছিল। পুরো UID-ই লিখতে হয়।
  assert.ok(!FS.personMatches(p, '100'))
  assert.ok(FS.personMatches(p, 'avijit'))
  assert.ok(!FS.personMatches(p, '100002'))
  assert.ok(!FS.personMatches({ id: 'u2', name: 'Rima' }, '100'))
})

check('mergeAllUsers — publicProfiles-এর UID খোঁজার তালিকায় বয়ে নেয়', () => {
  const merged = FS.mergeAllUsers([], [{ id: 'u1', displayName: 'Avijit', colour: '#111', referralCode: 'cg-x1', numericUid: 100001 }], null)
  assert.equal(merged.length, 1)
  assert.equal(merged[0].numericUid, 100001)
  assert.ok(FS.personMatches(merged[0], '100001'))
})

check('newMembers — প্রোফাইল থেকে UID পড়া; ভুল মান বাদ যায়', () => {
  const m = NM.mapPublicProfile('u1', { displayName: 'Avijit', createdAt: { seconds: 1700000000 }, colour: '#111', numericUid: 100042 })
  assert.equal(m?.numericUid, 100042)
  const m2 = NM.mapPublicProfile('u2', { displayName: 'Rima', createdAt: { seconds: 1700000000 }, colour: '#222', numericUid: '100043' })
  assert.equal(m2?.numericUid, 100043)
  const m3 = NM.mapPublicProfile('u3', { displayName: 'Bad', createdAt: { seconds: 1700000000 }, colour: '#333', numericUid: 99 })
  assert.equal(m3?.numericUid, undefined)
})

check('অ্যাডমিন খোঁজা — নাম, UID বা referral code দিয়ে মেলে', () => {
  const list = [
    { id: 'u1', displayName: 'Avijit', createdAtMs: 1, colour: '#111', numericUid: 100001, referralCode: 'cg-x1' },
    { id: 'u2', displayName: 'Rima', createdAtMs: 2, colour: '#222', referralCode: 'cg-y2' },
  ]
  assert.equal(NM.filterAdminUsers(list, '100001').length, 1)
  assert.equal(NM.filterAdminUsers(list, '100').length, 1)
  assert.equal(NM.filterAdminUsers(list, 'rima').length, 1)
  assert.equal(NM.filterAdminUsers(list, 'cg-y2').length, 1)
  assert.equal(NM.filterAdminUsers(list, '').length, 2)
})

check('friendRequests — রিকোয়েস্ট ডকে UID যায়, Friend-এ ফেরে', () => {
  const payload = FR.buildFriendRequestData(
    { uid: 'a'.repeat(28), name: 'Avijit', colour: '#111', numericUid: 100001 },
    { uid: 'b'.repeat(28), name: 'Rima', colour: '#222', numericUid: 100002 },
  )
  assert.ok(payload)
  assert.equal(payload.fromNumericUid, 100001)
  assert.equal(payload.toNumericUid, 100002)
  const doc = FR.mapFriendRequestDoc('req1', { ...payload, status: 'pending', createdAtMs: 1 })
  assert.ok(doc)
  assert.equal(doc.fromNumericUid, 100001)
  const friend = FR.requestToFriend(doc)
  assert.equal(friend.numericUid, 100001)
  assert.equal(friend.id, 'a'.repeat(28))
})

check('firestore.ts — কাউন্টার ট্রানজ্যাকশনে বরাদ্দ; ব্যাকফিল ক্রমানুসারে', () => {
  assert.ok(firestoreSrc.includes("import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, orderBy, limit, serverTimestamp, addDoc, onSnapshot, deleteField, increment, arrayUnion, arrayRemove, runTransaction"), 'runTransaction আমদানি নেই')
  assert.ok(firestoreSrc.includes('export async function ensureNumericUid(uid: string)'), 'ensureNumericUid নেই')
  assert.ok(firestoreSrc.includes("doc(d, 'config', 'uidCounter')"), 'কাউন্টার ডক config/uidCounter নয়')
  assert.ok(firestoreSrc.includes('runTransaction(d, async (tx)'), 'বরাদ্দ ট্রানজ্যাকশনে নয়')
  assert.ok(firestoreSrc.includes('export async function backfillNumericUids'), 'backfillNumericUids নেই')
  assert.ok(firestoreSrc.includes('.sort((a, b) => (a.createdAtMs ?? Number.MAX_SAFE_INTEGER)'), 'ব্যাকফিল যোগদানের ক্রমে নয়')
  assert.ok(firestoreSrc.includes('numericUid?: number'), 'writePublicProfile-এ numericUid ক্ষেত্র নেই')
})

check('store — লগইনে বরাদ্দ/ব্যাকফিল, প্রোফাইল + users ডকে লেখা হয়', () => {
  assert.ok(storeSrc.includes('ensureNumericUid'), 'store-এ ensureNumericUid আমদানি/ব্যবহার নেই')
  assert.ok(storeSrc.includes('const myNumericUid = await ensureNumericUid(uid)'), 'লগইন সিঙ্কে বরাদ্দ নেই')
  assert.ok(storeSrc.includes('numericUid: number | null'), 'store-এ numericUid অবস্থা নেই')
  assert.ok(storeSrc.includes("useEffect(() => save('numericUid', numericUid), [numericUid])"), 'numericUid স্থানীয়ভাবে সংরক্ষণ হয় না')
  assert.ok(storeSrc.includes('numericUid,'), 'collectSnapshot-এ numericUid নেই')
  assert.ok(storeSrc.includes('if (h.numericUid !== undefined) setNumericUidState(h.numericUid)'), 'hydrate-এ numericUid বসে না')
  assert.ok(storeSrc.includes('...(myNumericUid !== null ? { numericUid: myNumericUid } : {})'), 'writePublicProfile-এ UID পাঠানো হয় না')
  assert.ok(mappingSrc.includes('numericUid?: number'), 'users ডকের টাইপে numericUid নেই')
  assert.ok(mappingSrc.includes('...(s.numericUid !== null ? { numericUid: s.numericUid } : {})'), 'toUserDoc-এ numericUid লেখা হয় না')
  assert.ok(mappingSrc.includes("if (typeof d.numericUid === 'number' && Number.isInteger(d.numericUid)) out.numericUid = d.numericUid"), 'fromUserDoc-এ numericUid পড়া হয় না')
})

check('পেজ — Your ID / খোঁজা / অ্যাডমিন Users-এ সংখ্যার UID দেখায়', () => {
  assert.ok(pagesSrc.includes('{numericUid ?? referralCode}'), 'Your ID কার্ডে সংখ্যার UID দেখায় না')
  assert.ok(pagesSrc.includes('ID: {p.numericUid ?? p.referralCode ??'), 'খোঁজার ফলে সংখ্যার UID আগে নয়')
  assert.ok(pagesSrc.includes('ID: {m.numericUid ?? m.referralCode ??'), 'অ্যাডমিন Users-এ সংখ্যার UID দেখায় না')
  assert.ok(pagesSrc.includes('placeholder="Search by name, UID or referral code"'), 'অ্যাডমিন খোঁজার placeholder-এ UID নেই')
  assert.ok(pagesSrc.includes('Assign missing IDs'), 'অ্যাডমিন ব্যাকফিল বোতাম নেই')
  assert.ok(pagesSrc.includes('backfillNumericUids(adminUsers)'), 'অ্যাডমিন ব্যাকফিল হ্যান্ডলার নেই')
  assert.ok(pagesSrc.includes('ID: {r.numericUid}'), 'রিকোয়েস্ট তালিকায় UID দেখায় না')
  assert.ok(!pagesSrc.includes('ID: {p.referralCode ?? p.id}'), 'কোথাও এখনো কাঁচা Firebase uid ID হিসেবে দেখায়')
  assert.ok(searchUISrc.includes('ID: {p.numericUid ?? p.referralCode ??'), 'সার্চ ড্রপডাউনে সংখ্যার UID আগে নয়')
  assert.ok(!searchUISrc.includes('ID: {p.referralCode ?? p.id}'), 'ড্রপডাউনে এখনো কাঁচা uid ID হিসেবে দেখায়')
})

check('firestore.rules — কাউন্টার শুধু +১, UID একবার বসলে আর বদলায় না', () => {
  assert.ok(rulesSrc.includes('match /config/uidCounter'), 'uidCounter ম্যাচ নেই')
  assert.ok(rulesSrc.includes('request.resource.data.next == 100001'), 'প্রথম বরাদ্দ 100001 নয়')
  assert.ok(rulesSrc.includes('request.resource.data.next == resource.data.next + 1'), 'কাউন্টার +১-এ সীমাবদ্ধ নয়')
  assert.ok(rulesSrc.includes("(!('numericUid' in resource.data) || request.resource.data.numericUid == resource.data.numericUid)"), 'UID বদল-রোধ গার্ড নেই')
  assert.ok(rulesSrc.includes("!('numericUid' in resource.data)"), 'অ্যাডমিন ব্যাকফিল শুধু UID-নেই এমন প্রোফাইলে নয়')
  assert.ok(rulesSrc.includes("firebase deploy --only firestore:rules --project picall-76185"), 'নিয়ম publish নির্দেশ নেই')
})

check('রেফারেল অটুট — ?ref= লিংক ও referralCode আগের মতোই চলে', () => {
  assert.ok(pagesSrc.includes('?ref=${referralCode}'), '?ref= ইনভাইট লিংক ভেঙেছে')
  assert.ok(firestoreSrc.includes('referralCode'), 'writePublicProfile-এ referralCode নেই')
  assert.ok(storeSrc.includes('referralCode'), 'store-এ referralCode নেই')
  assert.ok(U.UID_START !== 0, 'UID_START বসেনি')
})

check('BUG 1 — আগের ব্যবহারকারীর UID নতুন অ্যাকাউন্টে লাগে না', () => {
  // resetSyncableState-এ numericUid শূন্য করা হয় — অন্য ব্যবহারকারী একই
  // ডিভাইসে লগইন করলে আগের নম্বর state-এ থেকে যায় না।
  const resetStart = storeSrc.indexOf('const resetSyncableState = () => {')
  assert.ok(resetStart >= 0, 'resetSyncableState নেই')
  const resetEnd = storeSrc.indexOf('  // প্রথম সিঙ্ক', resetStart)
  assert.ok(resetEnd > resetStart, 'resetSyncableState-এর শেষ খুঁজে পাওয়া যায়নি')
  assert.ok(storeSrc.slice(resetStart, resetEnd).includes('setNumericUidState(null)'), 'resetSyncableState numericUid শূন্য করে না')
  // বরাদ্দ ব্যর্থ হলেও state null হয় — শুধু সফল হলেই বসে না।
  assert.ok(storeSrc.includes('setNumericUidState(myNumericUid)'), 'বরাদ্দের ফল state-এ বসে না')
  assert.ok(!storeSrc.includes('if (myNumericUid !== null) setNumericUidState(myNumericUid)'), 'বরাদ্দ ব্যর্থ হলে পুরোনো UID state-এ থেকে যায়')
})

check('BUG 2 — writePublicProfile create-এ deleteField()/numericUid নয়', () => {
  // deleteField() শুধু merge/update পথে — create (merge ছাড়া setDoc)
  // -এ দিলে SDK throw করে, ডক তৈরি হয় না।
  assert.ok(!firestoreSrc.includes("if (extraFields.photo === '') extra.photo = deleteField()"), 'create পথে deleteField() এখনো আছে')
  assert.ok(firestoreSrc.includes("if (extraFields.photo === '' && snap.exists()) extra.photo = deleteField()"), 'deleteField শুধু বিদ্যমান প্রোফাইলে নয়')
  // numericUid create-এর পর আলাদা merge-এ বসে (নিয়ম: create-এ numericUid
  // থাকলে শুধু numericUid-ই থাকতে পারে)।
  assert.ok(firestoreSrc.includes('if (numericUid !== undefined) await setDoc(ref, { numericUid }, { merge: true })'), 'create-এর পর numericUid আলাদা merge-এ বসে না')
  assert.ok(firestoreSrc.includes('let numericUid: number | undefined'), 'numericUid আলাদা রাখা হয় না')
})

console.log(`\n${passed} passed`)
