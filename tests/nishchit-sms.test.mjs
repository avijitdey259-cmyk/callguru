// Nishchit SMS OTP — server adapter (send + verify) with a local mock for the
// Nishchit API. No real key anywhere here: the test server runs with a fake
// key (dashes in it, so it can never match a real nk_test_/nk_live_ key).
// Run: node tests/nishchit-sms.test.mjs
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')

const FAKE_KEY = 'nk_test_FAKE-KEY-FOR-TESTS-ONLY-0000'
const REAL_KEY_RE = /nk_(test|live)_[A-Za-z0-9]{20,}/

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

const serverSrc = read('server/index.js')
const apiSrc = read('src/api.ts')
const pagesSrc = read('src/pages.tsx')
const storeSrc = read('src/store.tsx')

// ---------- ভাগ ১: সোর্স যাচাই (কোনো আসল চাবি নেই, অ্যাডাপ্টার আছে) ----------
check('server: Nishchit adapter present (env key, base URL, E.164 normaliser)', () => {
  assert.ok(serverSrc.includes('NISHCHIT_API_KEY'), 'env key পড়া হয় না')
  assert.ok(serverSrc.includes('api.nishchit.tech'), 'API base নেই')
  assert.ok(serverSrc.includes('getNishchitApiKey'), 'key resolver নেই')
  assert.ok(serverSrc.includes('normalizeBdPhoneE164'), 'E.164 normaliser নেই')
  assert.ok(serverSrc.includes('/v1/messages'), 'messages endpoint নেই')
  assert.ok(serverSrc.includes('Idempotency-Key'), 'idempotency header নেই')
  assert.ok(serverSrc.includes("channel === 'sms'"), 'SMS channel branch নেই')
})
check('server: no real-looking Nishchit key in code', () => {
  for (const f of ['server/index.js', 'src/api.ts', 'src/pages.tsx', 'src/store.tsx']) {
    assert.ok(!REAL_KEY_RE.test(read(f)), `${f}-এ আসল চাবির মতো মান আছে`)
  }
})
check('server: GET /api/admin/settings returns booleans only', () => {
  const get = serverSrc.slice(serverSrc.indexOf("app.get('/api/admin/settings'"), serverSrc.indexOf("app.post('/api/admin/settings'"))
  assert.ok(get.includes('smsConfigured'), 'smsConfigured নেই')
  assert.ok(!get.includes('apiKey'), 'GET-এ চাবি ফেরার কথা নয়')
})
check('client: saveAdminSms posts the SMS key to the server (masked input in admin)', () => {
  assert.ok(apiSrc.includes('export async function saveAdminSms'), 'saveAdminSms নেই')
  assert.ok(apiSrc.includes("JSON.stringify({ sms })"), 'sms payload নেই')
  assert.ok(pagesSrc.includes('saveAdminSms(cleaned)'), 'Admin save-এ server call নেই')
  assert.ok(pagesSrc.includes('<option value="Nishchit">Nishchit</option>'), 'Nishchit provider option নেই')
  assert.ok(storeSrc.includes("provider: 'Nishchit'"), 'store default provider Nishchit নয়')
  assert.ok(!pagesSrc.includes('BulkSMSBD'), 'পুরনো provider থাকার কথা নয়')
})
check('client: login SMS error paths for bad key / no credit', () => {
  assert.ok(pagesSrc.includes("r.error === 'sms_key_invalid'"), 'sms_key_invalid branch নেই')
  assert.ok(pagesSrc.includes("r.error === 'sms_no_credit'"), 'sms_no_credit branch নেই')
})

// ---------- ভাগ ২: আসল সার্ভার + নিশ্চিতের mock ----------
// Mock: নিশ্চিতের ডকুমেন্ট করা 201 উত্তর দেয়; 019... নম্বরে 401 দেয়
// (চাবি ভুল হলে সার্ভারের আচরণ যাচাইয়ের জন্য)।
const mockHits = []
const mock = createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => { raw += c })
  req.on('end', () => {
    const body = JSON.parse(raw || '{}')
    mockHits.push({ method: req.method, path: req.url, auth: req.headers.authorization || '', idem: req.headers['idempotency-key'] || '', body })
    if (body.to === '+8801912345678') {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { code: 'authentication_failed', message: 'bad key', request_id: 'req_mock_401' } }))
      return
    }
    res.writeHead(201, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      id: 'msg_mock_01', object: 'message', environment: 'test', status: 'accepted',
      delivery_status: 'unknown', to: body.to, from: 'Nishchit Shared', body: body.body,
      segments: 1, encoding: 'gsm7', characters: String(body.body || '').length, credits: 1,
      classification: 'otp', reference: body.reference || null, error: null,
      campaign_id: null, created_at: new Date().toISOString(),
      sent_at: null, delivered_at: null, failed_at: null,
    }))
  })
})
await new Promise((r) => mock.listen(0, '127.0.0.1', r))
const MOCK_PORT = mock.address().port
const MOCK_BASE = `http://127.0.0.1:${MOCK_PORT}`

