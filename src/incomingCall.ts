// PiCall ইনকামিং কল — হোম পেজে কল এলে ওভারলে + গেটিং লজিক।
// কল-বাই-লিংকের ওপরে: কলকারী বন্ধুকে কল দিলে (CallPage) একটা 'call-invite'
// পাঠান; গ্রহণকারীর অ্যাপে (হোম পেজ সহ যেকোনো পেজে) এই মডিউলের নিয়মে
// ওভারলে ওঠে। ডেমো/ভুয়া কল কখনো বানানো হয় না — ইনভাইট শুধু আসল
// WebSocket সিগন্যালিং (src/presence.ts) থেকে আসে।
// রিংটোন এই মডিউলে বাজে না — ওভারলে হোস্ট (IncomingCallOverlay.tsx)
// শেয়ার্ড সাউন্ড ইঞ্জিন (src/sounds.ts) দিয়ে বাজায়, সেটিংস মেনে।

export type CallPrivacy = 'everyone' | 'friends' | 'nobody'

/** ডিফল্ট: শুধু বন্ধুরা কল দিতে পারেন — অচেনা কেউ হুট করে রিং করাতে পারবে না। */
export const DEFAULT_CALL_PRIVACY: CallPrivacy = 'friends'

export const CALL_PRIVACY_LABELS: Record<CallPrivacy, string> = {
  everyone: 'Everyone can call me',
  friends: 'Only friends can call me',
  nobody: 'Nobody can call me',
}

/** সংরক্ষিত মান যাচাই করে নেওয়া — পুরোনো/অসম্পূর্ণ ডেটাতেও নিরাপদ। */
export function loadCallPrivacy(raw: unknown): CallPrivacy {
  if (raw === 'everyone' || raw === 'friends' || raw === 'nobody') return raw
  return DEFAULT_CALL_PRIVACY
}

/** একটা ইনকামিং কলের আমন্ত্রণ — কলকারী পাঠান, গ্রহণকারী দেখেন। */
export type CallInvite = {
  /** ৬ অক্ষরের কল কোড (call-<code> রুমের চাবি) */
  code: string
  /** কলকারীর ইউজার আইডি (Firebase uid, না থাকলে referralCode) */
  fromId: string
  /** কলকারীর নাম (৬০ অক্ষরের মধ্যে) */
  fromName: string
  /** কলকারীর অবতার রং (না থাকলে fromId থেকে বানানো হয়) */
  fromColor?: string
  /** কী ধরনের কল — ইনভাইট শুধু বন্ধুর কলে পাঠানো হয় */
  kind: 'friend' | 'expert' | 'dating' | 'link' | 'service'
  /** পাঠানোর সময় (ms epoch) — ৬০ সেকেন্ডের বেশি পুরোনো ইনভাইট মেয়াদোত্তীর্ণ */
  at: number
}

/** ইনভাইটের মেয়াদ — রিংটোনও সর্বোচ্চ ৬০ সেকেন্ড বাজে (সাউন্ড ইঞ্জিনের নিয়ম)। */
export const INVITE_TTL_MS = 60000

export function isInviteExpired(invite: CallInvite, now: number = Date.now()): boolean {
  return now - invite.at > INVITE_TTL_MS
}

/** কল কোডের আকৃতি — makeCallCode-র ৬ অক্ষর (0/o/1/l নেই)। */
export function isValidCallCode(code: unknown): code is string {
  return typeof code === 'string' && /^[a-z0-9]{6}$/i.test(code)
}

/** presence সকেটে পাঠানোর মেসেজ বানানো (pure — টেস্টে যাচাই করা যায়)। */
export function buildInviteMessage(invite: Omit<CallInvite, 'at'> & { to: string }): Record<string, unknown> {
  return {
    type: 'call-invite',
    to: invite.to,
    code: invite.code,
    fromId: invite.fromId,
    fromName: invite.fromName.slice(0, 60),
    fromColor: invite.fromColor ?? '',
    kind: invite.kind,
  }
}

