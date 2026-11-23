// PiCall presence — লগইন থাকলে হালকা একটা WebSocket খোলা থাকে, যাতে
// কলকারী বন্ধুকে 'call-invite' পাঠাতে পারেন আর গ্রহণকারীর হোম পেজে
// ইনকামিং-কল ওভারলে উঠতে পারে। কল-বাই-লিংক আগের মতোই চলে — ইনভাইট না
// পৌঁছালেও শেয়ার লিংক খুলে কল ধরা যায়।
// সার্ভার (server/index.js) presence-register দিয়ে userId -> সকেট মনে রাখে;
// ব্যাকএন্ড না থাকলে সব ফাংশন চুপচাপ null/false ফেরে — অ্যাপ কখনো ভাঙে না।
import { getWsBase, sendSignal } from './live'
import { buildInviteMessage, parseInviteMessage, type CallInvite } from './incomingCall'
import { getIdToken } from './firebase'

export type PresenceHandlers = {
  onInvite?: (invite: CallInvite) => void
  /** কলকারী পান: গ্রহণকারী ধরলেন না কাটলেন (code মিলিয়ে দেখা হয়)। */
  onInviteResponse?: (res: { code: string; accepted: boolean; fromId: string }) => void
  onOpen?: () => void
  onClose?: () => void
}

/** presence-register মেসেজ — সার্ভার টোকেন যাচাই করে uid বাঁধে, তারপর
 *  এই userId-তে ইনভাইট পৌঁছে দেয়। টোকেন ছাড়া রেজিস্টার হয় না। */
export function buildPresenceRegister(userId: string, name: string, idToken?: string): Record<string, unknown> {
  return { type: 'presence-register', userId, name: name.slice(0, 60), ...(idToken ? { idToken } : {}) }
}

/** সার্ভার থেকে আসা presence মেসেজের ধরন চেনা (pure)। */
export function parsePresenceMessage(raw: unknown): { kind: 'invite'; invite: CallInvite } | { kind: 'invite-response'; code: string; accepted: boolean; fromId: string } | { kind: 'registered' } | { kind: 'unauthorized' } | { kind: 'invite-sent'; to: string; delivered: boolean; pushed: boolean } | { kind: 'unknown' } {
  if (!raw || typeof raw !== 'object') return { kind: 'unknown' }
  const m = raw as Record<string, unknown>
  if (m.type === 'presence-error') return { kind: 'unauthorized' }
  if (m.type === 'call-invite') {
    const invite = parseInviteMessage(m)
    return invite ? { kind: 'invite', invite } : { kind: 'unknown' }
  }
  if (m.type === 'call-invite-response') {
    if (typeof m.code !== 'string' || typeof m.accepted !== 'boolean') return { kind: 'unknown' }
    return { kind: 'invite-response', code: m.code, accepted: m.accepted, fromId: typeof m.fromId === 'string' ? m.fromId : '' }
  }
  if (m.type === 'presence-registered') return { kind: 'registered' }
  if (m.type === 'call-invite-sent') {
    return { kind: 'invite-sent', to: typeof m.to === 'string' ? m.to : '', delivered: m.delivered === true, pushed: m.pushed === true }
  }
  return { kind: 'unknown' }
}

// ---------- শেয়ার্ড presence সকেট (একটাই সংযোগ; হোস্ট + CallPage দুজনেই ব্যবহার করে) ----------

let sharedWs: WebSocket | null = null
let sharedUserId: string | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let wantConnected = false
const inviteResponseListeners = new Set<(res: { code: string; accepted: boolean; fromId: string }) => void>()

/** CallPage (কলকারী) এখানে শোনেন — গ্রহণকারী ধরলেন না কাটলেন। */
export function onInviteResponse(cb: (res: { code: string; accepted: boolean; fromId: string }) => void): () => void {
  inviteResponseListeners.add(cb)
  return () => { inviteResponseListeners.delete(cb) }
}

/**
 * বন্ধুকে কল দেওয়ার আমন্ত্রণ পাঠানো — CallPage-র startCall থেকে ডাকা হয়।
 * presence সকেট না থাকলে (ব্যাকএন্ড নেই/অফলাইন) false ফেরে; শেয়ার লিংক তখনো কাজ করে।
 */
