// createdAt টেস্ট — নতুন ব্যবহারকারী কেন অদৃশ্য ছিল (2026-11-25)
// দুটো নতুন অ্যাকাউন্ট (Call Test A 100003, Call Test B 100004) রেজিস্টার
// হলেও খোঁজায় "0 people found" আর নতুন সদস্যেও আসেনি — তাদের
// publicProfiles ডকে displayName + numericUid থাকলেও createdAt ছিল না।
// চালানো: রিপো রুট থেকে `node tests/created-at.test.mjs`
// (esbuild দিয়ে pure মডিউলগুলো বান্ডল করে Node-এ চালায়; পেজ/স্টোর/নিয়মের
// গঠন সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) createdAt ছাড়া ডক কোয়েরিতেই বাদ যায় — fetchAllPublicProfiles ও
//      fetchNewMembers দুটোই orderBy('createdAt', 'desc') করে; Firestore-এ
//      orderBy করা ক্ষেত্র না থাকলে ডক ফলে আসেই না
//   ২) mapPublicProfile createdAt সহ্য করে (না থাকলে createdAtMs null) —
//      ছাঁকাটা ম্যাপারে নয়, কোয়েরিতে
//   ৩) খোঁজার শৃঙ্খল — createdAt থাকা প্রোফাইল mergeAllUsers-এ আসে আর
//      নাম + সংখ্যার UID দুটো দিয়েই মেলে
//   ৪) writePublicProfile create-শাখায় createdAt: serverTimestamp() বসে
//   ৫) writePublicProfile merge-শাখায় createdAt না থাকলে ব্যাকফিল হয় —
//      পুরোনো ভাঙা ডক পরের লগইনে সেরে যায়; থাকলে কখনো বদলায় না
//   ৬) ensureNumericUid আর খালি {numericUid} ডক বানায় না — প্রোফাইল
//      ডক না থাকলে ট্রানজ্যাকশনে শুধু কাউন্টার লেখে
//   ৭) writeUserDoc প্রথমবার createdAt লেখে, পরের লেখায় আগেরটা রাখে
//   ৮) লগইন সিঙ্কের ক্রম — ensureNumericUid আগে, writePublicProfile পরে;
//      ৫+৬ থাকায় এই ক্রম এখন আর createdAt হারায় না
//   ৯) OTP লগইন পথ অপরিবর্তিত — loginOtp শুধু user বসায়, uid ছোঁয় না;
//      OTP ব্যবহারকারীর প্রোফাইল তৈরি হয় না (আগের সিদ্ধান্ত, আলাদা কাজ)
//   ১০) নিয়ম বদল লাগে না — মালিকের merge-আপডেটে createdAt ব্যাকফিল চলে
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-createdat-test-'))
await build({
  entryPoints: ['src/newMembers.ts', 'src/friendSearch.ts'].map(p => join(root, p)),
  bundle: true, format: 'esm', platform: 'node', outdir: outDir, logLevel: 'silent',
})
const NM = await import(join(outDir, 'newMembers.js'))
const FS = await import(join(outDir, 'friendSearch.js'))

const firestoreSrc = readFileSync(join(root, 'src/firestore.ts'), 'utf8')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
const rulesSrc = readFileSync(join(root, 'firestore.rules'), 'utf8')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

check('toCreatedAtMs — না থাকলে null, Timestamp/সংখ্যা/ISO থেকে ms', () => {
  assert.equal(NM.toCreatedAtMs(undefined), null)
  assert.equal(NM.toCreatedAtMs(null), null)
  assert.equal(NM.toCreatedAtMs('not-a-date'), null)
  assert.equal(NM.toCreatedAtMs({}), null)
  assert.equal(NM.toCreatedAtMs({ seconds: 1764000000 }), 1764000000000)
  assert.equal(NM.toCreatedAtMs({ seconds: 1764000000, nanoseconds: 500000000 }), 1764000000500)
  assert.equal(NM.toCreatedAtMs(1764000000000), 1764000000000)
  assert.equal(NM.toCreatedAtMs('2026-11-25T07:00:00.000Z'), Date.parse('2026-11-25T07:00:00.000Z'))
})

