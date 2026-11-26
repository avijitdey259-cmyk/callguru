// সংখ্যার UID বরাদ্দের টেস্ট — নতুন অ্যাকাউন্টে UID না বসার বাগ (২০২৬-১১-২৬)
// চালানো: রিপো রুট থেকে `node tests/numeric-uid-assignment.test.mjs`
// (esbuild দিয়ে pure মডিউল বান্ডল করে Node-এ চালায়; পেজ/স্টোর/নিয়মের
// গঠন সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
// বাগ (console-যাচাই, ২০২৬-১১-২৬ ১২:৩২): E (Sync Test E) + F (Sync Test F)
// — দুজনেরই users/publicProfiles ডকে numericUid নেই, অথচ কাউন্টার
// next: 100006-এ আটকে (A–D ১০০০০৩–১০০০০৬ পেয়েছিল)। কারণ: 0c71c004-এ
// ensureNumericUid ট্রানজ্যাকশনে প্রোফাইল-অস্তিত্ব যাচাই tx.set-এর পরে
// বসেছিল — Firestore নিয়ম "all reads before all writes" ভাঙায় প্রতিটি
// ট্রানজ্যাকশন ব্যর্থ হতো, catch চুপচাপ null ফেরাতো, কাউন্টার বাড়ত না।
// যাচাই করে:
//   ১) নতুন ব্যবহারকারী (প্রোফাইল ডক নেই) — কাউন্টার ১০০০০৬ → ১০০০০৭,
//      কাউন্টার ঠিক একবার বাড়ে, খালি {numericUid} ডক বানানো হয় না
//   ২) প্রোফাইল আছে কিন্তু UID নেই — প্রোফাইলে UID বসে, কাউন্টার +১
//   ৩) পরপর দুই বরাদ্দ — ১০০০০৭, ১০০০০৮; কারো নম্বর এক হয় না,
//      কাউন্টার প্রতিবার ঠিক একবার বাড়ে
//   ৪) কাউন্টার শেষ (৯৯৯৯৯৯) — 'Numeric UIDs exhausted', কাউন্টার বদলায় না
//   ৫) রিগ্রেশন গার্ড — সব পড়া সব লেখার আগে (পুরোনো ভুল ক্রমে নকল
//      ট্রানজ্যাকশন throw করে — SDK-র নিয়ম নকল করা হয়েছে)
//   ৬) ensureNumericUid — users/{uid} থেকে আগের বরাদ্দ নেয় (প্রোফাইলে
//      লেখা ব্যর্থ হলে), অন্যের নম্বর নেয় না, ব্যর্থতা console.warn-এ
//      দেখায়, assignNumericUidTx ব্যবহার করে
//   ৭) store — লগইনে বরাদ্দ, ব্যর্থ হলে একবার সাথে সাথে আবার চেষ্টা,
//      পরের লগইনেও আবার হয়; নতুন ব্যবহারকারীর দুই ডকেই UID লেখা হয়
//   ৮) firestore.rules — কাউন্টার নিয়ম বদলায়নি (নিয়ম publish লাগে না)
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-uid-assign-test-'))
await build({
  entryPoints: [join(root, 'src/numericUid.ts')],
  bundle: true, format: 'esm', platform: 'node', outdir: outDir, logLevel: 'silent',
})
const U = await import(join(outDir, 'numericUid.js'))

