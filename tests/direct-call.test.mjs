// ডিরেক্ট কল (Messenger-স্টাইল) + রুম-জয়েন টোকেন-যাচাই ফিক্স — ২০২৬-১১-২৫।
// চালানো: রিপো রুট থেকে `node tests/direct-call.test.mjs`
// যাচাই করে:
//   ১) সার্ভার auth ফিক্স — firebase-admin মডুলার API (admin.auth() আর নেই:
//      পুরোনো কোডে আসল টোকেনও null ফিরত, কল রুম-জয়েনে 'unauthorized' আসত)
//   ২) ডিরেক্ট বন্ধু-কল — /call/friend খুললেই কল শুরু, সামনের ক্যামেরা
//      ডিফল্ট, সেটআপ পর্দা শুধু ডেটিং/সার্ভিস/এক্সপার্টে থাকে
//   ৩) লাইভ সার্ভার — যাচাই-করা টোকেনে রুম-জয়েন হয় (আসল রিগ্রেশন),
//      ভুল টোকেনে 'unauthorized', অতিথি (টোকেন ছাড়া) জয়েন আগের মতো চলে
import { build } from 'esbuild'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import WebSocket from 'ws'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-dc-test-'))

async function loadModule(entry) {
  const outFile = join(outDir, entry.replace(/[^a-z]/gi, '') + '.mjs')
  await build({
    entryPoints: [join(root, 'src', entry)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: outFile,
    logLevel: 'silent',
    define: { 'import.meta.env.VITE_API_URL': '""' },
  })
  return import(outFile)
}

const CF = await loadModule('callFailure.ts')

let n = 0
function check(name, fn) {
  n += 1
  fn()
  console.log(`ok ${n} - ${name}`)
}
async function checkAsync(name, fn) {
  n += 1
  await fn()
  console.log(`ok ${n} - ${name}`)
}

const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const authSrc = readFileSync(join(root, 'server/auth.js'), 'utf8')
const serverSrc = readFileSync(join(root, 'server/index.js'), 'utf8')

// ---------- ভাগ ১: সার্ভার auth ফিক্স (সোর্স + রানটাইম) ----------
check('auth: মডুলার firebase-admin API — firebase-admin/app + firebase-admin/auth, getAuth(app)', () => {
  assert.ok(authSrc.includes("import('firebase-admin/app')"), 'firebase-admin/app ইমপোর্ট নেই')
  assert.ok(authSrc.includes("import('firebase-admin/auth')"), 'firebase-admin/auth ইমপোর্ট নেই')
  assert.ok(authSrc.includes('getAuth(app)'), 'getAuth(app) ডাকা হয় না')
  assert.ok(authSrc.includes('initializeApp({ projectId: FIREBASE_PROJECT_ID })'), 'projectId-শুধু init নেই')
})

check('auth: পুরোনো ভাঙা admin.auth() কোথাও নেই (এটাই আসল টোকেন ফিরিয়ে দিত)', () => {
  assert.ok(!authSrc.includes('admin.auth()'), 'admin.auth() এখনো আছে — 14.5.1-এ এটা ফাংশন নয়')
  assert.ok(!authSrc.includes("import('firebase-admin')"), 'পুরোনো ডিফল্ট ইমপোর্ট এখনো আছে')
  assert.ok(!serverSrc.includes('admin.auth()'), 'সার্ভারে admin.auth() এখনো আছে')
})

check('auth: কোনো service-account চাবি/ক্রেডেনশিয়াল কোডে নেই', () => {
  assert.ok(!authSrc.includes('serviceAccount'), 'service-account চাবির উল্লেখ আছে')
  assert.ok(!authSrc.includes('private_key'), 'private key-এর উল্লেখ আছে')
  assert.ok(!authSrc.includes('GOOGLE_APPLICATION_CREDENTIALS'), 'ক্রেডেনশিয়াল env-এর উল্লেখ আছে')
})

await checkAsync('auth রানটাইম: আসল SDK পথে ভুল টোকেন null (নেটওয়ার্ক ছাড়াই ফেরে), মক-ওভাররাইড এখনো চলে', async () => {
  const auth = await import(join(root, 'server/auth.js'))
  // মক ছাড়া: ভুল টোকেন — আসল SDK পথ (ইমপোর্ট + getAuth) চলে, null ফেরে
  assert.equal(await auth.verifyIdToken('garbage'), null)
  assert.equal(await auth.verifyIdToken(''), null)
  assert.equal(await auth.verifyIdToken('eyJhbGciOiJSUzI1NiJ9.invalid.invalid'), null)
  // মক-ওভাররাইড (অন্যান্য টেস্টের পথ): বৈধ টোকেনে uid ফেরে
  auth.__setTokenVerifier(async (t) => {
    if (t === 'tok-alice') return { uid: 'alice-uid', email: 'alice@example.com', name: 'Alice' }
    return null
  })
  const a = await auth.verifyIdToken('tok-alice')
  assert.equal(a?.uid, 'alice-uid')
  assert.equal(a?.email, 'alice@example.com')
  assert.equal(await auth.verifyIdToken('tok-nobody'), null)
  auth.__setTokenVerifier(null)
})

// ---------- ভাগ ২: ডিরেক্ট বন্ধু-কল UX (স্ট্যাটিক) ----------
check('friend কল বোতাম ৪টিই /call/friend/ -এ যায় (চ্যাট + Friends) — রুট বদলায়নি', () => {
  const hits = pagesSrc.match(/navigate\(`\/call\/friend\/\$\{encodeURIComponent\(/g) || []
  assert.equal(hits.length, 4, `৪টি বোতাম থাকার কথা, পাওয়া গেল ${hits.length}`)
})

check('CallPage: বন্ধুর কলে auto-start — /call/friend খুললেই startCall(), একবারই (ref গার্ড)', () => {
  assert.ok(pagesSrc.includes('autoStartRef'), 'autoStartRef নেই')
  assert.ok(pagesSrc.includes("if (type !== 'friend' || isLinkCall"), 'শুধু friend-এ auto-start-এর গার্ড নেই')
  assert.ok(pagesSrc.includes('void startCall()'), 'auto-start startCall() ডাকে না')
})

check('CallPage: বন্ধুর সেটআপ পর্দা নেই — friend শাখা সেটআপ পর্দার আগেই, শুধু Calling…/ছোট বার্তা', () => {
  const friendBranch = pagesSrc.indexOf("if (type === 'friend') {")
  const cameraChooser = pagesSrc.indexOf('Which camera will you start with?')
  assert.ok(friendBranch > 0 && cameraChooser > 0, 'শাখা বা ক্যামেরা-বাছাই খুঁজে পাওয়া যায়নি')
  assert.ok(friendBranch < cameraChooser, 'friend শাখা সেটআপ পর্দার পরে — বন্ধুর কলেও সেটআপ দেখাবে')
  assert.ok(pagesSrc.includes('Calling…'), 'Calling… লেখা নেই')
  assert.ok(pagesSrc.includes('❌ Cancel'), 'Cancel বোতাম নেই')
})

check('CallPage: সেটআপ পর্দা ডেটিং/সার্ভিস/এক্সপার্টে আগের মতোই আছে (দর/ব্যালেন্স/ক্যামেরা-বাছাই/Start)', () => {
  assert.ok(pagesSrc.includes('Which camera will you start with?'), 'ক্যামেরা-বাছাই উঠে গেছে')
  assert.ok(pagesSrc.includes('▶️ Start Call'), 'Start Call বোতাম উঠে গেছে')
  assert.ok(pagesSrc.includes('You can talk:'), 'You can talk লেখা উঠে গেছে')
  assert.ok(pagesSrc.includes('You cannot call without a Pi balance'), 'no-credit বার্তা উঠে গেছে')
})

check('CallPage: সামনের ক্যামেরা ডিফল্ট (facing user) — ডিরেক্ট কল ফ্রন্ট ক্যামেরায় শুরু হয়', () => {
  assert.ok(pagesSrc.includes("useState<'user' | 'environment'>('user')"), 'facing ডিফল্ট user নয়')
})

check('CallPage: বন্ধুর কলেও ইনভাইট + no-answer টাইমার আগের মতো (Accept/Decline ওভারলে থাকে)', () => {
  assert.ok(pagesSrc.includes("kind: type === 'service' ? 'service' : isDating ? 'dating' : 'friend'"), 'friend ইনভাইট kind নেই')
  assert.ok(pagesSrc.includes('createCallInvite(payload)'), 'ইনভাইট লেখা হয় না')
  assert.ok(pagesSrc.includes('armNoAnswerTimer()'), 'no-answer টাইমার নেই')
})

check('CallPage: স্ক্রিন শেয়ার + প্রিপেইড অটো-কাট আগের মতো আছে', () => {
  assert.ok(pagesSrc.includes('toggleShare'), 'স্ক্রিন শেয়ার টগল নেই')
  assert.ok(pagesSrc.includes('getDisplayMedia'), 'getDisplayMedia নেই')
  assert.ok(pagesSrc.includes("hangUp('Auto-cut — out of balance')"), 'অটো-কাট নেই')
})

check('callFailure: unauthorized আলাদা কারণ — জেনেরিক server বার্তা নয়', () => {
  assert.equal(CF.callErrorToFailureReason('unauthorized'), 'unauthorized')
  assert.equal(CF.callFailureMessage('unauthorized', 'রিমা'), 'Sign-in check failed — please sign out and sign in again.')
  assert.notEqual(CF.callFailureMessage('unauthorized', 'রিমা'), CF.callFailureMessage('server', 'রিমা'))
})

// ---------- ভাগ ৩: লাইভ সার্ভার ইন্টিগ্রেশন (স্টাব করা টোকেন-যাচাই) ----------
const TEST_PORT = 4180
const BASE = `http://127.0.0.1:${TEST_PORT}`
const WS_BASE = `ws://127.0.0.1:${TEST_PORT}`
const wrapper = join(outDir, 'server-wrapper.mjs')
writeFileSync(wrapper, `
import { __setTokenVerifier } from '${join(root, 'server', 'auth.js')}'
__setTokenVerifier(async (t) => {
  if (t === 'tok-alice') return { uid: 'alice-uid', email: 'alice@example.com', name: 'Alice' }
  if (t === 'tok-bob') return { uid: 'bob-uid', email: 'bob@example.com', name: 'Bob' }
  return null
})
await import('${join(root, 'server', 'index.js')}')
`)
const child = spawn('node', [wrapper], {
  cwd: root,
  env: { ...process.env, PORT: String(TEST_PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverErr = ''
child.stderr.on('data', (d) => { serverErr += String(d) })

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/api/health`)
      if (r.ok) return true
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}

function wsClient() {
  const ws = new WebSocket(WS_BASE)
  const seen = []
  const waiters = []
  ws.on('message', (raw) => {
    let m
    try { m = JSON.parse(String(raw)) } catch { return }
    seen.push(m)
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].pred(m)) { waiters[i].resolve(m); waiters.splice(i, 1) }
    }
  })
  return {
    ws,
    seen,
    send: (o) => ws.send(JSON.stringify(o)),
    waitFor: (pred, timeoutMs = 10000) => new Promise((resolve, reject) => {
      const found = seen.find(pred)
      if (found) return resolve(found)
      const timer = setTimeout(() => reject(new Error(`মেসেজ আসেনি (টাইমআউট ${timeoutMs}ms): ${JSON.stringify(seen.slice(-3))}`)), timeoutMs)
      waiters.push({ pred, resolve: (m) => { clearTimeout(timer); resolve(m) } })
    }),
    waitOpen: () => new Promise((resolve, reject) => {
      if (ws.readyState === 1) return resolve()
      ws.on('open', resolve)
      ws.on('error', reject)
      setTimeout(() => reject(new Error('WS খুলল না')), 10000)
    }),
    close: () => { try { ws.close() } catch { /* ignore */ } },
  }
}

let failed = null
try {
  const up = await waitForHealth()
  assert.ok(up, `টেস্ট সার্ভার চালু হয়নি: ${serverErr.slice(0, 500)}`)

  await checkAsync('live: GET /api/health — version 6.4.0', async () => {
    const r = await fetch(`${BASE}/api/health`)
    assert.equal(r.status, 200)
    const body = await r.json()
    assert.equal(body.version, '6.4.0')
  })

  await checkAsync('live: যাচাই-করা টোকেনে call-join → call-joined (আসল রিগ্রেশন: আসল টোকেনে আগে unauthorized আসত)', async () => {
    const alice = wsClient()
    await alice.waitOpen()
    alice.send({ type: 'call-join', roomId: 'call-dc001', role: 'caller', name: 'Alice', idToken: 'tok-alice' })
    const joined = await alice.waitFor((x) => x.type === 'call-joined')
    assert.equal(joined.roomId, 'call-dc001')
    assert.ok(joined.peerId)
    alice.close()
  })

  await checkAsync('live: ভুল টোকেনে call-join → call-error unauthorized (ফেরানো এখনো চলে)', async () => {
    const bad = wsClient()
    await bad.waitOpen()
    bad.send({ type: 'call-join', roomId: 'call-dc002', role: 'caller', name: 'Bad', idToken: 'tok-nobody' })
    const err = await bad.waitFor((x) => x.type === 'call-error')
    assert.equal(err.error, 'unauthorized')
    bad.close()
  })

  await checkAsync('live: টোকেন ছাড়া অতিথি call-join → call-joined (আগের মতো)', async () => {
    const guest = wsClient()
    await guest.waitOpen()
    guest.send({ type: 'call-join', roomId: 'call-dc003', role: 'caller', name: 'Guest' })
    const joined = await guest.waitFor((x) => x.type === 'call-joined')
    assert.equal(joined.roomId, 'call-dc003')
    guest.close()
  })

  await checkAsync('live: যাচাই-করা টোকেনের callee রুমে ঢুকলে caller peer-joined পায়', async () => {
    const caller = wsClient()
    const callee = wsClient()
    await caller.waitOpen()
    await callee.waitOpen()
    caller.send({ type: 'call-join', roomId: 'call-dc004', role: 'caller', name: 'Alice', idToken: 'tok-alice' })
    await caller.waitFor((x) => x.type === 'call-joined')
    callee.send({ type: 'call-join', roomId: 'call-dc004', role: 'callee', name: 'Bob', idToken: 'tok-bob' })
    await callee.waitFor((x) => x.type === 'call-joined')
    const peer = await caller.waitFor((x) => x.type === 'peer-joined')
    assert.equal(peer.name, 'Bob')
    caller.close()
    callee.close()
  })
} catch (e) {
  failed = e
} finally {
  try { child.kill() } catch { /* ignore */ }
}

if (failed) {
  console.error(`FAIL - ${failed.message}`)
  process.exit(1)
}
console.log(`\n${n} checks passed`)
