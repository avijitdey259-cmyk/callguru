// Firestore — আসল (শেয়ার করা) ডেটা স্তর।
// Firebase প্রজেক্ট picall-76185। Firestore কনসোলে চালু না থাকলে, বা নেটওয়ার্ক/
// অনুমতি না থাকলে, প্রতিটি ফাংশন null/false ফেরায় — অ্যাপ তখন ঠিক আগের মতো
// localStorage-এই চলে (অফলাইন ক্যাশ / graceful degradation)। কোনো ফাংশন throw করে না।
// NID/সেলফি/ভিডিও এখানে কখনো লেখা হয় না — ম্যাপিংটাই (firestoreMapping.ts) সেগুলো বাদ দেয়।
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, orderBy, limit, serverTimestamp, addDoc, onSnapshot, deleteField, increment, arrayUnion, arrayRemove, runTransaction, type Firestore, type Unsubscribe } from 'firebase/firestore'
import { UID_COUNTER_START, isValidNumericUid, nextNumericUid, numericUidFromDoc } from './numericUid'
import { getFirebaseApp, isFirebaseConfigured } from './firebase'
import { roundPi } from './data'
import type { PublicConfigDoc, TopUpDoc, UserDoc } from './firestoreMapping'
import { colourForUid, mapPublicProfile, type NewMember } from './newMembers'
import { mapAdDoc, type UserAd } from './ads'
import { mapGroupDoc, mapGroupPostDoc, mapPageDoc, mapPagePostDoc, type GroupItem, type GroupPost, type PageItem, type PagePost } from './groups'
import { mapReviewDoc, mapServiceDoc, type ServiceListing, type ServiceReview } from './services'
import { mapFriendRequestDoc, type FriendRequestDoc } from './friendRequests'
export type { FriendRequestDoc, FriendRequestStatus } from './friendRequests'
import { ADMIN_UID, computeTransfer, buildTransferApplication, mapPiTransferDoc, type PiTransferDoc } from './piTransfer'
export type { PiTransferDoc } from './piTransfer'
export { ADMIN_UID } from './piTransfer'

let db: Firestore | null = null

export function getDb(): Firestore | null {
  if (!isFirebaseConfigured) return null
  if (!db) {
    try { db = getFirestore(getFirebaseApp()) } catch { return null }
  }
  return db
}

// ---------- users/{uid} ----------
export async function fetchUserDoc(uid: string): Promise<(UserDoc & Record<string, unknown>) | null> {
  const d = getDb()
  if (!d) return null
  try {
    const snap = await getDoc(doc(d, 'users', uid))
    if (!snap.exists()) return null
    return snap.data() as UserDoc & Record<string, unknown>
  } catch { return null }
}

export async function writeUserDoc(uid: string, data: UserDoc): Promise<boolean> {
  const d = getDb()
  if (!d) return false
  try {
    await setDoc(doc(d, 'users', uid), { ...data, updatedAt: serverTimestamp() })
    return true
  } catch { return false }
}

// অ্যাডমিন অন্য ব্যবহারকারীর ডকে KYC স্ট্যাটাস বদলান (নিয়ম: অ্যাডমিনই শুধু পারেন)।
export async function updateUserKyc(uid: string, kyc: UserDoc['kyc']): Promise<boolean> {
  const d = getDb()
  if (!d) return false
  try {
    await updateDoc(doc(d, 'users', uid), { kyc, updatedAt: serverTimestamp() })
    return true
  } catch { return false }
}

// ---------- publicProfiles/{uid} — নতুন সদস্য + সব ব্যবহারকারী খোঁজা ----------
// পাবলিক প্রোফাইলে শুধু এই ক্ষেত্রগুলো: displayName, createdAt, colour, referralCode,
// gender, district, interests, photo (প্রোফাইল ছবির ছোট কপি)।
// referralCode (যেমন cg-abc123) নিজের আইডি কার্ডে এমনিতেই পাবলিক — তাই এখানে
// রাখা যায়; ইমেইল/ফোন/আইডি নম্বর/KYC/ব্যালেন্স/বন্ধু/পুরো ঠিকানা/জন্মতারিখ —
// কিছুই এখানে লেখা হয় না (users/{uid} ডক ব্যক্তিগতই থাকে, শুধু মালিক পড়তে পারেন)।
// createdAt শুধু প্রথমবার বসে — পরে নাম/রং/কোড বদলালেও যোগদানের সময় বদলায় না।
// referralCode পুরোনো প্রোফাইলে না থাকলে merge-এ যোগ হয় (লগইনে ব্যাকফিল)। কখনো throw করে না।
export type PublicProfileExtra = {
  gender?: string
  district?: string
  interests?: string[]
  photo?: string
  // সংখ্যার UID — শুধু বরাদ্দের সময় দেওয়া হয় (ensureNumericUid থেকে);
  // ভুল মান বাদ যায়, আর একবার বসলে আর কখনো বদলানো হয় না।
  numericUid?: number
}
export async function writePublicProfile(uid: string, displayName: string, referralCode?: string, extraFields?: PublicProfileExtra): Promise<boolean> {
  const d = getDb()
  if (!d) return false
  try {
    const ref = doc(d, 'publicProfiles', uid)
    const snap = await getDoc(ref)
    const code = typeof referralCode === 'string' && referralCode.trim() ? referralCode.trim() : undefined
    const extra: Record<string, unknown> = {}
    if (code) extra.referralCode = code
    if (extraFields) {
      if (extraFields.gender === 'Male' || extraFields.gender === 'Female') extra.gender = extraFields.gender
      if (typeof extraFields.district === 'string' && extraFields.district.trim()) extra.district = extraFields.district.trim()
      if (Array.isArray(extraFields.interests)) {
        const list = extraFields.interests.filter((x): x is string => typeof x === 'string' && x.trim() !== '').slice(0, 16)
        if (list.length > 0) extra.interests = list
      }
      if (typeof extraFields.photo === 'string' && (extraFields.photo.startsWith('data:image/') || extraFields.photo.startsWith('https://'))) extra.photo = extraFields.photo
      // Photo removed (empty string) — delete the field, otherwise the old
      // photo would stay in publicProfiles forever and keep showing everywhere.
      if (extraFields.photo === '') extra.photo = deleteField()
      // সংখ্যার UID — বৈধ হলেই লেখা হয় (বরাদ্দ ensureNumericUid থেকে আসে)
      if (extraFields.numericUid !== undefined && isValidNumericUid(extraFields.numericUid)) extra.numericUid = extraFields.numericUid
    }
    if (snap.exists()) {
      await setDoc(ref, { displayName: displayName || 'User', colour: colourForUid(uid), ...extra }, { merge: true })
    } else {
      await setDoc(ref, { displayName: displayName || 'User', createdAt: serverTimestamp(), colour: colourForUid(uid), ...extra })
    }
    return true
  } catch { return false }
}

