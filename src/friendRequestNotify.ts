// বন্ধু রিকোয়েস্টের নোটিফিকেশন — Facebook-এর মতো: রিকোয়েস্ট পাঠালে
// প্রাপক সঙ্গে সঙ্গে দেখতে পায় — অ্যাপ খোলা থাকলে ব্যাজ + চোখে পড়ার
// মতো Friend Requests কার্ড, অ্যাপ বন্ধ/লক থাকলে Web Push।
// রিকোয়েস্ট নিজে সার্ভারে পৌঁছাত আগেই (friendRequests কালেকশন) —
// এখানে যা ছিল না তা হলো প্রাপককে জানানো। এই মডিউল pure লজিক +
// পুশ ট্রিগার; Firebase/React নেই, তাই node টেস্টে সরাসরি চলে।
// সীমা (কলের মতোই): পুশ সাবস্ক্রিপশন Firebase uid দিয়ে বাঁধা —
// OTP-লগইন প্রাপকের কাছে পুশ মেলে না (pushed:false), তখন ইন-অ্যাপ
// ব্যাজই ভরসা; অ্যাপ খুললেই রিকোয়েস্ট দেখা যায়।
import { API_BASE, authHeaders } from './api'
import type { FriendRequestDoc } from './friendRequests'

export type FriendRequestPushPayload = {
  title: string
  body: string
  tag: string
  data: { requestId: string; fromId: string; fromName: string; kind: 'friend-request'; url: '/friends' }
  actions: { action: 'view' | 'dismiss'; title: string }[]
}

// একই রিকোয়েস্টের নোটিফিকেশন একটাই থাকে — ব্রাউজার একই tag-এর
// নোটিফিকেশন বদলে দেয়, ডুপ্লিকেট জমে না। নতুন রিকোয়েস্ট = নতুন id
// = নতুন tag = নতুন নোটিফিকেশন (ঠিক আচরণ)।
export function friendRequestPushTag(requestId: string): string {
  return `picall-friend-request-${requestId}`
}

// ঝুলে থাকা আসা রিকোয়েস্টের সংখ্যা — শুধু pending, শুধু আমার কাছে
// আসা (toUid == আমি), ব্লক করা প্রেরকেরটা বাদ। স্টোরের `requests`
// আগেই এভাবে ছাঁকা থাকে; এই হিসাব ব্যাজ + টেস্টের একক সত্য।
export function pendingFriendRequestCount(docs: FriendRequestDoc[], myUid: string, blockedUids: string[]): number {
  const blocked = new Set(blockedUids)
  let n = 0
  for (const d of docs) {
    if (d.status !== 'pending') continue
    if (d.toUid !== myUid || d.fromUid === myUid) continue
    if (blocked.has(d.fromUid)) continue
    n++
  }
  return n
}

// পুশ পেলোড বানানো — খারাপ ইনপুটে null (কখনো throw করে না)।
// নাম ১–৬০ অক্ষর, requestId/fromId খালি নয়; নিজেকে নয়।
export function buildFriendRequestPush(input: { requestId: string; fromId: string; fromName: string }): FriendRequestPushPayload | null {
  const requestId = typeof input.requestId === 'string' ? input.requestId.trim() : ''
  const fromId = typeof input.fromId === 'string' ? input.fromId.trim() : ''
  const fromName = typeof input.fromName === 'string' ? input.fromName.trim() : ''
  if (!requestId || !fromId || fromId === '' || !fromName || fromName.length > 60) return null
  return {
    title: `👥 ${fromName} sent you a friend request`,
    body: 'Tap to view — accept or decline in Friends',
    tag: friendRequestPushTag(requestId),
    data: { requestId, fromId, fromName, kind: 'friend-request', url: '/friends' },
    actions: [
      { action: 'view', title: '👀 View' },
      { action: 'dismiss', title: 'Later' },
    ],
  }
}

export type FriendRequestClickResult = { kind: 'open'; url: string } | { kind: 'close' }

// নোটিফিকেশনে ট্যাপ/অ্যাকশনের ফল — service worker (public/sw.js) এটাই মানে:
//  - 'view' (বা নোটিফিকেশনের গায়ে ট্যাপ) → অ্যাপ খুলে /friends-এ ঢোকা
//  - 'dismiss' → শুধু নোটিফিকেশন বন্ধ (কিছু পাঠানো হয় না)
export function friendRequestNotificationClickTarget(
  action: string | undefined,
  data: { url?: string } | null | undefined,
): FriendRequestClickResult {
  if (action === 'dismiss') return { kind: 'close' }
  const url = typeof data?.url === 'string' && data.url.startsWith('/friends') ? data.url : '/friends'
  return { kind: 'open', url }
}

// বন্ধু রিকোয়েস্টের পুশ (প্রাপকের অ্যাপ বন্ধ থাকলে): রিকোয়েস্ট ডক লেখার
// পর একবার চেষ্টা — সার্ভার প্রাপকের সাবস্ক্রিপশনে পুশ পাঠায়। ৫ সেকেন্ডে
// না হলে ছেড়ে দেওয়া হয়; পুশ না গেলেও রিকোয়েস্ট ডক থাকে, অ্যাপ খোলা
// প্রাপক ব্যাজেই সেটা দেখতে পায়। কখনো throw করে না।
// শুধু আসল Firebase রিকোয়েস্টে ডাকতে হয় — পারসোনা/লোকাল/OTP পথে নয়
// (sendFriendRequest-এ createFriendRequest সফল হলেই একবার ডাকা হয়)।
export async function triggerFriendRequestPush(input: { toUid: string; requestId: string; fromName: string }): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/friend-request/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch { return false }
}
