// CallGuru live client — talks to the self-hosted live server (same Railway
// service as the REST API). WebSocket URL is derived from VITE_API_URL
// (https -> wss, http -> ws). When the backend is unreachable, every function
// here returns null / false and the live pages fall back to their demo
// behaviour — the app must never crash or show a blank page.
// Media is WebRTC peer-to-peer (mesh): the host sends one stream per viewer.
// STUN only (Google, free, no key) — no TURN yet, so some strict NATs / mobile
// networks may fail to connect. Small audience (roughly 5-8 viewers); a big
// audience needs an SFU later.
import { API_BASE, API_TIMEOUT_MS } from './api'

export type LiveRoom = { id: string; hostName: string; title: string; viewers: number; startedAt: number }

export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
}

/** wss://... base for the live server, or null when no backend is configured. */
export function getWsBase(): string | null {
  if (!API_BASE) return null
  try {
    const u = new URL(API_BASE)
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    return u.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

async function liveFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
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

/** GET /api/live — null when the backend is unreachable. */
export function fetchLiveRooms(): Promise<LiveRoom[] | null> {
  return liveFetch<LiveRoom[]>('/api/live')
}

/** POST /api/live — null when the backend is unreachable. */
export function createLiveRoom(hostName: string, title: string): Promise<LiveRoom | null> {
  return liveFetch<LiveRoom>('/api/live', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hostName, title })
  })
}

/** DELETE /api/live/:id — best effort, failures are ignored. */
export async function endLiveRoom(id: string): Promise<void> {
  await liveFetch(`/api/live/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export type LiveGift = { icon: string; name: string; price: number }

export type LiveSignalHandlers = {
  onOpen?: () => void
  onClose?: () => void
  /** Viewer gets its server-assigned id here; host gets null. */
  onJoined?: (viewerId: string | null, viewers: number) => void
  onOffer?: (from: string, sdp: RTCSessionDescriptionInit) => void
  onAnswer?: (from: string, sdp: RTCSessionDescriptionInit) => void
  onIce?: (from: string, candidate: RTCIceCandidateInit) => void
  onViewerCount?: (viewers: number) => void
  onGift?: (from: string, gift: LiveGift) => void
  onChat?: (from: string, text: string) => void
  onHostLeft?: () => void
}

/** Open a signalling WebSocket for a room and join it. Null when no backend. */
export function connectLive(roomId: string, role: 'host' | 'viewer', name: string, h: LiveSignalHandlers): WebSocket | null {
  const base = getWsBase()
  if (!base) return null
  const ws = new WebSocket(base)
  ws.onopen = () => {
    try { ws.send(JSON.stringify({ type: 'join', roomId, role, name })) } catch { /* ignore */ }
    h.onOpen?.()
  }
  ws.onmessage = (ev) => {
    let m: Record<string, unknown>
    try { m = JSON.parse(String(ev.data)) as Record<string, unknown> } catch { return }
    switch (m.type) {
      case 'joined': h.onJoined?.((m.viewerId as string | null) ?? null, (m.viewers as number) ?? 0); break
      case 'offer': h.onOffer?.(String(m.from ?? ''), m.sdp as RTCSessionDescriptionInit); break
      case 'answer': h.onAnswer?.(String(m.from ?? ''), m.sdp as RTCSessionDescriptionInit); break
      case 'ice': h.onIce?.(String(m.from ?? ''), m.candidate as RTCIceCandidateInit); break
      case 'viewer-count': h.onViewerCount?.((m.viewers as number) ?? 0); break
      case 'gift': h.onGift?.(String(m.from ?? ''), m.gift as LiveGift); break
      case 'chat': h.onChat?.(String(m.from ?? ''), String(m.text ?? '')); break
      case 'host-left': h.onHostLeft?.(); break
      default: break
    }
  }
  ws.onclose = () => h.onClose?.()
  ws.onerror = () => { /* onclose follows; demo fallback handles it */ }
  return ws
}

/** Send a signalling message if the socket is open; otherwise a no-op. */
export function sendSignal(ws: WebSocket | null, msg: unknown): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return
  try { ws.send(JSON.stringify(msg)) } catch { /* ignore */ }
}
