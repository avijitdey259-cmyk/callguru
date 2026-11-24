// পেমেন্ট রিকোয়েস্ট টেস্ট — "আমাকে Pi দাও" অনুরোধ: পাঠানো, Pay
// (item 6-এর ট্রান্সফারই চলে), Decline, Cancel; স্ট্যাটাস একমুখী।
// চালানো: রিপো রুট থেকে `node tests/payment-request.test.mjs`
// (esbuild দিয়ে src/paymentRequest.ts বান্ডল করে Node-এ চালায়; পেজ/স্টোর/
// নিয়মের গঠন সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) ডক যাচাই — ঠিক ডক পার্স হয়; নিজেকে/ভুল পরিমাণ/ভুল স্ট্যাটাস বাদ
//   ২) অনুরোধ যাচাই — নিজেকে নয়, সর্বনিম্ন ০.১ π, ভুল পরিমাণ নয়
//   ৩) ভূমিকা — Pay/Decline শুধু প্রাপক, Cancel শুধু অনুরোধকারী, শুধু pending
//   ৪) স্ট্যাটাস লেবেল + মেটানো হয়নি এমন আসা অনুরোধের সংখ্যা (ব্যাজ)
//   ৫) Pay-এর অঙ্ক — পাঠক পুরোটা দেন, অনুরোধকারী পান ৯৮%, ফি ২%
//   ৬) store — requestPayment/payPaymentRequest/decline/cancel + Pay-টা
//      ট্রানজ্যাকশনে request 'paid' করে (markRequestPaidId)
//   ৭) পেজ — Wallet-এ Request Payment + Payment Requests (ব্যাজ), Pay
//      কনফার্মে ভাঙন, Decline/Cancel বোতাম
//   ৮) firestore.rules — paymentRequests: তৈরি শুধু অনুরোধকারী, পড়া শুধু
//      দুই পক্ষ, স্ট্যাটাস বদল শুধু সঠিক পক্ষ + শুধু status ফিল্ড
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-payreq-test-'))
await build({
  entryPoints: [join(root, 'src/paymentRequest.ts'), join(root, 'src/piTransfer.ts')],
  bundle: true, format: 'esm', platform: 'node', outdir: outDir, logLevel: 'silent',
})
const R = await import(join(outDir, 'paymentRequest.js'))
const T = await import(join(outDir, 'piTransfer.js'))

const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
const firestoreSrc = readFileSync(join(root, 'src/firestore.ts'), 'utf8')
const rulesSrc = readFileSync(join(root, 'firestore.rules'), 'utf8')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

const good = {
  id: 'rq1', fromUid: 'a'.repeat(28), toUid: 'b'.repeat(28),
  fromName: 'Rima', toName: 'Shakil', fromPhoto: 'data:image/png;base64,AAA',
  fromNumericUid: 100002, toNumericUid: 100003, amount: 10, note: 'Payment for the call',
  status: 'pending', participants: ['a'.repeat(28), 'b'.repeat(28)], createdAtMs: 1700000000000,
}

check('ডক যাচাই — ঠিক ডক পার্স হয়; নিজেকে/ভুল পরিমাণ/ভুল স্ট্যাটাস বাদ', () => {
  const doc = R.mapPaymentRequestDoc('rq1', good)
  assert.ok(doc)
  assert.equal(doc.amount, 10)
  assert.equal(doc.status, 'pending')
  assert.equal(doc.fromPhoto, 'data:image/png;base64,AAA')
  assert.equal(R.mapPaymentRequestDoc('rq1', { ...good, fromUid: 'a'.repeat(28), toUid: 'a'.repeat(28) }), null)
  assert.equal(R.mapPaymentRequestDoc('rq1', { ...good, amount: 0 }), null)
  assert.equal(R.mapPaymentRequestDoc('rq1', { ...good, status: 'done' }), null)
  assert.equal(R.mapPaymentRequestDoc('rq1', { ...good, note: 'x'.repeat(500) })?.note?.length, 200)
})

