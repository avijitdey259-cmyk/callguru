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
}

export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase()
}

export function personMatches(p: Pick<SearchablePerson, 'name' | 'id'>, query: string): boolean {
  const q = normalizeQuery(query)
  if (!q) return true
  return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
}

export function searchPeople(people: SearchablePerson[], query: string): SearchablePerson[] {
  const q = normalizeQuery(query)
  if (!q) return people
  return people.filter(p => personMatches(p, q))
}

// বন্ধু + People You May Know + চ্যাট পারসোনা — এক তালিকায়, নাম দিয়ে ডুপ্লিকেট বাদ দিয়ে
// (বন্ধু আগে, তারপর সাজেশন, তারপর পারসোনা — একই নাম দুবার দেখাবে না)।
export function buildSearchablePeople(
  friends: { id: string; name: string; color: string; online: boolean }[],
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
  for (const f of friends) push({ id: f.id, name: f.name, color: f.color, online: f.online, isFriend: true })
  for (const s of suggestions) push({ id: s.id, name: s.name, color: s.color, online: true, mutual: s.mutual, isFriend: false })
  for (const b of buddies) push({ id: b.id, name: b.name, color: b.color, online: b.online, isFriend: false })
  return out
}
