// নতুন সদস্য — আসল ব্যবহারকারীদের পাবলিক প্রোফাইল নিয়ে কাজ করার pure সাহায্যকারী।
// কোনো ডেমো/ভুয়া ব্যবহারকারী এখানে নেই — ডেটা আসে Firestore-এর publicProfiles
// কালেকশন থেকে (fetchNewMembers, src/firestore.ts)। Firebase/React লাগে না।
export const PUBLIC_PROFILE_COLORS = [
  '#1877F2', '#E91E63', '#27AE60', '#9C27B0',
  '#FF9800', '#16A085', '#8E44AD', '#E67E22',
]

// uid থেকে নির্ধারিত রং — একই ব্যবহারকারীর রং সবসময় একই থাকে।
export function colourForUid(uid: string): string {
  let h = 0
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0
  return PUBLIC_PROFILE_COLORS[h % PUBLIC_PROFILE_COLORS.length]
}

// Firestore Timestamp / সংখ্যা (ms) / ISO স্ট্রিং / null → ms (না পারলে null)।
export function toCreatedAtMs(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const ms = Date.parse(v)
    return Number.isFinite(ms) ? ms : null
  }
  if (typeof v === 'object') {
    const o = v as { toDate?: unknown; seconds?: unknown; nanoseconds?: unknown }
    if (typeof o.toDate === 'function') {
      const d = (o.toDate as () => unknown)()
      if (d instanceof Date && Number.isFinite(d.getTime())) return d.getTime()
      return null
    }
    if (typeof o.seconds === 'number') {
      return o.seconds * 1000 + (typeof o.nanoseconds === 'number' ? Math.floor(o.nanoseconds / 1e6) : 0)
    }
  }
  return null
}

// যোগদানের সময় বাংলায় — "Today", "Yesterday", "N দিন আগে", না জানা গেলে "Recently"।
export function formatJoinTime(createdAtMs: number | null, nowMs: number = Date.now()): string {
  if (createdAtMs == null) return 'Recently'
  const days = Math.floor((nowMs - createdAtMs) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days.toLocaleString('en-GB')} days ago`
}

export type NewMember = {
  id: string
  displayName: string
  createdAtMs: number | null
  colour: string
  // ব্যবহারকারীর পাবলিক আইডি (referralCode, যেমন cg-abc123) — নিজের আইডি কার্ডে
  // এমনিতেই দেখানো হয়, তাই পাবলিক প্রোফাইলে রাখা যায়। নাম/আইডি খোঁজায় মেলাতে লাগে।
  // না থাকলে undefined (পুরোনো প্রোফাইল — লগইনে ব্যাকফিল হয়)।
  referralCode?: string
}

// Firestore publicProfiles ডক → NewMember (pure)। ভাঙা/ফাঁকা ক্ষেত্রে নিরাপদ
// ডিফল্ট — কখনো throw করে না, ভুয়া কাউকে বানায় না।
export function mapPublicProfile(id: string, data: Record<string, unknown>): NewMember {
  const name = typeof data.displayName === 'string' && data.displayName.trim() ? data.displayName.trim() : 'User'
  const colour = typeof data.colour === 'string' && data.colour ? data.colour : colourForUid(id)
  const code = typeof data.referralCode === 'string' && data.referralCode.trim() ? data.referralCode.trim() : undefined
  return { id, displayName: name, createdAtMs: toCreatedAtMs(data.createdAt), colour, ...(code ? { referralCode: code } : {}) }
}

// নিজেকে বাদ দেওয়া — নতুন সদস্যের তালিকায় নিজের প্রোফাইল দেখানো হয় না।
// (অ্যাডমিন ও চ্যাট পারসোনারা publicProfiles-এ লেখাই হয় না, তাই তারা আসতেই পারে না।)
export function filterNewMembers(members: NewMember[], selfUid: string | null): NewMember[] {
  if (!selfUid) return members
  return members.filter(m => m.id !== selfUid)
}
