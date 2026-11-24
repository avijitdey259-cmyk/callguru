// Pi ট্রান্সফার টেস্ট — UID দিয়ে Pi পাঠানো, ২% ফি অ্যাডমিনের, শুধু আসল Pi,
// পাঠাতে অনুমোদিত KYC, ট্রানজ্যাকশনে কাটা + অপরিবর্তনীয় রেকর্ড।
// চালানো: রিপো রুট থেকে `node tests/pi-transfer.test.mjs`
// (esbuild দিয়ে src/piTransfer.ts বান্ডল করে Node-এ চালায়; পেজ/স্টোর/নিয়মের
// গঠন সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) হিসাব — ফি ২%, প্রাপক ৯৮%, ফি + প্রাপক = পরিমাণ (ঠিক মেলে)
//   ২) যাচাই — KYC ছাড়া নয়, সর্বনিম্নের নিচে নয়, ব্যালেন্সের বেশি নয়, নিজেকে নয়
//   ৩) ডক যাচাই — ভুল অঙ্ক/নিজেকে পাঠানো/ভুল ফি% বাদ যায়
//   ৪) ভূমিকা — পাঠক/প্রাপক/ফি-প্রাপক; অ্যাডমিন পাঠালে পাঠক + ফি দুটোই
//   ৫) জমা — সারির id-তে ট্রান্সফারের id বাঁধা, দুবার জমা হয় না
//   ৬) firestore.ts — ট্রানজ্যাকশনে কাটা + piTransfers ডক; UID দিয়ে খোঁজা;
//      প্রাপক/অ্যাডমিনের জমা ডক থেকে (অন্যের ডক লেখা হয় না)
//   ৭) store — sendPi + lookupUserByUid; লগইনে ও লাইভে জমা প্রয়োগ হয়
//   ৮) পেজ — Send Pi UI: UID খোঁজা, নাম+ছবি দেখে নিশ্চিত, ভাঙন, কনফার্ম,
//      অচেনা UID-তে কিছু যায় না, KYC গেট
//   ৯) অ্যাডমিন সেটিংস — ফি% + সর্বনিম্ন ট্রান্সফার বদলানো যায়
//   ১০) firestore.rules — piTransfers: তৈরি শুধু পাঠক, পড়া অংশগ্রহণকারী/
//      অ্যাডমিন, বদলানো/মোছা বন্ধ
//   ১১) Pi Report — ট্রান্সফারের লাইন আয়/খরচের যোগফলে ধরা হয়
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-transfer-test-'))
await build({
  entryPoints: [join(root, 'src/piTransfer.ts')],
  bundle: true, format: 'esm', platform: 'node', outfile: join(outDir, 'piTransfer.js'), logLevel: 'silent',
})
const T = await import(join(outDir, 'piTransfer.js'))

const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
const firestoreSrc = readFileSync(join(root, 'src/firestore.ts'), 'utf8')
const mappingSrc = readFileSync(join(root, 'src/firestoreMapping.ts'), 'utf8')
const rulesSrc = readFileSync(join(root, 'firestore.rules'), 'utf8')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

const base = { id: 'tr1', fromUid: 'a'.repeat(28), toUid: 'b'.repeat(28), adminUid: 'LXnGL8xA6VW8Gp7hvCaoakOha822', fromName: 'Avijit', toName: 'Rima', fromNumericUid: 100001, toNumericUid: 100002, amount: 10, fee: 0.2, net: 9.8, feePct: 2, participants: ['a'.repeat(28), 'b'.repeat(28)], status: 'completed', createdAtMs: 1700000000000 }

check('ডিফল্ট — ফি ২%, সর্বনিম্ন ট্রান্সফার ০.১ π', () => {
  assert.equal(T.DEFAULT_TRANSFER_FEE_PCT, 2)
  assert.equal(T.DEFAULT_MIN_TRANSFER_PI, 0.1)
  assert.equal(T.ADMIN_UID, 'LXnGL8xA6VW8Gp7hvCaoakOha822')
})

check('হিসাব — ফি ২%, প্রাপক ৯৮%, ফি + প্রাপক = পরিমাণ (ঠিক মেলে)', () => {
  const c = T.computeTransfer(10, 2)
  assert.equal(c.amount, 10)
  assert.equal(c.fee, 0.2)
  assert.equal(c.net, 9.8)
  assert.equal(c.fee + c.net, 10)
  const small = T.computeTransfer(0.1, 2)
  assert.equal(small.fee, 0.002)
  assert.equal(small.net, 0.098)
  const odd = T.computeTransfer(1.005, 2)
  assert.equal(odd.fee + odd.net, 1.005)
  assert.equal(T.computeTransfer(5, 0).fee, 0)
  assert.equal(T.computeTransfer(5, 0).net, 5)
})

