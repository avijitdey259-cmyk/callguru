// PiCall API client — talks to the live backend (Railway) when VITE_API_URL is
// set, and falls back to the local seed data (demo mode) otherwise.
// The site must keep working fully offline/demo: any backend failure, timeout,
// bad response shape, or missing env var means "demo" — never a broken page.
// Backend endpoints (see server/index.js — do not guess others):
//   GET  /api/health      -> { ok, app, version }
//   GET  /api/experts     -> [{ id, name, rate, online }]
//   POST /api/topup       -> { ok, amount, method, note }
//   POST /api/call/start  -> { ok, rate, freeFirstMinute, maxMinutes }
//   GET  /api/live        -> [{ id, hostName, title, viewers, startedAt }]
//   POST /api/live        -> create a live room { hostName, title }
//   DELETE /api/live/:id  -> end a live room
//   POST /api/otp/send    -> { ok:true } or { ok:false, error:'not_configured'|'rate_limited'|'invalid_email' }
//   POST /api/otp/verify  -> { ok:true } or { ok:false, error:'invalid_code'|'expired'|'too_many_attempts' }
//   OTP-তে channel:'sms' + phone দিলে SMS-এ কোড যায় (গেটওয়ে থাকলে); গেটওয়ে না
//   থাকলে 'not_configured' আসে — গেটওয়ে অ্যাডাপ্টার ব্যাকএন্ডের আলাদা কাজ।
//   GET  /api/call/:code  -> { ok, code, callerName, peers } or 404 (1-to-1 call link)
//   WebSocket (same host/port): live signalling — join/offer/answer/ice/gift/
//   chat/leave, viewer-count + host-left broadcasts (see src/live.ts), and
//   1-to-1 call signalling — call-join/call-offer/call-answer/call-ice/
//   call-chat/call-end, peer-joined + peer-left broadcasts (see src/call.ts).
import { useEffect, useState } from 'react'
import { EXPERTS, type Expert } from './data'
import { getIdToken } from './firebase'

export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) || 'https://callguru-production.up.railway.app').trim().replace(/\/+$/, '')
export const API_TIMEOUT_MS = 5000
// Admin settings save — slow mobile connections need longer than the 5s
// default: the POST to Railway aborted before the server ever saw it,
// while the UI still claimed the save worked. 30s for the save itself
// and for the status check right after it.
export const ADMIN_TIMEOUT_MS = 30000

export type ApiExpert = { id: string; name: string; rate: number; online: boolean }
export type ApiHealth = { ok: boolean; app: string; version: string }
export type BackendSource = 'live' | 'demo'

async function fetchJson<T>(path: string, init?: RequestInit, timeoutMs: number = API_TIMEOUT_MS): Promise<T | null> {
  if (!API_BASE) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, signal: ctrl.signal })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** GET /api/health — backend liveness check. Null when unreachable. */
export function getHealth(): Promise<ApiHealth | null> {
  return fetchJson<ApiHealth>('/api/health')
}

function isApiExpert(x: unknown): x is ApiExpert {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return typeof o.id === 'string' && typeof o.name === 'string' && typeof o.rate === 'number' && typeof o.online === 'boolean'
}

/** GET /api/experts — null when unreachable, empty, or wrong shape. */
export async function fetchApiExperts(): Promise<ApiExpert[] | null> {
  const data = await fetchJson<unknown>('/api/experts')
  if (!Array.isArray(data) || data.length === 0) return null
  if (!data.every(isApiExpert)) return null
  return data
}

/** Merge backend experts onto the seed: the backend is the source of truth for
 *  name/rate/online; the seed keeps title/category/rating/calls/langs/about. */
export function mergeExperts(apiExperts: ApiExpert[]): Expert[] {
  const merged = EXPERTS.map(seed => {
    const live = apiExperts.find(a => a.id === seed.id)
    return live ? { ...seed, name: live.name, rate: live.rate, online: live.online } : seed
  })
  for (const a of apiExperts) {
    if (!merged.some(e => e.id === a.id)) {
      merged.push({
        id: a.id, name: a.name, title: 'Expert', category: 'Health', rate: a.rate,
        rating: 4.8, calls: 0, online: a.online, langs: ['Bengali'], about: '', avatarColor: '#1877F2'
      })
    }
  }
  return merged
}

export type ExpertsResult = { experts: Expert[]; source: BackendSource }

