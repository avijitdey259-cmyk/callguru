// সিঙ্ক-পরিচয় দূষণ টেস্ট — নতুন অ্যাকাউন্টের রেজিস্ট্রেশন/সিঙ্কে আগের
// সেশনের পরিচয় লিক (২০২৬-১১-২৫, লাইভ ব্রাউজার রি-টেস্ট ২২:৪৯–২৩:০৮)
//   • D (Call Test D, 100006) রেজিস্টার করলে তার publicProfile-এ
//     displayName "Susmita" + referralCode "cg-b4rk4e" (সুস্মিতার কোড)
//     আর users ডকে ইমেইল avijitdey259@gmail.com + সুস্মিতার কল হিসাব উঠেছিল
//   • C/D দুজনেই প্রথমে খোঁজায় মেলেনি ("0 people found"), New Members-এ
//     সুস্মিতা দুবার এসেছিল, "100005" খুঁজে সুস্মিতা এসেছিল
//   • প্রতি রি-সাইন-ইনে users ডক সিড করা টেমপ্লেট দিয়ে আবার লেখা হয়ে
//     বন্ধুত্ব মুছে যাচ্ছিল (createdAt/updatedAt সাইন-ইনের সময়ে বদলে যেত);
//     প্রোমা/সুস্মিতার আসল ডকও ২৫ নভেম্বর রাতে এভাবে আবার লেখা হয়েছিল
// চালানো: রিপো রুট থেকে `node tests/sync-identity.test.mjs`
// (esbuild দিয়ে pure মডিউলগুলো বান্ডল করে Node-এ চালায়; পেজ/স্টোর/
// ফায়ারস্টোর-লেখার গঠন সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) পরিচয়-গার্ড — uid + ইমেইল দুটোই বর্তমান Firebase ব্যবহারকারীর
//      সঙ্গে মিললে তবেই সিঙ্ক লেখে; না মিললে (অ্যাকাউন্ট বদলের মাঝখান)
//      লেখা হয় না
//   ২) ডক পড়ার ফল — 'found' → hydrate, 'missing' → create,
//      'error' → abort (error-কে missing ধরে ডক উড়িয়ে দেওয়া যাবে না)
//   ৩) অ্যাকাউন্ট বদলে register/login-এ আগের অ্যাকাউন্টের পরিচয়
//      নতুন ডকে যায় না — auth listener + login() uid বদলালে
//      অবস্থা শূন্য করে user+uid একসাথে বসায়; সিঙ্ক-চিহ্ন শুধু সফল শেষে
//   ৪) রি-লগইনে বন্ধুত্ব মোছে না — পড়া ব্যর্থ হলে সিঙ্ক থামে (error),
//      writeUserDoc পড়া ব্যর্থ হলে merge-এ লেখে (createdAt নতুন করে নয়)
//   ৫) নতুন প্রোফাইল সঙ্গে সঙ্গে খুঁজে পাওয়া যায় — খোঁজা প্রতি
//      সার্চে তাজা করে (৩০ সেকেন্ড ক্যাশে), অ্যাকাউন্ট বদলালে তালিকা শূন্য হয়
//   ৬) সংখ্যার UID খোঁজা হুবহু মেলে — আংশিক সংখ্যায় ভুল মানুষ আসে না
//   ৭) একই নামের দুজন আলাদা মানুষ দুজনেই মেলে; New Members-এ একই
//      ব্যবহারকারী দুবার আসে না (uid দিয়ে ডুপ্লিকেট বাদ)
//   ৮) রেজিস্ট্রেশনে নিজের পরিচয়ই লেখা হয় — ডকের referralCode থাকলে
//      সেটাই, না থাকলে নতুন কোড; ক্লোজারের পুরোনো কোড নয়
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-syncid-test-'))
await build({
  entryPoints: ['src/syncGuard.ts', 'src/newMembers.ts', 'src/friendSearch.ts'].map(p => join(root, p)),
  bundle: true, format: 'esm', platform: 'node', outdir: outDir, logLevel: 'silent',
})
const SG = await import(join(outDir, 'syncGuard.js'))
const NM = await import(join(outDir, 'newMembers.js'))
const FS = await import(join(outDir, 'friendSearch.js'))

const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
const firestoreSrc = readFileSync(join(root, 'src/firestore.ts'), 'utf8')
const searchUISrc = readFileSync(join(root, 'src/searchUI.tsx'), 'utf8')
const firebaseSrc = readFileSync(join(root, 'src/firebase.ts'), 'utf8')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