// সংখ্যার UID বরাদ্দ — publicProfiles/{uid}-এ আগে থেকে বৈধ UID থাকলে
// সেটাই ফেরে (আর বদলায় না); না থাকলে config/uidCounter ট্রানজ্যাকশনে
// পরের নম্বর নিয়ে বসানো হয় — একই মুহূর্তে দুজন সাইন আপ করলেও একই নম্বর
// পায় না (ট্রানজ্যাকশন দ্বন্দ্বে আবার চেষ্টা করে)। ব্যর্থ হলে null —
// তখন UID ছাড়াই চলতে থাকে, পরের লগইনে আবার চেষ্টা হয়। কখনো throw করে না।
// ⚠️ নিয়ম publish না হওয়া পর্যন্ত (config/uidCounter) কাউন্টার লেখা
// যাবে না — firestore.rules-এ কাউন্টার ম্যাচ publish করতে হয়।
export async function ensureNumericUid(uid: string): Promise<number | null> {
  const d = getDb()
  if (!d || !uid) return null
  try {
    const ref = doc(d, 'publicProfiles', uid)
    const snap = await getDoc(ref)
    const existing = snap.exists() ? numericUidFromDoc((snap.data() as Record<string, unknown>).numericUid) : undefined
    if (existing !== undefined) return existing
    const counterRef = doc(d, 'config', 'uidCounter')
    const assigned = await runTransaction(d, async (tx) => {
      const cSnap = await tx.get(counterRef)
      const last = cSnap.exists() && typeof (cSnap.data() as Record<string, unknown>).next === 'number'
        ? (cSnap.data() as Record<string, unknown>).next as number
        : UID_COUNTER_START
      const next = nextNumericUid(last)
      if (next === null) throw new Error('Numeric UIDs exhausted')
      tx.set(counterRef, { next })
      tx.set(ref, { numericUid: next }, { merge: true })
      return next
    })
    return assigned
  } catch { return null }
}

// অ্যাডমিনের ব্যাকফিল — UID নেই এমন ব্যবহারকারীদের যোগদানের ক্রমে
// (createdAt পুরনো → নতুন) UID বসানো; একবারে একজন করে, ক্রমানুসারে।
// অ্যাডমিন শুধু UID-ই বসাতে পারেন (নিয়মে অন্য ক্ষেত্র বন্ধ); আগে থেকে
// UID থাকলে ছোঁয়া হয় না। কখনো throw করে না।
export async function backfillNumericUids(members: { id: string; createdAtMs: number | null; numericUid?: number }[]): Promise<{ assigned: number; failed: number }> {
  const missing = members
    .filter(m => m.numericUid === undefined)
    .sort((a, b) => (a.createdAtMs ?? Number.MAX_SAFE_INTEGER) - (b.createdAtMs ?? Number.MAX_SAFE_INTEGER))
  let assigned = 0
  let failed = 0
  for (const m of missing) {
    const n = await ensureNumericUid(m.id)
    if (n === null) failed++
    else assigned++
  }
  return { assigned, failed }
}

// UID দিয়ে ব্যবহারকারী খোঁজা — publicProfiles-এ numericUid == n ডক
// একটাই থাকে (বরাদ্দ কাউন্টার ট্রানজ্যাকশনে হয়); না থাকলে null।
// টাকা পাঠানোর আগে প্রাপক যাচাইয়ে লাগে — নাম + ছবি দেখে নিশ্চিত হয়ে তবে পাঠানো হয়।
export async function findUserByNumericUid(numericUid: number): Promise<{ uid: string; displayName: string; colour: string; photo?: string; numericUid: number } | null> {
  const d = getDb()
  if (!d || !isValidNumericUid(numericUid)) return null
  try {
    const q = query(collection(d, 'publicProfiles'), where('numericUid', '==', numericUid), limit(1))
    const snap = await getDocs(q)
    if (snap.empty) return null
    const m = mapPublicProfile(snap.docs[0].id, snap.docs[0].data() as Record<string, unknown>)
    if (!m || m.numericUid === undefined) return null
    return { uid: m.id, displayName: m.displayName, colour: m.colour, ...(m.photo ? { photo: m.photo } : {}), numericUid: m.numericUid }
  } catch { return null }
}

// অ্যাডমিনের নাম বদল — শুধু displayName বদলায় (createdAt/colour/অন্য ক্ষেত্র ছোঁয়া হয় না)।
// Firestore নিয়মে অ্যাডমিন-আপডেট অনুমোদিত না হলে false ফেরে — নিয়ম publish না
// হওয়া পর্যন্ত এডিট ব্যর্থ হবে; সেভ কখনো চুপচাপ ব্যর্থ হয় না, UI-তে ভুল দেখায়।
export async function updatePublicProfileName(uid: string, displayName: string): Promise<boolean> {
  const d = getDb()
  const name = displayName.trim()
  if (!d || !uid || !name || name.length > 60) return false
  try {
    await updateDoc(doc(d, 'publicProfiles', uid), { displayName: name })
    return true
  } catch { return false }
}

// ---------- friendRequests — Facebook-এর মতো বন্ধু রিকোয়েস্ট ----------
// ডক: fromUid/toUid (আসল Firebase UID), নাম + রং (+ ঐচ্ছিক ছবি), status,
// createdAtMs। নিয়ম (firestore.rules): তৈরি করতে পারেন শুধু প্রেরক নিজে
// (fromUid নিজের UID, toUid নিজে নয়, status 'pending'); পড়তে পারেন প্রেরক
// বা প্রাপক; প্রাপক শুধু status বদলাতে পারেন (pending → accepted/declined),
// প্রেরক শুধু বাতিল করতে পারেন (pending → cancelled)। মোছা বন্ধ — বাতিল/
// প্রত্যাখ্যান status দিয়েই হয়, তাই দুই দিক থেকেই রিকোয়েস্ট মিলিয়ে যায়।
// কোয়েরি একটাই সমতা-শর্তে (toUid বা fromUid) — কম্পোজিট ইনডেক্স লাগে না;
// status ক্লায়েন্টেই ছাঁকা হয়, নতুন থেকে পুরনো ক্লায়েন্টেই সাজানো হয়।
// Firestore/নিয়ম না থাকলে [] / null / false — অ্যাপ আগের মতো localStorage-এই
// চলে। কখনো throw করে না।
export async function createFriendRequest(data: Omit<FriendRequestDoc, 'id' | 'status' | 'createdAtMs'>): Promise<string | null> {
  const d = getDb()
  if (!d || !data.fromUid || !data.toUid || data.fromUid === data.toUid) return null
  try {
    const ref = await addDoc(collection(d, 'friendRequests'), {
      ...data,
      status: 'pending',
      createdAtMs: Date.now(),
      createdAt: serverTimestamp(),
    })
    return ref.id
  } catch { return null }
}