// One shared fetch: every component that calls useExperts() gets the same result.
let expertsPromise: Promise<ExpertsResult> | null = null
export function loadExperts(): Promise<ExpertsResult> {
  if (!expertsPromise) {
    expertsPromise = (async (): Promise<ExpertsResult> => {
      if (!API_BASE) return { experts: EXPERTS, source: 'demo' }
      const apiExperts = await fetchApiExperts()
      if (apiExperts) return { experts: mergeExperts(apiExperts), source: 'live' }
      return { experts: EXPERTS, source: 'demo' }
    })()
  }
  return expertsPromise
}

/** Experts list with its source. Starts as seed/demo, upgrades to live when the
 *  backend answers. Safe to use in Marketplace, ExpertProfile and CallPage. */
export function useExperts(): ExpertsResult {
  const [state, setState] = useState<ExpertsResult>({ experts: EXPERTS, source: 'demo' })
  useEffect(() => {
    let alive = true
    loadExperts().then(r => { if (alive) setState(r) })
    return () => { alive = false }
  }, [])
  return state
}

// Optional server-side checks (POST endpoints the backend exposes). Exported for
// future use; the prepaid call flow and wallet stay local so v6 pricing rules
// (first call's first 1 minute free, prepaid only, auto-cut) never change.
export async function requestTopUp(amount: number, method: string): Promise<{ ok: boolean; amount: number; method: string } | null> {
  return fetchJson('/api/topup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, method })
  })
}

export async function checkCallStart(expertId: string, balance: number, freeFirstMinuteUsed: boolean): Promise<{ ok: boolean; rate: number; freeFirstMinute: boolean; maxMinutes: number } | null> {
  return fetchJson('/api/call/start', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expertId, balance, freeFirstMinuteUsed })
  })
}

// ---------- ইমেইল OTP (৬ সংখ্যার কোড, Railway ব্যাকএন্ড) ----------
// fetchJson ভুল উত্তরে null দেয় — কিন্তু OTP-তে ভুলের কারণ (not_configured /
// rate_limited / invalid_code) জানা দরকার, তাই এখানে body-সহ পড়া হয়।
export type OtpResult = { ok: boolean; error?: string }

async function postOtp(path: string, body: Record<string, string>): Promise<OtpResult | null> {
  if (!API_BASE) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: ctrl.signal,
    })
    const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
    if (data && data.ok) return { ok: true }
    return { ok: false, error: (data && typeof data.error === 'string' && data.error) || 'failed' }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** POST /api/otp/send — ৬ সংখ্যার কোড ইমেইলে পাঠান। ব্যাকএন্ডে SMTP না থাকলে
 *  { ok:false, error:'not_configured' } আসে; ব্যাকএন্ড না পেলে null। */
export function sendEmailOtp(email: string): Promise<OtpResult | null> {
  return postOtp('/api/otp/send', { email })
}

/** POST /api/otp/verify — কোড মিললে { ok:true }, ভুল/মেয়াদোত্তীর্ণ হলে error। */
export function verifyEmailOtp(email: string, code: string): Promise<OtpResult | null> {
  return postOtp('/api/otp/verify', { email, code })
}

// ---------- SMS OTP (৬ সংখ্যার কোড, Railway ব্যাকএন্ড, channel:'sms') ----------
// ইমেইল OTP-র একই পথ — শুধু channel + phone যায়। চাবি না থাকলে ব্যাকএন্ড
// { ok:false, error:'not_configured' } দেয়; এখানে কোনো চাবি নেই —
// পাঠানোর কাজটা ব্যাকএন্ডের (server/index.js, নিশ্চিত SMS API)।
/** POST /api/otp/send { channel:'sms', phone } — ৬ সংখ্যার কোড SMS-এ পাঠান। */
export function sendSmsOtp(phone: string): Promise<OtpResult | null> {
  return postOtp('/api/otp/send', { channel: 'sms', phone })
}

/** POST /api/otp/verify { channel:'sms', phone, code } — কোড মিললে { ok:true }। */
export function verifySmsOtp(phone: string, code: string): Promise<OtpResult | null> {
  return postOtp('/api/otp/verify', { channel: 'sms', phone, code })
}