export function sendCallInvite(to: string, invite: Omit<CallInvite, 'at'>): boolean {
  if (!sharedWs || sharedWs.readyState !== WebSocket.OPEN) return false
  if (!to || !to.trim()) return false
  sendSignal(sharedWs, buildInviteMessage({ ...invite, to }))
  return true
}

/** ইনভাইটের উত্তর পাঠানো — ধরলে accepted=true, কাটলে false। */
export function sendInviteResponse(to: string, code: string, accepted: boolean): boolean {
  if (!sharedWs || sharedWs.readyState !== WebSocket.OPEN) return false
  if (!to || !to.trim() || !code) return false
  sendSignal(sharedWs, { type: 'call-invite-response', to, code, accepted })
  return true
}

export function isPresenceConnected(): boolean {
  return !!sharedWs && sharedWs.readyState === WebSocket.OPEN
}

function clearReconnectTimer() {
  if (reconnectTimer !== null) { clearTimeout(reconnectTimer); reconnectTimer = null }
}

/**
 * লগইন থাকলে presence সকেট খোলা — হোস্ট (IncomingCallHost) থেকে একবারই ডাকা হয়।
 * সংযোগ ছিঁড়ে গেলে নিজে থেকে আবার চেষ্টা করে (২ সেকেন্ড থেকে ৩০ সেকেন্ড পর্যন্ত)।
 * close() ডাকলে আর চেষ্টা করে না। ব্যাকএন্ড না থাকলে null ফেরে।
 */
export function connectPresence(
  userId: string,
  name: string,
  h: PresenceHandlers,
): { close: () => void; sendInvite: typeof sendCallInvite; sendResponse: typeof sendInviteResponse } | null {
  const base = getWsBase()
  if (!base || !userId) return null
  // একই ইউজারের সংযোগ থাকলে নতুন করে খোলা হয় না
  if (sharedWs && sharedUserId === userId && sharedWs.readyState <= 1) {
    return { close: disconnectPresence, sendInvite: sendCallInvite, sendResponse: sendInviteResponse }
  }
  if (sharedWs) { try { sharedWs.close() } catch { /* ignore */ } sharedWs = null }
  wantConnected = true
  sharedUserId = userId
  let attempt = 0

  const open = () => {
    if (!wantConnected) return
    let ws: WebSocket
    try { ws = new WebSocket(base) } catch { scheduleReconnect(); return }
    sharedWs = ws
    ws.onopen = () => {
      attempt = 0
      // টোকেন নিয়ে রেজিস্টার — সার্ভার টোকেনের uid-তেই ইনভাইট পাঠায়।
      getIdToken()
        .then((token) => {
          try { ws.send(JSON.stringify(buildPresenceRegister(userId, name, token ?? undefined))) } catch { /* ignore */ }
        })
        .catch(() => { /* টোকেন না থাকলে রেজিস্টার ছাড়াই খোলা থাকে */ })
      h.onOpen?.()
    }
    ws.onmessage = (ev) => {
      let m: unknown
      try { m = JSON.parse(String(ev.data)) } catch { return }
      const parsed = parsePresenceMessage(m)
      if (parsed.kind === 'invite') h.onInvite?.(parsed.invite)
      else if (parsed.kind === 'invite-response') {
        for (const cb of inviteResponseListeners) { try { cb(parsed) } catch { /* ignore */ } }
        h.onInviteResponse?.(parsed)
      }
    }
    ws.onclose = () => {
      if (sharedWs === ws) sharedWs = null
      h.onClose?.()
      scheduleReconnect()
    }
    ws.onerror = () => { /* onclose অনুসরণ করে */ }
  }
  const scheduleReconnect = () => {
    if (!wantConnected) return
    clearReconnectTimer()
    const delay = Math.min(30000, 2000 * Math.pow(2, attempt++))
    reconnectTimer = setTimeout(open, delay)
  }
  open()
  return { close: disconnectPresence, sendInvite: sendCallInvite, sendResponse: sendInviteResponse }
}

/** presence সকেট বন্ধ করা (লগআউট/আনমাউন্ট) — আর পুনঃসংযোগ নয়। */
export function disconnectPresence(): void {
  wantConnected = false
  clearReconnectTimer()
  if (sharedWs) { try { sharedWs.close() } catch { /* ignore */ } sharedWs = null }
  sharedUserId = null
}
