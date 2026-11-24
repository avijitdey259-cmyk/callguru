// CallGuru backend (Express + self-hosted live server). Netlify deploys only the
// frontend (dist/); run this separately: `npm run server` (port 4000, or $PORT).
// No secrets here — real Firebase / SMS / TURN credentials go in environment variables.
//
// LIVE SERVER (self-hosted, no external service, no API keys):
//   REST:  GET /api/live        -> currently live rooms [{id, hostName, title, viewers, startedAt}]
//          POST /api/live       -> create a room {hostName, title} -> room
//          DELETE /api/live/:id -> end a room (host + viewers get 'host-left')
//   WebSocket (same HTTP server/port, so it works on Railway's single PORT):
//   JSON messages, room = live room id:
//     join   {roomId, role: 'host'|'viewer', name}  -> host registers, viewer gets
//             {type:'joined', viewerId, viewers}; everyone gets 'viewer-count'
//     offer  {roomId, to, from, sdp}   viewer -> host (offer), host -> viewer (via answer)
//     answer {roomId, to, from, sdp}   host -> viewer
//     ice    {roomId, to, from, candidate}  relayed host <-> viewer
//     gift   {roomId, name, gift}      broadcast to the whole room
//     chat   {roomId, name, text}      broadcast to the room except the sender
//     leave  {roomId}                  leave the room
//   Host disconnect -> viewers get 'host-left' and the room is deleted.
//   Media itself is WebRTC peer-to-peer (mesh): the host sends one stream per
//   viewer, STUN only (stun:stun.l.google.com:19302) — no TURN yet. Works for a
//   small audience (roughly 5-8 viewers); a big audience needs an SFU later.
//
// 1-TO-1 CALLS (real peer-to-peer, call-by-link):
//   REST:  GET /api/call/:code   -> {ok, code, callerName, peers} or 404
//   WebSocket (same server/port, separate room map 'call-<code>'):
//     call-join  {roomId, role: 'caller'|'callee', name} -> 'call-joined'
//     call-offer / call-answer / call-ice  relayed between the two peers
//     call-chat  {roomId, text}  relayed to the other peer
//     call-end   {roomId}        the other peer gets 'call-ended'
//   Peer disconnect -> the other peer gets 'peer-left'. Max 2 peers per room.
//   Call-failure reasons (the caller sees EXACTLY why a call did not go
//   through — src/callFailure.ts has the same vocabulary on the client):
//     call-invite: callee busy (already in a call room) -> caller gets
//       'call-invite-sent' {delivered:false, pushed:false, reason:'busy'};
//       callee offline (no presence socket, push not delivered) ->
//       {delivered:false, pushed:false, reason:'offline'}.
//     call-invite-response: the callee's gate/decline reason is relayed
//       ('declined' | 'busy' | 'not-friend' | 'not-accepting').
//     POST /api/call-invite/decline (service-worker Decline) -> the caller
//       gets 'call-declined' {reason:'declined'}.
//   Media is WebRTC peer-to-peer — STUN + free shared TURN (OpenRelay,
//   public test credentials, testing only; paid TURN needed for production).
import express from 'express'
import http from 'http'
import crypto from 'node:crypto'
import { WebSocketServer } from 'ws'
import { verifyIdToken, requireAuth, requireAdmin, rateLimit, ADMIN_EMAIL } from './auth.js'

const app = express()
app.use(express.json())
// ---------- সুরক্ষা হেডার (সব উত্তরে) ----------
// CSP ইচ্ছা করে বসানো হয়নি — লাইভ TV-র HLS/CDN উৎসের allowlist ছাড়া
// কড়া CSP অ্যাপ ভাঙবে; সেটা আলাদা যাচাইয়ের কাজ (রিপোর্টে লেখা আছে)।
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade')
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()')
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  next()
})
// CORS — শুধু আমাদের সাইটগুলো + লোকাল ডেভ। '*' নয়: যেকোনো ওয়েবসাইট
// আর এই API ডাকতে পারবে না (Bearer টোকেন থাকলেও ব্রাউজার আটকাবে)।
const ALLOWED_ORIGINS = new Set([
  'https://picallbd.web.app',
  'https://picall-76185.web.app',
  'https://picall-76185.firebaseapp.com',
])
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && (ALLOWED_ORIGINS.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})
const PORT = process.env.PORT || 4000

// ---------- IP-ভিত্তিক রেট লিমিট (ইমেইল-ভিত্তিক OTP সীমার পাশাপাশি) ----------
// একজন আক্রমণকারী অনেক ইমেইলে স্প্রে করতে না পারে — OTP পাঠানো/যাচাইয়ে
// IP-সীমাও চলে। অ্যাডমিন/পুশ/লাইভ রুটে লগইন যাচাইয়ের আগেই IP-সীমা।
const otpSendIpLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 30 })
const otpVerifyIpLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 60 })
const adminIpLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 20 })
const pushIpLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 30 })
const liveIpLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 60 })

