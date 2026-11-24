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

// UID দিয়ে খোঁজা — সংখ্যার অংশ মিললেই হয় (100 লিখলে 100001-ও মেলে)
export function uidQueryMatches(numericUid: number | undefined, query: string): boolean {
  const digits = normalizeUidQuery(query)
  if (!digits || numericUid === undefined) return false
  return String(numericUid).includes(digits)
}

export function formatNumericUid(n: number): string {
  return String(n)
}