// status বদল — প্রাপক accepted/declined, প্রেরক cancelled (নিয়মে বাঁধা);
// অন্য status বা অন্য ক্ষেত্র বদলাতে গেলে নিয়মে আটকায়, false ফেরে।
export async function updateFriendRequestStatus(id: string, status: 'accepted' | 'declined' | 'cancelled'): Promise<boolean> {
  const d = getDb()
  if (!d || !id) return false
  try {
    await updateDoc(doc(d, 'friendRequests', id), { status })
    return true
  } catch { return false }
}

// আমার কাছে আসা রিকোয়েস্ট (toUid == আমি) — লাইভ সাবস্ক্রিপশন; Firestore
// না থাকলে null (রিকোয়েস্ট সেকশন তখন লোকাল ক্যাশেই থাকে)।
export function subscribeIncomingFriendRequests(uid: string, cb: (docs: FriendRequestDoc[]) => void): Unsubscribe | null {
  const d = getDb()
  if (!d || !uid) return null
  try {
    const q = query(collection(d, 'friendRequests'), where('toUid', '==', uid), limit(50))
    return onSnapshot(q, (snap) => {
      const docs = snap.docs
        .map(s => mapFriendRequestDoc(s.id, s.data() as Record<string, unknown>))
        .filter((x): x is FriendRequestDoc => x !== null)
      docs.sort((a, b) => b.createdAtMs - a.createdAtMs)
      cb(docs)
    }, () => { /* subscription failed — the requests section keeps its local cache */ })
  } catch { return null }
}

// আমার পাঠানো রিকোয়েস্ট (fromUid == আমি) — লাইভ সাবস্ক্রিপশন; গ্রহণ হলে
// স্টোর এটা দেখেই প্রাপককে বন্ধু তালিকায় যোগ করে।
export function subscribeSentFriendRequests(uid: string, cb: (docs: FriendRequestDoc[]) => void): Unsubscribe | null {
  const d = getDb()
  if (!d || !uid) return null
  try {
    const q = query(collection(d, 'friendRequests'), where('fromUid', '==', uid), limit(50))
    return onSnapshot(q, (snap) => {
      const docs = snap.docs
        .map(s => mapFriendRequestDoc(s.id, s.data() as Record<string, unknown>))
        .filter((x): x is FriendRequestDoc => x !== null)
      docs.sort((a, b) => b.createdAtMs - a.createdAtMs)
      cb(docs)
    }, () => { /* subscription failed — the sent state keeps its last value */ })
  } catch { return null }
}

// ---------- chats/{roomId}/messages/{msgId} — আসল বন্ধুদের মধ্যে চ্যাট ----------
// রুমের চাবি দুই UID-র সাজানো জোড়া (chatRoomId) — দুই দিক থেকে একই রুম মেলে।
// শুধু আসল বন্ধুদের চ্যাট এখানে যায়; ৫ চ্যাট পারসোনা আগের মতোই শুধু এই ডিভাইসে থাকে।
// localStorage (callguru:chatMsgs) অফলাইন ক্যাশ হিসেবে থাকে। কখনো throw করে না।
export type ChatMessage = { id: string; fromUid: string; fromName: string; text: string; ts: number }

export function chatRoomId(a: string, b: string): string {
  return [a, b].sort().join('_')
}

// রুমের নাম থেকে দুই সদস্যের UID — ঘরের নামই সদস্য তালিকা (সাজানো জোড়া)।
export function chatRoomMembers(roomId: string): [string, string] | null {
  const parts = roomId.split('_')
  return parts.length === 2 && parts[0] && parts[1] ? [parts[0], parts[1]] : null
}

// রুমের অন্য সদস্য — নিজের UID দিলে অপরজনের UID ফেরে, না মিললে null।
export function otherRoomMember(roomId: string, uid: string): string | null {
  const m = chatRoomMembers(roomId)
  if (!m) return null
  if (m[0] === uid) return m[1]
  if (m[1] === uid) return m[0]
  return null
}

export async function sendChatMessage(roomId: string, fromUid: string, fromName: string, text: string): Promise<boolean> {
  const d = getDb()
  if (!d) return false
  const t = text.trim()
  if (!t || !roomId || !fromUid) return false
  try {
    await addDoc(collection(d, 'chats', roomId, 'messages'), { fromUid, fromName: fromName || 'User', text: t.slice(0, 2000), ts: Date.now(), createdAt: serverTimestamp() })
    // রুমের সূচক (chats/{roomId} ডক) — অন্য ডিভাইস যেন এই চ্যাটটা খুঁজে পায়।
    // আগে শুধু messages সাবকালেকশনেই লেখা হতো: প্রাপক আগে থেকে প্রেরককে বন্ধু
    // হিসেবে না যোগ করলে রুমের অস্তিত্বই জানত না, তাই মেসেজ কোনোদিন পৌঁছাত না।
    // এটা best-effort — ব্যর্থ হলেও মেসেজটা ইতিমধ্যেই পাঠানো হয়েছে।
    try {
      const members = chatRoomMembers(roomId)
      if (members) {
        await setDoc(doc(d, 'chats', roomId), { members, names: { [fromUid]: fromName || 'User' }, updatedAtMs: Date.now(), updatedAt: serverTimestamp() }, { merge: true })
      }
    } catch { /* রুম সূচক না বসলে মেসেজ তবু পাঠানো থাকে */ }
    return true
  } catch { return false }
}

// আমার চ্যাট রুমগুলো — "আমাকে কে মেসেজ পাঠিয়েছে" জানার একমাত্র পথ।
// members-এ array-contains কোয়েরি (একটাই ক্ষেত্র, কম্পোজিট ইনডেক্স লাগে না);
// নতুন থেকে পুরনো — ক্লায়েন্টেই সাজানো হয়। না পেলে [] — চ্যাট তখন আগের মতো
// বন্ধু তালিকাতেই চলে।
export type ChatRoomSummary = { roomId: string; otherUid: string; otherName: string; updatedAtMs: number; blockedBy?: string[] }

