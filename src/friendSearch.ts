// বন্ধু খোঁজা — নাম বা আইডি দিয়ে (Friends পেজের সার্চ বক্স)।
// একটাই বাক্সে দুটোই খোঁজা যায়: নামের অংশ লিখলে নামে মেলে, আইডি/কোড লিখলে আইডিতে মেলে।
// কেস-ইনসেনসিটিভ সাবস্ট্রিং — বাংলা + ল্যাটিন দুটোই চলে। কোনো নতুন আইডি বানানো হয় না:
// ব্যবহারকারীর নিজের আইডি = store-এর referralCode (যেমন cg-abc123); অন্যদের আইডি = তাদের
// অ্যাপের ভেতরের id (যেমন bd-rima, f1, fr-1)। Firebase UID কখনো দেখানো হয় না।

export interface SearchablePerson {
  id: string
  name: string
  color: string
  online: boolean
  mutual?: number
  isFriend: boolean
  // The person's profile photo (publicProfiles photo) when they set one —
  // carried through search so every avatar can show it instead of initials.
  photo?: string
  // ব্যবহারকারীর পাবলিক আইডি (referralCode, যেমন cg-abc123) — আসল ব্যবহারকারীদের
  // ক্ষেত্রে থাকে; বন্ধু/সাজেশন/পারসোনার ক্ষেত্রে নাও থাকতে পারে (তাদের id-ই আইডি)।
  referralCode?: string
}

export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase()
}

export function personMatches(p: Pick<SearchablePerson, 'name' | 'id' | 'referralCode'>, query: string): boolean {
  const q = normalizeQuery(query)
  if (!q) return true
  return p.name.toLowerCase().includes(q)
    || p.id.toLowerCase().includes(q)
    || (typeof p.referralCode === 'string' && p.referralCode.toLowerCase().includes(q))
}

export function searchPeople(people: SearchablePerson[], query: string): SearchablePerson[] {
  const q = normalizeQuery(query)
  if (!q) return people
  return people.filter(p => personMatches(p, q))
}

// সব আসল ব্যবহারকারী (Firestore publicProfiles থেকে) লোকাল তালিকার সাথে মেশানো।
// নিজেকে কখনো দেখায় না (selfUid বাদ); একই ব্যবহারকারী বন্ধু হিসেবেও থাকলে একবারই
// দেখায় (id দিয়ে, তারপর নাম দিয়ে ডুপ্লিকেট বাদ — বন্ধুর তথ্যই থাকে)। আসল
// ব্যবহারকারীর আইডি = তার Firebase uid (পাবলিক প্রোফাইলের চাবি); referralCode
// থাকলে সেটাও ম্যাচ করে। কোনো ডেমো/ভুয়া ব্যবহারকারী এখানে আসে না — ডেটা শুধু
// publicProfiles থেকে আসে, না পেলে লোকাল তালিকাই থাকে।
export function mergeAllUsers(
  local: SearchablePerson[],
  allUsers: { id: string; displayName: string; colour: string; referralCode?: string; photo?: string }[],
  selfUid: string | null,
): SearchablePerson[] {
  const out: SearchablePerson[] = [...local]
  const seenIds = new Set(local.map(p => p.id))
  const seenNames = new Set(local.map(p => p.name.trim().toLowerCase()))
  for (const u of allUsers) {
    if (selfUid && u.id === selfUid) continue
    if (seenIds.has(u.id)) continue
    const nameKey = u.displayName.trim().toLowerCase()
    if (seenNames.has(nameKey)) continue
    seenIds.add(u.id)
    seenNames.add(nameKey)
    out.push({ id: u.id, name: u.displayName, color: u.colour, online: true, isFriend: false, ...(u.referralCode ? { referralCode: u.referralCode } : {}), ...(u.photo ? { photo: u.photo } : {}) })
  }
  return out
}

// অটোকমপ্লিট সাজেশন — টাইপ করার সাথে সাথে মেলা নাম/আইডি, সর্বোচ্চ limitNটি।
// খালি কোয়েরিতে কিছু ফেরে না (ড্রপডাউন লুকিয়ে থাকে); কেস-ইনসেনসিটিভ সাবস্ট্রিং,
// বাংলা + ল্যাটিন। সাজেশনে ট্যাপ করলে তার নাম কোয়েরি হয় (পেজে ফল দেখায়)।
export function suggestionsFor(people: SearchablePerson[], query: string, limitN = 8): SearchablePerson[] {
  const q = normalizeQuery(query)
  if (!q) return []
  return searchPeople(people, q).slice(0, Math.max(0, limitN))
}
// কেস-ইনসেনসিটিভ সাবস্ট্রিং — বাংলা + ল্যাটিন। খালি কোয়েরিতে কিছু ফেরে না
// (বন্ধু খোঁজার মতো নয় — পোস্টের তালিকা সার্চের ফল হিসেবে দেখানো হয় না)।
export interface SearchablePost {
  id: string
  author: string
  text: string
  time?: string
}

export function searchPosts(posts: SearchablePost[], query: string): SearchablePost[] {
  const q = normalizeQuery(query)
  if (!q) return []
  return posts.filter(p => p.text.toLowerCase().includes(q) || p.author.toLowerCase().includes(q))
}

// বন্ধু + People You May Know + চ্যাট পারসোনা — এক তালিকায়, নাম দিয়ে ডুপ্লিকেট বাদ দিয়ে
// (বন্ধু আগে, তারপর সাজেশন, তারপর পারসোনা — একই নাম দুবার দেখাবে না)।
export function buildSearchablePeople(
  friends: { id: string; name: string; color: string; online: boolean; photo?: string }[],
  suggestions: { id: string; name: string; color: string; mutual: number }[],
  buddies: { id: string; name: string; color: string; online: boolean }[],
): SearchablePerson[] {
  const out: SearchablePerson[] = []
  const seen = new Set<string>()
  const push = (p: SearchablePerson) => {
    const key = p.name.trim().toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(p)
  }
  for (const f of friends) push({ id: f.id, name: f.name, color: f.color, online: f.online, isFriend: true, ...(f.photo ? { photo: f.photo } : {}) })
  for (const s of suggestions) push({ id: s.id, name: s.name, color: s.color, online: true, mutual: s.mutual, isFriend: false })
  for (const b of buddies) push({ id: b.id, name: b.name, color: b.color, online: b.online, isFriend: false })
  return out
}
