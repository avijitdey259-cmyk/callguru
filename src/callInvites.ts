// PiCall কল ইনভাইট — Firestore-ভিত্তিক (callInvites কালেকশন)।
// পুরোনো presence-WebSocket ইনভাইট পথ বাদ দেওয়া হয়েছে (২০২৬-১১-২৫
// রিবিল্ড): মোবাইল নেটওয়ার্ক/NAT অপেক্ষারত presence সকেট কেটে দিত,
// Railway WS ~৪.৫ মিনিটে ছিঁড়ত, টোকেন ছাড়া (OTP লগইন) ইনভাইট
// যেতই না, আর কলকারী ভুল "Could not connect to the server" দেখত।
// নতুন পথ: কলকারী callInvites-এ একটা ডক লেখে (ringing); গ্রহণকারীর
// অ্যাপ সেই ডক শুনে (onSnapshot) ওভারলে দেখায়; ধরলে/কাটলে স্ট্যাটাস
// বদলায় আর কলকারী তা শুনে কারণসহ দেখে। কোনো presence সকেট নেই,
// কোনো টোকেন-গেটেড ইনভাইট পথ নেই — শুধু Firestore auth (Firebase
// সেশন, OTP লগইনে বেনামি সেশন) লাগে। মিডিয়া সিগন্যালিং (offer/
// answer/ICE) আগের মতোই Railway রুম-WS-এ চলে — সেটা সংযোগের কয়েক
// সেকেন্ডেই শেষ হয়, অপেক্ষার সময় নয়।
// এই মডিউল pure — Firebase/React নেই, তাই node টেস্টে সরাসরি চলে।
// নাম + রং (+ ঐচ্ছিক ছবি/সংখ্যা-UID) ছাড়া কিছু যায় না — ইমেইল/ফোন/
// NID/ব্যালেন্স কখনো ইনভাইট ডকে লেখা হয় না।
import { isValidCallCode, type CallInvite } from './incomingCall'
import { parseFailureReason, type CallFailureReason } from './callFailure'
import { isValidNumericUid } from './numericUid'
import { looksLikeFirebaseUid } from './friendRequests'

export type CallInviteKind = 'friend' | 'expert' | 'dating' | 'service'
export const CALL_INVITE_KINDS: readonly CallInviteKind[] = ['friend', 'expert', 'dating', 'service']

/** ringing → terminal (accepted/declined/…) — একবার terminal হলে আর বদলায় না। */
export type CallInviteStatus = 'ringing' | 'accepted' | 'declined' | 'busy' | 'not-friend' | 'not-accepting' | 'cancelled'
export const CALL_INVITE_STATUSES: readonly CallInviteStatus[] = ['ringing', 'accepted', 'declined', 'busy', 'not-friend', 'not-accepting', 'cancelled']
const TERMINAL_STATUSES: readonly CallInviteStatus[] = ['accepted', 'declined', 'busy', 'not-friend', 'not-accepting', 'cancelled']

export function isCallInviteStatus(v: unknown): v is CallInviteStatus {
  return typeof v === 'string' && (CALL_INVITE_STATUSES as readonly string[]).includes(v)
}

export function isTerminalCallInviteStatus(v: unknown): v is CallInviteStatus {
  return typeof v === 'string' && (TERMINAL_STATUSES as readonly string[]).includes(v)
}

export type CallInviteDoc = {
  id: string
  fromUid: string
  toUid: string
  fromName: string
  fromColour: string
  fromPhoto?: string
  fromNumericUid?: number
  kind: CallInviteKind
  /** ৬ অক্ষরের কল কোড (call-<code> রুমের চাবি) */
  code: string
  status: CallInviteStatus
  createdAtMs: number
}

function cleanAppUid(v: unknown): string | null {
  // অ্যাপ-পরিচয়: Firebase uid, অথবা OTP/লোকাল ব্যবহারকারীর referralCode
  // (cg-xxxxxx)। পারসোনা/সিড id (bd-…/fr-…/f…) এতে আসে না — ওদের
  // ইনভাইট যায় না, লোকাল বন্ধুই থাকে।
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (!t || t.length > 80) return null
  return t
}

function cleanName(name: unknown): string | null {
  if (typeof name !== 'string') return null
  const t = name.trim()
  return t.length >= 1 && t.length <= 60 ? t : null
}

function cleanColour(colour: unknown): string | null {
  return typeof colour === 'string' && colour.trim() !== '' ? colour.trim().slice(0, 20) : null
}

function cleanPhoto(photo: unknown): string | undefined {
  return typeof photo === 'string' && (photo.startsWith('data:image/') || photo.startsWith('https://')) ? photo : undefined
}

