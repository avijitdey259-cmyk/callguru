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
//   WebSocket (same host/port): live signalling — join/offer/answer/ice/gift/
//   chat/leave, viewer-count + host-left broadcasts (see src/live.ts).
import { useEffect, useState } from 'react'
import { EXPERTS, type Expert } from './data'

export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) || 'https://callguru-production.up.railway.app').trim().replace(/\/+$/, '')
export const API_TIMEOUT_MS = 5000

export type ApiExpert = { id: string; name: string; rate: number; online: boolean }
export type ApiHealth = { ok: boolean; app: string; version: string }
export type BackendSource = 'live' | 'demo'

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!API_BASE) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS)
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
        id: a.id, name: a.name, title: 'এক্সপার্ট', category: 'স্বাস্থ্য', rate: a.rate,
        rating: 4.8, calls: 0, online: a.online, langs: ['বাংলা'], about: '', avatarColor: '#1877F2'
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

// ---------- অ্যাডমিন সেটিংস (সার্ভার-সাইড কপি) ----------
// SMTP সেটিংস সার্ভারেও পাঠানো হয়, যাতে /api/otp/send মেইল পাঠাতে পারে —
// ব্রাউজারের localStorage সার্ভার পড়তে পারে না। সার্ভারের কপি শুধু মেমোরিতে
// থাকে (Railway রিস্টার্টে মুছে যায়); স্থায়ী উপায় SMTP_* env var।
export type AdminSmtpPayload = { host: string; port: number; user: string; pass: string; from: string }

export async function saveAdminSmtp(smtp: AdminSmtpPayload): Promise<boolean> {
  if (!API_BASE) return false
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}/api/admin/settings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smtp }), signal: ctrl.signal,
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** GET /api/admin/settings — শুধু অবস্থা (চালু/বন্ধ) ফেরে, কোনো গোপন মান নয়। */
export function getAdminSettingsStatus(): Promise<{ smtpConfigured: boolean; smsConfigured: boolean } | null> {
  return fetchJson('/api/admin/settings')
}