// ---------- ১) পরিচয়-গার্ড ----------
check('identityMatchesSync — uid + ইমেইল মিললে তবেই true', () => {
  const auth = { uid: 'uid-D', email: 'picalltest.callD.20261125@gmail.com' }
  assert.equal(SG.identityMatchesSync({ uid: 'uid-D', userEmail: 'picalltest.callD.20261125@gmail.com' }, auth), true)
  // ইমেইলের কেস বদলালেও মেলে (লগইনে ছোট হাতের করা হয়)
  assert.equal(SG.identityMatchesSync({ uid: 'uid-D', userEmail: 'PicallTest.CallD.20261125@Gmail.com' }, auth), true)
})

check('identityMatchesSync — আগের অ্যাকাউন্টের পরিচয় নতুন uid-তে false', () => {
  // D রেজিস্টার হচ্ছে, কিন্তু state-এ এখনো সুস্মিতা — এটাই ২২:৫৩-র লিক
  const authD = { uid: 'uid-D', email: 'picalltest.callD.20261125@gmail.com' }
  assert.equal(SG.identityMatchesSync({ uid: 'uid-D', userEmail: 'avijitdey259@gmail.com' }, authD), false)
  assert.equal(SG.identityMatchesSync({ uid: 'uid-Susmita', userEmail: 'avijitdey259@gmail.com' }, authD), false)
})

check('identityMatchesSync — auth পরিচয় না থাকলে / ইমেইল না থাকলে false (fail-closed)', () => {
  assert.equal(SG.identityMatchesSync({ uid: 'uid-D', userEmail: 'd@x.com' }, null), false)
  assert.equal(SG.identityMatchesSync({ uid: 'uid-D', userEmail: '' }, { uid: 'uid-D', email: 'd@x.com' }), false)
  assert.equal(SG.identityMatchesSync({ uid: 'uid-D', userEmail: 'd@x.com' }, { uid: 'uid-D', email: '' }), false)
  assert.equal(SG.identityMatchesSync({ uid: '', userEmail: 'd@x.com' }, { uid: 'uid-D', email: 'd@x.com' }), false)
})

// ---------- ২) ডক পড়ার ফল ----------
check('syncDocAction — found → hydrate, missing → create, error → abort', () => {
  assert.equal(SG.syncDocAction('found'), 'hydrate')
  assert.equal(SG.syncDocAction('missing'), 'create')
  assert.equal(SG.syncDocAction('error'), 'abort')
})

// ---------- ৩) অ্যাকাউন্ট বদলে পরিচয় আলাদা থাকে (সোর্স-গঠন) ----------
check('auth listener — uid বদলালে user+uid একসাথে বসে, অবস্থা আগেই শূন্য হয়', () => {
  const listener = storeSrc.slice(storeSrc.indexOf('onFirebaseAuthUser((fbUser)'))
  assert.ok(listener.includes('resetSyncableState()'), 'listener-এ রিসেট নেই')
  assert.ok(listener.includes('setUid(fbUser.uid)'), 'listener-এ setUid নেই')
  assert.ok(listener.includes('setUser({ name: fbUser.displayName'), 'listener-এ setUser নেই')
  assert.ok(
    listener.indexOf('resetSyncableState()') < listener.indexOf('setUid(fbUser.uid)'),
    'রিসেট uid বসানোর আগে হতে হবে',
  )
})

check('login() — uid বদলালে অবস্থা শূন্য করে তারপর user/uid বসায়', () => {
  const loginFn = storeSrc.slice(storeSrc.indexOf('login: (name, email) =>'))
  assert.ok(loginFn.includes('resetSyncableState()'), 'login-এ রিসেট নেই')
  assert.ok(loginFn.includes("u !== uidRef.current"), 'login-এ uid-তুলনা নেই')
})

check('সিঙ্ক ইফেক্ট — পরিচয়-গার্ড কোনো লেখার আগে; চিহ্ন শুধু সফল শেষে', () => {
  const syncStart = storeSrc.indexOf('প্রথম সিঙ্ক — লগইনে একবার')
  const sync = storeSrc.slice(syncStart, syncStart + 12000)
  const guardAt = sync.indexOf('identityMatchesSync({ uid, userEmail: user.email }, getCurrentAuthIdentity())')
  assert.ok(guardAt !== -1, 'সিঙ্কে পরিচয়-গার্ড নেই')
  assert.ok(sync.indexOf('resetSyncableState()') > guardAt, 'গার্ড রিসেটের আগে থাকতে হবে')
  assert.ok(sync.indexOf('writeUserDoc(uid, toUserDoc') > guardAt, 'গার্ড লেখার আগে থাকতে হবে')
  assert.ok(sync.indexOf('writePublicProfile(uid, user.name') > guardAt, 'গার্ড প্রোফাইল-লেখার আগে থাকতে হবে')
  // চিহ্ন আগেই বসত — এখন শুধু শেষে (setPaymentRequests-এর পর, fsState on-এর ঠিক আগে)
  const markAt = sync.indexOf('fsSyncUidRef.current = uid')
  assert.ok(markAt !== -1, 'সিঙ্ক-চিহ্ন বসানো হয় না')
  assert.ok(markAt > sync.indexOf('setPaymentRequests(reqs)'), 'চিহ্ন সিঙ্ক শেষে বসতে হবে, শুরুতে নয়')
  assert.ok(!sync.slice(0, markAt).includes('fsSyncUidRef.current = uid\n    let cancelled'), 'চিহ্ন শুরুতে বসে আছে')
})