check('mapPublicProfile — createdAt থাকলে ms বসে, না থাকলে null (ছাঁকা নয়)', () => {
  const withCreated = NM.mapPublicProfile('uA', { displayName: 'Call Test A', createdAt: { seconds: 1764000000 }, colour: '#111', numericUid: 100003 })
  assert.equal(withCreated.createdAtMs, 1764000000000)
  assert.equal(withCreated.numericUid, 100003)
  const withoutCreated = NM.mapPublicProfile('uB', { displayName: 'Call Test B', colour: '#222', numericUid: 100004 })
  assert.equal(withoutCreated.createdAtMs, null)
  assert.equal(withoutCreated.numericUid, 100004)
  assert.equal(NM.formatJoinTime(null), 'Recently')
})

check('খোঁজা + নতুন সদস্য — দুটো কোয়েরিই orderBy(createdAt, desc) করে', () => {
  // Firestore-এ orderBy করা ক্ষেত্র না থাকলে ডক ফলে আসেই না — তাই
  // createdAt ছাড়া প্রোফাইল খোঁজায় ও নতুন সদস্যে অদৃশ্য থাকে।
  const fetchAll = firestoreSrc.slice(firestoreSrc.indexOf('export async function fetchAllPublicProfiles'))
  assert.ok(fetchAll.includes("orderBy('createdAt', 'desc')"), 'fetchAllPublicProfiles orderBy createdAt নয়')
  const fetchNew = firestoreSrc.slice(firestoreSrc.indexOf('export async function fetchNewMembers'))
  assert.ok(fetchNew.includes("orderBy('createdAt', 'desc')"), 'fetchNewMembers orderBy createdAt নয়')
})

check('খোঁজার শৃঙ্খল — createdAt থাকা প্রোফাইল নাম + UID দুটোতেই মেলে', () => {
  const merged = FS.mergeAllUsers(
    [],
    [{ id: 'uA', displayName: 'Call Test A', colour: '#111', numericUid: 100003 }],
    'uB',
  )
  assert.equal(merged.length, 1)
  assert.ok(FS.personMatches(merged[0], 'Call Test A'))
  assert.ok(FS.personMatches(merged[0], 'call test a'))
  assert.ok(FS.personMatches(merged[0], '100003'))
  // ২০২৬-১১-২৫: শুধু সংখ্যা লিখলে হুবহু মিলতে হবে — আংশিক "100" দিয়ে
  // 100003 মিলত বলে "100005" খুঁজে ভুল ব্যবহারকারী (100001) এসেছিল।
  assert.ok(!FS.personMatches(merged[0], '100'))
  assert.ok(!FS.personMatches(merged[0], '100004'))
  assert.ok(!FS.personMatches(merged[0], 'Call Test B'))
})

check('writePublicProfile create-শাখায় createdAt: serverTimestamp() বসে', () => {
  assert.ok(firestoreSrc.includes('export async function writePublicProfile'), 'writePublicProfile নেই')
  assert.ok(firestoreSrc.includes("await setDoc(ref, { displayName: displayName || 'User', createdAt: serverTimestamp(), colour: colourForUid(uid), ...extra })"), 'create-শাখায় createdAt নেই')
})

check('writePublicProfile merge-শাখায় createdAt না থাকলে ব্যাকফিল হয়', () => {
  // লগইন সিঙ্কে প্রতিবার writePublicProfile চলে — পুরোনো ভাঙা ডক
  // (displayName + numericUid আছে, createdAt নেই) পরের লগইনেই সেরে যায়।
  assert.ok(firestoreSrc.includes('toCreatedAtMs(existing.createdAt) == null ? { createdAt: serverTimestamp() } : {}'), 'merge-শাখায় createdAt ব্যাকফিল নেই')
  assert.ok(firestoreSrc.includes('...backfill }, { merge: true })'), 'ব্যাকফিল merge-লেখায় যায় না')
  assert.ok(firestoreSrc.includes("import { colourForUid, dedupeMembers, mapPublicProfile, toCreatedAtMs, type NewMember } from './newMembers'"), 'toCreatedAtMs আমদানি নেই')
})