/** রুম ডক পড়া — blockedBy দেখার জন্য (কল/মেসেজ পাঠানোর আগের যাচাই)। না পেলে null। */
export async function fetchChatRoomDoc(roomId: string): Promise<{ blockedBy?: string[] } | null> {
  const d = getDb()
  if (!d || !roomId) return null
  try {
    const snap = await getDoc(doc(d, 'chats', roomId))
    if (!snap.exists()) return null
    const data = snap.data() as Record<string, unknown>
    return { blockedBy: Array.isArray(data.blockedBy) ? (data.blockedBy as unknown[]).filter((x): x is string => typeof x === 'string') : undefined }
  } catch { return null }
}

/** রুম ডকে ব্লক লেখা/তোলা — দুই সদস্যই পড়তে পারেন, তাই ব্লক হওয়া পক্ষও
 *  পাঠানোর আগেই জানতে পারেন। রুম না থাকলে members-সহ তৈরি হয় (নিয়ম: নিজের
 *  UID members-এ থাকলে লেখা যায়)। না পারলে false — অ্যাপ তবু localStorage
 *  ক্যাশের ব্লক মেনে চলে। */
export async function setRoomBlocked(roomId: string, uid: string, blocked: boolean): Promise<boolean> {
  const d = getDb()
  if (!d || !roomId || !uid) return false
  try {
    const members = chatRoomMembers(roomId)
    if (!members) return false
    await setDoc(doc(d, 'chats', roomId), {
      members,
      blockedBy: blocked ? arrayUnion(uid) : arrayRemove(uid),
      updatedAtMs: Date.now(), updatedAt: serverTimestamp(),
    }, { merge: true })
    return true
  } catch { return false }
}

export function subscribeMyChatRooms(uid: string, cb: (rooms: ChatRoomSummary[]) => void): Unsubscribe | null {
  const d = getDb()
  if (!d || !uid) return null
  try {
    const q = query(collection(d, 'chats'), where('members', 'array-contains', uid), limit(20))
    return onSnapshot(q, (snap) => {
      const rooms = snap.docs.map(s => {
        const data = s.data() as Record<string, unknown>
        const other = otherRoomMember(s.id, uid)
        const names = (data.names ?? {}) as Record<string, unknown>
        const otherName = other && typeof names[other] === 'string' ? (names[other] as string) : 'User'
        return {
          roomId: s.id,
          otherUid: other ?? '',
          otherName,
          updatedAtMs: typeof data.updatedAtMs === 'number' ? data.updatedAtMs : 0,
          blockedBy: Array.isArray(data.blockedBy) ? (data.blockedBy as unknown[]).filter((x): x is string => typeof x === 'string') : undefined,
        }
      }).filter(r => r.otherUid !== '')
      rooms.sort((a, b) => b.updatedAtMs - a.updatedAtMs)
      cb(rooms)
    }, () => { /* সাবস্ক্রিপশন ব্যর্থ হলে চ্যাট বন্ধু তালিকাতেই চলবে */ })
  } catch { return null }
}

// রুমের মেসেজে লাইভ সাবস্ক্রিপশন — নতুন মেসেজ এলে cb ডাকা হয় (সময়ের ক্রমে)।
// onSnapshot-এর আনসাবস্ক্রাইব ফাংশন ফেরে; Firestore না থাকলে null ফেরে।
export function subscribeChatMessages(roomId: string, cb: (msgs: ChatMessage[]) => void): Unsubscribe | null {
  const d = getDb()
  if (!d || !roomId) return null
  try {
    const q = query(collection(d, 'chats', roomId, 'messages'), orderBy('ts', 'asc'), limit(200))
    return onSnapshot(q, (snap) => {
      cb(snap.docs.map(s => {
        const data = s.data() as Record<string, unknown>
        return {
          id: s.id,
          fromUid: typeof data.fromUid === 'string' ? data.fromUid : '',
          fromName: typeof data.fromName === 'string' ? data.fromName : 'User',
          text: typeof data.text === 'string' ? data.text : '',
          ts: typeof data.ts === 'number' ? data.ts : 0,
        }
      }))
    }, () => { /* সাবস্ক্রিপশন ব্যর্থ হলে চ্যাট localStorage ক্যাশেই চলবে */ })
  } catch { return null }
}

// নতুন সদস্য — publicProfiles থেকে createdAt অনুযায়ী নতুন থেকে পুরনো, সর্বোচ্চ limitN জন।
// নিয়ম/নেটওয়ার্ক না থাকলে [] ফেরে (খালি অবস্থা দেখায়, ভুয়া কাউকে দেখায় না)।
export async function fetchNewMembers(limitN = 10): Promise<NewMember[]> {
  const d = getDb()
  if (!d) return []
  try {
    const snap = await getDocs(query(collection(d, 'publicProfiles'), orderBy('createdAt', 'desc'), limit(limitN)))
    return snap.docs.map(s => mapPublicProfile(s.id, s.data() as Record<string, unknown>))
  } catch { return [] }
}

// সব আসল ব্যবহারকারী — নাম/আইডি খোঁজার জন্য (publicProfiles, নতুন থেকে পুরনো)।
// সীমা: limitN = 100 — এর বেশি ব্যবহারকারী হলে সবাই একবারে আসে না; তখন সার্ভার-সাইড
// প্রিফিক্স কোয়েরি/ইনডেক্স লাগবে (এখনো বানানো হয়নি)। নিয়ম/নেটওয়ার্ক না থাকলে []
// ফেরে — খোঁজা তখন লোকাল তালিকাতেই চলে, কখনো ভুয়া কাউকে দেখায় না।
export async function fetchAllPublicProfiles(limitN = 100): Promise<NewMember[]> {
  const d = getDb()
  if (!d) return []
  try {
    const snap = await getDocs(query(collection(d, 'publicProfiles'), orderBy('createdAt', 'desc'), limit(limitN)))
    return snap.docs.map(s => mapPublicProfile(s.id, s.data() as Record<string, unknown>))
  } catch { return [] }
}

// ---------- config/public ----------
export async function fetchPublicConfig(): Promise<(PublicConfigDoc & Record<string, unknown>) | null> {
  const d = getDb()
  if (!d) return null
  try {
    const snap = await getDoc(doc(d, 'config', 'public'))
    if (!snap.exists()) return null
    return snap.data() as PublicConfigDoc & Record<string, unknown>
  } catch { return null }
}

export async function writePublicConfig(data: PublicConfigDoc): Promise<boolean> {
  const d = getDb()
  if (!d) return false
  try {
    await setDoc(doc(d, 'config', 'public'), { ...data, updatedAt: serverTimestamp() })
    return true
  } catch { return false }
}

