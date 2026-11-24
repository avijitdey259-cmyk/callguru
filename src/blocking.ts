// PiCall user block — any user can block any other user from messaging + calling.
// ব্লক করা হয় দুই জায়গায়, দুটোই Firestore-এ (নতুন নিয়ম লাগে না):
//   ১) আমার নিজের users/{uid} ডকে blockedUids তালিকা — আমার সব ডিভাইসে সিঙ্ক হয়;
//      এখান থেকেই ইনকামিং কল গেট + চ্যাট তালিকার ফিল্টার চলে।
//   ২) শেয়ার করা চ্যাট রুম ডকে (chats/{roomId}) blockedBy তালিকা — রুম ডক দুই
//      সদস্যই পড়তে পারেন, তাই যিনি ব্লক হয়েছেন তিনিও পাঠানোর/কল করার আগেই
//      জানতে পারেন (মেসেজ সার্ভারে গিয়ে অদৃশ্য হয় না)।
// localStorage (callguru:blockedUids) শুধু অফলাইন ক্যাশ — Firestore না থাকলে
// অ্যাপ এই ডিভাইসেই ব্লক মেনে চলে।
import { chatRoomId } from './firestore'

export const BLOCKED_UIDS_KEY = 'blockedUids'
export const BLOCKED_NAMES_KEY = 'blockedNames'

/** UID তালিকা পরিষ্কার করা — খালি/ভুল মান বাদ, ডুপ্লিকেট বাদ, সর্বোচ্চ ২০০। */
export function cleanUidList(list: unknown): string[] {
  if (!Array.isArray(list)) return []
  return [...new Set(list.filter((x): x is string => typeof x === 'string' && x.trim() !== ''))].slice(0, 200)
}

/** রুম ডকের blockedBy-তে এই UID আছে কি না (যিনি ব্লক করেছেন তাঁর UID)। */
export function isBlockedBy(blockedBy: unknown, uid: string): boolean {
  return Array.isArray(blockedBy) && blockedBy.includes(uid)
}

/** দুই ব্যবহারকারীর শেয়ার করা রুম ডকের চাবি — chatRoomId-র সাজানো জোড়া। */
export function blockRoomId(myUid: string, otherUid: string): string {
  return chatRoomId(myUid, otherUid)
}

/** ইনকামিং চ্যাট রুম থেকে ব্লক করা পাঠকের রুম বাদ দেওয়া। */
export function filterBlockedRooms<T extends { otherUid: string }>(rooms: T[], blockedUids: string[]): T[] {
  if (blockedUids.length === 0) return rooms
  const blocked = new Set(blockedUids)
  return rooms.filter(r => !blocked.has(r.otherUid))
}

/** নতুন আসা মেসেজ থেকে ব্লক করা পাঠকের মেসেজ বাদ দেওয়া (পুরোনো ইতিহাস থাকে)। */
export function filterBlockedMessages<T extends { fromUid: string }>(msgs: T[], blockedUids: string[]): T[] {
  if (blockedUids.length === 0) return msgs
  const blocked = new Set(blockedUids)
  return msgs.filter(m => !blocked.has(m.fromUid))
}
