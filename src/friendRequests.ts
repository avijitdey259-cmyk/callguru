// বন্ধু রিকোয়েস্ট — Facebook-এর মতো: Add Friend চাপলে ওপাশের ব্যবহারকারীর
// কাছে আসল রিকোয়েস্ট যায়; গ্রহণ করলে দুই দিকেই বন্ধু হয়, বাতিল করলে
// চুপচাপ মিলিয়ে যায়। ডেটা `friendRequests` কালেকশনে থাকে — কোনো সার্ভার
// বদল লাগে না, শুধু Firestore নিয়ম (firestore.rules) publish করতে হয়।
// এই মডিউল pure — Firebase/React নেই, তাই node টেস্টে সরাসরি চলে।
// নাম + রং (+ ঐচ্ছিক ছবি) ছাড়া এখানে কিছু যায় না — ইমেইল/ফোন/NID/
// ব্যালেন্স কখনো রিকোয়েস্ট ডকে লেখা হয় না। সংখ্যার UID (fromNumericUid /
// toNumericUid) শুধু দেখানোর জন্য যায় — রিকোয়েস্ট তালিকায় প্রেরকের
// ছোট ID দেখা যায়, কাঁচা Firebase uid নয়।
import type { Friend } from './store'
import { numericUidFromDoc } from './numericUid'

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'

export type FriendRequestDoc = {
  id: string
  fromUid: string
  toUid: string
  fromName: string
  fromColour: string
  fromPhoto?: string
  fromNumericUid?: number
  toName: string
  toColour: string
  toPhoto?: string
  toNumericUid?: number
  status: FriendRequestStatus
  createdAtMs: number
}

const STATUSES: FriendRequestStatus[] = ['pending', 'accepted', 'declined', 'cancelled']

// Firebase Auth UID — ২০–৪০ অক্ষরের ল্যাটিন অক্ষর + সংখ্যা (ড্যাশ নেই)।
// পারসোনা (bd-rima…) আর পুরোনো সিড id (fr-1, f1, rq-…) এতে মেলে না —
// ওগুলো Firestore রিকোয়েস্ট পায় না, লোকাল বন্ধুই থাকে।
export function looksLikeFirebaseUid(id: string): boolean {
  return /^[A-Za-z0-9]{20,40}$/.test(id)
}

function cleanName(name: unknown): string | null {
  if (typeof name !== 'string') return null
  const t = name.trim()
  return t.length >= 1 && t.length <= 80 ? t : null
}

function cleanColour(colour: unknown): string | null {
  return typeof colour === 'string' && colour.trim() !== '' ? colour.trim().slice(0, 20) : null
}

function cleanPhoto(photo: unknown): string | undefined {
  return typeof photo === 'string' && (photo.startsWith('data:image/') || photo.startsWith('https://')) ? photo : undefined
}

