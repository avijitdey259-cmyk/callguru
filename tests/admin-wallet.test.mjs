// অ্যাডমিন ওয়ালেট টেস্ট — অ্যাডমিনের নিজের ব্যালেন্স থেকে যেকোনো
// ব্যবহারকারীকে ম্যানুয়ালি Pi পাঠানো (ফি নেই, প্রাপক পুরোটাই পায়)।
// চালানো: রিপো রুট থেকে `node tests/admin-wallet.test.mjs`
// (esbuild দিয়ে src/piTransfer.ts বান্ডল করে Node-এ চালায়; পেজ/স্টোর/নিয়মের
// গঠন সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) অ্যাডমিন পাঠানো — ফি ০%, প্রাপক পুরোটাই পায়
//   ২) ডক যাচাই — kind 'admin' + note পার্স হয়; ভুল kind বাদ যায়
//   ৩) খতিয়ান — "Sent by Admin" / "Received from Admin" লাইন
//   ৪) ভূমিকা — অ্যাডমিন পাঠালে ফি-ভূমিকা হয় না (ফি ০ বলে)
//   ৫) store — sendPiAsAdmin: শুধু অ্যাডমিন, ফি ০, kind admin, KYC যাচাই বাদ
//   ৬) পেজ — Admin Wallet ট্যাব: নিজের ব্যালেন্স, UID খোঁজা, note, কনফার্ম,
//      "no Pi is created" + ব্যালেন্সের বেশি পাঠানো যায় না
//   ৭) firestore.rules — kind 'admin' শুধু অ্যাডমিনই লিখতে পারেন
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-adminwallet-test-'))
await build({
  entryPoints: [join(root, 'src/piTransfer.ts')],
  bundle: true, format: 'esm', platform: 'node', outfile: join(outDir, 'piTransfer.js'), logLevel: 'silent',
})
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

const adminDoc = { id: 'tr9', fromUid: 'LXnGL8xA6VW8Gp7hvCaoakOha822', toUid: 'b'.repeat(28), adminUid: 'LXnGL8xA6VW8Gp7hvCaoakOha822', fromName: 'Susmita', toName: 'Rima', fromNumericUid: 100001, toNumericUid: 100002, amount: 5, fee: 0, net: 5, feePct: 0, kind: 'admin', note: 'Refund for order #1234', participants: ['LXnGL8xA6VW8Gp7hvCaoakOha822', 'b'.repeat(28)], status: 'completed', createdAtMs: 1700000000000 }

check('অ্যাডমিন পাঠানো — ফি ০%, প্রাপক পুরোটাই পায়', () => {
  const c = T.computeTransfer(5, 0)
  assert.equal(c.fee, 0)
  assert.equal(c.net, 5)
  assert.equal(c.fee + c.net, 5)
})

check("ডক যাচাই — kind 'admin' + note পার্স হয়; ভুল kind বাদ যায়", () => {
  const doc = T.mapPiTransferDoc('tr9', adminDoc)
  assert.ok(doc)
  assert.equal(doc.kind, 'admin')
  assert.equal(doc.note, 'Refund for order #1234')
  assert.equal(doc.fee, 0)
  assert.equal(doc.net, 5)
  const notAdmin = T.mapPiTransferDoc('tr9', { ...adminDoc, kind: 'user' })
  assert.equal(notAdmin?.kind, undefined)
  const longNote = T.mapPiTransferDoc('tr9', { ...adminDoc, note: 'x'.repeat(500) })
  assert.equal(longNote?.note?.length, 200)
})

check('খতিয়ান — "Sent by Admin" / "Received from Admin" লাইন', () => {
  const sent = T.buildTransferApplication(adminDoc, 'sent')
  assert.equal(sent.delta, -5)
  assert.equal(sent.row.type, 'Transfer Sent')
  assert.ok(sent.row.label.includes('Sent by Admin to Rima'))
  assert.ok(sent.row.label.includes('Refund for order #1234'))
  const recv = T.buildTransferApplication(adminDoc, 'received')
  assert.equal(recv.delta, 5)
  assert.equal(recv.row.type, 'Transfer Received')
  assert.ok(recv.row.label.includes('Received from Admin'))
  assert.ok(recv.row.label.includes('Refund for order #1234'))
})

