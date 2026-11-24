// Pi ট্রান্সফার — ব্যবহারকারী থেকে ব্যবহারকারী Pi পাঠানো (২% ফি, UID দিয়ে)।
// Pure মডিউল — Firebase/React নেই, তাই node টেস্টে সরাসরি চলে।
// টাকার প্রবাহ (মালিকের নিয়ম):
//   - পাঠানো যায় শুধু আসল piBalance থেকে — বোনাস Pi / গিফট Pi কখনো নয়
//   - পাঠানোর পরিমাণ পুরোটাই পাঠকের ব্যালেন্স থেকে কমে; প্রাপক পায় ৯৮%,
//     বাকি ২% অ্যাডমিনের (ফি); ফি% আর সর্বনিম্ন ট্রান্সফার অ্যাডমিন-নিয়ন্ত্রিত
//   - পাঠাতে অনুমোদিত KYC লাগে (তোলার মতোই); প্রাপকের KYC লাগে না
//   - রেকর্ড অপরিবর্তনীয়: piTransfers ডকই সত্য — প্রাপক/অ্যাডমিনের ব্যালেন্সে
//     জমা হয় সেই ডক থেকে (নিজের ডিভাইসে), তাই অন্যের ডক কেউ লিখতে পারে না
//     আর নিয়ম ভাঙা যায় না। খতিয়ানের সারির id-তেই ট্রান্সফারের id থাকে,
//     তাই একই ট্রান্সফার দুবার জমা হয় না।
import { roundPi } from './data'
import { isValidNumericUid } from './numericUid'

export const DEFAULT_TRANSFER_FEE_PCT = 2
export const DEFAULT_MIN_TRANSFER_PI = 0.1
export const TRANSFER_FEE_PCT_MAX = 10
export const MIN_TRANSFER_PI_MIN = 0.01
export const MIN_TRANSFER_PI_MAX = 100

// অ্যাডমিনের Auth UID — ফি যাঁর users ডকে জমা হয় (avijitdey259@gmail.com)।
// গোপন কিছু নয় — পাবলিক প্রোফাইলের UID-র মতোই পরিচয় মাত্র।
export const ADMIN_UID = 'LXnGL8xA6VW8Gp7hvCaoakOha822'

// ফি% যাচাই — ০–১০% (এক দশমিক পর্যন্ত)
export function cleanTransferFeePct(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n < 0 || n > TRANSFER_FEE_PCT_MAX) return null
  return Math.round(n * 10) / 10
}

export function isValidTransferFeePct(v: unknown): v is number {
  return cleanTransferFeePct(v) !== null
}

// সর্বনিম্ন ট্রান্সফার যাচাই — ০.০১–১০০ π
export function cleanMinTransfer(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n < MIN_TRANSFER_PI_MIN || n > MIN_TRANSFER_PI_MAX) return null
  return roundPi(n)
}

// হিসাব — ফি = পরিমাণ × ফি%; প্রাপক পায় বাকিটা; ফি + প্রাপক = পরিমাণ (ঠিক মেলে)
export function computeTransfer(amount: number, feePct: number): { amount: number; fee: number; net: number } {
  const a = roundPi(amount)
  const fee = roundPi(a * (feePct / 100))
  const net = roundPi(a - fee)
  return { amount: a, fee, net }
}

// পাঠানোর আগে যাচাই — ভুল হলে বাংলায় কারণ, ঠিক হলে null
export function validateTransferInput(input: {
  amount: number
  balance: number
  minTransfer: number
  kycApproved: boolean
  isSelf: boolean
}): string | null {
  if (!input.kycApproved) return 'Pi send needs approved KYC — complete Dating KYC first.'
  if (!Number.isFinite(input.amount) || input.amount <= 0) return 'Enter a valid amount.'
  if (input.amount < input.minTransfer) return `Minimum transfer: ${input.minTransfer} π.`
  if (input.isSelf) return 'You cannot send Pi to yourself.'
  if (input.amount > input.balance) return 'Not enough Pi balance — only real Pi can be sent, bonus Pi cannot be transferred.'
  return null
}

export type PiTransferRole = 'sent' | 'received' | 'fee'

// piTransfers ডক — একবার লেখা হলে আর বদলায় না (নিয়মে update/delete বন্ধ)।
// kind 'admin' মানে অ্যাডমিনের ম্যানুয়াল পাঠানো — ফি ০%, প্রাপক পুরোটাই
// পায়, পাঠানো হয় অ্যাডমিনের নিজের ব্যালেন্স থেকে (কোনো Pi বানানো হয় না)।
export type PiTransferDoc = {
  id: string
  fromUid: string
  toUid: string
  adminUid: string
  fromName: string
  toName: string
  fromNumericUid?: number
  toNumericUid?: number
  amount: number
  fee: number
  net: number
  feePct: number
  kind?: 'admin'
  note?: string
  participants: string[]
  status: 'completed'
  createdAtMs: number
}

function toCreatedAtMs(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (v && typeof v === 'object') {
    const o = v as { seconds?: unknown; _seconds?: unknown; toMillis?: unknown }
    if (typeof o.seconds === 'number') return o.seconds * 1000
    if (typeof o._seconds === 'number') return o._seconds * 1000
    if (typeof o.toMillis === 'function') return (o.toMillis as () => number)()
  }
  return 0
}

