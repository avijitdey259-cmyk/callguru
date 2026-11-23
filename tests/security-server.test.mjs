// সার্ভার-সাইড সুরক্ষা — টোকেন যাচাই, রেট লিমিট, গোপন মানের লিক নেই।
// চালানো: রিপো রুট থেকে `node tests/security-server.test.mjs`
// ভাগ ১: server/auth.js-এর ইউনিট টেস্ট (স্টাব করা verifier দিয়ে)।
// ভাগ ২: আসল সার্ভার চালিয়ে (node server/index.js, টেস্ট পোর্টে)
//        HTTP + WebSocket ইন্টিগ্রেশন টেস্ট — ভুল/টোকেন-ছাড়া অনুরোধ
//        401 পায় কি না, সেটিংসে গোপন মান ফেরে কি না, রেট লিমিট ধরে কি না।
// "সম্পূর্ণ হ্যাক-প্রুফ" দাবি করা হয় না — এখানে যা যাচাই করা হয়েছে শুধু তাই।
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import WebSocket from 'ws'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { verifyIdToken, requireAuth, requireAdmin, rateLimit, getBearerToken, __setTokenVerifier } =
  await import('../server/auth.js')

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

const serverSrc = readFileSync(join(root, 'server/index.js'), 'utf8')
const rulesSrc = readFileSync(join(root, 'firestore.rules'), 'utf8')
const mappingSrc = readFileSync(join(root, 'src/firestoreMapping.ts'), 'utf8')
const firebaseJson = JSON.parse(readFileSync(join(root, 'firebase.json'), 'utf8'))
const appSrc = readFileSync(join(root, 'src/App.tsx'), 'utf8')

// ---------- ভাগ ১: auth.js ইউনিট টেস্ট ----------
__setTokenVerifier(async (token) => {
  if (token === 'valid-user-token') return { uid: 'u-123', email: 'user@example.com', name: 'টেস্ট ইউজার' }
  if (token === 'valid-admin-token') return { uid: 'u-admin', email: 'avijitdey259@gmail.com', name: 'অ্যাডমিন' }
  if (token === 'throws-token') throw new Error('boom')
  return null
})

function fakeRes() {
  const res = {
    statusCode: 200, body: null, headers: {},
    status(c) { this.statusCode = c; return this },
    json(b) { this.body = b; return this },
    setHeader(k, v) { this.headers[k] = v; return this },
  }
  return res
}
function fakeReq(token, ip = '1.2.3.4') {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    socket: { remoteAddress: ip },
  }
}

check('getBearerToken: Bearer হেডার থেকে টোকেন তোলে', () => {
  assert.equal(getBearerToken(fakeReq('abc')), 'abc')
  assert.equal(getBearerToken({ headers: {} }), null)
  assert.equal(getBearerToken({ headers: { authorization: 'Token abc' } }), null)
})

await checkAsync('verifyIdToken: বৈধ টোকেনে uid/email/name ফেরে', async () => {
  const a = await verifyIdToken('valid-user-token')
  assert.deepEqual(a, { uid: 'u-123', email: 'user@example.com', name: 'টেস্ট ইউজার' })
})
await checkAsync('verifyIdToken: ভুল টোকেনে null', async () => {
  assert.equal(await verifyIdToken('garbage'), null)
})
await checkAsync('verifyIdToken: টোকেন নয় এমন মান / খালি / অনেক লম্বা মান null', async () => {
  assert.equal(await verifyIdToken(''), null)
  assert.equal(await verifyIdToken(null), null)
  assert.equal(await verifyIdToken('x'.repeat(5000)), null)
})
await checkAsync('verifyIdToken: verifier throw করলেও null (সার্ভার ভাঙে না)', async () => {
  assert.equal(await verifyIdToken('throws-token'), null)
})