check('ensureNumericUid আর খালি {numericUid} ডক বানায় না', () => {
  // আগে ট্রানজ্যাকশনেই tx.set(ref, { numericUid }, { merge: true }) হতো —
  // ডক না থাকলে খালি ডক তৈরি হতো, writePublicProfile create-শাখা নিত না,
  // createdAt চিরকাল বসত না। এখন ডক থাকলেই শুধু UID merge হয়।
  assert.ok(firestoreSrc.includes('const pSnap = await tx.get(ref)'), 'ট্রানজ্যাকশনে প্রোফাইল ডক পড়া হয় না')
  assert.ok(firestoreSrc.includes('if (pSnap.exists()) tx.set(ref, { numericUid: next }, { merge: true })'), 'UID merge ডক-থাকা শর্তে বাঁধা নয়')
  assert.ok(!firestoreSrc.includes('tx.set(counterRef, { next })\n      tx.set(ref, { numericUid: next }, { merge: true })'), 'খালি ডক বানানো পুরোনো লাইন এখনো আছে')
  assert.ok(firestoreSrc.includes("tx.set(counterRef, { next })"), 'কাউন্টার লেখা নেই')
})

check('writeUserDoc প্রথমবার createdAt লেখে, পরের লেখায় আগেরটা রাখে', () => {
  assert.ok(firestoreSrc.includes('export async function writeUserDoc(uid: string, data: UserDoc)'), 'writeUserDoc নেই')
  assert.ok(firestoreSrc.includes('const createdAt = existing && toCreatedAtMs(existing.createdAt) != null'), 'createdAt রাখা/ব্যাকফিলের শর্ত নেই')
  assert.ok(firestoreSrc.includes('await setDoc(ref, { ...data, createdAt, updatedAt: serverTimestamp() })'), 'users ডকে createdAt লেখা হয় না')
})

check('লগইন সিঙ্ক — ensureNumericUid আগে, writePublicProfile পরে', () => {
  const syncStart = storeSrc.indexOf('const myNumericUid = await ensureNumericUid(uid)')
  assert.ok(syncStart >= 0, 'লগইন সিঙ্কে ensureNumericUid নেই')
  const writeAfter = storeSrc.indexOf('await writePublicProfile(uid, user.name, myReferralCode, profileExtra)', syncStart)
  assert.ok(writeAfter > syncStart, 'writePublicProfile বরাদ্দের পরে নয়')
})

check('OTP লগইন পথ অপরিবর্তিত — loginOtp শুধু user বসায়', () => {
  const otpStart = storeSrc.indexOf('loginOtp: (name, email) => {')
  assert.ok(otpStart >= 0, 'loginOtp নেই')
  const otpEnd = storeSrc.indexOf('},', otpStart)
  assert.ok(otpEnd > otpStart, 'loginOtp ব্লকের শেষ নেই')
  const otpBlock = storeSrc.slice(otpStart, otpEnd)
  assert.ok(otpBlock.includes('setUser({ name, email })'), 'loginOtp user বসায় না')
  assert.ok(!otpBlock.includes('setUid('), 'loginOtp uid ছুঁয়েছে — OTP প্রোফাইল পথ বদলে গেছে')
})

check('নিয়ম বদল লাগে না — মালিকের merge-আপডেটে createdAt ব্যাকফিল চলে', () => {
  // create-নিয়ম: numericUid থাকলে শুধু সেটাই থাকতে পারে — create-শাখায়
  // numericUid থাকে না, তাই createdAt সহ পুরো প্রোফাইল তৈরি চলে।
  assert.ok(rulesSrc.includes("(!('numericUid' in request.resource.data) || request.resource.data.keys().hasOnly(['numericUid']))"), 'create-নিয়ম নেই')
  // update-নিয়ম: numericUid বদলানো যায় না, createdAt-এ কোনো বাধা নেই।
  assert.ok(rulesSrc.includes("(!('numericUid' in resource.data) || request.resource.data.numericUid == resource.data.numericUid)"), 'update-নিয়মে numericUid গার্ড নেই')
})

console.log(`\n${passed} passed`)