check('ভূমিকা — অ্যাডমিন পাঠালে ফি-ভূমিকা হয় না (ফি ০ বলে)', () => {
  assert.deepEqual(T.transferRoles(adminDoc, adminDoc.fromUid), ['sent'])
  assert.deepEqual(T.transferRoles(adminDoc, adminDoc.toUid), ['received'])
})

check('store — sendPiAsAdmin: শুধু অ্যাডমিন, ফি ০, kind admin, KYC যাচাই বাদ', () => {
  assert.ok(storeSrc.includes('sendPiAsAdmin: async (to, amount, note)'), 'sendPiAsAdmin নেই')
  assert.ok(storeSrc.includes("if (user.email.trim().toLowerCase() !== ADMIN_EMAIL) return { ok: false, error: 'Only the admin can send Pi from the Admin Wallet.' }"), 'অ্যাডমিন-শুধু গেট নেই')
  assert.ok(storeSrc.includes('feePct: 0, kind:'), 'ফি ০ + kind admin পাঠানো হয় না')
  assert.ok(storeSrc.includes('skipKycCheck: true'), 'অ্যাডমিন পাঠানোয় KYC যাচাই বাদ যায় না')
  assert.ok(storeSrc.includes('Not enough Pi balance in the Admin Wallet'), 'ব্যালেন্সের বেশি পাঠানো আটকানো নেই')
  assert.ok(firestoreSrc.includes("kind?: 'admin'"), 'createPiTransfer-এ kind নেই')
  assert.ok(firestoreSrc.includes('skipKycCheck?: boolean'), 'createPiTransfer-এ skipKycCheck নেই')
  assert.ok(firestoreSrc.includes("if (!input.skipKycCheck && kycStatus !== 'approved')"), 'KYC যাচাই শর্তাধীন নয়')
})

check('পেজ — Admin Wallet ট্যাব: নিজের ব্যালেন্স, UID খোঁজা, note, কনফার্ম', () => {
  assert.ok(pagesSrc.includes("'wallet'"), 'wallet ট্যাব নেই')
  assert.ok(pagesSrc.includes('💰 Wallet'), 'Wallet ট্যাব বোতাম নেই')
  assert.ok(pagesSrc.includes("tab === 'wallet' && <Card>"), 'Admin Wallet সেকশন নেই')
  assert.ok(pagesSrc.includes('Your Pi Balance (fees + platform earnings accrue here)'), 'অ্যাডমিনের নিজের ব্যালেন্স দেখায় না')
  assert.ok(pagesSrc.includes('no Pi is created'), '"no Pi is created" লেখা নেই')
  assert.ok(pagesSrc.includes('Note / reason (optional)'), 'note ইনপুট নেই')
  assert.ok(pagesSrc.includes('full amount, no fee'), 'ফি নেই — পুরোটাই পায়, লেখা নেই')
  assert.ok(pagesSrc.includes('sendPiAsAdmin('), 'sendPiAsAdmin ডাকা হয় না')
  assert.ok(pagesSrc.includes('Not enough Pi balance in the Admin Wallet'), 'ব্যালেন্সের বেশি পাঠানোর বার্তা নেই')
  assert.ok(pagesSrc.includes('"Sent by Admin"'), 'Pi Report-এ Sent by Admin লেখা নেই')
})

check("firestore.rules — kind 'admin' শুধু অ্যাডমিনই লিখতে পারেন", () => {
  const body = rulesSrc.slice(rulesSrc.indexOf('match /piTransfers/{transferId}'))
  assert.ok(body.includes("request.resource.data.kind != 'admin' || isAdmin()"), 'kind গার্ড নেই')
  assert.ok(body.includes('request.resource.data.note.size() <= 200'), 'note দৈর্ঘ্য সীমা নেই')
})

console.log(`\n${passed} passed`)