await checkAsync('requireAuth: টোকেন ছাড়া 401', async () => {
  const res = fakeRes()
  let nextCalled = false
  requireAuth(fakeReq(null), res, () => { nextCalled = true })
  assert.equal(res.statusCode, 401)
  assert.equal(res.body.error, 'unauthorized')
  assert.equal(nextCalled, false)
})
await checkAsync('requireAuth: বৈধ টোকেনে req.auth বসে + next() চলে', async () => {
  const req = fakeReq('valid-user-token')
  const res = fakeRes()
  let nextCalled = false
  await new Promise((resolve) => requireAuth(req, res, () => { nextCalled = true; resolve() }))
  assert.equal(nextCalled, true)
  assert.equal(req.auth.uid, 'u-123')
})
await checkAsync('requireAdmin: সাধারণ লগইন-থাকা ব্যবহারকারী 403', async () => {
  const res = fakeRes()
  let nextCalled = false
  await new Promise((resolve) => {
    requireAdmin(fakeReq('valid-user-token'), res, () => { nextCalled = true; resolve() })
    setTimeout(resolve, 500)
  })
  assert.equal(res.statusCode, 403)
  assert.equal(res.body.error, 'forbidden')
  assert.equal(nextCalled, false)
})
await checkAsync('requireAdmin: অ্যাডমিন ইমেইলের টোকেনে next() চলে', async () => {
  const req = fakeReq('valid-admin-token')
  const res = fakeRes()
  let nextCalled = false
  await new Promise((resolve) => requireAdmin(req, res, () => { nextCalled = true; resolve() }))
  assert.equal(nextCalled, true)
  assert.equal(req.auth.email, 'avijitdey259@gmail.com')
})

check('rateLimit: সীমার পরের অনুরোধে 429 + error rate_limited', () => {
  const mw = rateLimit({ windowMs: 60 * 1000, max: 2 })
  let nextCount = 0
  const next = () => { nextCount++ }
  for (let i = 0; i < 2; i++) {
    const res = fakeRes()
    mw(fakeReq(null, '9.9.9.9'), res, next)
    assert.equal(res.statusCode, 200)
  }
  const res = fakeRes()
  mw(fakeReq(null, '9.9.9.9'), res, next)
  assert.equal(res.statusCode, 429)
  assert.equal(res.body.error, 'rate_limited')
  assert.ok(res.headers['Retry-After'])
  assert.equal(nextCount, 2)
})
check('rateLimit: আলাদা IP-র সীমা আলাদা', () => {
  const mw = rateLimit({ windowMs: 60 * 1000, max: 1 })
  const res = fakeRes()
  let nextCalled = false
  mw(fakeReq(null, '5.5.5.5'), res, () => { nextCalled = true })
  assert.equal(nextCalled, true)
})

// ---------- সার্ভার কোডে সুরক্ষা-গেট বসানো আছে (স্ট্যাটিক যাচাই) ----------
check('server: /api/admin/settings POST-এ requireAdmin আছে', () => {
  assert.ok(serverSrc.includes("app.post('/api/admin/settings', adminIpLimit, requireAdmin"))
})
check('server: /api/live POST/DELETE-এ requireAuth আছে', () => {
  assert.ok(serverSrc.includes("app.post('/api/live', liveIpLimit, requireAuth"))
  assert.ok(serverSrc.includes("app.delete('/api/live/:id', liveIpLimit, requireAuth"))
})
check('server: /api/push/subscribe-এ requireAuth আছে', () => {
  assert.ok(serverSrc.includes("app.post('/api/push/subscribe', pushIpLimit, requireAuth"))
})
check('server: push subscribe-এ userId টোকেনের uid থেকে নেওয়া হয়', () => {
  assert.ok(serverSrc.includes('const userId = req.auth.uid'))
  assert.ok(!serverSrc.includes("body.userId"))
})
check('server: presence-register টোকেন যাচাই করে, uid টোকেন থেকে নেয়', () => {
  assert.ok(serverSrc.includes("await verifyIdToken(typeof m.idToken === 'string' ? m.idToken : '')"))
  assert.ok(serverSrc.includes('const userId = auth.uid'))
})
check('server: call-invite-এ fromId শুধু যাচাই করা presence থেকে', () => {
  assert.ok(serverSrc.includes('const fromId = ws._presence.userId'))
  assert.ok(!serverSrc.includes("String(m.fromId || '')"))
})
check('server: CORS allowlist — "*" দিয়ে সবাইকে খোলা নয়', () => {
  assert.ok(serverSrc.includes('ALLOWED_ORIGINS'))
  assert.ok(!serverSrc.includes("setHeader('Access-Control-Allow-Origin', '*')"))
})
check('server: সুরক্ষা হেডার (nosniff / SAMEORIGIN / Referrer) আছে', () => {
  assert.ok(serverSrc.includes("X-Content-Type-Options', 'nosniff"))
  assert.ok(serverSrc.includes("X-Frame-Options', 'SAMEORIGIN"))
  assert.ok(serverSrc.includes("Referrer-Policy"))
})
check('server: OTP কোড / টোকেন লগ হয় না (শুধু listen লাইন ছাড়া console নেই)', () => {
  const logs = serverSrc.split('\n').filter((l) => l.includes('console.'))
  assert.equal(logs.length, 1)
  assert.ok(logs[0].includes('listening on'))
})
check('server: OTP-তে IP রেট লিমিট আছে (ইমেইল-সীমার পাশাপাশি)', () => {
  assert.ok(serverSrc.includes('otpSendIpLimit'))
  assert.ok(serverSrc.includes('otpVerifyIpLimit'))
})
check('server: live রুমের মালিক টোকেনের uid (DELETE শুধু মালিক/অ্যাডমিন)', () => {
  assert.ok(serverSrc.includes('ownerUid: req.auth.uid'))
  assert.ok(serverSrc.includes("room.ownerUid !== req.auth.uid"))
})