const experts = [
  { id: 'exp-1', name: 'Dr. Rahat Hossain', rate: 15, online: true },
  { id: 'exp-2', name: 'Advocate Nusrat Jahan', rate: 25, online: true },
  { id: 'exp-4', name: 'Mehjabin Chowdhury', rate: 10, online: true }
]

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'callguru', version: '6.1.0' }))
app.get('/api/experts', (_req, res) => res.json(experts))
app.post('/api/topup', (req, res) => {
  const { amount, method } = req.body || {}
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' })
  res.json({ ok: true, amount, method: method || 'bKash', note: 'Demo: integrate a real payment gateway before production.' })
})
app.post('/api/call/start', (req, res) => {
  const { expertId, balance, freeFirstMinuteUsed } = req.body || {}
  const expert = experts.find(e => e.id === expertId)
  const rate = expert?.rate ?? 10
  const canStart = !freeFirstMinuteUsed || balance >= rate
  res.json({ ok: canStart, rate, freeFirstMinute: !freeFirstMinuteUsed, maxMinutes: freeFirstMinuteUsed ? Math.floor((balance || 0) / rate) : 1 + Math.floor((balance || 0) / rate) })
})

// ---------- Email OTP (6-digit, via SMTP from env vars only) ----------
// In-memory only: a restart clears pending codes. Codes are never logged.
// SMTP is configured ONLY through environment variables (Railway Variables):
//   SMTP_HOST (default smtp.gmail.com), SMTP_PORT (default 587),
//   SMTP_USER, SMTP_PASS, SMTP_FROM (defaults to SMTP_USER).
// Without SMTP_USER/SMTP_PASS, /api/otp/send answers {ok:false, error:'not_configured'}
// and never generates or leaks a code.
const otpStore = new Map() // email -> { code, expiresAt, attempts }
const otpSendLog = new Map() // email -> { count, windowStart }
const OTP_TTL_MS = 10 * 60 * 1000
const OTP_MAX_SENDS_PER_HOUR = 5
const OTP_MAX_ATTEMPTS = 5

let mailerPromise = null
let mailerCfgKey = ''
// কার্যকর SMTP কনফিগ — env var (SMTP_*) থাকলে সেটাই আগে; না থাকলে অ্যাডমিন
// প্যানেল থেকে পাঠানো সেটিংস (POST /api/admin/settings, শুধু মেমোরিতে)।
function getSmtpConfig() {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return { host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT || 587), user: process.env.SMTP_USER, pass: process.env.SMTP_PASS, from: process.env.SMTP_FROM || process.env.SMTP_USER }
  }
  const s = adminSettings.smtp
  if (s && s.user && s.pass) {
    return { host: s.host || 'smtp.gmail.com', port: s.port || 587, user: s.user, pass: s.pass, from: s.from || s.user }
  }
  return null
}
function getMailer() {
  const cfg = getSmtpConfig()
  if (!cfg) return Promise.resolve(null)
  const key = `${cfg.host}|${cfg.port}|${cfg.user}`
  if (!mailerPromise || mailerCfgKey !== key) {
    mailerCfgKey = key
    mailerPromise = import('nodemailer').then(m => {
      const nodemailer = m.default || m
      return {
        transport: nodemailer.createTransport({
          host: cfg.host,
          port: cfg.port,
          secure: cfg.port === 465,
          auth: { user: cfg.user, pass: cfg.pass },
        }),
        from: cfg.from || cfg.user,
      }
    }).catch(() => null)
  }
  return mailerPromise
}

function validEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

app.post('/api/otp/send', otpSendIpLimit, async (req, res) => {
  if (req.body?.channel === 'sms') return sendSmsOtp(req, res)
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  if (!validEmail(email)) return res.status(400).json({ ok: false, error: 'invalid_email' })
  const mailer = await getMailer()
  if (!mailer) return res.status(503).json({ ok: false, error: 'not_configured' })
  const now = Date.now()
  const log = otpSendLog.get(email)
  if (log && now - log.windowStart < 60 * 60 * 1000) {
    if (log.count >= OTP_MAX_SENDS_PER_HOUR) return res.status(429).json({ ok: false, error: 'rate_limited' })
    log.count += 1
  } else {
    otpSendLog.set(email, { count: 1, windowStart: now })
  }
  const code = String(crypto.randomInt(100000, 1000000))
  otpStore.set(email, { code, expiresAt: now + OTP_TTL_MS, attempts: 0 })
  try {
    await mailer.transport.sendMail({
      from: mailer.from,
      to: email,
      subject: 'PiCall login code',
      text: `Your PiCall login code: ${code}\nThe code is valid for 10 minutes. Do not share it with anyone.`,
    })
    res.json({ ok: true })
  } catch {
    otpStore.delete(email)
    res.status(502).json({ ok: false, error: 'send_failed' })
  }
})

app.post('/api/otp/verify', otpVerifyIpLimit, (req, res) => {
  if (req.body?.channel === 'sms') return verifySmsOtp(req, res)
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
  if (!validEmail(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ ok: false, error: 'invalid_code' })
  const rec = otpStore.get(email)
  if (!rec) return res.status(400).json({ ok: false, error: 'invalid_code' })
  if (Date.now() > rec.expiresAt) { otpStore.delete(email); return res.status(400).json({ ok: false, error: 'expired' }) }
  if (rec.attempts >= OTP_MAX_ATTEMPTS) { otpStore.delete(email); return res.status(400).json({ ok: false, error: 'too_many_attempts' }) }
  if (rec.code !== code) {
    rec.attempts += 1
    if (rec.attempts >= OTP_MAX_ATTEMPTS) { otpStore.delete(email); return res.status(400).json({ ok: false, error: 'too_many_attempts' }) }
    return res.status(400).json({ ok: false, error: 'invalid_code' })
  }
  otpStore.delete(email)
  res.json({ ok: true })
})

