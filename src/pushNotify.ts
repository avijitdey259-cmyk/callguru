// PiCall Web Push — ইনকামিং কলের নোটিফিকেশন (লক স্ক্রিনেও দেখায়)।
// সৎ সীমা: ওয়েব PWA লক করা স্ক্রিন নিজে থেকে জাগিয়ে অ্যাপ সামনে আনতে
// পারে না — ব্রাউজার তা দেয় না; পুরো ফোন-কলের মতো জাগাতে নেটিভ অ্যাপ
// লাগবে (পরে, যেমন Capacitor + full-screen intent)। যা করা যায়:
// সার্ভিস ওয়ার্কার থেকে Web Push নোটিফিকেশন — লক স্ক্রিনে কলকারীর নাম
// + ধরো/কাটো বোতাম; ধরো-তে ট্যাপ করলে অ্যাপ খুলে সরাসরি কলে ঢোকে।
// পুশ পাঠাতে সার্ভারে VAPID চাবি লাগে (Railway env: VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY, VAPID_SUBJECT) — না থাকলে পুশ চুপচাপ বন্ধ থাকে,
// ইন-অ্যাপ ওভারলে তখনো চলে।
import { API_BASE, API_TIMEOUT_MS, authHeaders } from './api'
import type { CallInvite } from './incomingCall'

export type CallPushPayload = {
  title: string
  body: string
  tag: string
  /** নোটিফিকেশনে ট্যাপ করলে / অ্যাকশনে যা লাগে */
  data: { code: string; fromId: string; fromName: string; url: string }
  actions: { action: 'answer' | 'decline'; title: string }[]
}

/** ইনকামিং কলের পুশ নোটিফিকেশন বানানো (pure — টেস্টে যাচাই করা যায়)। */
export function buildIncomingCallPush(invite: CallInvite): CallPushPayload {
  return {
    title: `📞 ${invite.fromName} is calling`,
    body: 'Tap to answer — PiCall video call',
    tag: `picall-call-${invite.code}`,
    data: { code: invite.code, fromId: invite.fromId, fromName: invite.fromName, url: `/call/${invite.code}` },
    actions: [
      { action: 'answer', title: '📞 Answer' },
      { action: 'decline', title: '❌ Decline' },
    ],
  }
}

export type NotificationClickResult = { kind: 'open'; url: string } | { kind: 'close' }

/**
 * নোটিফিকেশনে ট্যাপ/অ্যাকশনের ফল — service worker (public/sw.js) এটাই মানে:
 *  - 'answer' (বা নোটিফিকেশনের গায়ে ট্যাপ) → অ্যাপ খুলে /call/<code>-এ ঢোকা
 *  - 'decline' → শুধু নোটিফিকেশন বন্ধ (কলকারীকে সার্ভার আলাদা করে জানায়)
 */
export function notificationClickTarget(action: string | undefined, data: { url?: string } | null | undefined): NotificationClickResult {
  if (action === 'decline') return { kind: 'close' }
  const url = typeof data?.url === 'string' && data.url.startsWith('/call/') ? data.url : '/feed'
  return { kind: 'open', url }
}

// ---------- ব্রাউজার-নির্ভর অংশ (নোটিফিকেশন অনুমতি + সাবস্ক্রিপশন) ----------

export type PushStatus = 'unsupported' | 'default' | 'granted' | 'denied'

/** এই ব্রাউজার/ডিভাইসে পুশ নোটিফিকেশন চলে কি না + অনুমতির অবস্থা। */
export function getPushStatus(): { status: PushStatus; subscribed: boolean } {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { status: 'unsupported', subscribed: false }
  }
  return { status: Notification.permission as PushStatus, subscribed: false }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function fetchVapidPublicKey(): Promise<string | null> {
  if (!API_BASE) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}/api/push/vapid-public-key`, { signal: ctrl.signal })
    if (!res.ok) return null
    const data = (await res.json()) as { publicKey?: string }
    return typeof data.publicKey === 'string' && data.publicKey ? data.publicKey : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * কলের নোটিফিকেশন চালু করা — সেটিংসের বোতাম থেকে (ব্যবহারকারীর ট্যাপে) ডাকতে হয়,
 * পেজ লোডে নিজে থেকে অনুমতি চাওয়া হয় না। ফেরে: চালু হলো কি না + কারণ।
 * VAPID চাবি সার্ভারে বসানো না থাকলে 'not-configured' ফেরে — তখন ইন-অ্যাপ
 * ওভারলেই ভরসা।
 */
export async function enableCallPush(userId: string): Promise<{ ok: boolean; reason: string }> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' }
  }
  if (!userId) return { ok: false, reason: 'no-user' }
  let permission: NotificationPermission
  try {
    permission = await Notification.requestPermission()
  } catch {
    return { ok: false, reason: 'denied' }
  }
  if (permission !== 'granted') return { ok: false, reason: 'denied' }
  const vapidKey = await fetchVapidPublicKey()
  if (!vapidKey) return { ok: false, reason: 'not-configured' }
  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource }))
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS)
    try {
      // সার্ভার টোকেনের uid-তেই সাবস্ক্রিপশন বাঁধে — অন্যের userId দিয়ে আর হবে না।
      const res = await fetch(`${API_BASE}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ userId, subscription: sub.toJSON() }),
        signal: ctrl.signal,
      })
      if (!res.ok) return { ok: false, reason: 'subscribe-failed' }
    } finally {
      clearTimeout(timer)
    }
    try { localStorage.setItem('callguru:pushEnabled', '1') } catch { /* ignore */ }
    return { ok: true, reason: 'ok' }
  } catch {
    return { ok: false, reason: 'subscribe-failed' }
  }
}

/** আগে নোটিফিকেশন চালু করা হয়েছিল কি না (এই ডিভাইসে)। */
export function wasPushEnabled(): boolean {
  try { return localStorage.getItem('callguru:pushEnabled') === '1' } catch { return false }
}