// ---------- Firestore নিয়ম + ম্যাপিং ----------
check('firestore.rules: deny-all ডিফল্ট আছে', () => {
  assert.ok(rulesSrc.includes("match /{document=**}"))
  assert.ok(rulesSrc.includes('allow read, write: if false'))
})
check('firestore.rules: users ডক শুধু নিজের uid + অ্যাডমিন আপডেট', () => {
  assert.ok(rulesSrc.includes('match /users/{uid}'))
  assert.ok(rulesSrc.includes('request.auth.uid == uid'))
})
check('firestore.rules: publicProfiles-এ শুধু পড়া (লগইন থাকলে) + নিজের লেখা', () => {
  assert.ok(rulesSrc.includes('match /publicProfiles/{uid}'))
  assert.ok(rulesSrc.includes('allow delete: if false'))
})
check('firestoreMapping: পুরো NID / সেলফি / ভিডিও কখনো সিঙ্ক হয় না', () => {
  assert.ok(mappingSrc.includes("LOCAL_ONLY_KYC_FIELDS = ['idNumber', 'selfie', 'selfieVideo']"))
})

// ---------- Firebase Hosting হেডার + অ্যাপের গেট ----------
check('firebase.json: হোস্টিং হেডার (nosniff / SAMEORIGIN / HSTS) আছে', () => {
  const headers = firebaseJson.hosting.headers || []
  assert.ok(headers.length > 0)
  const all = JSON.stringify(headers)
  assert.ok(all.includes('X-Content-Type-Options'))
  assert.ok(all.includes('X-Frame-Options'))
  assert.ok(all.includes('Strict-Transport-Security'))
})
check('App.tsx: লগইন দেওয়াল (/login ছাড়া সব রুটে) আছে', () => {
  assert.ok(appSrc.includes("if (!user && loc.pathname !== '/login')"))
})
check('App.tsx: /admin শুধু isAdmin-এর জন্য', () => {
  assert.ok(appSrc.includes('<Route path="/admin" element={isAdmin ? <AdminPage /> : <AdminBlocked />} />'))
})