check('যাচাই — KYC ছাড়া নয়, সর্বনিম্নের নিচে নয়, ব্যালেন্সের বেশি নয়, নিজেকে নয়', () => {
  const ok = { amount: 1, balance: 10, minTransfer: 0.1, kycApproved: true, isSelf: false }
  assert.equal(T.validateTransferInput(ok), null)
  assert.ok(T.validateTransferInput({ ...ok, kycApproved: false })?.includes('KYC'))
  assert.ok(T.validateTransferInput({ ...ok, amount: 0.05 })?.includes('Minimum'))
  assert.ok(T.validateTransferInput({ ...ok, amount: 11 })?.includes('Not enough'))
  assert.ok(T.validateTransferInput({ ...ok, isSelf: true })?.includes('yourself'))
  assert.ok(T.validateTransferInput({ ...ok, amount: NaN }))
  assert.ok(T.validateTransferInput({ ...ok, amount: 0 }))
})

check('ডক যাচাই — ভুল অঙ্ক/নিজেকে পাঠানো/ভুল ফি% বাদ যায়', () => {
  assert.ok(T.mapPiTransferDoc('tr1', base))
  assert.equal(T.mapPiTransferDoc('tr1', { ...base, fee: 0.3, net: 9.8 }), null)
  assert.equal(T.mapPiTransferDoc('tr1', { ...base, toUid: base.fromUid }), null)
  assert.equal(T.mapPiTransferDoc('tr1', { ...base, feePct: 11 }), null)
  assert.equal(T.mapPiTransferDoc('tr1', { ...base, amount: 0 }), null)
  assert.equal(T.mapPiTransferDoc('tr1', { ...base, amount: -5 }), null)
  assert.equal(T.mapPiTransferDoc('tr1', null), null)
})

check('ভূমিকা — পাঠক/প্রাপক/ফি-প্রাপক; অ্যাডমিন পাঠালে পাঠক + ফি দুটোই', () => {
  assert.deepEqual(T.transferRoles(base, base.fromUid), ['sent'])
  assert.deepEqual(T.transferRoles(base, base.toUid), ['received'])
  assert.deepEqual(T.transferRoles(base, base.adminUid), ['fee'])
  assert.deepEqual(T.transferRoles(base, 'someone-else'), [])
  const adminSends = { ...base, fromUid: base.adminUid }
  assert.deepEqual(T.transferRoles(adminSends, base.adminUid), ['sent', 'fee'])
})

check('জমা — সারির id-তে ট্রান্সফারের id বাঁধা, দুবার জমা হয় না', () => {
  const sent = T.buildTransferApplication(base, 'sent')
  assert.equal(sent.delta, -10)
  assert.equal(sent.row.id, 'tr-tr1')
  assert.equal(sent.row.type, 'Transfer Sent')
  assert.ok(sent.row.label.includes('Rima') && sent.row.label.includes('100002'))
  const recv = T.buildTransferApplication(base, 'received')
  assert.equal(recv.delta, 9.8)
  assert.equal(recv.row.id, 'tr-tr1-in')
  assert.equal(recv.row.type, 'Transfer Received')
  const fee = T.buildTransferApplication(base, 'fee')
  assert.equal(fee.delta, 0.2)
  assert.equal(fee.row.id, 'tr-tr1-fee')
  assert.equal(fee.row.type, 'Transfer Fee')
  assert.ok(T.isTransferApplied(['tr-tr1'], 'tr1', 'sent'))
  assert.ok(!T.isTransferApplied(['tr-tr1'], 'tr1', 'received'))
  assert.ok(!T.isTransferApplied([], 'tr1', 'sent'))
})