// ---------- topups/{id} ----------
export async function writeTopUpDoc(id: string, data: TopUpDoc): Promise<boolean> {
  const d = getDb()
  if (!d) return false
  try {
    await setDoc(doc(d, 'topups', id), { ...data, updatedAt: serverTimestamp() })
    return true
  } catch { return false }
}

export async function updateTopUpStatus(id: string, status: 'approved' | 'rejected'): Promise<boolean> {
  const d = getDb()
  if (!d) return false
  try {
    await updateDoc(doc(d, 'topups', id), { status, updatedAt: serverTimestamp() })
    return true
  } catch { return false }
}

// অ্যাডমিনের জন্য সব pending আবেদন (নিয়ম: অ্যাডমিনই শুধু সব পড়তে পারেন)।
export async function fetchPendingTopUps(): Promise<Array<{ id: string; data: TopUpDoc & Record<string, unknown> }>> {
  const d = getDb()
  if (!d) return []
  try {
    const snap = await getDocs(query(collection(d, 'topups'), where('status', '==', 'pending')))
    return snap.docs.map(s => ({ id: s.id, data: s.data() as TopUpDoc & Record<string, unknown> }))
  } catch { return [] }
}

// এই ব্যবহারকারীর নিজের সব টপ-আপ আবেদন (নিজের ডিভাইসে স্ট্যাটাস আপডেট দেখাতে)।
export async function fetchMyTopUps(uid: string): Promise<Array<{ id: string; data: TopUpDoc & Record<string, unknown> }>> {
  const d = getDb()
  if (!d) return []
  try {
    const snap = await getDocs(query(collection(d, 'topups'), where('uid', '==', uid)))
    return snap.docs.map(s => ({ id: s.id, data: s.data() as TopUpDoc & Record<string, unknown> }))
  } catch { return [] }
}

// ---------- piTransfers/{id} — ব্যবহারকারী থেকে ব্যবহারকারী Pi ট্রান্সফার ----------
// নিয়ম: প্রাপক/অ্যাডমিনের users ডক অন্য কেউ লিখতে পারে না — তাই ব্যালেন্স
// জমা হয় transfer ডক থেকে, প্রত্যেকের নিজের ডিভাইসে (applyPiTransfer,
// store.tsx)। এই ট্রানজ্যাকশনে শুধু দুটো জিনিস একসাথে হয় — পাঠকের নিজের
// ডক থেকে টাকা কাটা + piTransfers ডক তৈরি। একটা ব্যর্থ হলে অন্যটাও হয় না,
// তাই টাকা কাটা গেলেও রেকর্ড না থাকা, বা রেকর্ড থাকলেও টাকা না কাটা —
// কোনোটাই হতে পারে না। কখনো throw করে না।
export async function createPiTransfer(input: {
  fromUid: string
  toUid: string
  fromName: string
  toName: string
  fromNumericUid?: number
  toNumericUid?: number
  amount: number
  feePct: number
  // অ্যাডমিনের ম্যানুয়াল পাঠানো — ফি ০%, note থাকে, KYC যাচাই বাদ যায়
  // (অ্যাডমিনের পাঠানো অনুমোদন-নির্ভর নয় — অ্যাডমিন নিজেই অনুমোদনকারী)।
  kind?: 'admin'
  note?: string
  skipKycCheck?: boolean
}): Promise<{ ok: true; transfer: PiTransferDoc; newBalance: number } | { ok: false; error: string }> {
  const d = getDb()
  if (!d) return { ok: false, error: 'No connection — try again.' }
  if (input.fromUid === input.toUid) return { ok: false, error: 'You cannot send Pi to yourself.' }
  const { amount, fee, net } = computeTransfer(input.amount, input.feePct)
  if (amount <= 0) return { ok: false, error: 'Enter a valid amount.' }
  const transferRef = doc(collection(d, 'piTransfers'))
  const transferId = transferRef.id
  const transfer: PiTransferDoc = {
    id: transferId,
    fromUid: input.fromUid,
    toUid: input.toUid,
    adminUid: ADMIN_UID,
    fromName: input.fromName.trim().slice(0, 80) || 'User',
    toName: input.toName.trim().slice(0, 80) || 'User',
    ...(input.fromNumericUid !== undefined && isValidNumericUid(input.fromNumericUid) ? { fromNumericUid: input.fromNumericUid } : {}),
    ...(input.toNumericUid !== undefined && isValidNumericUid(input.toNumericUid) ? { toNumericUid: input.toNumericUid } : {}),
    amount,
    fee,
    net,
    feePct: input.feePct,
    ...(input.kind === 'admin' ? { kind: 'admin' as const } : {}),
    ...(typeof input.note === 'string' && input.note.trim() ? { note: input.note.trim().slice(0, 200) } : {}),
    participants: [...new Set([input.fromUid, input.toUid, ADMIN_UID])],
    status: 'completed',
    createdAtMs: Date.now(),
  }
  try {
    const newBalance = await runTransaction(d, async (tx) => {
      const senderRef = doc(d, 'users', input.fromUid)
      const snap = await tx.get(senderRef)
      if (!snap.exists()) throw new Error('no-sender-doc')
      const data = snap.data() as Record<string, unknown>
      // ক্লাউডের ব্যালেন্সই সত্য — পাঠানোর আগে store স্থানীয় স্ন্যাপশট
      // ক্লাউডে তুলে দেয়, তাই এখানে পুরোনো অঙ্ক থাকে না।
      const bal = typeof data.piBalance === 'number' && Number.isFinite(data.piBalance) ? data.piBalance : 0
      const kycStatus = (data.kyc as Record<string, unknown> | undefined)?.status
      if (!input.skipKycCheck && kycStatus !== 'approved') throw new Error('kyc')
      if (roundPi(bal) < amount) throw new Error('balance')
      const ledger = Array.isArray(data.piLedger) ? (data.piLedger as { id: string; date: string; type: string; label: string; amount: number }[]) : []
      const row = buildTransferApplication(transfer, 'sent').row
      const newLedger = [row, ...ledger].slice(0, 200)
      tx.update(senderRef, { piBalance: roundPi(bal - amount), piLedger: newLedger, updatedAt: serverTimestamp() })
      const { createdAtMs: _omit, ...docData } = transfer
      tx.set(transferRef, { ...docData, createdAt: serverTimestamp() })
      return roundPi(bal - amount)
    })
    return { ok: true, transfer, newBalance }
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (msg === 'kyc') return { ok: false, error: 'Pi send needs approved KYC — complete Dating KYC first.' }
    if (msg === 'balance') return { ok: false, error: 'Not enough Pi balance — only real Pi can be sent, bonus Pi cannot be transferred.' }
    if (msg === 'no-sender-doc') return { ok: false, error: 'Your account was not found — log in again and try.' }
    return { ok: false, error: 'Transfer failed — nothing was sent. Check the connection and try again.' }
  }
}