// Firestore ডক → যাচাই করা PiTransferDoc; খারাপ/অসম্পূর্ণ ডক null
export function mapPiTransferDoc(id: string, data: unknown): PiTransferDoc | null {
  if (!id || !data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (typeof d.fromUid !== 'string' || !d.fromUid) return null
  if (typeof d.toUid !== 'string' || !d.toUid) return null
  if (d.fromUid === d.toUid) return null
  if (typeof d.amount !== 'number' || !Number.isFinite(d.amount) || d.amount <= 0) return null
  if (typeof d.fee !== 'number' || !Number.isFinite(d.fee) || d.fee < 0 || d.fee > d.amount) return null
  if (typeof d.net !== 'number' || !Number.isFinite(d.net) || d.net < 0) return null
  if (roundPi(d.fee + d.net) !== roundPi(d.amount)) return null
  const feePct = typeof d.feePct === 'number' ? d.feePct : DEFAULT_TRANSFER_FEE_PCT
  if (!isValidTransferFeePct(feePct)) return null
  const fromName = typeof d.fromName === 'string' && d.fromName.trim() ? d.fromName.trim().slice(0, 80) : 'User'
  const toName = typeof d.toName === 'string' && d.toName.trim() ? d.toName.trim().slice(0, 80) : 'User'
  const participants = Array.isArray(d.participants)
    ? [...new Set(d.participants.filter((x): x is string => typeof x === 'string' && x !== ''))]
    : [d.fromUid as string, d.toUid as string]
  const fromNumericUid = isValidNumericUid(d.fromNumericUid) ? (d.fromNumericUid as number) : undefined
  const toNumericUid = isValidNumericUid(d.toNumericUid) ? (d.toNumericUid as number) : undefined
  const kind = d.kind === 'admin' ? ('admin' as const) : undefined
  const note = typeof d.note === 'string' && d.note.trim() ? d.note.trim().slice(0, 200) : undefined
  return {
    id,
    fromUid: d.fromUid as string,
    toUid: d.toUid as string,
    adminUid: typeof d.adminUid === 'string' && d.adminUid ? (d.adminUid as string) : ADMIN_UID,
    fromName,
    toName,
    ...(fromNumericUid !== undefined ? { fromNumericUid } : {}),
    ...(toNumericUid !== undefined ? { toNumericUid } : {}),
    amount: roundPi(d.amount as number),
    fee: roundPi(d.fee as number),
    net: roundPi(d.net as number),
    feePct,
    ...(kind !== undefined ? { kind } : {}),
    ...(note !== undefined ? { note } : {}),
    participants,
    status: 'completed',
    createdAtMs: toCreatedAtMs(d.createdAt),
  }
}

// এই ট্রান্সফারে আমার ভূমিকা — পাঠক / প্রাপক / ফি-প্রাপক (অ্যাডমিন); একই
// ট্রান্সফারে একাধিক ভূমিকা হতে পারে (যেমন অ্যাডমিন নিজে পাঠালে পাঠক + ফি)
export function transferRoles(t: PiTransferDoc, myUid: string): PiTransferRole[] {
  const roles: PiTransferRole[] = []
  if (t.fromUid === myUid) roles.push('sent')
  if (t.toUid === myUid) roles.push('received')
  if (t.adminUid === myUid && t.fee > 0) roles.push('fee')
  return roles
}

// খতিয়ানের সারির id — ট্রান্সফারের id-তেই বাঁধা, তাই দুবার জমা হয় না
export function transferLedgerRowId(transferId: string, role: PiTransferRole): string {
  return role === 'sent' ? `tr-${transferId}` : role === 'received' ? `tr-${transferId}-in` : `tr-${transferId}-fee`
}

// এক ভূমিকার জমা — ব্যালেন্সে কত যোগ/বাদ আর খতিয়ানে কী লাইন পড়বে
export function buildTransferApplication(t: PiTransferDoc, role: PiTransferRole): { delta: number; row: { id: string; date: string; type: string; label: string; amount: number } } {
  const date = t.createdAtMs ? new Date(t.createdAtMs).toLocaleString('en-GB') : new Date().toLocaleString('en-GB')
  if (role === 'sent') {
    const label = t.kind === 'admin'
      ? `Sent by Admin to ${t.toName}${t.toNumericUid !== undefined ? ` (ID ${t.toNumericUid})` : ''}${t.note ? ` — ${t.note}` : ''}`
      : `Sent to ${t.toName}${t.toNumericUid !== undefined ? ` (ID ${t.toNumericUid})` : ''} — fee π ${t.fee} • they get π ${t.net}`
    return {
      delta: -t.amount,
      row: { id: transferLedgerRowId(t.id, 'sent'), date, type: 'Transfer Sent', label, amount: -t.amount },
    }
  }
  if (role === 'received') {
    const label = t.kind === 'admin'
      ? `Received from Admin${t.note ? ` — ${t.note}` : ''}`
      : `Received from ${t.fromName}${t.fromNumericUid !== undefined ? ` (ID ${t.fromNumericUid})` : ''}`
    return {
      delta: t.net,
      row: { id: transferLedgerRowId(t.id, 'received'), date, type: 'Transfer Received', label, amount: t.net },
    }
  }
  return {
    delta: t.fee,
    row: { id: transferLedgerRowId(t.id, 'fee'), date, type: 'Transfer Fee', label: `Transfer fee — ${t.fromName} → ${t.toName}`, amount: t.fee },
  }
}

// এই ট্রান্সফারের এই ভূমিকার জমা খতিয়ানে আছে কি না (থাকলে আর জমা হয় না)
export function isTransferApplied(ledgerRowIds: string[], transferId: string, role: PiTransferRole): boolean {
  return ledgerRowIds.includes(transferLedgerRowId(transferId, role))
}
