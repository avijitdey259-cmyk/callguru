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
//   Media is WebRTC peer-to-peer — STUN + free shared TURN (OpenRelay,
//   public test credentials, testing only; paid TURN needed for production).
import express from 'express'
import http from 'http'
import crypto from 'node:crypto'
import { WebSocketServer } from 'ws'

const app = express()
app.use(express.json())
// Minimal CORS for the demo API: the Netlify frontend runs on a different
// origin, so browsers would block cross-origin calls without these headers.
// No credentials, no secrets — the demo API takes no auth.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})
const PORT = process.env.PORT || 4000

const experts = [
  { id: 'exp-1', name: 'ডা. রাহাত হোসেন', rate: 15, online: true },
  { id: 'exp-2', name: 'অ্যাডভোকেট নুসরাত জাহান', rate: 25, online: true },
  { id: 'exp-4', name: 'মেহজাবিন চৌধুরী', rate: 10, online: true }
]

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'callguru', version: '6.0.0' }))
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

app.post('/api/otp/send', async (req, res) => {
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
      subject: 'PiCall লগইন কোড',
      text: `আপনার PiCall লগইন কোড: ${code}\nকোডটি ১০ মিনিটের জন্য বৈধ। কাউকে এই কোড দেবেন না।`,
    })
    res.json({ ok: true })
  } catch {
    otpStore.delete(email)
    res.status(502).json({ ok: false, error: 'send_failed' })
  }
})

app.post('/api/otp/verify', (req, res) => {
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

// ---------- Admin settings (in-memory only; Railway restart clears them) ----------
// অ্যাডমিন প্যানেলের সেটিংসের সার্ভার-সাইড কপি — শুধু /api/otp/send-এর SMTP-র জন্য।
// GET কখনো গোপন মান ফেরায় না, শুধু চালু/বন্ধ অবস্থা। স্থায়ী উপায়: Railway-তে SMTP_* env var।
const adminSettings = { smtp: null, sms: null } // smtp: {host,port,user,pass,from} | null; sms: {provider, apiKey, senderId} | null

app.get('/api/admin/settings', (_req, res) => {
  res.json({
    smtpConfigured: Boolean(adminSettings.smtp && adminSettings.smtp.user && adminSettings.smtp.pass),
    smsConfigured: Boolean(adminSettings.sms && adminSettings.sms.apiKey),
  })
})

app.post('/api/admin/settings', (req, res) => {
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
      provider: typeof s.provider === 'string' ? s.provider : 'BulkSMSBD',
      apiKey: typeof s.apiKey === 'string' ? s.apiKey : '',
      senderId: typeof s.senderId === 'string' ? s.senderId : '',
    }
  }
  res.json({
    ok: true,
    smtpConfigured: Boolean(adminSettings.smtp && adminSettings.smtp.user && adminSettings.smtp.pass),
    smsConfigured: Boolean(adminSettings.sms && adminSettings.sms.apiKey),
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
const callRooms = new Map() // 'call-<code>' -> { id, peers: Map<peerId, {ws, name, role}>, createdAt }

app.get('/api/call/:code', (req, res) => {
  const code = String(req.params.code || '').trim()
  const room = callRooms.get(`call-${code}`)
  if (!room) return res.status(404).json({ ok: false, error: 'not_found' })
  const caller = [...room.peers.values()].find(p => p.role === 'caller')
  res.json({ ok: true, code, callerName: caller ? caller.name : 'কলার', peers: room.peers.size })
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

app.post('/api/live', (req, res) => {
  const { hostName, title } = req.body || {}
  const name = typeof hostName === 'string' && hostName.trim() ? hostName.trim().slice(0, 60) : 'লাইভ হোস্ট'
  const id = `live-${Date.now().toString(36)}-${++liveSeq}`
  const room = { id, hostName: name, title: typeof title === 'string' ? title.slice(0, 80) : 'ডেটিং লাইভ', startedAt: Date.now(), host: null, viewers: new Map() }
  liveRooms.set(id, room)
  res.status(201).json(publicRoom(room))
})

app.delete('/api/live/:id', (req, res) => {
  const room = liveRooms.get(req.params.id)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  endRoom(room, 'ended')
  res.json({ ok: true, id: room.id })
})

// ---------- WebSocket signalling (same server/port) ----------
const server = http.createServer(app)
const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
  ws._live = { roomId: null, role: null, name: null, viewerId: null }
  ws._call = { roomId: null, peerId: null, name: null, role: null }

  ws.on('message', (raw) => {
    let m
    try { m = JSON.parse(String(raw)) } catch { return }
    if (!m || typeof m.type !== 'string') return

    // ---- 1-to-1 call signalling (separate room map; live rooms untouched) ----
    if (m.type === 'call-join') {
      const code = String(m.roomId || '').trim()
      if (!/^call-[a-z0-9]{4,12}$/i.test(code)) { send(ws, { type: 'call-error', roomId: code, error: 'bad-call-code' }); return }
      let room = callRooms.get(code)
      if (!room) {
        if (m.role !== 'caller') { send(ws, { type: 'call-error', roomId: code, error: 'call-not-found' }); return }
        room = { id: code, peers: new Map(), createdAt: Date.now() }
        callRooms.set(code, room)
      }
      if (room.peers.size >= 2) { send(ws, { type: 'call-error', roomId: code, error: 'room-full' }); return }
      const peerId = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      const name = typeof m.name === 'string' ? m.name.slice(0, 60) : 'অতিথি'
      const role = m.role === 'callee' ? 'callee' : 'caller'
      room.peers.set(peerId, { ws, name, role })
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
      ws._live = { roomId: room.id, role: m.role, name: typeof m.name === 'string' ? m.name.slice(0, 60) : 'অতিথি', viewerId: null }
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
        room.peers.delete(c.peerId)
        for (const p of room.peers.values()) send(p.ws, { type: 'peer-left', roomId: c.roomId, peerId: c.peerId })
        if (room.peers.size === 0) callRooms.delete(c.roomId)
      }
    }
  })
})

server.listen(PORT, () => console.log(`CallGuru API + live server listening on http://localhost:${PORT}`))
