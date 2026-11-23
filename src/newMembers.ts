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

// যোগদানের সময় বাংলায় — "আজ", "গতকাল", "N দিন আগে", না জানা গেলে "সম্প্রতি"।
export function formatJoinTime(createdAtMs: number | null, nowMs: number = Date.now()): string {
  if (createdAtMs == null) return 'সম্প্রতি'
  const days = Math.floor((nowMs - createdAtMs) / 86400000)
  if (days <= 0) return 'আজ'
  if (days === 1) return 'গতকাল'
  return `${days.toLocaleString('bn-BD')} দিন আগে`
}

export type NewMember = {
  id: string
  displayName: string
  createdAtMs: number | null
  colour: string
}

// নিজেকে বাদ দেওয়া — নতুন সদস্যের তালিকায় নিজের প্রোফাইল দেখানো হয় না।
// (অ্যাডমিন ও চ্যাট পারসোনারা publicProfiles-এ লেখাই হয় না, তাই তারা আসতেই পারে না।)
export function filterNewMembers(members: NewMember[], selfUid: string | null): NewMember[] {
  if (!selfUid) return members
  return members.filter(m => m.id !== selfUid)
}
