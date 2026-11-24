// ফিডের সাজানো — নতুন (fresh) উপরে, ক্যাশ করা (cached) নিচে।
// মালিকের নিয়ম: স্ক্রল করতে করতে নিচের দিকের জিনিস ক্যাশ থেকেই আসবে,
// সার্ভারে একই জিনিসের জন্য বারবার চাওয়া হবে না। ফিডের পোস্টের কোনো
// নেটওয়ার্ক ফিড নেই — পোস্ট localStorage-এই থাকে (store.tsx: 'posts');
// এখানে শুধু সাজানোর নিয়মটা কাঠামোগত করা হয়েছে, যাতে ভবিষ্যতে কোনো
// পথে (হাইড্রেশন/সিঙ্ক) ক্যাশ করা পোস্ট উপরে উঠে না আসে।
// fresh = এই সেশনে তৈরি পোস্ট (store-এর freshPostIds); cached = বাকি সব
// (আগের সেশনের/দেখা পোস্ট — localStorage থেকে লোড হওয়া)।
export function mergeFeedPosts<T extends { id: string }>(
  fresh: readonly T[],
  cached: readonly T[],
): T[] {
  const seen = new Set<string>(fresh.map((p) => p.id))
  const out: T[] = [...fresh]
  for (const p of cached) {
    if (!seen.has(p.id)) {
      seen.add(p.id)
      out.push(p)
    }
  }
  return out
}

// একটাই পোস্ট-তালিকাকে fresh/cached দুই ভাগে ভাগ করা — ভেতরের ক্রম অটুট থাকে।
export function splitFeedPosts<T extends { id: string }>(
  posts: readonly T[],
  freshIds: readonly string[],
): { fresh: T[]; cached: T[] } {
  const freshSet = new Set(freshIds)
  return {
    fresh: posts.filter((p) => freshSet.has(p.id)),
    cached: posts.filter((p) => !freshSet.has(p.id)),
  }
}

// স্ক্রল-পেজিং — নিচের পাতাগুলো একই (আগে থেকে লোড হওয়া, ক্যাশ করা)
// তালিকা থেকে কাটা হয়; কোনো নেটওয়ার্ক চাওয়া এখানে নেই, তাই একই
// আইটেমের জন্য সার্ভারে দ্বিতীয়বার যাওয়া হয় না।
export function feedPage<T>(merged: readonly T[], page: number, pageSize: number): T[] {
  if (page < 0 || pageSize <= 0) return []
  return merged.slice(page * pageSize, page * pageSize + pageSize)
}
