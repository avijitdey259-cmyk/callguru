// সংখ্যার UID — প্রত্যেক ব্যবহারকারীর ছোট, সহজ, ৬ সংখ্যার পরিচয় নম্বর
// (যেমন 100001)। রেফারেল কোডের বদল নয় — UID শুধু দেখানো, খোঁজা আর বন্ধু
// যোগ/টাকা পাঠানোর জন্য; ?ref= রেফারেল লিংক আগের মতোই চলে। একবার বসলে
// আর বদলায় না — বরাদ্দ Firestore কাউন্টার ট্রানজ্যাকশনে হয়, তাই একই
// মুহূর্তে দুজন সাইন আপ করলেও একই নম্বর পায় না।
export const UID_START = 100001
export const UID_MIN = 100000
export const UID_MAX = 999999
// কাউন্টার ডক (config/uidCounter) — শেষ বরাদ্দ করা নম্বর; না থাকলে 100000
// ধরে প্রথম UID 100001 হয়।
export const UID_COUNTER_START = 100000

// বৈধ সংখ্যা-UID — ৬ সংখ্যার পূর্ণসংখ্যা
export function isValidNumericUid(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= UID_MIN && v <= UID_MAX
}

// ডকের মান থেকে UID পড়া — সংখ্যা বা সংখ্যার স্ট্রিং চলে; ভুল মান বাদ যায়
export function numericUidFromDoc(v: unknown): number | undefined {
  if (typeof v === 'number' && isValidNumericUid(v)) return v
  if (typeof v === 'string' && /^\d{6}$/.test(v.trim())) {
    const n = Number(v.trim())
    if (isValidNumericUid(n)) return n
  }
  return undefined
}

// কাউন্টারের শেষ মান থেকে পরের UID — শেষ হয়ে গেলে null
export function nextNumericUid(lastAssigned: number): number | null {
  const next = (Number.isFinite(lastAssigned) ? Math.floor(lastAssigned) : UID_COUNTER_START) + 1
  return next >= UID_START && next <= UID_MAX ? next : null
}

// খোঁজার লেখা থেকে শুধু সংখ্যা — 'UID 100-001' → '100001', নাম লিখলে ''
export function normalizeUidQuery(q: string): string {
  return q.replace(/\D/g, '')
}

// কাউন্টার ট্রানজ্যাকশনের ধাপ — Firestore-এ ট্রানজ্যাকশনে সব পড়া
// লেখার আগে করতে হয় ("Firestore transactions require all reads to be
// executed before all writes" — লেখার পর tx.get করলে SDK-ই throw করে)।
// 2026-11-26 রিগ্রেশন: 0c71c004-এ প্রোফাইল-অস্তিত্ব যাচাই tx.set-এর পরে
// বসেছিল বলে প্রতিটি বরাদ্দ ব্যর্থ হতো, কাউন্টার বাড়ত না, নতুন
// ব্যবহারকারীর numericUid থাকত না (console: next 100006-এ আটকে)।
// তাই পড়া দুটোই (কাউন্টার + প্রোফাইল) আগে, লেখা পরে। প্রোফাইল না
// থাকলে এখানে বানানো হয় না — খালি {numericUid} ডকে createdAt থাকে না,
// খোঁজা/নতুন সদস্যে চিরকাল অদৃশ্য থাকে (2026-11-25); প্রোফাইল লেখে
// writePublicProfile (লগইন সিঙ্কে এর পরেই চলে)।
export type NumericUidTxSnap = { exists: () => boolean; data: () => Record<string, unknown> }
export type NumericUidTx = {
  get: (ref: unknown) => Promise<NumericUidTxSnap>
  set: (ref: unknown, data: Record<string, unknown>, opts?: { merge?: boolean }) => void
}
export async function assignNumericUidTx(tx: NumericUidTx, counterRef: unknown, profileRef: unknown): Promise<number> {
  const cSnap = await tx.get(counterRef)
  const pSnap = await tx.get(profileRef)
  const last = cSnap.exists() && typeof cSnap.data().next === 'number'
    ? (cSnap.data().next as number)
    : UID_COUNTER_START
  const next = nextNumericUid(last)
  if (next === null) throw new Error('Numeric UIDs exhausted')
  tx.set(counterRef, { next })
  if (pSnap.exists()) tx.set(profileRef, { numericUid: next }, { merge: true })
  return next
}

// UID দিয়ে খোঁজা — সংখ্যার অংশ মিললেই হয় (100 লিখলে 100001-ও মেলে)
export function uidQueryMatches(numericUid: number | undefined, query: string): boolean {
  const digits = normalizeUidQuery(query)
  if (!digits || numericUid === undefined) return false
  return String(numericUid).includes(digits)
}

export function formatNumericUid(n: number): string {
  return String(n)
}
