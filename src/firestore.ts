// Firestore — আসল (শেয়ার করা) ডেটা স্তর।
// Firebase প্রজেক্ট picall-76185। Firestore কনসোলে চালু না থাকলে, বা নেটওয়ার্ক/
// অনুমতি না থাকলে, প্রতিটি ফাংশন null/false ফেরায় — অ্যাপ তখন ঠিক আগের মতো
// localStorage-এই চলে (অফলাইন ক্যাশ / graceful degradation)। কোনো ফাংশন throw করে না।
// NID/সেলফি/ভিডিও এখানে কখনো লেখা হয় না — ম্যাপিংটাই (firestoreMapping.ts) সেগুলো বাদ দেয়।
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, orderBy, limit, serverTimestamp, addDoc, onSnapshot, deleteField, increment, arrayUnion, arrayRemove, type Firestore, type Unsubscribe } from 'firebase/firestore'
import { getFirebaseApp, isFirebaseConfigured } from './firebase'
import type { PublicConfigDoc, TopUpDoc, UserDoc } from './firestoreMapping'
import { colourForUid, mapPublicProfile, type NewMember } from './newMembers'
import { mapAdDoc, type UserAd } from './ads'
import { mapGroupDoc, mapGroupPostDoc, mapPageDoc, mapPagePostDoc, type GroupItem, type GroupPost, type PageItem, type PagePost } from './groups'
import { mapReviewDoc, mapServiceDoc, type ServiceListing, type ServiceReview } from './services'

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
    }
    if (snap.exists()) {
      await setDoc(ref, { displayName: displayName || 'User', colour: colourForUid(uid), ...extra }, { merge: true })
    } else {
      await setDoc(ref, { displayName: displayName || 'User', createdAt: serverTimestamp(), colour: colourForUid(uid), ...extra })
    }
    return true
  } catch { return false }
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