check('অনুরোধ যাচাই — নিজেকে নয়, সর্বনিম্ন ০.১ π, ভুল পরিমাণ নয়', () => {
  assert.equal(R.validatePaymentRequest({ amount: 5, minTransfer: 0.1, isSelf: false }), null)
  assert.ok(R.validatePaymentRequest({ amount: 5, minTransfer: 0.1, isSelf: true })?.includes('yourself'))
  assert.ok(R.validatePaymentRequest({ amount: 0.05, minTransfer: 0.1, isSelf: false })?.includes('Minimum'))
  assert.ok(R.validatePaymentRequest({ amount: 0, minTransfer: 0.1, isSelf: false })?.includes('valid'))
})

check('ভূমিকা — Pay/Decline শুধু প্রাপক, Cancel শুধু অনুরোধকারী, শুধু pending', () => {
  assert.equal(R.canPayRequest(good, 'b'.repeat(28)), true)
  assert.equal(R.canPayRequest(good, 'a'.repeat(28)), false)
  assert.equal(R.canDeclineRequest(good, 'b'.repeat(28)), true)
  assert.equal(R.canDeclineRequest(good, 'a'.repeat(28)), false)
  assert.equal(R.canCancelRequest(good, 'a'.repeat(28)), true)
  assert.equal(R.canCancelRequest(good, 'b'.repeat(28)), false)
  const paid = { ...good, status: 'paid' }
  assert.equal(R.canPayRequest(paid, 'b'.repeat(28)), false)
  assert.equal(R.canDeclineRequest(paid, 'b'.repeat(28)), false)
  assert.equal(R.canCancelRequest(paid, 'a'.repeat(28)), false)
})

check('স্ট্যাটাস লেবেল + মেটানো হয়নি এমন আসা অনুরোধের সংখ্যা (ব্যাজ)', () => {
  assert.equal(R.paymentRequestStatusLabel('pending'), '⏳ Pending')
  assert.equal(R.paymentRequestStatusLabel('paid'), '✅ Paid')
  assert.equal(R.paymentRequestStatusLabel('declined'), '❌ Declined')
  assert.equal(R.paymentRequestStatusLabel('cancelled'), '🚫 Cancelled')
  const list = [good, { ...good, id: 'rq2', status: 'paid' }, { ...good, id: 'rq3', fromUid: 'c'.repeat(28), toUid: 'b'.repeat(28) }, { ...good, id: 'rq4', toUid: 'c'.repeat(28) }]
  assert.equal(R.pendingIncomingCount(list, 'b'.repeat(28)), 2)
  assert.equal(R.pendingIncomingCount(list, 'c'.repeat(28)), 1)
  assert.equal(R.pendingIncomingCount(list, 'd'.repeat(28)), 0)
})

check('Pay-এর অঙ্ক — পাঠক পুরোটা দেন, অনুরোধকারী পান ৯৮%, ফি ২%', () => {
  const c = T.computeTransfer(10, 2)
  assert.equal(c.amount, 10)
  assert.equal(c.fee, 0.2)
  assert.equal(c.net, 9.8)
  assert.equal(c.fee + c.net, 10)
})

