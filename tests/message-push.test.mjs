// মেসেজ নোটিফিকেশন — মেসেঞ্জারের মতো: মেসেজ এলে নাম + ঝলকসহ পুশ, ট্যাপে চ্যাট।
// চালানো: রিপো রুট থেকে `node tests/message-push.test.mjs`
// ভাগ ১: পেজ/সার্ভার/SW-এর গঠন সোর্স পড়ে যাচাই (ক্লায়েন্ট ট্রিগার, পেলোড,
//       SW রাউট, ব্লক-নিয়ম)।
// ভাগ ২: আসল সার্ভার ইন-প্রসেস চালিয়ে (stub করা verifier) /api/message/push
//       HTTP টেস্ট — টোকেন ছাড়া 401, ভুল পেলোড 400, নিজেকে পুশ 400,
//       সাবস্ক্রিপশন না থাকলে {ok:true, pushed:false}।
// যাচাই করে:
//   ১) মেসেজ পাঠালেই (Firestore-এ লেখা সফল হলে) প্রাপককে পুশ ট্রিগার হয়
//   ২) নিজেকে পুশ যায় না; ব্লক করা প্রাপককে মেসেজই যায় না (তাই পুশও নয়)
//   ৩) নোটিফিকেশনে প্রেরকের নাম + মেসেজের ঝলক থাকে; ট্যাপে সঠিক চ্যাট খোলে
//   ৪) সাবস্ক্রিপশন না থাকলে (OTP) নীরবে হারায় না — মেসেজ তবু পৌঁছে থাকে
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const apiSrc = readFileSync(join(root, 'src/api.ts'), 'utf8')
const serverSrc = readFileSync(join(root, 'server/index.js'), 'utf8')
const swSrc = readFileSync(join(root, 'public/sw.js'), 'utf8')

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

console.log('— ওয়্যারিং (সোর্স-গঠন) —')
check('মেসেজ Firestore-এ লেখা সফল হলেই পুশ ট্রিগার হয় (ব্যর্থ হলে নয়)', () => {
  assert.ok(pagesSrc.includes('sendChatMessage(roomId, uid, user?.name'))
  assert.ok(pagesSrc.includes('triggerMessagePush({ toUid, fromName: user?.name'))
  // sendFailed শাখায় পুশ নেই — শুধু else (সফল) শাখায়
  const sendFn = pagesSrc.slice(pagesSrc.indexOf('function send()'), pagesSrc.indexOf('const contacts = friends'))
  assert.ok(sendFn.includes('triggerMessagePush'))
  assert.ok(sendFn.indexOf('setSendFailed(false)') < sendFn.indexOf('triggerMessagePush'))
})
check('পুশে প্রাপকের UID (রুমের অন্য সদস্য), প্রেরকের নাম, ঝলক যায়', () => {
  assert.ok(pagesSrc.includes('const toUid = otherRoomMember(roomId, uid)'))
  assert.ok(pagesSrc.includes("preview: text.slice(0, 100)"))
  assert.ok(apiSrc.includes("fetch(`${API_BASE}/api/message/push`"))
})
check('ব্লক করা প্রাপককে মেসেজই যায় না — তাই পুশও যায় না', () => {
  const sendFn = pagesSrc.slice(pagesSrc.indexOf('function send()'), pagesSrc.indexOf('const contacts = friends'))
  assert.ok(sendFn.includes('if (iBlockedThem || blockedByThem) return'))
  assert.ok(sendFn.indexOf('if (iBlockedThem || blockedByThem) return') < sendFn.indexOf('triggerMessagePush'))
})
check('সার্ভার: /api/message/push আছে — নাম + ঝলক + চ্যাট-লিংকসহ পেলোড', () => {
  assert.ok(serverSrc.includes("app.post('/api/message/push'"))
  assert.ok(serverSrc.includes('async function sendMessagePush(userId, msg)'))
  assert.ok(serverSrc.includes("title: msg.fromName"))
  assert.ok(serverSrc.includes('body: msg.preview'))
  assert.ok(serverSrc.includes("tag: `picall-message-${msg.roomId}`"))
  assert.ok(serverSrc.includes("url: `/chat?with=${encodeURIComponent(msg.fromName)}&peer=${encodeURIComponent(msg.fromId)}`"))
})
check('সার্ভার: নিজেকে পুশ যায় না (toUid == প্রেরক হলে 400)', () => {
  assert.ok(serverSrc.includes("toUid === req.auth.uid"))
})
check('সার্ভিস ওয়ার্কার: মেসেজ পুশ একই জেনেরিক পথে দেখায়, ট্যাপে চ্যাট খোলে', () => {
  assert.ok(swSrc.includes("kind: 'message'"))
  assert.ok(swSrc.includes("data.url.startsWith('/')"))
})
check('চ্যাট পেজ: ?with=<নাম>&peer=<uid> URL দিয়ে সরাসরি থ্রেড খোলে', () => {
  assert.ok(pagesSrc.includes("params.get('with')"))
  assert.ok(pagesSrc.includes("params.get('peer')"))
  assert.ok(pagesSrc.includes('st?.peerId ?? st?.datingPartnerId ?? params.get'))
})

console.log('— লাইভ সার্ভার (/api/message/push) —')
const TEST_PORT = 4182
const BASE = `http://127.0.0.1:${TEST_PORT}`
process.env.PORT = String(TEST_PORT)
const { __setTokenVerifier } = await import('../server/auth.js')
__setTokenVerifier(async (token) => {
  if (token === 'valid-sender-token') return { uid: 'u-sender', email: 'sender@example.com', name: 'Sender' }
  return null
})
await import('../server/index.js')
async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/api/health`)
      if (r.ok) return
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error('server did not start')
}
await waitForHealth()
async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const r = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  let data = null
  try { data = await r.json() } catch { /* ignore */ }
  return { status: r.status, data }
}
const GOOD = { toUid: 'u-recipient', fromName: 'Sender', preview: 'Hi, how are you?', roomId: 'u-recipient_u-sender' }
await checkAsync('টোকেন ছাড়া মেসেজ-পুশ 401 পায়', async () => {
  const r = await post('/api/message/push', GOOD)
  assert.equal(r.status, 401)
})
await checkAsync('ভুল পেলোড (ঝলক নেই / রুম নেই) 400 পায়', async () => {
  const r1 = await post('/api/message/push', { ...GOOD, preview: '   ' }, 'valid-sender-token')
  assert.equal(r1.status, 400)
  const r2 = await post('/api/message/push', { ...GOOD, roomId: '' }, 'valid-sender-token')
  assert.equal(r2.status, 400)
})
await checkAsync('নিজেকে পুশ 400 পায়', async () => {
  const r = await post('/api/message/push', { ...GOOD, toUid: 'u-sender' }, 'valid-sender-token')
  assert.equal(r.status, 400)
})
await checkAsync('সাবস্ক্রিপশন না থাকলে {ok:true, pushed:false} — মেসেজ তবু পৌঁছে থাকে', async () => {
  const r = await post('/api/message/push', GOOD, 'valid-sender-token')
  assert.equal(r.status, 200)
  assert.deepEqual(r.data, { ok: true, pushed: false })
})

console.log(`\n${passed} passed`)
process.exit(0)