/** সার্ভার থেকে আসা মেসেজ যাচাই করে ইনভাইট বানানো — ভুল আকৃতি হলে null। */
export function parseInviteMessage(raw: unknown): CallInvite | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as Record<string, unknown>
  if (m.type !== 'call-invite') return null
  if (!isValidCallCode(m.code)) return null
  if (typeof m.fromId !== 'string' || !m.fromId.trim()) return null
  if (typeof m.fromName !== 'string' || !m.fromName.trim()) return null
  const kind = m.kind === 'friend' || m.kind === 'expert' || m.kind === 'dating' || m.kind === 'link' || m.kind === 'service' ? m.kind : 'friend'
  return {
    code: String(m.code),
    fromId: String(m.fromId),
    fromName: String(m.fromName).slice(0, 60),
    fromColor: typeof m.fromColor === 'string' && m.fromColor ? String(m.fromColor) : undefined,
    kind,
    at: typeof m.at === 'number' ? m.at : Date.now(),
  }
}

export type InviteGate = {
  show: boolean
  /** কেন দেখানো হলো না — 'ok' মানে দেখানো যাবে */
  reason: 'ok' | 'self' | 'in-call' | 'privacy-nobody' | 'privacy-friends' | 'expired' | 'blocked'
}

/**
 * ইনভাইট দেখানো যাবে কি না — এক জায়গায় সব শর্ত:
 *  - নিজের নিজেকে কল নয়; চলমান কলে থাকলে নয়; মেয়াদোত্তীর্ণ নয়;
 *  - ব্লক করা কলকারী হলে কখনো নয় (ওভারলে ওঠে না, রিংটোন বাজে না);
 *  - 'nobody' হলে কেউ না; 'friends' হলে শুধু বন্ধু; 'everyone' হলে সবাই।
 */
export function shouldShowInvite(
  invite: CallInvite,
  opts: { privacy: CallPrivacy; isFriend: boolean; inCall: boolean; selfId: string | null; isBlocked?: boolean; now?: number },
): InviteGate {
  if (opts.selfId && invite.fromId === opts.selfId) return { show: false, reason: 'self' }
  if (opts.inCall) return { show: false, reason: 'in-call' }
  if (isInviteExpired(invite, opts.now ?? Date.now())) return { show: false, reason: 'expired' }
  if (opts.isBlocked) return { show: false, reason: 'blocked' }
  if (opts.privacy === 'nobody') return { show: false, reason: 'privacy-nobody' }
  if (opts.privacy === 'friends' && !opts.isFriend) return { show: false, reason: 'privacy-friends' }
  return { show: true, reason: 'ok' }
}

/** ওভারলের অবস্থা — একসঙ্গে একটাই ইনকামিং কল দেখায়। */
export type InviteOverlayState =
  | { status: 'idle' }
  | { status: 'ringing'; invite: CallInvite }
  | { status: 'accepted'; invite: CallInvite }
  | { status: 'declined'; invite: CallInvite }

export function idleOverlayState(): InviteOverlayState {
  return { status: 'idle' }
}

/** নতুন ইনভাইট এলে আগেরটা (যদি থাকে) সরিয়ে এটাই বাজে — শেষের কলটাই জেতে। */
export function reduceInviteArrived(_state: InviteOverlayState, invite: CallInvite): InviteOverlayState {
  return { status: 'ringing', invite }
}

export function reduceInviteAnswered(state: InviteOverlayState): InviteOverlayState {
  return state.status === 'ringing' ? { status: 'accepted', invite: state.invite } : state
}

export function reduceInviteDeclined(state: InviteOverlayState): InviteOverlayState {
  return state.status === 'ringing' ? { status: 'declined', invite: state.invite } : state
}

export function reduceInviteCleared(_state: InviteOverlayState): InviteOverlayState {
  return { status: 'idle' }
}