// Firestore ডক → যাচাই করা FriendRequestDoc; খারাপ/অসম্পূর্ণ ডক null
// (কখনো throw করে না — খারাপ ডক দেখালে অ্যাপ ভাঙবে না)।
export function mapFriendRequestDoc(id: string, data: unknown): FriendRequestDoc | null {
  if (!id || !data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (typeof d.fromUid !== 'string' || !looksLikeFirebaseUid(d.fromUid)) return null
  if (typeof d.toUid !== 'string' || !looksLikeFirebaseUid(d.toUid)) return null
  if (d.fromUid === d.toUid) return null
  const fromName = cleanName(d.fromName)
  const toName = cleanName(d.toName)
  const fromColour = cleanColour(d.fromColour)
  const toColour = cleanColour(d.toColour)
  if (!fromName || !toName || !fromColour || !toColour) return null
  const status = d.status
  if (typeof status !== 'string' || !(STATUSES as string[]).includes(status)) return null
  const createdAtMs = typeof d.createdAtMs === 'number' && Number.isFinite(d.createdAtMs) ? d.createdAtMs : 0
  return {
    id,
    fromUid: d.fromUid,
    toUid: d.toUid,
    fromName,
    fromColour,
    ...(cleanPhoto(d.fromPhoto) ? { fromPhoto: cleanPhoto(d.fromPhoto) } : {}),
    ...(numericUidFromDoc(d.fromNumericUid) !== undefined ? { fromNumericUid: numericUidFromDoc(d.fromNumericUid) } : {}),
    toName,
    toColour,
    ...(cleanPhoto(d.toPhoto) ? { toPhoto: cleanPhoto(d.toPhoto) } : {}),
    ...(numericUidFromDoc(d.toNumericUid) !== undefined ? { toNumericUid: numericUidFromDoc(d.toNumericUid) } : {}),
    status: status as FriendRequestStatus,
    createdAtMs,
  }
}

// পাঠানোর ডেটা বানানো — নাম ১–৮০ অক্ষর, দুজনেই আসল UID, নিজেকে নয়; না হলে null।
// status/createdAt লেখে firestore.ts-এর createFriendRequest।
export function buildFriendRequestData(
  from: { uid: string; name: string; colour: string; photo?: string; numericUid?: number },
  to: { uid: string; name: string; colour: string; photo?: string; numericUid?: number },
): Omit<FriendRequestDoc, 'id' | 'status' | 'createdAtMs'> | null {
  if (!looksLikeFirebaseUid(from.uid) || !looksLikeFirebaseUid(to.uid)) return null
  if (from.uid === to.uid) return null
  const fromName = cleanName(from.name)
  const toName = cleanName(to.name)
  const fromColour = cleanColour(from.colour)
  const toColour = cleanColour(to.colour)
  if (!fromName || !toName || !fromColour || !toColour) return null
  return {
    fromUid: from.uid,
    toUid: to.uid,
    fromName,
    fromColour,
    ...(cleanPhoto(from.photo) ? { fromPhoto: cleanPhoto(from.photo) } : {}),
    ...(numericUidFromDoc(from.numericUid) !== undefined ? { fromNumericUid: numericUidFromDoc(from.numericUid) } : {}),
    toName,
    toColour,
    ...(cleanPhoto(to.photo) ? { toPhoto: cleanPhoto(to.photo) } : {}),
    ...(numericUidFromDoc(to.numericUid) !== undefined ? { toNumericUid: numericUidFromDoc(to.numericUid) } : {}),
  }
}

// আসা রিকোয়েস্ট → Friend তালিকার এন্ট্রি। requestId = friendRequests ডকের
// চাবি — Accept/Decline কোন ডকটা বদলাবে তা এটা দিয়েই চেনে।
export function requestToFriend(doc: FriendRequestDoc): Friend {
  return {
    id: doc.fromUid,
    name: doc.fromName,
    color: doc.fromColour,
    online: true,
    ...(doc.fromPhoto ? { photo: doc.fromPhoto } : {}),
    ...(doc.fromNumericUid !== undefined ? { numericUid: doc.fromNumericUid } : {}),
    requestId: doc.id,
  }
}

// পাঠানো রিকোয়েস্ট → "Request Sent" অবস্থা (toUid দিয়েই বোতাম মেলে)।
export function requestToSentEntry(doc: FriendRequestDoc): { toUid: string; requestId: string } {
  return { toUid: doc.toUid, requestId: doc.id }
}

// গ্রহণ হওয়া রিকোয়েস্ট → ওপাশের বন্ধু (আমার দিক থেকে)।
// পাঠানো রিকোয়েস্ট গ্রহণ হলে প্রাপক, আসা রিকোয়েস্ট গ্রহণ হলে প্রেরক;
// pending/declined/cancelled হলে বা আমার সঙ্গে না জড়ালে null।
export function friendFromAcceptedDoc(doc: FriendRequestDoc, myUid: string): Friend | null {
  if (doc.status !== 'accepted') return null
  if (doc.fromUid === myUid && doc.toUid !== myUid) {
    return {
      id: doc.toUid,
      name: doc.toName,
      color: doc.toColour,
      online: true,
      ...(doc.toPhoto ? { photo: doc.toPhoto } : {}),
      ...(doc.toNumericUid !== undefined ? { numericUid: doc.toNumericUid } : {}),
    }
  }
  if (doc.toUid === myUid && doc.fromUid !== myUid) {
    return {
      id: doc.fromUid,
      name: doc.fromName,
      color: doc.fromColour,
      online: true,
      ...(doc.fromPhoto ? { photo: doc.fromPhoto } : {}),
      ...(doc.fromNumericUid !== undefined ? { numericUid: doc.fromNumericUid } : {}),
    }
  }
  return null
}

// গ্রহণ হওয়া রিকোয়েস্টগুলো থেকে বন্ধু তালিকা মেলানো — নতুন array ফেরে
// (ইনপুট বদলায় না); আগে থেকে থাকলে ডুপ্লিকেট হয় না, আনফ্রেন্ড করা uid
// বাদ যায়, pending/declined/cancelled ডক কিছু যোগ করে না।
// ২০২৬-১১-২৬ লাইভ বাগ: শুধু সাবস্ক্রিপশন-কলব্যাকে যোগ করলে লগইন-সিঙ্কের
// ডক-হাইড্রেশন (applyHydrated) সেটা মুছে ফেলত, আর পুরোনো
// 'frAcceptedHandled' চিহ্ন আর কখনো ফিরিয়ে আনত না — তাই লগইনে এই
// মেলানোই বন্ধুত্ব টিকিয়ে রাখে (রিলোড/রি-সাইন-ইনেও)।
export function mergeAcceptedFriends(
  friends: Friend[],
  docs: FriendRequestDoc[],
  myUid: string,
  unfriendedUids: string[],
): Friend[] {
  const unfriended = new Set(unfriendedUids)
  const seen = new Set(friends.map(f => f.id))
  const next = [...friends]
  for (const d of docs) {
    const f = friendFromAcceptedDoc(d, myUid)
    if (!f || unfriended.has(f.id) || seen.has(f.id)) continue
    seen.add(f.id)
    next.push(f)
  }
  return next
}

// আনফ্রেন্ড করা uid-র তালিকা (pure — localStorage ছাড়া; store-এ
// 'frUnfriendedUids' চাবিতে থাকে)।
export function addUnfriendedUid(list: string[], uid: string): string[] {
  if (!uid || list.includes(uid)) return list
  return [...list, uid]
}

export function removeUnfriendedUid(list: string[], uid: string): string[] {
  if (!uid || !list.includes(uid)) return list
  return list.filter(x => x !== uid)
}

// পাঠানো যায় কি না — নিজেকে নয়, ইতিমধ্যে বন্ধু নয়, pending রিকোয়েস্ট নেই,
// ব্লক করা কাউকে নয়। 'ok' ছাড়া বাকি সব ক্ষেত্রে রিকোয়েস্ট পাঠানো হয় না।
export function canSendFriendRequest(
  targetId: string,
  me: { uid: string; friendIds: string[]; sentToUids: string[]; blockedUids: string[] },
): 'ok' | 'self' | 'already-friend' | 'already-sent' | 'blocked' {
  if (targetId === me.uid) return 'self'
  if (me.friendIds.includes(targetId)) return 'already-friend'
  if (me.sentToUids.includes(targetId)) return 'already-sent'
  if (me.blockedUids.includes(targetId)) return 'blocked'
  return 'ok'
}

// আসা রিকোয়েস্ট দেখানো যায় কি না — ব্লক করা প্রেরকের রিকোয়েস্ট লুকানো
// থাকে (আনব্লক করলে আবার দেখা যাবে); বাকি সব pending রিকোয়েস্ট দেখায়।
export function isIncomingVisible(doc: FriendRequestDoc, blockedUids: string[]): boolean {
  return !blockedUids.includes(doc.fromUid)
}