// Firestore ডক → যাচাই করা CallInviteDoc; খারাপ/অসম্পূর্ণ ডক null
// (কখনো throw করে না — খারাপ ডক দেখালে অ্যাপ ভাঙবে না)।
export function mapCallInviteDoc(id: string, data: unknown): CallInviteDoc | null {
  if (!id || !data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  const fromUid = cleanAppUid(d.fromUid)
  const toUid = cleanAppUid(d.toUid)
  if (!fromUid || !toUid || fromUid === toUid) return null
  const fromName = cleanName(d.fromName)
  const fromColour = cleanColour(d.fromColour)
  if (!fromName || !fromColour) return null
  if (!isValidCallCode(d.code)) return null
  const kind = d.kind
  if (kind !== 'friend' && kind !== 'expert' && kind !== 'dating' && kind !== 'service') return null
  if (!isCallInviteStatus(d.status)) return null
  if (typeof d.createdAtMs !== 'number' || !Number.isFinite(d.createdAtMs)) return null
  const fromNumericUid = d.fromNumericUid === undefined ? undefined : (isValidNumericUid(d.fromNumericUid) ? d.fromNumericUid : undefined)
  return {
    id,
    fromUid,
    toUid,
    fromName,
    fromColour,
    ...(cleanPhoto(d.fromPhoto) ? { fromPhoto: cleanPhoto(d.fromPhoto) } : {}),
    ...(fromNumericUid !== undefined ? { fromNumericUid } : {}),
    kind,
    code: String(d.code),
    status: d.status,
    createdAtMs: d.createdAtMs,
  }
}

/** Firestore ডক → ওভারলে/গেটিং-এর পুরোনো CallInvite আকৃতি (shouldShowInvite
 *  + ওভারলে রিডিউসার আগের মতোই চলে — শুধু উৎস বদলেছে, presence থেকে Firestore)। */
export function inviteDocToCallInvite(doc: CallInviteDoc): CallInvite {
  return {
    code: doc.code,
    fromId: doc.fromUid,
    fromName: doc.fromName,
    fromColor: doc.fromColour,
    kind: doc.kind,
    at: doc.createdAtMs,
  }
}

/** ইনভাইটের terminal স্ট্যাটাস → কলকারীকে দেখানো কারণ। ringing/accepted/
 *  cancelled-এ কোনো ব্যর্থতা নেই (accepted মানে ধরেছেন, cancelled মানে
 *  কলকারী নিজেই কেটেছেন) — null। */
export function callInviteStatusToFailureReason(status: CallInviteStatus): CallFailureReason | null {
  switch (status) {
    case 'declined': return 'declined'
    case 'busy': return 'busy'
    case 'not-friend': return 'not-friend'
    case 'not-accepting': return 'not-accepting'
    default: return null
  }
}

/** ইনভাইট পাঠানোর পেলোড — কলকারী Firestore-এ লেখে (createCallInvite)।
 *  ভুল আকৃতি হলে null — লেখা হয় না, লিংক-পথ তখনো চলে। */
export function buildCallInvitePayload(input: {
  fromUid: unknown
  toUid: unknown
  fromName: unknown
  fromColour: unknown
  fromPhoto?: unknown
  fromNumericUid?: unknown
  kind: unknown
  code: unknown
}): Omit<CallInviteDoc, 'id' | 'status' | 'createdAtMs'> | null {
  const fromUid = cleanAppUid(input.fromUid)
  const toUid = cleanAppUid(input.toUid)
  if (!fromUid || !toUid || fromUid === toUid) return null
  const fromName = cleanName(input.fromName)
  const fromColour = cleanColour(input.fromColour)
  if (!fromName || !fromColour) return null
  if (!isValidCallCode(input.code)) return null
  const kind = input.kind
  if (kind !== 'friend' && kind !== 'expert' && kind !== 'dating' && kind !== 'service') return null
  const fromNumericUid = input.fromNumericUid === undefined ? undefined : (isValidNumericUid(input.fromNumericUid) ? input.fromNumericUid : undefined)
  return {
    fromUid,
    toUid,
    fromName,
    fromColour,
    ...(cleanPhoto(input.fromPhoto) ? { fromPhoto: cleanPhoto(input.fromPhoto) } : {}),
    ...(fromNumericUid !== undefined ? { fromNumericUid } : {}),
    kind,
    code: String(input.code),
  }
}

/** এই id-তে Firestore ইনভাইট পাঠানো যায় কি না — আসল ব্যবহারকারী
 *  (Firebase uid বা OTP/লোকাল ব্যবহারকারীর cg- referralCode) হলে হ্যাঁ;
 *  পারসোনা (bd-…) বা পুরোনো সিড id (fr-/f-/rq-…) হলে না — ওরা লোকাল
 *  বন্ধু, ওদের কাছে Firestore ইনভাইট যায় না। */
export function isCallableInviteTarget(id: unknown): boolean {
  if (typeof id !== 'string' || !id.trim()) return false
  const t = id.trim()
  if (looksLikeFirebaseUid(t)) return true
  if (/^cg-[a-z0-9]{6}$/.test(t)) return true
  return false
}

/** গেটের কারণ → ইনভাইট ডকে লেখা স্ট্যাটাস (কলকারীকে জানানো হয়)। */
export function gateReasonToInviteStatus(gateReason: string): CallInviteStatus | null {
  switch (gateReason) {
    case 'in-call': return 'busy'
    case 'privacy-nobody': return 'not-accepting'
    case 'privacy-friends': return 'not-friend'
    case 'blocked': return 'not-accepting'
    default: return null
  }
}

// parseFailureReason re-export — কলার-পক্ষের স্ট্যাটাস যাচাইয়ে লাগে
// (Firestore ডকের বাইরে থেকে আসা reason মান যাচাই)।
export { parseFailureReason }