const SERVER_PORT = 4185
const BASE = `http://127.0.0.1:${SERVER_PORT}`
const children = []
async function startServer(extraEnv) {
  const child = spawn('node', ['server/index.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(extraEnv.port), NISHCHIT_API_BASE: MOCK_BASE, ...(extraEnv.key ? { NISHCHIT_API_KEY: extraEnv.key } : {}) },
    stdio: 'ignore',
  })
  children.push(child)
  const base = `http://127.0.0.1:${extraEnv.port}`
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${base}/api/health`)
      if (r.ok) return base
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`server did not come up on ${extraEnv.port}`)
}
async function post(base, path, body) {
  const r = await fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  return { status: r.status, body: await r.json().catch(() => null) }
}

let base = ''
try {
  base = await startServer({ port: SERVER_PORT, key: FAKE_KEY })

  await checkAsync('SMS send: valid number → ok:true, mock got one correct request', async () => {
    const before = mockHits.length
    const r = await post(base, '/api/otp/send', { channel: 'sms', phone: '01712345678' })
    assert.equal(r.status, 200)
    assert.deepEqual(r.body, { ok: true })
    assert.equal(mockHits.length, before + 1)
    const hit = mockHits[mockHits.length - 1]
    assert.equal(hit.method, 'POST')
    assert.equal(hit.path, '/v1/messages')
    assert.equal(hit.auth, `Bearer ${FAKE_KEY}`)
    assert.equal(hit.body.to, '+8801712345678')
    assert.match(hit.body.body, /^Your PiCall OTP is \d{6}\. Valid 10 minutes\.$/)
    assert.ok(/^[\x00-\x7F]*$/.test(hit.body.body), 'OTP বার্তা GSM-7 (ASCII) হতে হবে')
    assert.ok(hit.body.body.length <= 160, 'OTP বার্তা ১ সেগমেন্টের মধ্যে হতে হবে')
    assert.ok(typeof hit.idem === 'string' && hit.idem.startsWith('picall-sms-otp-'), 'Idempotency-Key নেই')
    assert.equal(hit.body.reference, 'picall-otp')
  })

  await checkAsync('SMS send: +880 / 880 / Bengali digits all normalise to E.164', async () => {
    for (const form of ['+8801712345678', '8801712345678', '০১৭১২৩৪৫৬৭৮']) {
      const r = await post(base, '/api/otp/send', { channel: 'sms', phone: form })
      assert.equal(r.status, 200, `${form} → ${r.status}`)
      assert.deepEqual(r.body, { ok: true })
      assert.equal(mockHits[mockHits.length - 1].body.to, '+8801712345678', `${form} E.164 হয়নি`)
    }
  })

  await checkAsync('SMS verify: wrong code → invalid_code (code was stored server-side)', async () => {
    const r = await post(base, '/api/otp/verify', { channel: 'sms', phone: '01712345678', code: '000000' })
    assert.equal(r.status, 400)
    assert.equal(r.body.error, 'invalid_code')
  })

  await checkAsync('SMS send: invalid number → 400 invalid_phone, no mock request', async () => {
    const before = mockHits.length
    const r = await post(base, '/api/otp/send', { channel: 'sms', phone: '01212345678' })
    assert.equal(r.status, 400)
    assert.equal(r.body.error, 'invalid_phone')
    assert.equal(mockHits.length, before)
  })

  await checkAsync('SMS send: gateway 401 → sms_key_invalid, and no code is stored', async () => {
    const before = mockHits.length
    const r = await post(base, '/api/otp/send', { channel: 'sms', phone: '01912345678' })
    assert.equal(r.status, 502)
    assert.equal(r.body.error, 'sms_key_invalid')
    assert.equal(mockHits.length, before + 1)
    const v = await post(base, '/api/otp/verify', { channel: 'sms', phone: '01912345678', code: '123456' })
    assert.equal(v.body.error, 'invalid_code')
  })

  await checkAsync('SMS send: 5/hour per phone — 5th ok, 6th rate_limited', async () => {
    // এই নম্বরে আগের ৪টি সফল send হয়েছে (১ + ৩ ফরম্যাট)।
    const fifth = await post(base, '/api/otp/send', { channel: 'sms', phone: '01712345678' })
    assert.equal(fifth.status, 200)
    assert.deepEqual(fifth.body, { ok: true })
    const sixth = await post(base, '/api/otp/send', { channel: 'sms', phone: '01712345678' })
    assert.equal(sixth.status, 429)
    assert.equal(sixth.body.error, 'rate_limited')
  })

  await checkAsync('SMS send: no key configured → 503 not_configured, no mock request', async () => {
    const base2 = await startServer({ port: 4186 })
    const before = mockHits.length
    const r = await post(base2, '/api/otp/send', { channel: 'sms', phone: '01712345678' })
    assert.equal(r.status, 503)
    assert.equal(r.body.error, 'not_configured')
    assert.equal(mockHits.length, before)
  })

  await checkAsync('GET /api/admin/settings: booleans only, no key material', async () => {
    const r = await fetch(`${base}/api/admin/settings`)
    const body = await r.json()
    assert.deepEqual(Object.keys(body).sort(), ['smsConfigured', 'smtpConfigured'])
    assert.equal(typeof body.smsConfigured, 'boolean')
    assert.equal(body.smsConfigured, true, 'fake key থাকায় smsConfigured true হওয়া উচিত')
    const raw = JSON.stringify(body)
    assert.ok(!raw.includes('nk_test_'), 'GET উত্তরে চাবি ফাঁস হচ্ছে')
    assert.ok(!raw.includes('apiKey'), 'GET উত্তরে apiKey ফাঁস হচ্ছে')
  })

  await checkAsync('Email OTP untouched: no SMTP → 503 not_configured', async () => {
    const r = await post(base, '/api/otp/send', { email: 'test@example.com' })
    assert.equal(r.status, 503)
    assert.equal(r.body.error, 'not_configured')
  })
} finally {
  for (const c of children) { try { c.kill('SIGTERM') } catch { /* ignore */ } }
  await new Promise((r) => mock.close(r))
}

console.log(`\nAll ${passed} Nishchit SMS tests passed.`)
