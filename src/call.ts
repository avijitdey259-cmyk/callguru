// PiCall 1-to-1 call client — real peer-to-peer calls over the same Railway
// WebSocket server as Dating Live (separate room map, see server/index.js).
// Call-by-link for now: no real user directory/presence exists yet, so the
// caller shares a link (https://picallbd.web.app/call/<code>) and the callee
// opens it to join the same room. Media is WebRTC peer-to-peer — STUN +
// free shared TURN (OpenRelay, public test credentials, testing only; a paid
// TURN is needed for production). When the backend is unreachable every
// function here returns null and the call page shows a Bangla error —
// the app must never fake a connected call.
import { API_BASE, API_TIMEOUT_MS } from './api'
import { getWsBase, sendSignal, ICE_SERVERS } from './live'
import { INVITE_BASE_URL } from './store'

/** Short call code — 6 chars, no 0/o/1/l so it is easy to read aloud. */
export function makeCallCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let code = ''
  const buf = new Uint32Array(6)
  crypto.getRandomValues(buf)
  for (let i = 0; i < 6; i++) code += alphabet[buf[i] % alphabet.length]
  return code
}

/** Shareable call link the caller sends to the other person. */
export function callLink(code: string): string {
  return `${INVITE_BASE_URL}call/${code}`
}

export type CallInfo = { ok: true; code: string; callerName: string; peers: number }

/** GET /api/call/:code — who is calling, or null when the call does not exist. */
export async function fetchCallInfo(code: string): Promise<CallInfo | null> {
  if (!API_BASE) return null
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS)
  try {
    const res = await fetch(`${API_BASE}/api/call/${encodeURIComponent(code)}`, { signal: ctrl.signal })
    if (!res.ok) return null
    const data = (await res.json()) as CallInfo
    return data && data.ok ? data : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export type CallPeer = { peerId: string; name: string; role: 'caller' | 'callee' }

export type CallSignalHandlers = {
  onOpen?: () => void
  onClose?: () => void
  /** Own server-assigned peer id + the peers already in the room. */
  onJoined?: (peerId: string, peers: CallPeer[]) => void
  onPeerJoined?: (peer: CallPeer) => void
  onOffer?: (from: string, sdp: RTCSessionDescriptionInit) => void
  onAnswer?: (from: string, sdp: RTCSessionDescriptionInit) => void
  onIce?: (from: string, candidate: RTCIceCandidateInit) => void
  onChat?: (from: string, text: string) => void
  onPeerLeft?: (peerId: string) => void
  onCallEnded?: () => void
  onError?: (error: string) => void
}

/** Open a signalling WebSocket for a 1-to-1 call and join it. Null when no backend. */
export function connectCall(code: string, role: 'caller' | 'callee', name: string, h: CallSignalHandlers): WebSocket | null {
  const base = getWsBase()
  if (!base) return null
  const ws = new WebSocket(base)
  ws.onopen = () => {
    try { ws.send(JSON.stringify({ type: 'call-join', roomId: `call-${code}`, role, name })) } catch { /* ignore */ }
    h.onOpen?.()
  }
  ws.onmessage = (ev) => {
    let m: Record<string, unknown>
    try { m = JSON.parse(String(ev.data)) as Record<string, unknown> } catch { return }
    switch (m.type) {
      case 'call-joined': h.onJoined?.(String(m.peerId ?? ''), (Array.isArray(m.peers) ? m.peers : []) as CallPeer[]); break
      case 'peer-joined': h.onPeerJoined?.({ peerId: String(m.peerId ?? ''), name: String(m.name ?? ''), role: ((m.role as string) === 'callee' ? 'callee' : 'caller') }); break
      case 'call-offer': h.onOffer?.(String(m.from ?? ''), m.sdp as RTCSessionDescriptionInit); break
      case 'call-answer': h.onAnswer?.(String(m.from ?? ''), m.sdp as RTCSessionDescriptionInit); break
      case 'call-ice': h.onIce?.(String(m.from ?? ''), m.candidate as RTCIceCandidateInit); break
      case 'call-chat': h.onChat?.(String(m.from ?? ''), String(m.text ?? '')); break
      case 'peer-left': h.onPeerLeft?.(String(m.peerId ?? '')); break
      case 'call-ended': h.onCallEnded?.(); break
      case 'call-error': h.onError?.(String(m.error ?? 'failed')); break
      default: break
    }
  }
  ws.onclose = () => h.onClose?.()
  ws.onerror = () => { /* onclose follows */ }
  return ws
}

/** Send a call signalling message if the socket is open; otherwise a no-op. */
export function sendCallSignal(ws: WebSocket | null, msg: unknown): void {
  sendSignal(ws, msg)
}

/** A peer connection for a 1-to-1 call — STUN + free shared TURN (testing only). */
export function createCallPeerConnection(onRemoteStream: (stream: MediaStream) => void): RTCPeerConnection {
  const pc = new RTCPeerConnection(ICE_SERVERS)
  pc.ontrack = (ev) => {
    const s = ev.streams[0]
    if (s) onRemoteStream(s)
  }
  return pc
}