check('firestore.ts — ট্রানজ্যাকশনে কাটা + piTransfers ডক; UID দিয়ে খোঁজা', () => {
  assert.ok(firestoreSrc.includes('export async function createPiTransfer'), 'createPiTransfer নেই')
  assert.ok(firestoreSrc.includes('runTransaction(d, async (tx)'), 'ট্রানজ্যাকশনে নয়')
  assert.ok(firestoreSrc.includes("doc(d, 'users', input.fromUid)"), 'পাঠকের ডক পড়া হয় না')
  assert.ok(firestoreSrc.includes("kycStatus !== 'approved'"), 'ট্রানজ্যাকশনে KYC যাচাই নেই')
  assert.ok(firestoreSrc.includes("tx.set(transferRef,"), 'piTransfers ডক তৈরি হয় না')
  assert.ok(firestoreSrc.includes("tx.update(senderRef, { piBalance:"), 'পাঠকের ব্যালেন্স কাটা হয় না')
  assert.ok(firestoreSrc.includes('export async function findUserByNumericUid'), 'UID দিয়ে খোঁজা নেই')
  assert.ok(firestoreSrc.includes("where('numericUid', '==', numericUid)"), 'numericUid কোয়েরি নেই')
  assert.ok(firestoreSrc.includes('export async function fetchMyPiTransfers'), 'fetchMyPiTransfers নেই')
  assert.ok(firestoreSrc.includes('export function subscribeMyPiTransfers'), 'subscribeMyPiTransfers নেই')
  assert.ok(firestoreSrc.includes("where('participants', 'array-contains', uid)"), 'participants কোয়েরি নেই')
  // প্রাপক/অ্যাডমিনের users ডক এই ফাংশনে লেখা হয় না — জমা হয় ডক থেকে
  const body = firestoreSrc.slice(firestoreSrc.indexOf('export async function createPiTransfer'), firestoreSrc.indexOf('export async function fetchMyPiTransfers'))
  assert.ok(!body.includes("doc(d, 'users', input.toUid)"), 'ট্রানজ্যাকশনে প্রাপকের ডক লেখা হয় (নিয়ম ভাঙবে)')
  assert.ok(!body.includes("doc(d, 'users', ADMIN_UID)"), 'ট্রানজ্যাকশনে অ্যাডমিনের ডক লেখা হয় (নিয়ম ভাঙবে)')
})

check('store — sendPi + lookupUserByUid; লগইনে ও লাইভে জমা প্রয়োগ হয়', () => {
  assert.ok(storeSrc.includes('lookupUserByUid: (numericUid) => findUserByNumericUid(numericUid)'), 'lookupUserByUid নেই')
  assert.ok(storeSrc.includes('sendPi: async (to, amount, opts)'), 'sendPi নেই')
  assert.ok(storeSrc.includes('validateTransferInput({ amount:'), 'sendPi-তে যাচাই নেই')
  assert.ok(storeSrc.includes('await writeUserDoc(uid, toUserDoc(collectSnapshot()))'), 'পাঠানোর আগে স্ন্যাপশট তাজা হয় না')
  assert.ok(storeSrc.includes('const res = await createPiTransfer('), 'createPiTransfer ডাকা হয় না')
  assert.ok(storeSrc.includes('setPiBalance(res.newBalance)'), 'স্থানীয় ব্যালেন্স ট্রানজ্যাকশনের ফলে বসে না')
  assert.ok(storeSrc.includes('const applyPiTransfer = (t: PiTransferDoc'), 'applyPiTransfer নেই')
  assert.ok(storeSrc.includes('subscribeMyPiTransfers(uid,'), 'লাইভ ট্রান্সফার সাবস্ক্রিপশন নেই')
  assert.ok(storeSrc.includes('fetchMyPiTransfers(uid)'), 'লগইনে ট্রান্সফার আনা হয় না')
  assert.ok(storeSrc.includes('piTransferFeePct'), 'ফি% অবস্থা নেই')
  assert.ok(storeSrc.includes('piMinTransfer'), 'সর্বনিম্ন অবস্থা নেই')
  assert.ok(storeSrc.includes("if (c.piTransferFeePct !== undefined) setPiTransferFeePctState(c.piTransferFeePct)"), 'কনফিগ থেকে ফি% আসে না')
  assert.ok(storeSrc.includes("if (c.piMinTransfer !== undefined) setPiMinTransferState(c.piMinTransfer)"), 'কনফিগ থেকে সর্বনিম্ন আসে না')
})