const firestoreSrc = readFileSync(join(root, 'src/firestore.ts'), 'utf8')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
const rulesSrc = readFileSync(join(root, 'firestore.rules'), 'utf8')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}
async function checkAsync(name, fn) {
  await fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

// ---- নকল ট্রানজ্যাকশন: আসল Firestore SDK-র নিয়ম মেনে চলে ----
// SDK (firebase 13.4.0): "Firestore transactions require all reads to be
// executed before all writes." — লেখার পর get() করলে throw হয়।
class FakeTx {
  constructor(store) {
    this.store = store // Map<ref, data>
    this.writes = new Map()
    this.ops = []
    this.setCalled = false
  }
  async get(ref) {
    this.ops.push('get')
    if (this.setCalled) throw new Error('Firestore transactions require all reads to be executed before all writes.')
    const data = this.store.get(ref)
    return { exists: () => data !== undefined, data: () => ({ ...(data ?? {}) }) }
  }
  set(ref, data, opts) {
    this.ops.push('set')
    this.setCalled = true
    const prev = this.writes.get(ref) ?? this.store.get(ref) ?? {}
    this.writes.set(ref, opts?.merge ? { ...prev, ...data } : { ...data })
  }
  commit() {
    for (const [k, v] of this.writes) this.store.set(k, v)
  }
}

async function runAssign(store, counterLast) {
  if (counterLast !== undefined) store.set('counter', { next: counterLast })
  const tx = new FakeTx(store)
  const n = await U.assignNumericUidTx(tx, 'counter', 'profile')
  tx.commit()
  return { n, ops: tx.ops }
}

await checkAsync('নতুন ব্যবহারকারী (প্রোফাইল ডক নেই) — কাউন্টার ১০০০০৬ → ১০০০০৭, খালি ডক নয়', async () => {
  const store = new Map()
  const { n, ops } = await runAssign(store, 100006)
  assert.equal(n, 100007)
  assert.equal(store.get('counter').next, 100007)
  assert.ok(!store.has('profile'), 'প্রোফাইল ডক বানানো হয়েছে — খালি {numericUid} ডক হওয়ার কথা নয়')
  assert.deepEqual(ops, ['get', 'get', 'set'], 'অপ ক্রম ভুল — পড়া দুটো আগে, লেখা পরে হওয়ার কথা')
})

await checkAsync('প্রোফাইল আছে কিন্তু UID নেই — প্রোফাইলে UID বসে, কাউন্টার +১', async () => {
  const store = new Map([['profile', { displayName: 'Sync Test E', createdAt: 'x', colour: '#123456', referralCode: 'cg-qavv7f' }]])
  const { n } = await runAssign(store, 100006)
  assert.equal(n, 100007)
  assert.equal(store.get('counter').next, 100007)
  assert.equal(store.get('profile').numericUid, 100007)
  assert.equal(store.get('profile').displayName, 'Sync Test E', 'প্রোফাইলের অন্য ক্ষেত্র বদলানো যাবে না')
})

await checkAsync('পরপর দুই বরাদ্দ — ১০০০০৭, ১০০০০৮; কারো নম্বর এক নয়, কাউন্টার ঠিক একবার করে বাড়ে', async () => {
  const store = new Map()
  const first = await runAssign(store, 100006)
  const second = await runAssign(store, undefined)
  assert.equal(first.n, 100007)
  assert.equal(second.n, 100008)
  assert.notEqual(first.n, second.n)
  assert.equal(store.get('counter').next, 100008)
})

await checkAsync('কাউন্টার শেষ (৯৯৯৯৯৯) — throw, কাউন্টার বদলায় না', async () => {
  const store = new Map()
  await assert.rejects(runAssign(store, 999999), /Numeric UIDs exhausted/)
  assert.equal(store.get('counter').next, 999999, 'ব্যর্থ বরাদ্দে কাউন্টার বদলানো যাবে না')
})

await checkAsync('রিগ্রেশন গার্ড — সব পড়া সব লেখার আগে; পুরোনো ভুল ক্রম throw করে', async () => {
  // নতুন হেলপার: সব get সবার আগে, তারপর set — নকল SDK কিছু বলে না।
  const store = new Map([['profile', { displayName: 'X' }]])
  const { ops } = await runAssign(store, 100006)
  const lastGet = ops.lastIndexOf('get')
  const firstSet = ops.indexOf('set')
  assert.ok(lastGet >= 0 && firstSet > lastGet, `পড়া লেখার আগে নয়: ${ops.join(',')}`)
  // পুরোনো (0c71c004) ক্রম — set-এর পর get — নকল SDK throw করে, আর
  // কমিট না হওয়ায় কাউন্টার আটকে থাকে (লাইভে next 100006-এ আটকে ছিল)।
  const buggyStore = new Map()
  buggyStore.set('counter', { next: 100006 })
  const buggyTx = new FakeTx(buggyStore)
  await assert.rejects(async () => {
    const cSnap = await buggyTx.get('counter')
    const last = cSnap.exists() ? cSnap.data().next : 100000
    const next = last + 1
    buggyTx.set('counter', { next })
    const pSnap = await buggyTx.get('profile')
    if (pSnap.exists()) buggyTx.set('profile', { numericUid: next }, { merge: true })
    return next
  }, /before all writes/)
  assert.equal(buggyStore.get('counter').next, 100006, 'ব্যর্থ ট্রানজ্যাকশনে কাউন্টার বাড়বে না')
})

check('ensureNumericUid — assignNumericUidTx ব্যবহার করে, ভেতরে ভুল ক্রম নেই', () => {
  const start = firestoreSrc.indexOf('export async function ensureNumericUid')
  assert.ok(start >= 0, 'ensureNumericUid নেই')
  const end = firestoreSrc.indexOf('// অ্যাডমিনের ব্যাকফিল', start)
  assert.ok(end > start, 'ensureNumericUid-এর শেষ খুঁজে পাওয়া যায়নি')
  const fn = firestoreSrc.slice(start, end)
  assert.ok(fn.includes('assignNumericUidTx(tx, counterRef, ref)'), 'ট্রানজ্যাকশন হেলপার ব্যবহার করে না')
  assert.ok(!fn.includes('tx.get(ref)') || fn.indexOf('tx.get(ref)') < 0, 'ফাংশনে সরাসরি tx.get(ref) থাকবে না')
  assert.ok(!fn.includes('tx.set(counterRef'), 'ফাংশনে সরাসরি tx.set থাকবে না')
})

check('ensureNumericUid — users/{uid} থেকে আগের বরাদ্দ নেয়, অন্যের নম্বর নেয় না', () => {
  const start = firestoreSrc.indexOf('export async function ensureNumericUid')
  const fn = firestoreSrc.slice(start, firestoreSrc.indexOf('// অ্যাডমিনের ব্যাকফিল', start))
  assert.ok(fn.includes("getDoc(doc(d, 'users', uid))"), 'users/{uid} পড়া হয় না')
  assert.ok(fn.includes('findUserByNumericUid(userUid)'), 'নম্বরটা অন্যের কি না যাচাই হয় না')
  assert.ok(fn.includes('takenBy.uid === uid'), 'নিজের নম্বরই শুধু নেওয়া হয় না')
  assert.ok(fn.includes("if (snap.exists()) await setDoc(ref, { numericUid: userUid }, { merge: true })"), 'প্রোফাইল থাকলে আগের নম্বর সেখানে লেখা হয় না')
})

check('ensureNumericUid — ব্যর্থতা console.warn-এ দেখায়, চুপচাপ হারায় না', () => {
  const start = firestoreSrc.indexOf('export async function ensureNumericUid')
  const fn = firestoreSrc.slice(start, firestoreSrc.indexOf('// অ্যাডমিনের ব্যাকফিল', start))
  assert.ok(fn.includes("console.warn('[numericUid] assignment failed for', uid, err)"), 'ব্যর্থতা warn করা হয় না')
  assert.ok(!fn.includes('} catch { return null }'), 'catch এখনো চুপচাপ null ফেরায়')
})

check('store — লগইনে বরাদ্দ, ব্যর্থ হলে একবার সাথে সাথে আবার চেষ্টা হয়', () => {
  assert.ok(storeSrc.includes('let myNumericUid = await ensureNumericUid(uid)'), 'বরাদ্দের ফল let-এ রাখা হয় না')
  assert.ok(storeSrc.includes('if (myNumericUid === null && !cancelled) {'), 'null হলে আবার চেষ্টার শর্ত নেই')
  const retryAt = storeSrc.indexOf('if (myNumericUid === null && !cancelled) {')
  assert.ok(retryAt >= 0, 'আবার চেষ্টার ব্লক নেই')
  const retryBlock = storeSrc.slice(retryAt, retryAt + 400)
  assert.ok(retryBlock.includes('setTimeout(r, 2000)'), 'আবার চেষ্টার আগে বিরতি নেই')
  assert.ok(retryBlock.includes('myNumericUid = await ensureNumericUid(uid)'), 'দ্বিতীয়বার ensureNumericUid ডাকা হয় না')
  // পরের লগইনেও আবার হয় — সিঙ্ক-চিহ্ন শুধু সফল শেষেই বসে, লগআউটে শূন্য হয়।
  assert.ok(storeSrc.includes('fsSyncUidRef.current = null'), 'লগআউটে সিঙ্ক-চিহ্ন শূন্য হয় না — পরের লগইনে বরাদ্দ আবার হবে না')
})

check('store — নতুন ব্যবহারকারীর দুই ডকেই UID লেখা হয়', () => {
  assert.ok(storeSrc.includes('numericUid: myNumericUid }'), 'writeUserDoc-এ numericUid যায় না')
  assert.ok(storeSrc.includes('...(myNumericUid !== null ? { numericUid: myNumericUid } : {})'), 'profileExtra-তে numericUid যায় না')
  assert.ok(storeSrc.includes('await writePublicProfile(uid, user.name, myReferralCode, profileExtra)'), 'writePublicProfile ডাকা হয় না')
})

check('firestore.rules — কাউন্টার নিয়ম বদলায়নি (নিয়ম publish লাগে না)', () => {
  assert.ok(rulesSrc.includes('match /config/uidCounter'), 'কাউন্টার ম্যাচ নেই')
  assert.ok(rulesSrc.includes('request.resource.data.next == resource.data.next + 1'), 'কাউন্টার +১ নিয়ম নেই')
  assert.ok(rulesSrc.includes("request.resource.data.keys().hasOnly(['next'])"), 'কাউন্টারে শুধু next লেখার নিয়ম নেই')
})

console.log(`\n${passed} passed`)