check('store — requestPayment/payPaymentRequest/decline/cancel + Pay ট্রানজ্যাকশনে request paid', () => {
  assert.ok(storeSrc.includes('paymentRequests: PaymentRequestDoc[]'), 'paymentRequests স্টেট নেই')
  assert.ok(storeSrc.includes('requestPayment: async (to, amount, note)'), 'requestPayment নেই')
  assert.ok(storeSrc.includes('payPaymentRequest: async (req)'), 'payPaymentRequest নেই')
  assert.ok(storeSrc.includes('declinePaymentRequest: async (req)'), 'declinePaymentRequest নেই')
  assert.ok(storeSrc.includes('cancelPaymentRequest: async (req)'), 'cancelPaymentRequest নেই')
  assert.ok(storeSrc.includes('markRequestPaidId: req.id'), 'Pay-এ markRequestPaidId পাঠানো হয় না')
  assert.ok(storeSrc.includes("sendPi: async (to, amount, opts)"), 'sendPi-তে opts নেই')
  assert.ok(storeSrc.includes('subscribeMyPaymentRequests(uid, (docs) => { setPaymentRequests(docs) })'), 'লাইভ সাবস্ক্রিপশন নেই')
  assert.ok(storeSrc.includes('fetchMyPaymentRequests(uid)'), 'লগইন সিঙ্কে অনুরোধ আনা হয় না')
  assert.ok(firestoreSrc.includes('export async function createPaymentRequest'), 'createPaymentRequest নেই')
  assert.ok(firestoreSrc.includes("markRequestPaidId?: string"), 'createPiTransfer-এ markRequestPaidId নেই')
  assert.ok(firestoreSrc.includes("throw new Error('request-not-pending')"), 'request-not-pending যাচাই নেই')
  assert.ok(firestoreSrc.includes('tx.update(reqRef, { status: \'paid\' })'), 'ট্রানজ্যাকশনে request paid হয় না')
  assert.ok(firestoreSrc.includes('export function subscribeMyPaymentRequests'), 'subscribeMyPaymentRequests নেই')
})

check('পেজ — Wallet-এ Request Payment + Payment Requests (ব্যাজ), Pay কনফার্মে ভাঙন', () => {
  assert.ok(pagesSrc.includes('Request Payment'), 'Request Payment সেকশন নেই')
  assert.ok(pagesSrc.includes('Payment Requests'), 'Payment Requests সেকশন নেই')
  assert.ok(pagesSrc.includes('pendingIncomingCount(paymentRequests, uid)'), 'ব্যাজ সংখ্যা নেই')
  assert.ok(pagesSrc.includes('payPaymentRequest(req as never)'), 'Pay ডাকা হয় না')
  assert.ok(pagesSrc.includes('declinePaymentRequest(req as never)'), 'Decline ডাকা হয় না')
  assert.ok(pagesSrc.includes('cancelPaymentRequest(req as never)'), 'Cancel ডাকা হয় না')
  assert.ok(pagesSrc.includes('No user found with this UID'), 'অচেনা UID বার্তা নেই')
  assert.ok(pagesSrc.includes('Paying needs approved KYC'), 'Pay-এ KYC বার্তা নেই')
  assert.ok(pagesSrc.includes('paymentRequestStatusLabel(r.status)'), 'স্ট্যাটাস লেবেল দেখায় না')
})

check('firestore.rules — paymentRequests: তৈরি শুধু অনুরোধকারী, পড়া শুধু দুই পক্ষ, স্ট্যাটাস বদল শুধু সঠিক পক্ষ', () => {
  const body = rulesSrc.slice(rulesSrc.indexOf('match /paymentRequests/{requestId}'))
  assert.ok(body.includes("request.resource.data.fromUid == request.auth.uid"), 'তৈরি গার্ড নেই')
  assert.ok(body.includes("request.resource.data.toUid != request.auth.uid"), 'নিজেকে অনুরোধ আটকানো নেই')
  assert.ok(body.includes("request.resource.data.status == 'pending'"), 'pending দিয়ে শুরু নয়')
  assert.ok(body.includes("resource.data.fromUid == request.auth.uid || resource.data.toUid == request.auth.uid"), 'পড়া দুই পক্ষের নয়')
  assert.ok(body.includes("request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status'])"), 'শুধু status বদলানো নয়')
  assert.ok(body.includes("(resource.data.toUid == request.auth.uid && (request.resource.data.status == 'paid' || request.resource.data.status == 'declined'))"), 'প্রাপকের pay/decline গার্ড নেই')
  assert.ok(body.includes("(resource.data.fromUid == request.auth.uid && request.resource.data.status == 'cancelled')"), 'অনুরোধকারীর cancel গার্ড নেই')
  assert.ok(body.includes('allow delete: if false'), 'মোছা বন্ধ নয়')
})

console.log(`\n${passed} passed`)