// আমার ট্রান্সফারগুলো (পাঠানো + পাওয়া + ফি) — participants-এ আমি আছি এমন
// ডক; নতুনতম আগে। array-contains একক ফিল্টার — কম্পোজিট ইনডেক্স লাগে না।
export async function fetchMyPiTransfers(uid: string): Promise<PiTransferDoc[]> {
  const d = getDb()
  if (!d || !uid) return []
  try {
    const snap = await getDocs(query(collection(d, 'piTransfers'), where('participants', 'array-contains', uid), limit(50)))
    const list = snap.docs.map(s => mapPiTransferDoc(s.id, s.data() as Record<string, unknown>)).filter((x): x is PiTransferDoc => x !== null)
    list.sort((a, b) => b.createdAtMs - a.createdAtMs)
    return list
  } catch { return [] }
}

// আমার ট্রান্সফারগুলোর লাইভ সাবস্ক্রিপশন — নতুন ট্রান্সফার এলেই কলব্যাক
// (প্রাপক/অ্যাডমিনের জমা এখান থেকেই হয়)।
export function subscribeMyPiTransfers(uid: string, cb: (docs: PiTransferDoc[]) => void): Unsubscribe | null {
  const d = getDb()
  if (!d || !uid) return null
  try {
    const q = query(collection(d, 'piTransfers'), where('participants', 'array-contains', uid), limit(50))
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map(s => mapPiTransferDoc(s.id, s.data() as Record<string, unknown>)).filter((x): x is PiTransferDoc => x !== null)
      list.sort((a, b) => b.createdAtMs - a.createdAtMs)
      cb(list)
    }, () => { /* listener failed — login fetch still covers it */ })
  } catch { return null }
}

// ---------- services/{serviceId} — virtual (video-call only) services ----------
// Real user-created listings only — no seeds, no demo providers. A service is
// delivered by video call; there is no location / in-person field. Firestore
// off / rules not published yet → [] / null / false, and the UI falls back to
// its localStorage cache (graceful degradation, like the feed). Never throws.
export type NewServiceDoc = {
  providerUid: string
  providerName: string
  providerPhoto?: string
  title: string
  description: string
  ratePiPerMin: number
}

export async function fetchServices(limitN = 50): Promise<ServiceListing[]> {
  const d = getDb()
  if (!d) return []
  try {
    const snap = await getDocs(query(collection(d, 'services'), orderBy('createdAtMs', 'desc'), limit(limitN)))
    return snap.docs
      .map(s => mapServiceDoc(s.id, s.data() as Record<string, unknown>))
      .filter((s): s is ServiceListing => s !== null)
  } catch { return [] }
}

export async function fetchService(id: string): Promise<ServiceListing | null> {
  const d = getDb()
  if (!d || !id) return null
  try {
    const snap = await getDoc(doc(d, 'services', id))
    if (!snap.exists()) return null
    return mapServiceDoc(snap.id, snap.data() as Record<string, unknown>)
  } catch { return null }
}

export function subscribeServices(cb: (services: ServiceListing[]) => void): Unsubscribe | null {
  const d = getDb()
  if (!d) return null
  try {
    const q = query(collection(d, 'services'), orderBy('createdAtMs', 'desc'), limit(50))
    return onSnapshot(q, (snap) => {
      cb(snap.docs
        .map(s => mapServiceDoc(s.id, s.data() as Record<string, unknown>))
        .filter((s): s is ServiceListing => s !== null))
    }, () => { /* subscription failed — the section keeps its local cache */ })
  } catch { return null }
}

// A service is created by its provider (rules: providerUid must be own uid).
// Returns the new doc id, or null when Firestore is unreachable / denied.
export async function createServiceDoc(data: NewServiceDoc): Promise<string | null> {
  const d = getDb()
  if (!d) return null
  try {
    const ref = await addDoc(collection(d, 'services'), {
      ...data,
      description: data.description || '',
      createdAtMs: Date.now(),
      createdAt: serverTimestamp(),
    })
    return ref.id
  } catch { return null }
}

// ---------- services/{serviceId}/reviews/{reviewId} ----------
// Reviews are public to signed-in users, WITH the reviewer's name shown
// (owner requirement). Only the reviewer themself can create one
// (rules: reviewerUid must be own uid). No update / delete.
export async function fetchServiceReviews(serviceId: string, limitN = 50): Promise<ServiceReview[]> {
  const d = getDb()
  if (!d || !serviceId) return []
  try {
    const snap = await getDocs(query(collection(d, 'services', serviceId, 'reviews'), orderBy('createdAtMs', 'desc'), limit(limitN)))
    return snap.docs
      .map(s => mapReviewDoc(s.id, serviceId, s.data() as Record<string, unknown>))
      .filter((r): r is ServiceReview => r !== null)
  } catch { return [] }
}

export function subscribeServiceReviews(serviceId: string, cb: (reviews: ServiceReview[]) => void): Unsubscribe | null {
  const d = getDb()
  if (!d || !serviceId) return null
  try {
    const q = query(collection(d, 'services', serviceId, 'reviews'), orderBy('createdAtMs', 'desc'), limit(50))
    return onSnapshot(q, (snap) => {
      cb(snap.docs
        .map(s => mapReviewDoc(s.id, serviceId, s.data() as Record<string, unknown>))
        .filter((r): r is ServiceReview => r !== null))
    }, () => { /* subscription failed — the card keeps its last reviews */ })
  } catch { return null }
}

export async function submitServiceReview(serviceId: string, review: { reviewerUid: string; reviewerName: string; stars: number; text: string }): Promise<boolean> {
  const d = getDb()
  if (!d || !serviceId || !review.reviewerUid || !review.reviewerName.trim()) return false
  const stars = Math.trunc(review.stars)
  if (stars < 1 || stars > 5) return false
  try {
    await addDoc(collection(d, 'services', serviceId, 'reviews'), {
      reviewerUid: review.reviewerUid,
      reviewerName: review.reviewerName.trim().slice(0, 80),
      stars,
      text: review.text.trim().slice(0, 300),
      createdAtMs: Date.now(),
      createdAt: serverTimestamp(),
    })
    return true
  } catch { return false }
}

// ---------- ads/{adId} — user product ads (self-serve) ----------
// A user advertises their own product (photo, title, price, website link).
// Submitting saves PENDING for admin review; only APPROVED ads show in the
// Feed. No payment is taken (model undecided). Firestore off / rules not
// published yet → [] / null / false, and the UI falls back to its
// localStorage cache (graceful degradation, like services). Never throws.
export type NewAdDoc = {
  ownerUid: string
  ownerName: string
  title: string
  description: string
  priceBDT: number
  link: string
  photo?: string
}