check('পেজ — Send Pi UI: UID খোঁজা, নাম+ছবি দেখে নিশ্চিত, ভাঙন, কনফার্ম', () => {
  assert.ok(pagesSrc.includes('id="wallet-sendpi"'), 'Send Pi সেকশন নেই')
  assert.ok(pagesSrc.includes('Recipient UID (6 digits)'), 'UID ইনপুট নেই')
  assert.ok(pagesSrc.includes('No user found with this UID'), 'অচেনা UID-র বার্তা নেই')
  assert.ok(pagesSrc.includes('Receiver gets'), 'কনফার্ম ভাঙনে Receiver gets নেই')
  assert.ok(pagesSrc.includes('Confirm Send'), 'কনফার্ম বোতাম নেই')
  assert.ok(pagesSrc.includes('Pi send needs approved KYC'), 'Send Pi-তে KYC গেট নেই')
  assert.ok(pagesSrc.includes('Or pick a friend'), 'বন্ধু থেকে বেছে নেওয়া নেই')
  assert.ok(pagesSrc.includes('Only real Pi can be sent'), 'শুধু আসল Pi-র কথা নেই')
  assert.ok(pagesSrc.includes("getElementById('wallet-sendpi')"), 'ব্যালেন্স কার্ডে Send Pi বোতাম নেই')
})

check('অ্যাডমিন সেটিংস — ফি% + সর্বনিম্ন ট্রান্সফার বদলানো যায়', () => {
  assert.ok(pagesSrc.includes('Pi Transfer Fee (%)'), 'ট্রান্সফার ফি ইনপুট নেই')
  assert.ok(pagesSrc.includes('Minimum Transfer (π)'), 'সর্বনিম্ন ট্রান্সফার ইনপুট নেই')
  assert.ok(pagesSrc.includes('setPiTransferFeePct(v)'), 'ফি% সেভ হয় না')
  assert.ok(pagesSrc.includes('setPiMinTransfer(v)'), 'সর্বনিম্ন সেভ হয় না')
  assert.ok(pagesSrc.includes('Transfer fee {piTransferFeePct}%'), 'বর্তমান ফি দেখায় না')
})

check('firestore.rules — piTransfers: তৈরি শুধু পাঠক, পড়া অংশগ্রহণকারী/অ্যাডমিন, বদলানো/মোছা বন্ধ', () => {
  assert.ok(rulesSrc.includes('match /piTransfers/{transferId}'), 'piTransfers ম্যাচ নেই')
  const body = rulesSrc.slice(rulesSrc.indexOf('match /piTransfers/{transferId}'))
  assert.ok(body.includes('request.resource.data.fromUid == request.auth.uid'), 'তৈরি শুধু পাঠক নয়')
  assert.ok(body.includes("request.resource.data.toUid != request.auth.uid"), 'নিজেকে পাঠানো আটকানো নেই')
  assert.ok(body.includes('request.resource.data.feePct <= 10'), 'ফি% সীমা নেই')
  assert.ok(body.includes("request.resource.data.status == 'completed'"), 'স্ট্যাটাস যাচাই নেই')
  assert.ok(body.includes('allow update, delete: if false'), 'বদলানো/মোছা বন্ধ নেই')
  assert.ok(rulesSrc.includes('firebase deploy --only firestore:rules --project picall-76185'), 'নিয়ম publish নির্দেশ নেই')
})

check('কনফিগ ম্যাপিং — ফি% + সর্বনিম্ন config/public-এ যায় ও আসে', () => {
  assert.ok(mappingSrc.includes('piTransferFeePct: number'), 'PublicConfigDoc-এ ফি% নেই')
  assert.ok(mappingSrc.includes('piMinTransfer: number'), 'PublicConfigDoc-এ সর্বনিম্ন নেই')
  assert.ok(mappingSrc.includes('piTransferFeePct: rates.piTransferFeePct'), 'toPublicConfig-এ ফি% নেই')
  assert.ok(mappingSrc.includes("if (typeof d.piTransferFeePct === 'number'"), 'fromPublicConfig-এ ফি% পড়া হয় না')
  assert.ok(mappingSrc.includes("if (typeof d.piMinTransfer === 'number'"), 'fromPublicConfig-এ সর্বনিম্ন পড়া হয় না')
})

check('Pi Report — ট্রান্সফারের লাইন আয়/খরচের যোগফলে ধরা হয়', () => {
  assert.ok(pagesSrc.includes("'Transfer Received', 'Transfer Fee'"), 'প্রাপ্তি/ফি আয়ে ধরা হয় না')
  assert.ok(pagesSrc.includes("'Transfer Sent'"), 'পাঠানো খরচে ধরা হয় না')
  assert.ok(pagesSrc.includes("type: 'Transfer Sent'") || pagesSrc.includes("'Transfer Sent'"), 'খতিয়ানে Transfer Sent লাইন নেই')
})

console.log(`\n${passed} passed`)