// ---------- অ্যাডমিন সেটিংস (সার্ভার-সাইড কপি) ----------
// SMTP সেটিংস সার্ভারেও পাঠানো হয়, যাতে /api/otp/send মেইল পাঠাতে পারে —
// ব্রাউজারের localStorage সার্ভার পড়তে পারে না। সার্ভারের কপি শুধু মেমোরিতে
// থাকে (Railway রিস্টার্টে মুছে যায়); স্থায়ী উপায় SMTP_* env var।
export type AdminSmtpPayload = { host: string; port: number; user: string; pass: string; from: string }

// সুরক্ষিত API কলের Authorization হেডার — লগইন না থাকলে খালি।
// সার্ভার (server/auth.js) Bearer টোকেন যাচাই করে; টোকেন ছাড়া 401।
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// কল ইনভাইটের পুশ (গ্রহণকারীর অ্যাপ বন্ধ থাকলে): ইনভাইট ডক লেখার পর
// একবার চেষ্টা — সার্ভার গ্রহণকারীর সাবস্ক্রিপশনে পুশ পাঠায়। ৫ সেকেন্ডে
// না হলে ছেড়ে দেওয়া হয়; পুশ না গেলেও ইনভাইট ডক থাকে, অ্যাপ খোলা
// গ্রহণকারী সেটা দেখতে পায়। কখনো throw করে না।
// ফেরে pushed-ও — সাবস্ক্রিপশন না থাকলে (OTP লগইন/নোটিফিকেশন বন্ধ)
// pushed:false; কলকারী তখন অপেক্ষার পর্দায় সৎ ইঙ্গিত দেখাতে পারেন।
export async function triggerCallInvitePush(input: { toUid: string; inviteId: string; code: string; fromName: string }): Promise<{ ok: boolean; pushed: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/api/call-invite/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return { ok: false, pushed: false }
    try {
      const data = (await res.json()) as { pushed?: unknown }
      return { ok: true, pushed: data.pushed === true }
    } catch { return { ok: true, pushed: false } }
  } catch { return { ok: false, pushed: false } }
}

// চ্যাট মেসেজের পুশ (প্রাপকের অ্যাপ বন্ধ/ব্যাকগ্রাউন্ডে থাকলে): মেসেজ
// Firestore-এ লেখার পর একবার চেষ্টা — সার্ভার প্রাপকের সাবস্ক্রিপশনে
// প্রেরকের নাম + মেসেজের ঝলকসহ পুশ পাঠায় (মেসেঞ্জারের মতো)। ৫ সেকেন্ডে
// না হলে ছেড়ে দেওয়া হয়; মেসেজ তবু পৌঁছে থাকে — অ্যাপ খুললেই দেখা যায়।
// ব্লক করা প্রাপককে মেসেজই যায় না (ChatPage-র send() গেট), তাই এখানে
// আলাদা ব্লক-যাচাই নেই। কখনো throw করে না।
export async function triggerMessagePush(input: { toUid: string; fromName: string; preview: string; roomId: string }): Promise<{ ok: boolean; pushed: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/api/message/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return { ok: false, pushed: false }
    try {
      const data = (await res.json()) as { pushed?: unknown }
      return { ok: true, pushed: data.pushed === true }
    } catch { return { ok: true, pushed: false } }
  } catch { return { ok: false, pushed: false } }
}

export async function saveAdminSmtp(smtp: AdminSmtpPayload): Promise<boolean> {
  if (!API_BASE) return false
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ADMIN_TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}/api/admin/settings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ smtp }), signal: ctrl.signal,
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** GET /api/admin/settings — শুধু অবস্থা (চালু/বন্ধ) ফেরে, কোনো গোপন মান নয়।
 *  সেভের ঠিক পরের চেক ৩০ সেকেন্ড পায় (ধীর মোবাইলে ৫ সেকেন্ডে মরে যেত)। */
export function getAdminSettingsStatus(timeoutMs: number = API_TIMEOUT_MS): Promise<{ smtpConfigured: boolean; smsConfigured: boolean } | null> {
  return fetchJson('/api/admin/settings', undefined, timeoutMs)
}

export type AdminSmsPayload = { provider: string; apiKey: string; senderId: string }

/** POST /api/admin/settings { sms } — SMS চাবি শুধু সার্ভারের মেমোরিতে যায়
 *  (Railway রিস্টার্টে মুছে যায়); স্থায়ী উপায় NISHCHIT_API_KEY env var। */
export async function saveAdminSms(sms: AdminSmsPayload): Promise<boolean> {
  if (!API_BASE) return false
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ADMIN_TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}/api/admin/settings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ sms }), signal: ctrl.signal,
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
