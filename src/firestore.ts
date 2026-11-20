// Firestore — আসল (শেয়ার করা) ডেটা স্তর।
// Firebase প্রজেক্ট picall-76185। Firestore কনসোলে চালু না থাকলে, বা নেটওয়ার্ক/
// অনুমতি না থাকলে, প্রতিটি ফাংশন null/false ফেরায় — অ্যাপ তখন ঠিক আগের মতো
// localStorage-এই চলে (অফলাইন ক্যাশ / graceful degradation)। কোনো ফাংশন throw করে না।
// NID/সেলফি/ভিডিও এখানে কখনো লেখা হয় না — ম্যাপিংটাই (firestoreMapping.ts) সেগুলো বাদ দেয়।
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, serverTimestamp, type Firestore } from 'firebase/firestore'
import { getFirebaseApp, isFirebaseConfigured } from './firebase'
import type { PublicConfigDoc, TopUpDoc, UserDoc } from './firestoreMapping'

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