check('সিঙ্ক ইফেক্ট — ডক পড়া ব্যর্থ হলে থামে (error), missing ধরে লেখে না', () => {
  assert.ok(storeSrc.includes('fetchUserDocResult(uid)'), 'fetchUserDocResult ব্যবহার হয় না')
  assert.ok(storeSrc.includes("docResult.status === 'error'"), 'error-শাখা নেই')
  assert.ok(storeSrc.includes("setFsState('error')"), 'error-এ fsState error হয় না')
})

check('logout — অবস্থা শূন্য হয় আর ক্যাশের UID মোছে', () => {
  const logoutAt = storeSrc.indexOf('logout: () => {')
  const logout = storeSrc.slice(logoutAt, logoutAt + 800)
  assert.ok(logout.includes('resetSyncableState()'), 'logout-এ রিসেট নেই')
  assert.ok(logout.includes("save('fsCacheUid', null)"), 'logout-এ fsCacheUid মোছে না')
})

check('write-through + প্রোফাইল-সিঙ্ক — লেখার মুহূর্তে পরিচয়-গার্ড', () => {
  const wt = storeSrc.slice(storeSrc.indexOf('Write-through'))
  assert.ok(wt.includes('identityMatchesSync({ uid, userEmail: user.email }, getCurrentAuthIdentity())'), 'write-through-এ গার্ড নেই')
  const pp = storeSrc.slice(storeSrc.indexOf('পাবলিক প্রোফাইল সিঙ্ক'))
  assert.ok(pp.includes('identityMatchesSync({ uid, userEmail: user.email }, getCurrentAuthIdentity())'), 'প্রোফাইল-সিঙ্কে গার্ড নেই')
})

// ---------- ৪) রি-লগইনে বন্ধুত্ব মোছে না ----------
check('writeUserDoc — পড়া ব্যর্থ হলে merge-এ লেখে, createdAt নতুন করে নয়', () => {
  assert.ok(firestoreSrc.includes('readOk'), 'writeUserDoc-এ readOk নেই')
  assert.ok(firestoreSrc.includes("await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true })"), 'merge-ফলব্যাক নেই')
})

check('fetchUserDocResult — found/missing/error আলাদা করে', () => {
  assert.ok(firestoreSrc.includes('export async function fetchUserDocResult'), 'fetchUserDocResult নেই')
  assert.ok(firestoreSrc.includes("return { status: 'error', data: null }"), 'error-ফল নেই')
  assert.ok(firestoreSrc.includes("return { status: 'missing', data: null }"), 'missing-ফল নেই')
  assert.ok(firestoreSrc.includes("return { status: 'found', data:"), 'found-ফল নেই')
})

// ---------- ৫) নতুন প্রোফাইল সঙ্গে সঙ্গে খুঁজে পাওয়া যায় ----------
check('useAllUserSearch — প্রতি খোঁজায় তাজা করে; একবার-আনা তালিকা আর নেই', () => {
  assert.ok(!searchUISrc.includes('if (!debounced.trim() || allUsers !== null) return'), 'একবার-আনা গার্ড এখনো আছে')
  assert.ok(searchUISrc.includes('fetchedAtRef'), 'TTL ক্যাশ নেই')
  assert.ok(searchUISrc.includes('30000'), '৩০ সেকেন্ড ক্যাশ নেই')
  assert.ok(searchUISrc.includes('setAllUsers(null)'), 'অ্যাকাউন্ট বদলে তালিকা শূন্য হয় না')
})

