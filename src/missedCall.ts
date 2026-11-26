// PiCall মিসড কল — pure helpers (Firebase/React নেই, node টেস্টে সরাসরি চলে)।
// নিয়ম (মালিক, ২০২৬-১১-২৬ "miss call rako"):
//  - গ্রহণকারীর জন্য MISSED হয় যখন: উত্তর না আসায় টাইমার শেষ, গ্রহণকারী
//    কাটলেন, বা ইনভাইট পাঠানোর সময় গ্রহণকারী অফলাইন ছিলেন। কলকারী
//    ইনভাইট যাওয়ার আগেই কাটলে মিসড নয়; বাজতে থাকা অবস্থায় কাটলে মিসড।
//  - ব্লক/বন্ধু-নয়/প্রাইভেসিতে আটকে যে কল কখনো বাজেনি, সেটা মিসড নয় —
//    ওই ইনভাইটগুলোর স্ট্যাটাস 'busy'/'not-friend'/'not-accepting' হয়,
//    'declined'/'cancelled' হয় না, তাই স্ট্যাটাসই ছাঁকনি।
//  - রেকর্ড CallRecord আকৃতিতেই থাকে (status 'Missed', খরচ π 0) —
//    id `missed-<inviteId>` বলে একই কল দুবার লিখলেও ডুপ্লিকেট হয় না।
//  - গ্রহণকারীর নাম নয় — কলকারীর নাম + সময় দেখায়; peerId দিয়ে সঠিক
//    মানুষটিতে কল-ব্যাক/চ্যাট খোলে।
import type { CallInviteDoc, CallInviteKind } from './callInvites'

/** মিসড কল বোঝায় এমন ইনভাইট স্ট্যাটাস (বাজা কলের পরের অবস্থা)। */
export const MISSED_CALL_INVITE_STATUSES: readonly string[] = ['declined', 'cancelled']

export function isMissedCallInviteStatus(status: string): boolean {
  return status === 'declined' || status === 'cancelled'
}

/** একই কলের মিসড এন্ট্রির নির্ধারিত id — দুবার লিখলেও একই id। */
export function missedCallId(inviteId: string): string {
  return `missed-${inviteId}`
}

export type MissedCallRecord = {
  id: string
  peerId?: string
  name: string
  type: 'Expert' | 'Friend' | 'Dating' | 'Service'
  rate: number
  durationSec: number
  cost: number
  freeMinute: boolean
  time: string
  status: 'Completed' | 'Missed' | 'Auto-cut'
}

function inviteKindToCallType(kind: CallInviteKind): MissedCallRecord['type'] {
  if (kind === 'dating') return 'Dating'
  if (kind === 'service') return 'Service'
  if (kind === 'expert') return 'Expert'
  return 'Friend'
}

/**
 * ইনভাইট ডক → মিসড-কল রেকর্ড। শর্ত না মিললে null:
 *  - toUid আমি না হলে (অন্যের কল আমার তালিকায় নয়)
 *  - স্ট্যাটাস 'declined'/'cancelled' না হলে (বাজেনি/ধরেছেন/ব্যস্ত/বন্ধু নয়)
 *  - fromUid খালি হলে বা নাম না থাকলে
 * খরচ সবসময় ০ — মিসড কলে টাকা কাটে না।
 */
export function inviteToMissedCall(
  doc: CallInviteDoc,
  meUid: string,
  rate: number,
): MissedCallRecord | null {
  if (!doc || doc.toUid !== meUid) return null
  if (!isMissedCallInviteStatus(doc.status)) return null
  if (!doc.fromUid || !doc.fromName.trim()) return null
  return {
    id: missedCallId(doc.id),
    peerId: doc.fromUid,
    name: doc.fromName.trim(),
    type: inviteKindToCallType(doc.kind),
    rate,
    durationSec: 0,
    cost: 0,
    freeMinute: false,
    time: new Date(doc.createdAtMs).toLocaleString('en-GB'),
    status: 'Missed',
  }
}

/** মিসড রেকর্ডগুলো আগের তালিকায় মেশানো — id দিয়ে ডুপ্লিকেট বাদ, নতুনগুলো উপরে। */
export function mergeMissedCalls<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map((c) => c.id))
  const fresh = incoming.filter((c) => !seen.has(c.id))
  if (fresh.length === 0) return existing
  return [...fresh, ...existing]
}

/** একজনের (peerId বা নামে) মিসড কলগুলো — চ্যাট থ্রেডের কার্ডের জন্য। */
export function missedCallsOf<T extends { status: string; peerId?: string; name: string }>(
  calls: T[],
  peerIdOrName?: string,
): T[] {
  return calls.filter(
    (c) =>
      c.status === 'Missed' &&
      (!peerIdOrName || c.peerId === peerIdOrName || c.name === peerIdOrName),
  )
}

/** এখনো না-দেখা মিসড কলের সংখ্যা — ব্যাজের জন্য। */
export function unseenMissedCount<T extends { id: string; status: string }>(
  calls: T[],
  seenIds: string[],
): number {
  const seen = new Set(seenIds)
  return calls.filter((c) => c.status === 'Missed' && !seen.has(c.id)).length
}

/** মিসড কলগুলো "দেখা" হিসেবে চিহ্নিত — সবগুলো, বা একজনের (peerId/নাম) গুলো। */
export function markMissedSeenIds<T extends { id: string; status: string; peerId?: string; name: string }>(
  seenIds: string[],
  calls: T[],
  peerIdOrName?: string,
): string[] {
  const seen = new Set(seenIds)
  for (const c of calls) {
    if (c.status === 'Missed' && (!peerIdOrName || c.peerId === peerIdOrName || c.name === peerIdOrName)) {
      seen.add(c.id)
    }
  }
  return [...seen]
}