// ---------- ভাগ ২: লাইভ সার্ভার ইন্টিগ্রেশন টেস্ট ----------
const TEST_PORT = 4177
const BASE = `http://127.0.0.1:${TEST_PORT}`
const child = spawn('node', ['server/index.js'], {
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

try {
  const up = await waitForHealth()
  assert.ok(up, `টেস্ট সার্ভার চালু হয়নি: ${serverErr.slice(0, 500)}`)

  await checkAsync('live: GET /api/health 200 + nosniff হেডার', async () => {
    const r = await fetch(`${BASE}/api/health`)
    assert.equal(r.status, 200)
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(r.headers.get('x-frame-options'), 'SAMEORIGIN')
    const body = await r.json()
    assert.equal(body.ok, true)
  })

  await checkAsync('live: GET /api/admin/settings — শুধু boolean, কোনো গোপন মান নয়', async () => {
    const r = await fetch(`${BASE}/api/admin/settings`)
    assert.equal(r.status, 200)
    const body = await r.json()
    assert.deepEqual(Object.keys(body).sort(), ['smsConfigured', 'smtpConfigured'])
    assert.equal(typeof body.smtpConfigured, 'boolean')
    assert.equal(typeof body.smsConfigured, 'boolean')
    assert.ok(!JSON.stringify(body).toLowerCase().includes('pass'))
    assert.ok(!JSON.stringify(body).toLowerCase().includes('apikey'))
  })

  await checkAsync('live: POST /api/admin/settings টোকেন ছাড়া 401', async () => {
    const r = await fetch(`${BASE}/api/admin/settings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smtp: { host: 'smtp.evil.example', port: 587, user: 'a@evil.example', pass: 'x' } }),
    })
    assert.equal(r.status, 401)
  })

  await checkAsync('live: POST /api/admin/settings ভুল টোকেনে 401', async () => {
    const r = await fetch(`${BASE}/api/admin/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer this-is-not-a-real-token' },
      body: JSON.stringify({ smtp: { host: 'smtp.evil.example', port: 587, user: 'a@evil.example', pass: 'x' } }),
    })
    assert.equal(r.status, 401)
  })

  await checkAsync('live: POST /api/live টোকেন ছাড়া 401', async () => {
    const r = await fetch(`${BASE}/api/live`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostName: 'হ্যাকার', title: 'x' }),
    })
    assert.equal(r.status, 401)
  })

  await checkAsync('live: POST /api/push/subscribe টোকেন ছাড়া 401', async () => {
    const r = await fetch(`${BASE}/api/push/subscribe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'victim-uid', subscription: { endpoint: 'https://example.com/push' } }),
    })
    assert.equal(r.status, 401)
  })

  await checkAsync('live: OTP send — IP রেট লিমিট 30 পার হলে 429', async () => {
    let saw429 = false
    let saw503 = false
    for (let i = 0; i < 35; i++) {
      const r = await fetch(`${BASE}/api/otp/send`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ratelimit-test@example.com' }),
      })
      if (r.status === 429) saw429 = true
      if (r.status === 503) saw503 = true
    }
    assert.ok(saw503, 'SMTP না থাকায় 503 (not_configured) আসা উচিত')
    assert.ok(saw429, '৩০ পার হলে 429 (rate_limited) আসা উচিত')
  })

  await checkAsync('live: WS presence-register টোকেন ছাড়া presence-error unauthorized', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`)
    const got = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('presence-error আসেনি (টাইমআউট)')), 10000)
      ws.on('open', () => ws.send(JSON.stringify({ type: 'presence-register', userId: 'victim-uid', name: 'হ্যাকার' })))
      ws.on('message', (raw) => {
        const m = JSON.parse(String(raw))
        if (m.type === 'presence-error') { clearTimeout(timer); resolve(m) }
        if (m.type === 'presence-registered') { clearTimeout(timer); reject(new Error('টোকেন ছাড়াই presence-registered এলো!')) }
      })
      ws.on('error', (e) => { clearTimeout(timer); reject(e) })
    })
    assert.equal(got.error, 'unauthorized')
    ws.close()
  })

  await checkAsync('live: WS presence-register ভুল টোকেনেও presence-error', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}`)
    const got = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('presence-error আসেনি (টাইমআউট)')), 15000)
      ws.on('open', () => ws.send(JSON.stringify({ type: 'presence-register', idToken: 'not-a-real-token' })))
      ws.on('message', (raw) => {
        const m = JSON.parse(String(raw))
        if (m.type === 'presence-error') { clearTimeout(timer); resolve(m) }
        if (m.type === 'presence-registered') { clearTimeout(timer); reject(new Error('ভুল টোকেনে presence-registered এলো!')) }
      })
      ws.on('error', (e) => { clearTimeout(timer); reject(e) })
    })
    assert.equal(got.error, 'unauthorized')
    ws.close()
  })
} finally {
  child.kill('SIGTERM')
}

console.log(`\n${passed} checks passed — security-server`)