// ---------- SMS OTP (6-digit, via Nishchit — Bangladesh SMS API) ----------
// নিশ্চিত (Nishchit) API: POST https://api.nishchit.tech/v1/messages,
// Authorization: Bearer <key>, JSON {to, body, reference} + Idempotency-Key.
// চাবি env var NISHCHIT_API_KEY থেকে আগে; না থাকলে অ্যাডমিন প্যানেলের
// সার্ভার-সাইড কপি (POST /api/admin/settings → sms.apiKey, provider 'Nishchit')।
// চাবি কোথাও hard-code করা হয় না, GET /api/admin/settings কখনো চাবি ফেরায় না,
// config/public-এও চাবি যায় না। টেস্ট চাবি (nk_test_) ক্যারিয়ারে যায় না,
// ক্রেডিটও খরচ করে না — শুধু যাচাইয়ের জন্য।
// OTP বার্তা ইংরেজিতে (GSM-7, ১ সেগমেন্ট = ৳0.50); বাংলা হলে UCS-2 হয়ে
// ৭০ অক্ষর/সেগমেন্ট হয়, তাই কোডের বার্তা ছোট ইংরেজি রাখা হয়েছে।
const NISHCHIT_API_BASE = (process.env.NISHCHIT_API_BASE || 'https://api.nishchit.tech').replace(/\/$/, '')
const smsOtpStore = new Map() // +8801... -> { code, expiresAt, attempts }
const smsOtpSendLog = new Map() // +8801... -> { count, windowStart }

function getNishchitApiKey() {
  if (process.env.NISHCHIT_API_KEY) return process.env.NISHCHIT_API_KEY
  const s = adminSettings.sms
  if (s && s.provider === 'Nishchit' && typeof s.apiKey === 'string' && s.apiKey) return s.apiKey
  return ''
}

// বাংলাদেশি নম্বর → E.164 (+8801[3-9]XXXXXXXX)। 01... / 880... / +880... /
// বাংলা সংখ্যা — সব একই রূপে আসে; ভুল নম্বরে null।
function normalizeBdPhoneE164(raw) {
  if (typeof raw !== 'string') return null
  const bn = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' }
  let d = raw.replace(/[০-৯]/g, (ch) => bn[ch] ?? ch).replace(/[\s\-()]/g, '')
  if (d.startsWith('+880')) d = '0' + d.slice(4)
  else if (d.startsWith('880')) d = '0' + d.slice(3)
  if (!/^01[3-9]\d{8}$/.test(d)) return null
  return '+880' + d.slice(1)
}