export async function fetchAds(limitN = 50): Promise<UserAd[]> {
  const d = getDb()
  if (!d) return []
  try {
    const snap = await getDocs(query(collection(d, 'ads'), orderBy('createdAtMs', 'desc'), limit(limitN)))
    return snap.docs
      .map(s => mapAdDoc(s.id, s.data() as Record<string, unknown>))
      .filter((a): a is UserAd => a !== null)
  } catch { return [] }
}

export async function fetchApprovedAds(limitN = 20): Promise<UserAd[]> {
  const d = getDb()
  if (!d) return []
  try {
    const snap = await getDocs(query(collection(d, 'ads'), where('status', '==', 'approved'), orderBy('createdAtMs', 'desc'), limit(limitN)))
    return snap.docs
      .map(s => mapAdDoc(s.id, s.data() as Record<string, unknown>))
      .filter((a): a is UserAd => a !== null)
  } catch { return [] }
}

export function subscribeApprovedAds(cb: (ads: UserAd[]) => void): Unsubscribe | null {
  const d = getDb()
  if (!d) return null
  try {
    const q = query(collection(d, 'ads'), where('status', '==', 'approved'), orderBy('createdAtMs', 'desc'), limit(20))
    return onSnapshot(q, (snap) => {
      cb(snap.docs
        .map(s => mapAdDoc(s.id, s.data() as Record<string, unknown>))
        .filter((a): a is UserAd => a !== null))
    }, () => { /* subscription failed — the Feed keeps its local cache */ })
  } catch { return null }
}

// A user ad is created PENDING (rules: ownerUid must be own uid; the server
// never trusts a client-set status). Returns the new doc id, or null when
// Firestore is unreachable / denied.
export async function createAdDoc(data: NewAdDoc): Promise<string | null> {
  const d = getDb()
  if (!d) return null
  try {
    const ref = await addDoc(collection(d, 'ads'), {
      ...data,
      description: data.description || '',
      status: 'pending',
      views: 0,
      clicks: 0,
      createdAtMs: Date.now(),
      createdAt: serverTimestamp(),
    })
    return ref.id
  } catch { return null }
}

// Admin only (rules: isAdmin) — approve or reject a pending ad.
export async function updateAdStatus(id: string, status: 'approved' | 'rejected'): Promise<boolean> {
  const d = getDb()
  if (!d || !id) return false
  try {
    await updateDoc(doc(d, 'ads', id), { status, updatedAt: serverTimestamp() })
    return true
  } catch { return false }
}

// CPM/CPC billing — one view per ad per device session is counted by the
// caller (sessionStorage guard in the Feed); one click per link tap.
export async function recordAdView(id: string): Promise<void> {
  const d = getDb()
  if (!d || !id) return
  try { await updateDoc(doc(d, 'ads', id), { views: increment(1) }) } catch { /* best-effort */ }
}

export async function recordAdClick(id: string): Promise<void> {
  const d = getDb()
  if (!d || !id) return
  try { await updateDoc(doc(d, 'ads', id), { clicks: increment(1) }) } catch { /* best-effort */ }
}

// ---------- groups/{groupId} + pages/{pageId} — Groups & Pages ----------
// A group is a member community (public/private); a page is a public
// presence (business/creator/community). Both start empty — member/follower
// counts come only from real uid arrays, never invented. Firestore off or
// rules not published yet → [] / null / false, and the UI falls back to its
// localStorage cache (graceful degradation, like services). Never throws.
export type NewGroupDoc = {
  ownerUid: string
  ownerName: string
  name: string
  description: string
  visibility: 'public' | 'private'
}

export type NewPageDoc = {
  ownerUid: string
  ownerName: string
  name: string
  category: string
  description: string
}

export async function fetchGroups(limitN = 50): Promise<GroupItem[]> {
  const d = getDb()
  if (!d) return []
  try {
    const snap = await getDocs(query(collection(d, 'groups'), orderBy('createdAtMs', 'desc'), limit(limitN)))
    return snap.docs
      .map(s => mapGroupDoc(s.id, s.data() as Record<string, unknown>))
      .filter((g): g is GroupItem => g !== null)
  } catch { return [] }
}

export async function fetchGroup(id: string): Promise<GroupItem | null> {
  const d = getDb()
  if (!d || !id) return null
  try {
    const snap = await getDoc(doc(d, 'groups', id))
    if (!snap.exists()) return null
    return mapGroupDoc(snap.id, snap.data() as Record<string, unknown>)
  } catch { return null }
}

export function subscribeGroups(cb: (groups: GroupItem[]) => void): Unsubscribe | null {
  const d = getDb()
  if (!d) return null
  try {
    const q = query(collection(d, 'groups'), orderBy('createdAtMs', 'desc'), limit(50))
    return onSnapshot(q, (snap) => {
      cb(snap.docs
        .map(s => mapGroupDoc(s.id, s.data() as Record<string, unknown>))
        .filter((g): g is GroupItem => g !== null))
    }, () => { /* subscription failed — the page keeps its local cache */ })
  } catch { return null }
}

export async function createGroupDoc(data: NewGroupDoc): Promise<string | null> {
  const d = getDb()
  if (!d) return null
  try {
    const ref = await addDoc(collection(d, 'groups'), {
      ...data,
      description: data.description || '',
      memberUids: [data.ownerUid],
      createdAtMs: Date.now(),
      createdAt: serverTimestamp(),
    })
    return ref.id
  } catch { return null }
}

// Join a public group (the owner is already a member). Private groups: only
// the owner can add members — a non-owner join attempt is refused by rules.
export async function joinGroup(id: string, uid: string): Promise<boolean> {
  const d = getDb()
  if (!d || !id || !uid) return false
  try {
    await updateDoc(doc(d, 'groups', id), { memberUids: arrayUnion(uid) })
    return true
  } catch { return false }
}

export async function leaveGroup(id: string, uid: string): Promise<boolean> {
  const d = getDb()
  if (!d || !id || !uid) return false
  try {
    await updateDoc(doc(d, 'groups', id), { memberUids: arrayRemove(uid) })
    return true
  } catch { return false }
}

// The owner adds a member (any uid, not just their own). Rules allow the
// owner to update the group, so this works for public and private groups;
// a non-owner add is refused by the rules.
export async function addGroupMember(id: string, uid: string): Promise<boolean> {
  const d = getDb()
  if (!d || !id || !uid) return false
  try {
    await updateDoc(doc(d, 'groups', id), { memberUids: arrayUnion(uid) })
    return true
  } catch { return false }
}