// ---------- ৬) সংখ্যার UID খোঁজা হুবহু মেলে ----------
check('personMatches — শুধু সংখ্যা লিখলে হুবহু UID-ই মেলে', () => {
  const susmita = { id: 'uid-S', name: 'Susmita', referralCode: 'cg-b4rk4e', numericUid: 100001 }
  const c = { id: 'uid-C', name: 'Call Test C', referralCode: 'cg-jlmnlq', numericUid: 100005 }
  // "100005" খুঁজে সুস্মিতা (100001) আসত — এখন আসবে না
  assert.equal(FS.personMatches(susmita, '100005'), false)
  assert.equal(FS.personMatches(c, '100005'), true)
  // আংশিক "10000" কোনো UID-তেই মেলে না
  assert.equal(FS.personMatches(susmita, '10000'), false)
  assert.equal(FS.personMatches(c, '10000'), false)
  // পুরো UID মেলে; নামে আংশিক মেলা এখনো চলে
  assert.equal(FS.personMatches(susmita, '100001'), true)
  assert.equal(FS.personMatches(c, 'Call Test'), true)
  assert.equal(FS.personMatches(c, 'call test c'), true)
})

// ---------- ৭) একই নামের দুজন; New Members-এ ডুপ্লিকেট নয় ----------
check('mergeAllUsers — একই নামের দুজন আলাদা মানুষ দুজনেই মেলে', () => {
  const local = []
  const all = [
    { id: 'uid-S', displayName: 'Susmita', colour: '#27AE60', referralCode: 'cg-b4rk4e', numericUid: 100001 },
    { id: 'uid-D', displayName: 'Susmita', colour: '#E91E63', referralCode: 'cg-d000', numericUid: 100006 },
  ]
  const merged = FS.mergeAllUsers(local, all, null)
  assert.equal(merged.length, 2)
  assert.equal(FS.searchPeople(merged, 'Susmita').length, 2)
})

check('mergeAllUsers — একই ব্যবহারকারী id দিয়ে একবারই; নিজেকে বাদ', () => {
  const local = [{ id: 'uid-F', name: 'Rafi', color: '#111', online: true, isFriend: true }]
  const all = [{ id: 'uid-F', displayName: 'Rafi', colour: '#111', referralCode: 'cg-f1' }]
  const merged = FS.mergeAllUsers(local, all, null)
  assert.equal(merged.length, 1)
  assert.equal(merged[0].isFriend, true)
  const withSelf = FS.mergeAllUsers([], [{ id: 'uid-Me', displayName: 'Me', colour: '#111' }], 'uid-Me')
  assert.equal(withSelf.length, 0)
})

check('dedupeMembers — একই uid দুবার নয়; একই নামের আলাদা uid দুজনেই থাকে', () => {
  const list = [
    { id: 'uid-S', displayName: 'Susmita', createdAtMs: 1, colour: '#111' },
    { id: 'uid-S', displayName: 'Susmita', createdAtMs: 1, colour: '#111' },
    { id: 'uid-D', displayName: 'Susmita', createdAtMs: 2, colour: '#222' },
  ]
  const out = NM.dedupeMembers(list)
  assert.equal(out.length, 2)
  assert.deepEqual(out.map(m => m.id), ['uid-S', 'uid-D'])
})

check('fetchNewMembers/fetchAllPublicProfiles — ফলে dedupeMembers চলে', () => {
  assert.ok(firestoreSrc.includes('dedupeMembers(snap.docs.map'), 'fetch-এ dedupe নেই')
})

// ---------- ৮) রেজিস্ট্রেশনে নিজের পরিচয়ই লেখা হয় ----------
check('সিঙ্ক — referralCode ডকেরটা, না থাকলে নতুন কোড; ক্লোজারের পুরোনো কোড নয়', () => {
  const syncStart = storeSrc.indexOf('প্রথম সিঙ্ক — লগইনে একবার')
  const sync = storeSrc.slice(syncStart, syncStart + 12000)
  assert.ok(sync.includes('docReferralCode'), 'docReferralCode নেই')
  assert.ok(sync.includes('const myReferralCode = docReferralCode || randomCode()'), 'myReferralCode নেই')
  assert.ok(sync.includes('writePublicProfile(uid, user.name, myReferralCode'), 'প্রোফাইল-লেখায় myReferralCode নেই')
  assert.ok(sync.includes('referralCode: myReferralCode, numericUid: myNumericUid'), 'users-ডক লেখায় myReferralCode নেই')
})

check('getCurrentAuthIdentity — Firebase থেকে uid + ইমেইল দেয়', () => {
  assert.ok(firebaseSrc.includes('export function getCurrentAuthIdentity'), 'getCurrentAuthIdentity নেই')
  assert.ok(firebaseSrc.includes('u.isAnonymous'), 'বেনামি বাদ দেওয়া হয় না')
})

console.log(`\n${passed} passed`)