/** নিশ্চিতকে একটা SMS পাঠানো — 15s টাইমআউট (API-র ডেডলাইন 10s)। */
async function sendNishchitSms(to, body, idempotencyKey) {
  const key = getNishchitApiKey()
  if (!key) return { ok: false, error: 'not_configured' }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(`${NISHCHIT_API_BASE}/v1/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ to, body, reference: 'picall-otp' }),
      signal: ctrl.signal,
    })
    const data = await res.json().catch(() => null)
    if (res.status === 201 || res.ok) return { ok: true, status: res.status, data }
    if (res.status === 401 || res.status === 403) return { ok: false, error: 'sms_key_invalid', status: res.status, data }
    if (res.status === 429) return { ok: false, error: 'rate_limited', status: res.status, data }
    if (res.status === 402) return { ok: false, error: 'sms_no_credit', status: res.status, data }
    return { ok: false, error: 'send_failed', status: res.status, data }
  } catch {
    return { ok: false, error: 'send_failed' }
  } finally {
    clearTimeout(timer)
  }
}

async function sendSmsOtp(req, res) {
  try {
    const phone = normalizeBdPhoneE164(req.body?.phone)
    if (!phone) return res.status(400).json({ ok: false, error: 'invalid_phone' })
    const now = Date.now()
    const log = smsOtpSendLog.get(phone)
    if (log && now - log.windowStart < 60 * 60 * 1000) {
      if (log.count >= OTP_MAX_SENDS_PER_HOUR) return res.status(429).json({ ok: false, error: 'rate_limited' })
      log.count += 1
    } else {
      smsOtpSendLog.set(phone, { count: 1, windowStart: now })
    }
    if (!getNishchitApiKey()) return res.status(503).json({ ok: false, error: 'not_configured' })
    const code = String(crypto.randomInt(100000, 1000000))
    smsOtpStore.set(phone, { code, expiresAt: now + OTP_TTL_MS, attempts: 0 })
    const r = await sendNishchitSms(phone, `Your PiCall OTP is ${code}. Valid 10 minutes.`, `picall-sms-otp-${phone}-${code}`)
    if (!r.ok) {
      smsOtpStore.delete(phone)
      if (r.error === 'sms_key_invalid') return res.status(502).json({ ok: false, error: 'sms_key_invalid' })
      if (r.error === 'rate_limited') return res.status(429).json({ ok: false, error: 'rate_limited' })
      if (r.error === 'sms_no_credit') return res.status(502).json({ ok: false, error: 'sms_no_credit' })
      return res.status(502).json({ ok: false, error: 'send_failed' })
    }
    res.json({ ok: true })
  } catch {
    res.status(502).json({ ok: false, error: 'send_failed' })
  }
}

function verifySmsOtp(req, res) {
  const phone = normalizeBdPhoneE164(req.body?.phone)
  const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
  if (!phone || !/^\d{6}$/.test(code)) return res.status(400).json({ ok: false, error: 'invalid_code' })
  const rec = smsOtpStore.get(phone)
  if (!rec) return res.status(400).json({ ok: false, error: 'invalid_code' })
  if (Date.now() > rec.expiresAt) { smsOtpStore.delete(phone); return res.status(400).json({ ok: false, error: 'expired' }) }
  if (rec.attempts >= OTP_MAX_ATTEMPTS) { smsOtpStore.delete(phone); return res.status(400).json({ ok: false, error: 'too_many_attempts' }) }
  if (rec.code !== code) {
    rec.attempts += 1
    if (rec.attempts >= OTP_MAX_ATTEMPTS) { smsOtpStore.delete(phone); return res.status(400).json({ ok: false, error: 'too_many_attempts' }) }
    return res.status(400).json({ ok: false, error: 'invalid_code' })
  }
  smsOtpStore.delete(phone)
  res.json({ ok: true })
}

// ---------- Admin settings (in-memory only; Railway restart clears them) ----------
// অ্যাডমিন প্যানেলের সেটিংসের সার্ভার-সাইড কপি — শুধু /api/otp/send-এর SMTP-র জন্য।
// GET কখনো গোপন মান ফেরায় না, শুধু চালু/বন্ধ অবস্থা। স্থায়ী উপায়: Railway-তে SMTP_* env var।
const adminSettings = { smtp: null, sms: null } // smtp: {host,port,user,pass,from} | null; sms: {provider, apiKey, senderId} | null

app.get('/api/admin/settings', (_req, res) => {
  res.json({
    smtpConfigured: Boolean(adminSettings.smtp && adminSettings.smtp.user && adminSettings.smtp.pass),
    // env চাবি থাকলেও SMS চালু দেখায় — চাবির মান নয়, শুধু চালু/বন্ধ অবস্থা।
    smsConfigured: Boolean(getNishchitApiKey()),
  })
})

// POST /api/admin/settings — শুধু অ্যাডমিন (Firebase লগইন + ADMIN_EMAIL)।
// আগে যাচাই ছাড়াই খোলা ছিল: যে কেউ SMTP পাসওয়ার্ড বদলে OTP কোড নিজের
// SMTP সার্ভারে পাঠাতে পারত। এখন টোকেন ছাড়া 401, অ্যাডমিন নয় এমন
// লগইন-থাকা ব্যবহারকারী 403 পায়।
app.post('/api/admin/settings', adminIpLimit, requireAdmin, (req, res) => {
  const body = req.body || {}
  if (body.smtp && typeof body.smtp === 'object') {
    const s = body.smtp
    if (typeof s.user === 'string' && typeof s.pass === 'string') {
      adminSettings.smtp = {
        host: typeof s.host === 'string' && s.host.trim() ? s.host.trim() : 'smtp.gmail.com',
        port: Number(s.port) || 587,
        user: s.user.trim(),
        pass: s.pass,
        from: typeof s.from === 'string' ? s.from.trim() : '',
      }
    }
  }
  if (body.sms && typeof body.sms === 'object') {
    const s = body.sms
    adminSettings.sms = {
      provider: typeof s.provider === 'string' ? s.provider : 'Nishchit',
      apiKey: typeof s.apiKey === 'string' ? s.apiKey.trim() : '',
      senderId: typeof s.senderId === 'string' ? s.senderId : '',
    }
  }
  res.json({
    ok: true,
    smtpConfigured: Boolean(adminSettings.smtp && adminSettings.smtp.user && adminSettings.smtp.pass),
    smsConfigured: Boolean(getNishchitApiKey()),
  })
})

// ---------- 1-to-1 call rooms (in-memory; a restart clears them) ----------
// Call-by-link: the caller starts from /call/<type>/<id>, gets a short code,
// shares https://picallbd.web.app/call/<code>; the callee opens the link
// and joins the same room. Signalling only — media is WebRTC peer-to-peer
// (STUN + free shared TURN for testing; paid TURN needed for production).
//   REST: GET /api/call/:code -> {ok, code, callerName, peers} or 404
//   WebSocket (same server/port as live rooms, separate room map):
//     call-join  {roomId: 'call-<code>', role: 'caller'|'callee', name}
//                -> {type:'call-joined', peerId, peers:[{peerId,name,role}]};
//                   the other peer gets 'peer-joined' {peerId, name, role}
//     call-offer / call-answer / call-ice  {roomId, to, from, sdp/candidate}
//                relayed between exactly the two peers (to = peerId)
//     call-chat  {roomId, text}  relayed to the other peer
//     call-end   {roomId}        the other peer gets 'call-ended', room deleted
//   Peer disconnect -> the other peer gets 'peer-left' and the room is deleted
//   when empty. A room holds at most 2 peers; a callee joining a missing
//   room gets {type:'call-error', error:'call-not-found'}.
const callRooms = new Map() // 'call-<code>' -> { id, peers: Map<peerId, {ws, name, role, uid}>, createdAt }

// 1-to-1 কলে কে ব্যস্ত — uid -> roomId; ইনভাইট এলে ব্যস্ত থাকলে রিং না
// বাজিয়ে কলকারীকে 'busy' জানানো হয় (অন্য ডিভাইসে কলে থাকলেও ধরা পড়ে)।
// call-join-এ টোকেন থাকলেই uid বাঁধা হয়; অতিথি (লিংক-কল) ধরা পড়ে না।
const inCallByUser = new Map() // uid -> roomId
function markInCall(uid, roomId) { if (uid) inCallByUser.set(uid, roomId) }
function clearInCall(uid, roomId) { if (uid && inCallByUser.get(uid) === roomId) inCallByUser.delete(uid) }

app.get('/api/call/:code', (req, res) => {
  const code = String(req.params.code || '').trim()
  const room = callRooms.get(`call-${code}`)
  if (!room) return res.status(404).json({ ok: false, error: 'not_found' })
  const caller = [...room.peers.values()].find(p => p.role === 'caller')
  res.json({ ok: true, code, callerName: caller ? caller.name : 'Caller', peers: room.peers.size })
})

// ---------- Web Push (ইনকামিং কলের নোটিফিকেশন — লক স্ক্রিনেও দেখায়) ----------
// VAPID চাবি শুধু env var থেকে (Railway Variables): VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY, VAPID_SUBJECT (যেমন mailto:avijitdey259@gmail.com)।
// চাবি না থাকলে পুশ চুপচাপ বন্ধ থাকে — ইন-অ্যাপ ওভারলে তখনো চলে।
// সাবস্ক্রিপশন ইন-মেমোরি (রিস্টার্টে মুছে যায় — অ্যাপ খুললেই আবার জমা হয়)।
const pushSubscriptions = new Map() // userId -> push subscription object
let webPushLib = null
let webPushTried = false
async function getWebPush() {
  if (webPushTried) return webPushLib
  webPushTried = true
  const pub = process.env.VAPID_PUBLIC_KEY || ''
  const priv = process.env.VAPID_PRIVATE_KEY || ''
  if (!pub || !priv) return null
  try {
    const mod = await import('web-push')
    const wp = mod.default || mod
    wp.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:avijitdey259@gmail.com', pub, priv)
    webPushLib = wp
    return wp
  } catch { return null }
}

/** পুশ পাঠানো — সার্ভিস ওয়ার্কার (public/sw.js) এই পেলোডই দেখায়। */
async function sendCallPush(userId, invite) {
  const sub = pushSubscriptions.get(userId)
  if (!sub) return false
  const wp = await getWebPush()
  if (!wp) return false
  const payload = JSON.stringify({
    title: `📞 ${invite.fromName} is calling`,
    body: 'Tap to answer — PiCall video call',
    tag: `picall-call-${invite.code}`,
    data: { code: invite.code, fromId: invite.fromId, fromName: invite.fromName, url: `/call/${invite.code}` },
    actions: [{ action: 'answer', title: '📞 Answer' }, { action: 'decline', title: '❌ Decline' }],
  })
  try { await wp.sendNotification(sub, payload); return true }
  catch (e) {
    if (e && (e.statusCode === 404 || e.statusCode === 410)) pushSubscriptions.delete(userId)
    return false
  }
}

app.get('/api/push/vapid-public-key', (_req, res) => {
  const pub = process.env.VAPID_PUBLIC_KEY || ''
  if (!pub) return res.json({ configured: false })
  res.json({ configured: true, publicKey: pub })
})

// POST /api/push/subscribe — শুধু লগইন থাকা ব্যবহারকারী; userId টোকেনের
// uid থেকে নেওয়া হয় — ক্লায়েন্টের পাঠানো userId-তে ভরসা করা হয় না
// (আগে যে কেউ অন্যের userId দিয়ে সাবস্ক্রাইব করে তার কলের পুশ পেত)।
app.post('/api/push/subscribe', pushIpLimit, requireAuth, (req, res) => {
  const body = req.body || {}
  const userId = req.auth.uid
  const sub = body.subscription
  if (!sub || typeof sub.endpoint !== 'string') return res.status(400).json({ ok: false, error: 'invalid_subscription' })
  pushSubscriptions.set(userId, sub)
  res.json({ ok: true })
})

// সার্ভিস ওয়ার্কার থেকে Decline — কলারকে জানানো (রুমে থাকলে 'call-declined'
// যায়, সঙ্গে কারণ 'declined' — কলার "declined" দেখবেন, জেনেরিক ভুল নয়)
app.post('/api/call-invite/decline', (req, res) => {
  const code = String(req.body?.code || '').trim()
  const room = callRooms.get(`call-${code}`)
  if (room) {
    for (const p of room.peers.values()) {
      if (p.role === 'caller') send(p.ws, { type: 'call-declined', roomId: `call-${code}`, reason: 'declined' })
    }
  }
  res.json({ ok: true })
})

// ---------- Live rooms (in-memory; a restart clears them) ----------
/** @type {Map<string, {id: string, hostName: string, title: string, startedAt: number, host: import('ws').WebSocket | null, viewers: Map<string, import('ws').WebSocket>}>} */
const liveRooms = new Map()
let liveSeq = 0

function publicRoom(r) {
  return { id: r.id, hostName: r.hostName, title: r.title, viewers: r.viewers.size, startedAt: r.startedAt }
}

function send(ws, msg) {
  try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)) } catch { /* ignore */ }
}

function broadcast(room, msg, except) {
  if (room.host && room.host !== except) send(room.host, msg)
  for (const ws of room.viewers.values()) {
    if (ws !== except) send(ws, msg)
  }
}

function broadcastViewerCount(room) {
  broadcast(room, { type: 'viewer-count', roomId: room.id, viewers: room.viewers.size })
}

function endRoom(room, reason) {
  liveRooms.delete(room.id)
  broadcast(room, { type: 'host-left', roomId: room.id, reason: reason || 'host-left' })
}

app.get('/api/live', (_req, res) => {
  res.json([...liveRooms.values()].map(publicRoom))
})

// POST /api/live — শুধু লগইন থাকা ব্যবহারকারী রুম খুলতে পারেন; রুমের
// মালিক (ownerUid) টোকেনের uid — পরে DELETE শুধু মালিক/অ্যাডমিন পারেন।
app.post('/api/live', liveIpLimit, requireAuth, (req, res) => {
  const { hostName, title } = req.body || {}
  const name = typeof hostName === 'string' && hostName.trim() ? hostName.trim().slice(0, 60) : 'Live host'
  const id = `live-${Date.now().toString(36)}-${++liveSeq}`
  const room = { id, hostName: name, title: typeof title === 'string' ? title.slice(0, 80) : 'Dating Live', startedAt: Date.now(), host: null, viewers: new Map(), ownerUid: req.auth.uid }
  liveRooms.set(id, room)
  res.status(201).json(publicRoom(room))
})

app.delete('/api/live/:id', liveIpLimit, requireAuth, (req, res) => {
  const room = liveRooms.get(req.params.id)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  if (room.ownerUid && room.ownerUid !== req.auth.uid && req.auth.email.toLowerCase() !== ADMIN_EMAIL) {
    return res.status(403).json({ ok: false, error: 'forbidden' })
  }
  endRoom(room, 'ended')
  res.json({ ok: true, id: room.id })
})

// ---------- WebSocket signalling (same server/port) ----------
const server = http.createServer(app)
const wss = new WebSocketServer({ server })

// Presence — লগইন থাকা ব্যবহারকারীর userId -> সকেট; ইনকামিং কলের
// ইনভাইট এই ম্যাপ দিয়ে পৌঁছায়। রিস্টার্টে মুছে যায় (অ্যাপ খুললেই আবার জমা হয়)।
const presence = new Map() // userId -> ws

wss.on('connection', (ws) => {
  ws._live = { roomId: null, role: null, name: null, viewerId: null }
  ws._call = { roomId: null, peerId: null, name: null, role: null }
  ws._presence = { userId: null, name: null }

  ws.on('message', async (raw) => {
    let m
    try { m = JSON.parse(String(raw)) } catch { return }
    if (!m || typeof m.type !== 'string') return

    // ---- presence: Firebase ID token দিয়ে পরিচয় যাচাই, তারপর রেজিস্টার ----
    // আগে যেকোনো userId দিয়ে রেজিস্টার করা যেত — অন্যের কল-ইনভাইট পাওয়া
    // যেত। এখন uid টোকেন থেকেই নেওয়া হয়; টোকেন ছাড়া/ভুল হলে রেজিস্টার হয় না।
    if (m.type === 'presence-register') {
      const auth = await verifyIdToken(typeof m.idToken === 'string' ? m.idToken : '')
      if (!auth) { send(ws, { type: 'presence-error', error: 'unauthorized' }); return }
      const userId = auth.uid
      const prev = presence.get(userId)
      if (prev && prev !== ws) { try { prev.close() } catch { /* ignore */ } }
      presence.set(userId, ws)
      ws._presence = { userId, name: auth.name || (typeof m.name === 'string' ? m.name.slice(0, 60) : 'User') }
      ws._auth = auth
      send(ws, { type: 'presence-registered', userId })
      return
    }

    // ---- 1-to-1 কল ইনভাইট: বন্ধুর হোম পেজে ওভারলে উঠবে ----
    // কলারকে সঙ্গে সঙ্গে জানানো হয় ইনভাইট পৌঁছাল কি না — পৌঁছায়নি +
    // পুশও যায়নি মানে গ্রহণকারী অফলাইন ('offline'); ব্যস্ত থাকলে ('busy')
    // রিং বাজানো হয় না, কলার "busy" দেখবেন। পুশ গেলে উত্তর অপেক্ষা করা
    // হয় — লক স্ক্রিন থেকে ধরতে পারেন, তাই 'offline' বলা হয় না।
    if (m.type === 'call-invite') {
      const to = typeof m.to === 'string' ? m.to.trim() : ''
      const code = String(m.code || '').trim()
      if (!to || !/^[a-z0-9]{6}$/i.test(code)) return
      // পরিচয় শুধু যাচাই করা presence থেকেই — ক্লায়েন্টের পাঠানো
      // fromId/fromName-এ আর ভরসা করা হয় না (presence ছাড়া ইনভাইট যায় না)।
      const fromId = ws._presence.userId
      const fromName = ws._presence.name || 'Caller'
      if (!fromId) return
      const payload = {
        type: 'call-invite',
        code,
        fromId,
        fromName,
        fromColor: typeof m.fromColor === 'string' ? m.fromColor.slice(0, 20) : '',
        kind: 'friend',
        at: Date.now(),
      }
      const target = presence.get(to)
      if (target) {
        if (inCallByUser.has(to)) {
          send(ws, { type: 'call-invite-sent', to, delivered: false, pushed: false, reason: 'busy' })
          return
        }
        send(target, payload)
        send(ws, { type: 'call-invite-sent', to, delivered: true, pushed: false })
        return
      }
      // অনলাইনে নেই — লক স্ক্রিনের পুশ নোটিফিকেশন চেষ্টা (VAPID থাকলে)
      sendCallPush(to, payload)
        .then((pushed) => { send(ws, { type: 'call-invite-sent', to, delivered: false, pushed, reason: pushed ? undefined : 'offline' }) })
        .catch(() => { send(ws, { type: 'call-invite-sent', to, delivered: false, pushed: false, reason: 'offline' }) })
      return
    }

    // ---- ইনভাইটের উত্তর: ধরলেন না কাটলেন — কলকারীকে ফেরত পাঠানো ----
    // কারণসহ ('declined' | 'busy' | 'not-friend' | 'not-accepting') —
    // গ্রহণকারীর গেট (বন্ধু নয়/ব্যস্ত/কল নেন না) বা Decline বোতাম থেকে
    // আসে; ভুল কারণ এলে বাদ দেওয়া হয় — তখন ক্লায়েন্ট সাধারণ 'declined'
    // দেখায় (কোনো অজানা কারণ কলারকে দেখানো হয় না)।
    if (m.type === 'call-invite-response') {
      const to = typeof m.to === 'string' ? m.to.trim() : ''
      const code = String(m.code || '').trim()
      if (!to || !code || typeof m.accepted !== 'boolean') return
      const VALID_DECLINE_REASONS = new Set(['declined', 'busy', 'not-friend', 'not-accepting'])
      const reason = !m.accepted && typeof m.reason === 'string' && VALID_DECLINE_REASONS.has(m.reason) ? m.reason : undefined
      const target = presence.get(to)
      if (target) send(target, { type: 'call-invite-response', code, accepted: m.accepted, fromId: ws._presence.userId || '', ...(reason ? { reason } : {}) })
      return
    }

    // ---- 1-to-1 call signalling (separate room map; live rooms untouched) ----
    // call-join: টোকেন থাকলে যাচাই করে পরিচয় বাঁধা হয়; না থাকলে আগের মতো
    // অতিথি হিসেবে ঢোকা যায় (কল-বাই-লিংক লগইন ছাড়াও চলে)। ভুল টোকেন
    // পাঠালে 'unauthorized' — চুপচাপ অতিথি বানানো হয় না।
    if (m.type === 'call-join') {
      const code = String(m.roomId || '').trim()
      if (!/^call-[a-z0-9]{4,12}$/i.test(code)) { send(ws, { type: 'call-error', roomId: code, error: 'bad-call-code' }); return }
      let joinAuth = null
      if (typeof m.idToken === 'string' && m.idToken) {
        joinAuth = await verifyIdToken(m.idToken)
        if (!joinAuth) { send(ws, { type: 'call-error', roomId: code, error: 'unauthorized' }); return }
        ws._auth = joinAuth
      }
      let room = callRooms.get(code)
      if (!room) {
        if (m.role !== 'caller') { send(ws, { type: 'call-error', roomId: code, error: 'call-not-found' }); return }
        room = { id: code, peers: new Map(), createdAt: Date.now() }
        callRooms.set(code, room)
      }
      if (room.peers.size >= 2) { send(ws, { type: 'call-error', roomId: code, error: 'room-full' }); return }
      const peerId = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      const name = joinAuth?.name || (typeof m.name === 'string' ? m.name.slice(0, 60) : 'Guest')
      const role = m.role === 'callee' ? 'callee' : 'caller'
      room.peers.set(peerId, { ws, name, role, uid: joinAuth?.uid ?? null })
      // লগইন থাকা পিয়ার কলে ঢুকলেন — এই uid-তে ইনভাইট এলে 'busy' যাবে
      if (joinAuth) markInCall(joinAuth.uid, code)
      ws._call = { roomId: code, peerId, name, role }
      const others = [...room.peers.entries()].filter(([pid]) => pid !== peerId).map(([pid, p]) => ({ peerId: pid, name: p.name, role: p.role }))
      send(ws, { type: 'call-joined', roomId: code, peerId, peers: others })
      for (const [pid, p] of room.peers) {
        if (pid !== peerId) send(p.ws, { type: 'peer-joined', roomId: code, peerId, name, role })
      }
      return
    }

    if (m.type === 'call-offer' || m.type === 'call-answer' || m.type === 'call-ice' || m.type === 'call-chat') {
      const room = callRooms.get(String(m.roomId || ''))
      if (!room || !ws._call || ws._call.roomId !== m.roomId) return
      if (m.type === 'call-chat' && (typeof m.text !== 'string' || !m.text.trim())) return
      const target = m.to ? room.peers.get(m.to) : [...room.peers.values()].find(p => p.ws !== ws)
      if (!target) return
      const relay = { type: m.type, roomId: m.roomId, from: ws._call.peerId }
      if (m.sdp) relay.sdp = m.sdp
      if (m.candidate) relay.candidate = m.candidate
      if (m.type === 'call-chat') relay.text = m.text.slice(0, 500)
      send(target.ws, relay)
      return
    }

    if (m.type === 'call-end') {
      const room = callRooms.get(String(m.roomId || ''))
      if (room) {
        for (const p of room.peers.values()) {
          if (p.uid) clearInCall(p.uid, m.roomId)
          if (p.ws !== ws) send(p.ws, { type: 'call-ended', roomId: m.roomId })
        }
        callRooms.delete(m.roomId)
      }
      ws._call = { roomId: null, peerId: null, name: null, role: null }
      return
    }

    const room = m.roomId ? liveRooms.get(m.roomId) : null

    if (m.type === 'join') {
      if (!room) { send(ws, { type: 'error', roomId: m.roomId, error: 'Room not found' }); return }
      // হোস্ট হিসেবে ঢুকতে Firebase লগইন লাগবে — নইলে যেকোনো ব্যক্তি অন্যের
      // রুমের হোস্ট সেজে স্ট্রিম দখল করতে পারত। রুমের মালিক (REST-এ তৈরি
      // করা uid) ছাড়া অন্য কেউ হোস্ট হতে পারে না (অ্যাডমিন বাদে)।
      // ownerUid না থাকা পুরনো/ডেমো রুমে যাচাই করা যেকোনো লগইন-থাকা
      // ব্যবহারকারী হোস্ট হতে পারেন (রোলআউটের সুবিধার জন্য)।
      let joinAuth = null
      if (m.role === 'host') {
        joinAuth = await verifyIdToken(typeof m.idToken === 'string' ? m.idToken : '')
        if (!joinAuth) { send(ws, { type: 'error', roomId: room.id, error: 'unauthorized' }); return }
        if (room.ownerUid && joinAuth.uid !== room.ownerUid && joinAuth.email.toLowerCase() !== ADMIN_EMAIL) {
          send(ws, { type: 'error', roomId: room.id, error: 'forbidden' }); return
        }
        ws._auth = joinAuth
      }
      ws._live = { roomId: room.id, role: m.role, name: joinAuth?.name || (typeof m.name === 'string' ? m.name.slice(0, 60) : 'Guest'), viewerId: null }
      if (m.role === 'host') {
        if (room.host && room.host !== ws) send(room.host, { type: 'host-left', roomId: room.id, reason: 'replaced' })
        room.host = ws
        send(ws, { type: 'joined', roomId: room.id, role: 'host', viewers: room.viewers.size })
      } else {
        const viewerId = `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        ws._live.viewerId = viewerId
        room.viewers.set(viewerId, ws)
        send(ws, { type: 'joined', roomId: room.id, role: 'viewer', viewerId, viewers: room.viewers.size })
        broadcastViewerCount(room)
      }
      return
    }

    if (!room) return
    const from = ws._live.viewerId || ws._live.role || 'unknown'

    if (m.type === 'offer' || m.type === 'answer' || m.type === 'ice') {
      // Viewer -> host (to 'host' or omitted), host -> one viewer (to = viewerId).
      if (m.to && m.to !== 'host') {
        const target = room.viewers.get(m.to)
        if (target) send(target, { ...m, from })
      } else if (room.host) {
        send(room.host, { ...m, from })
      }
      return
    }

    if (m.type === 'gift') {
      broadcast(room, { type: 'gift', roomId: room.id, from: ws._live.name, gift: m.gift })
      return
    }

    if (m.type === 'chat') {
      if (typeof m.text !== 'string' || !m.text.trim()) return
      broadcast(room, { type: 'chat', roomId: room.id, from: ws._live.name, text: m.text.slice(0, 500) }, ws)
      return
    }

    if (m.type === 'leave') {
      if (ws._live.role === 'viewer' && ws._live.viewerId) {
        room.viewers.delete(ws._live.viewerId)
        broadcastViewerCount(room)
      }
      ws._live = { roomId: null, role: null, name: null, viewerId: null }
      return
    }
  })

  ws.on('close', () => {
    const pr = ws._presence
    if (pr && pr.userId && presence.get(pr.userId) === ws) presence.delete(pr.userId)
    const info = ws._live
    if (info && info.roomId) {
      const room = liveRooms.get(info.roomId)
      if (room) {
        if (info.role === 'host' && room.host === ws) {
          endRoom(room, 'host-left')
        } else if (info.role === 'viewer' && info.viewerId) {
          room.viewers.delete(info.viewerId)
          broadcastViewerCount(room)
        }
      }
    }
    const c = ws._call
    if (c && c.roomId) {
      const room = callRooms.get(c.roomId)
      if (room) {
        const peer = room.peers.get(c.peerId)
        if (peer?.uid) clearInCall(peer.uid, c.roomId)
        room.peers.delete(c.peerId)
        for (const p of room.peers.values()) send(p.ws, { type: 'peer-left', roomId: c.roomId, peerId: c.peerId })
        if (room.peers.size === 0) callRooms.delete(c.roomId)
      }
    }
  })
})

server.listen(PORT, () => console.log(`CallGuru API + live server listening on http://localhost:${PORT}`))