// The owner removes a member (never themselves — the owner is always a
// member; leaving is the owner's own choice via leaveGroup).
export async function removeGroupMember(id: string, uid: string): Promise<boolean> {
  const d = getDb()
  if (!d || !id || !uid) return false
  try {
    await updateDoc(doc(d, 'groups', id), { memberUids: arrayRemove(uid) })
    return true
  } catch { return false }
}

// ---------- groups/{groupId}/posts/{postId} — group posts (text only) ----------
// Only members can write; rules check membership on the parent group doc.
// Photo posts stay out — Storage is not enabled and feed photos are
// device-local data URLs that must never go to Firestore.
export async function fetchGroupPosts(groupId: string, limitN = 50): Promise<GroupPost[]> {
  const d = getDb()
  if (!d || !groupId) return []
  try {
    const snap = await getDocs(query(collection(d, 'groups', groupId, 'posts'), orderBy('createdAtMs', 'desc'), limit(limitN)))
    return snap.docs
      .map(s => mapGroupPostDoc(s.id, s.data() as Record<string, unknown>))
      .filter((p): p is GroupPost => p !== null)
  } catch { return [] }
}

export function subscribeGroupPosts(groupId: string, cb: (posts: GroupPost[]) => void): Unsubscribe | null {
  const d = getDb()
  if (!d || !groupId) return null
  try {
    const q = query(collection(d, 'groups', groupId, 'posts'), orderBy('createdAtMs', 'desc'), limit(50))
    return onSnapshot(q, (snap) => {
      cb(snap.docs
        .map(s => mapGroupPostDoc(s.id, s.data() as Record<string, unknown>))
        .filter((p): p is GroupPost => p !== null))
    }, () => { /* subscription failed — the page keeps its local cache */ })
  } catch { return null }
}

export async function createGroupPostDoc(groupId: string, data: { authorUid: string; authorName: string; text: string }): Promise<string | null> {
  const d = getDb()
  if (!d || !groupId) return null
  const text = data.text.trim()
  if (!text || !data.authorUid || !data.authorName.trim()) return null
  try {
    const ref = await addDoc(collection(d, 'groups', groupId, 'posts'), {
      authorUid: data.authorUid,
      authorName: data.authorName.trim(),
      text: text.slice(0, 1000),
      createdAtMs: Date.now(),
      createdAt: serverTimestamp(),
    })
    return ref.id
  } catch { return null }
}

export async function fetchPages(limitN = 50): Promise<PageItem[]> {
  const d = getDb()
  if (!d) return []
  try {
    const snap = await getDocs(query(collection(d, 'pages'), orderBy('createdAtMs', 'desc'), limit(limitN)))
    return snap.docs
      .map(s => mapPageDoc(s.id, s.data() as Record<string, unknown>))
      .filter((p): p is PageItem => p !== null)
  } catch { return [] }
}

export async function fetchPage(id: string): Promise<PageItem | null> {
  const d = getDb()
  if (!d || !id) return null
  try {
    const snap = await getDoc(doc(d, 'pages', id))
    if (!snap.exists()) return null
    return mapPageDoc(snap.id, snap.data() as Record<string, unknown>)
  } catch { return null }
}

export function subscribePages(cb: (pages: PageItem[]) => void): Unsubscribe | null {
  const d = getDb()
  if (!d) return null
  try {
    const q = query(collection(d, 'pages'), orderBy('createdAtMs', 'desc'), limit(50))
    return onSnapshot(q, (snap) => {
      cb(snap.docs
        .map(s => mapPageDoc(s.id, s.data() as Record<string, unknown>))
        .filter((p): p is PageItem => p !== null))
    }, () => { /* subscription failed — the page keeps its local cache */ })
  } catch { return null }
}

export async function createPageDoc(data: NewPageDoc): Promise<string | null> {
  const d = getDb()
  if (!d) return null
  try {
    const ref = await addDoc(collection(d, 'pages'), {
      ...data,
      category: data.category || '',
      description: data.description || '',
      followerUids: [],
      createdAtMs: Date.now(),
      createdAt: serverTimestamp(),
    })
    return ref.id
  } catch { return null }
}

export async function followPage(id: string, uid: string): Promise<boolean> {
  const d = getDb()
  if (!d || !id || !uid) return false
  try {
    await updateDoc(doc(d, 'pages', id), { followerUids: arrayUnion(uid) })
    return true
  } catch { return false }
}

export async function unfollowPage(id: string, uid: string): Promise<boolean> {
  const d = getDb()
  if (!d || !id || !uid) return false
  try {
    await updateDoc(doc(d, 'pages', id), { followerUids: arrayRemove(uid) })
    return true
  } catch { return false }
}

// ---------- pages/{pageId}/posts/{postId} — page posts (text only) ----------
// Only the page owner writes; rules check ownership on the parent page doc.
// Followers and visitors read. Same text-only rule as group posts.
export async function fetchPagePosts(pageId: string, limitN = 50): Promise<PagePost[]> {
  const d = getDb()
  if (!d || !pageId) return []
  try {
    const snap = await getDocs(query(collection(d, 'pages', pageId, 'posts'), orderBy('createdAtMs', 'desc'), limit(limitN)))
    return snap.docs
      .map(s => mapPagePostDoc(s.id, s.data() as Record<string, unknown>))
      .filter((p): p is PagePost => p !== null)
  } catch { return [] }
}

export function subscribePagePosts(pageId: string, cb: (posts: PagePost[]) => void): Unsubscribe | null {
  const d = getDb()
  if (!d || !pageId) return null
  try {
    const q = query(collection(d, 'pages', pageId, 'posts'), orderBy('createdAtMs', 'desc'), limit(50))
    return onSnapshot(q, (snap) => {
      cb(snap.docs
        .map(s => mapPagePostDoc(s.id, s.data() as Record<string, unknown>))
        .filter((p): p is PagePost => p !== null))
    }, () => { /* subscription failed — the page keeps its local cache */ })
  } catch { return null }
}

export async function createPagePostDoc(pageId: string, data: { authorUid: string; authorName: string; text: string }): Promise<string | null> {
  const d = getDb()
  if (!d || !pageId) return null
  const text = data.text.trim()
  if (!text || !data.authorUid || !data.authorName.trim()) return null
  try {
    const ref = await addDoc(collection(d, 'pages', pageId, 'posts'), {
      authorUid: data.authorUid,
      authorName: data.authorName.trim(),
      text: text.slice(0, 1000),
      createdAtMs: Date.now(),
      createdAt: serverTimestamp(),
    })
    return ref.id
  } catch { return null }
}
