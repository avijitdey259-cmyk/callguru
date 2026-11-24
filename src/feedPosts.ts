// ফিডের পোস্ট-ক্রিয়া — ফেসবুক-স্টাইল পোস্টিংয়ের শুদ্ধ (pure) অংশ:
// লাইক টগল, কমেন্ট যোগ, পোস্ট মোছা/সম্পাদনা, শেয়ার লিংক, ?post= ডিপ লিংক।
// store + Feed এগুলোই ব্যবহার করে; Node টেস্টে সরাসরি চলে (React/Firebase লাগে না)।
import type { Post, PostComment } from './data'

// নিজের পোস্ট — mine ফ্ল্যাগ থাকলে, বা পুরোনো পোস্টে author 'You' হলে
export function isOwnPost(p: Post): boolean {
  return !!p.mine || p.author === 'You'
}

// লাইক টগল — লাইক করলে +১, আবার চাপলে −১ (কখনো ০-এর নিচে নয়); না থাকা id-তে কিছু বদলায় না
export function togglePostLike(posts: Post[], likedIds: string[], id: string): { posts: Post[]; likedIds: string[] } {
  const target = posts.find(p => p.id === id)
  if (!target) return { posts, likedIds }
  const liked = likedIds.includes(id)
  const next = posts.map(p => (p.id === id ? { ...p, likes: Math.max(0, p.likes + (liked ? -1 : 1)) } : p))
  return { posts: next, likedIds: liked ? likedIds.filter(x => x !== id) : [...likedIds, id] }
}

// কমেন্ট যোগ — খালি লেখা বাদ যায়; সংখ্যা +১, তালিকায় জমে; না থাকা পোস্টে কিছু বদলায় না
export function addPostComment(posts: Post[], id: string, comment: PostComment): Post[] {
  if (!comment.text.trim()) return posts
  return posts.map(p => (p.id === id
    ? { ...p, comments: p.comments + 1, commentsList: [...(p.commentsList ?? []), comment] }
    : p))
}

// পোস্ট মোছা — শুধু ওই id-টাই যায়
export function deletePost(posts: Post[], id: string): Post[] {
  return posts.filter(p => p.id !== id)
}

// পোস্ট সম্পাদনা — শুধু দেওয়া ঘরগুলো বদলায়, বাকি সব (লাইক/কমেন্ট/শেয়ার) একই থাকে
export function updatePost(
  posts: Post[],
  id: string,
  patch: Partial<Pick<Post, 'text' | 'location' | 'audience' | 'imageUrl' | 'videoUrl'>>,
): Post[] {
  return posts.map(p => (p.id === id ? { ...p, ...patch } : p))
}

// শেয়ার লিংক — /feed?post=<id>; খুললে ফিড ওই পোস্টে স্ক্রল করে
export function buildPostShareUrl(origin: string, postId: string): string {
  return origin.replace(/\/$/, '') + '/feed?post=' + encodeURIComponent(postId)
}

// ?post= ডিপ লিংক পড়া — না থাকলে null
export function parsePostDeepLink(search: string): string | null {
  try {
    const v = new URLSearchParams(search.startsWith('?') ? search : '?' + search).get('post')
    return v && v.trim() ? v : null
  } catch {
    return null
  }
}
