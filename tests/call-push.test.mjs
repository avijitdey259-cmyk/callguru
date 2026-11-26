// ইনকামিং কল পুশ — অ্যাপ বন্ধ থাকলেও কলটা পৌঁছাতে হবে (ট্যাপে সরাসরি কলে)।
// চালানো: রিপো রুট থেকে `node tests/call-push.test.mjs`
// ভাগ ১: src/pushNotify.ts pure লজিক (esbuild বান্ডল) + পেজ/স্টোর/সার্ভার/
//       SW-এর গঠন সোর্স পড়ে যাচাই।
// ভাগ ২: আসল সার্ভার ইন-প্রসেস চালিয়ে (stub করা verifier) /api/call-invite/push
//       HTTP টেস্ট — টোকেন ছাড়া 401, ভুল পেলোড 400, সাবস্ক্রিপশন না থাকলে
//       {ok:true, pushed:false} (নীরবে হারিয়ে যায় না — কলকারী জানতে পারে)।
// যাচাই করে:
//   ১) লগইন/অ্যাপ-খোলায় সাবস্ক্রিপশন (আবার) জমা হয় — সার্ভার রিস্টার্টের
//      পরের মুছে যাওয়া সাবস্ক্রিপশন এভাবেই ফেরে
//   ২) প্রতিটা ইনভাইটে পুশ ট্রিগার হয়
//   ৩) Answer/ট্যাপ → সরাসরি /call/<code>-এ (ফিডে নয়); Decline → কাটা যায়
//   ৪) সাবস্ক্রিপশন না থাকলে (OTP/নোটিফিকেশন বন্ধ) কলকারী সৎ ইঙ্গিত দেখেন —
//      ইনভাইট তবু থাকে, অ্যাপ খুললেই কল আসে
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-callpush-test-'))
const outFile = join(outDir, 'pushNotify.mjs')
await build({
  entryPoints: [join(root, 'src/pushNotify.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
  define: { 'import.meta.env.VITE_API_URL': '""' },
})
const P = await import(outFile)

const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
const serverSrc = readFileSync(join(root, 'server/index.js'), 'utf8')
const swSrc = readFileSync(join(root, 'public/sw.js'), 'utf8')
const apiSrc = readFileSync(join(root, 'src/api.ts'), 'utf8')

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

console.log('— পুশ পেলোড (pure) —')
check('ইনকামিং কল পুশ: নাম + ট্যাপে /call/<code> + Answer/Decline অ্যাকশন', () => {
  const p = P.buildIncomingCallPush({ code: 'ndra94', fromId: 'u-1', fromName: 'Susmita', at: Date.now() })
  assert.ok(p.title.includes('Susmita'))
  assert.equal(p.data.url, '/call/ndra94')
  assert.equal(p.data.code, 'ndra94')
  assert.equal(p.tag, 'picall-call-ndra94')
  assert.deepEqual(p.actions.map(a => a.action), ['answer', 'decline'])
})
check('নোটিফিকেশন ট্যাপ: Answer/ট্যাপ → কল খোলে, Decline → শুধু বন্ধ', () => {
  assert.deepEqual(P.notificationClickTarget('answer', { url: '/call/ndra94' }), { kind: 'open', url: '/call/ndra94' })
  assert.deepEqual(P.notificationClickTarget(undefined, { url: '/call/ndra94' }), { kind: 'open', url: '/call/ndra94' })
  assert.deepEqual(P.notificationClickTarget('decline', { url: '/call/ndra94' }), { kind: 'close' })
  // ভুল URL হলে ফিডে — কখনো ভাঙা লিংকে নয়
  assert.deepEqual(P.notificationClickTarget(undefined, { url: 'https://evil.example/x' }), { kind: 'open', url: '/feed' })
  assert.deepEqual(P.notificationClickTarget(undefined, null), { kind: 'open', url: '/feed' })
})
check('node-এ (window নেই) পুশ unsupported — ক্র্যাশ নয়', async () => {
  assert.deepEqual(P.getPushStatus(), { status: 'unsupported', subscribed: false })
  assert.deepEqual(await P.ensureCallPushOnOpen('u-1'), { ok: false, reason: 'unsupported' })
})

console.log('— ওয়্যারিং (সোর্স-গঠন) —')
check('লগইন-সিঙ্কে পুশ সাবস্ক্রিপশন নিশ্চিত করা হয় (অ্যাপ খুললেই আবার জমা)', () => {
  assert.ok(storeSrc.includes('ensureCallPushOnOpen(uid)'))
  assert.ok(storeSrc.includes("import { ensureCallPushOnOpen } from './pushNotify'"))
})
check('ensureCallPushOnOpen: অনুমতি না চেয়ে শুধু আগে-দেওয়া অনুমতিতে জমা দেয়', () => {
  const src = readFileSync(join(root, 'src/pushNotify.ts'), 'utf8')
  assert.ok(src.includes("if (Notification.permission !== 'granted') return { ok: false, reason: 'not-granted' }"))
  assert.ok(!src.includes('requestPermission', src.indexOf('ensureCallPushOnOpen')))
  assert.ok(src.includes('reg.pushManager.getSubscription()'))
  assert.ok(src.includes("fetch(`${API_BASE}/api/push/subscribe`"))
})
check('প্রতিটা ইনভাইটে পুশ ট্রিগার হয় (কলকারী)', () => {
  assert.ok(pagesSrc.includes('triggerCallInvitePush({ toUid: inviteTarget, inviteId, code'))
  assert.ok(apiSrc.includes("fetch(`${API_BASE}/api/call-invite/push`"))
})
check('পুশ না গেলে কলকারী অপেক্ষার পর্দায় সৎ ইঙ্গিত দেখেন', () => {
  assert.ok(pagesSrc.includes('setPushDelivered(r.pushed)'))
  assert.ok(pagesSrc.includes("Couldn't reach them by notification"))
  assert.ok(pagesSrc.includes('pushDelivered === false'))
})
check('অনুমতি না থাকলে ফিডে এক ট্যাপের ব্যানার দেখায় (নিজে থেকে প্রম্পট নয়)', () => {
  assert.ok(pagesSrc.includes('<PushEnableBanner />'))
  assert.ok(pagesSrc.includes('Never miss a call — turn on call notifications'))
  assert.ok(pagesSrc.includes("localStorage.getItem('callguru:pushBannerDismissed')"))
})
check('সার্ভিস ওয়ার্কার: Answer/ট্যাপ → /call/<code> খোলে (ফিডে নয়)', () => {
  assert.ok(swSrc.includes("client.navigate(url)") || swSrc.includes('openWindow(url)'))
  assert.ok(swSrc.includes("data.url.startsWith('/')"))
})
check('সার্ভিস ওয়ার্কার: Decline → সার্ভারে কাটা জানায় (কলকারী declined দেখেন)', () => {
  assert.ok(swSrc.includes("event.action === 'decline'"))
  assert.ok(swSrc.includes('/api/call-invite/decline'))
  assert.ok(serverSrc.includes("app.post('/api/call-invite/decline'"))
})
check('সার্ভার: /api/call-invite/push আছে; সাবস্ক্রিপশন না থাকলে pushed:false', () => {
  assert.ok(serverSrc.includes("app.post('/api/call-invite/push'"))
  assert.ok(serverSrc.includes('const pushed = await sendCallPush(toUid'))
})
check('সার্ভার: সাবস্ক্রিপশন ইন-মেমোরি (রিস্টার্টে মুছে যায়) — ক্লায়েন্ট আবার জমা দেয়', () => {
  assert.ok(serverSrc.includes('pushSubscriptions = new Map()'))
  assert.ok(serverSrc.includes('রিস্টার্টে মুছে যায়'))
})

console.log('— লাইভ সার্ভার (/api/call-invite/push) —')
const TEST_PORT = 4181
const BASE = `http://127.0.0.1:${TEST_PORT}`
process.env.PORT = String(TEST_PORT)
const { __setTokenVerifier } = await import('../server/auth.js')
__setTokenVerifier(async (token) => {
  if (token === 'valid-caller-token') return { uid: 'u-caller', email: 'caller@example.com', name: 'Caller' }
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
await checkAsync('টোকেন ছাড়া পুশ ট্রিগার 401 পায়', async () => {
  const r = await post('/api/call-invite/push', { toUid: 'u-callee', inviteId: 'inv-1', code: 'ndra94', fromName: 'Caller' })
  assert.equal(r.status, 401)
})
await checkAsync('ভুল পেলোড (কোড/নাম নেই) 400 পায়', async () => {
  const r = await post('/api/call-invite/push', { toUid: 'u-callee', inviteId: 'inv-1', code: 'BAD!', fromName: 'Caller' }, 'valid-caller-token')
  assert.equal(r.status, 400)
})
await checkAsync('সাবস্ক্রিপশন না থাকলে {ok:true, pushed:false} — নীরবে হারায় না', async () => {
  const r = await post('/api/call-invite/push', { toUid: 'u-callee', inviteId: 'inv-1', code: 'ndra94', fromName: 'Caller' }, 'valid-caller-token')
  assert.equal(r.status, 200)
  assert.deepEqual(r.data, { ok: true, pushed: false })
})

console.log(`\n${passed} passed`)
process.exit(0)
