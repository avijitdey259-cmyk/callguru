// পেমেন্ট রিকোয়েস্ট — "আমাকে Pi দাও" অনুরোধ। অনুরোধকারী প্রাপক বেছে
// (UID/বন্ধু/নাম) পরিমাণ + note পাঠান; প্রাপক Wallet-এ দেখে Pay বা
// Decline করেন। Pay করলে item 6-এর ট্রান্সফারই চলে — পাঠকের আসল Pi থেকে
// পুরোটা কমে, অনুরোধকারী পান ৯৮%, ২% অ্যাডমিনের ফি; Pay-এর সময়ও
// পাঠকের (payer-এর) অনুমোদিত KYC + ব্যালেন্স যাচাই হয়।
// Pure মডিউল — Firebase/React নেই, তাই node টেস্টে সরাসরি চলে।
// স্ট্যাটাস একমুখী: pending → paid / declined / cancelled — আর ফেরে না।
// Pay-টা ট্রানজ্যাকশনেই request-এর স্ট্যাটাস 'paid' করে দেয়, তাই দুবার
// Pay করা যায় না (দ্বিতীয়বার ট্রানজ্যাকশনই ব্যর্থ হয়)।
import { roundPi } from './data'
import { isValidNumericUid } from './numericUid'

export type PaymentRequestStatus = 'pending' | 'paid' | 'declined' | 'cancelled'

export type PaymentRequestDoc = {
  id: string
  fromUid: string
  toUid: string
  fromName: string
  toName: string
  fromPhoto?: string
  fromNumericUid?: number
  toNumericUid?: number
  amount: number
  note?: string
  status: PaymentRequestStatus
  participants: string[]
  createdAtMs: number
}

const STATUSES: PaymentRequestStatus[] = ['pending', 'paid', 'declined', 'cancelled']

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

// Firestore ডক → যাচাই করা PaymentRequestDoc; খারাপ/অসম্পূর্ণ ডক null
export function mapPaymentRequestDoc(id: string, data: unknown): PaymentRequestDoc | null {
  if (!id || !data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (typeof d.fromUid !== 'string' || !d.fromUid) return null
  if (typeof d.toUid !== 'string' || !d.toUid) return null
  if (d.fromUid === d.toUid) return null
  if (typeof d.amount !== 'number' || !Number.isFinite(d.amount) || d.amount <= 0) return null
  if (typeof d.status !== 'string' || !(STATUSES as string[]).includes(d.status)) return null
  const fromName = typeof d.fromName === 'string' && d.fromName.trim() ? d.fromName.trim().slice(0, 80) : 'User'
  const toName = typeof d.toName === 'string' && d.toName.trim() ? d.toName.trim().slice(0, 80) : 'User'
  const fromPhoto = typeof d.fromPhoto === 'string' && d.fromPhoto.trim() ? d.fromPhoto.trim().slice(0, 500) : undefined
  const participants = Array.isArray(d.participants)
    ? [...new Set(d.participants.filter((x): x is string => typeof x === 'string' && x !== ''))]
    : [d.fromUid as string, d.toUid as string]
  const fromNumericUid = isValidNumericUid(d.fromNumericUid) ? (d.fromNumericUid as number) : undefined
  const toNumericUid = isValidNumericUid(d.toNumericUid) ? (d.toNumericUid as number) : undefined
  const note = typeof d.note === 'string' && d.note.trim() ? d.note.trim().slice(0, 200) : undefined
  return {
    id,
    fromUid: d.fromUid as string,
    toUid: d.toUid as string,
    fromName,
    toName,
    ...(fromPhoto !== undefined ? { fromPhoto } : {}),
    ...(fromNumericUid !== undefined ? { fromNumericUid } : {}),
    ...(toNumericUid !== undefined ? { toNumericUid } : {}),
    amount: roundPi(d.amount as number),
    ...(note !== undefined ? { note } : {}),
    status: d.status as PaymentRequestStatus,
    participants,
    createdAtMs: toCreatedAtMs(d.createdAt),
  }
}

// অনুরোধ পাঠানোর আগে যাচাই — ভুল হলে কারণ, ঠিক হলে null
export function validatePaymentRequest(input: {
  amount: number
  minTransfer: number
  isSelf: boolean
}): string | null {
  if (!Number.isFinite(input.amount) || input.amount <= 0) return 'Enter a valid amount.'
  if (input.amount < input.minTransfer) return `Minimum request: ${input.minTransfer} π.`
  if (input.isSelf) return 'You cannot request Pi from yourself.'
  return null
}

// এই request-এ আমি কী করতে পারি (pending হলেই, আর শুধু সঠিক পক্ষ)
export function canPayRequest(t: PaymentRequestDoc, myUid: string): boolean {
  return t.status === 'pending' && t.toUid === myUid
}

export function canDeclineRequest(t: PaymentRequestDoc, myUid: string): boolean {
  return t.status === 'pending' && t.toUid === myUid
}

export function canCancelRequest(t: PaymentRequestDoc, myUid: string): boolean {
  return t.status === 'pending' && t.fromUid === myUid
}

// স্ট্যাটাসের বাংলা/ইংরেজি লেবেল (তালিকায় দেখানোর জন্য)
export function paymentRequestStatusLabel(status: PaymentRequestStatus): string {
  if (status === 'pending') return '⏳ Pending'
  if (status === 'paid') return '✅ Paid'
  if (status === 'declined') return '❌ Declined'
  return '🚫 Cancelled'
}

// আমার কাছে আসা মেটানো হয়নি এমন অনুরোধের সংখ্যা (ব্যাজের জন্য)
export function pendingIncomingCount(requests: PaymentRequestDoc[], myUid: string): number {
  return requests.filter(r => r.status === 'pending' && r.toUid === myUid).length
}
