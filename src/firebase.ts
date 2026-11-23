// Firebase — আসল ১-ক্লিক Gmail (Google) লগইন।
// Config শুধু environment variable থেকে আসে (GitHub Actions-এ VITE_FIREBASE_* secrets হিসেবে বসাতে হয়)।
// কোনো key এখানে hard-code করা নেই, কোনো project ID বানানো নেই।
// কোনো একটা value না থাকলে isFirebaseConfigured false হয় আর লগইন পেজ ডেমো মোডে চলে।
import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth, GoogleAuthProvider, signInWithPopup,
  sendSignInLinkToEmail, signInWithEmailLink, isSignInWithEmailLink,
  onAuthStateChanged, type Auth, type User,
} from 'firebase/auth'

const _env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}
const firebaseConfig = {
  apiKey: _env.VITE_FIREBASE_API_KEY,
  authDomain: _env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: _env.VITE_FIREBASE_PROJECT_ID,
  appId: _env.VITE_FIREBASE_APP_ID,
  storageBucket: _env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: _env.VITE_FIREBASE_MESSAGING_SENDER_ID,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
)

let app: FirebaseApp | null = null
let auth: Auth | null = null

export function getFirebaseAuth(): Auth | null {
  if (!isFirebaseConfigured) return null
  if (!auth) {
    app = initializeApp(firebaseConfig as { apiKey: string; authDomain: string; projectId: string; appId: string })
    auth = getAuth(app)
  }
  return auth
}

// Firestore-এর জন্য একই Firebase অ্যাপ — আলাদা করে initialize করা হয় না।
export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null
  if (!app) getFirebaseAuth()
  return app
}

// এখন লগইন করা Firebase ব্যবহারকারীর UID (users/{uid} ডকের চাবি)।
// লগইন না থাকলে, বা Firebase সেটআপ না থাকলে, বা OTP লগইনে (Firebase সেশন নেই) null।
export function getCurrentUid(): string | null {
  try { return getFirebaseAuth()?.currentUser?.uid ?? null } catch { return null }
}

// এখন লগইন করা Firebase ব্যবহারকারীর ID token — সুরক্ষিত API রুট
// (অ্যাডমিন সেটিংস, লাইভ রুম, পুশ সাবস্ক্রিপশন) + WebSocket presence-এ
// Authorization হিসেবে পাঠানো হয়। লগইন না থাকলে null। টোকেন কখনো লগ হয় না।
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  try {
    const u = getFirebaseAuth()?.currentUser
    if (!u) return null
    return await u.getIdToken(forceRefresh)
  } catch { return null }
}

// Firebase সেশন ফিরে এলে (পেজ রিলোডের পর) UID জানানো হয় — স্টোর এতে Firestore সিঙ্ক চালায়।
// Firebase সেটআপ না থাকলে কিছুই করে না, আনসাবস্ক্রাইব ফাংশন ফেরায়।
export function onFirebaseAuthUser(cb: (u: User | null) => void): () => void {
  const a = getFirebaseAuth()
  if (!a) return () => { /* no-op */ }
  return onAuthStateChanged(a, cb)
}

// আসল Google Sign-In — popup থেকে ফেরত আসা আসল নাম + ইমেইল দেয়।
// Config না থাকলে null ফেরায় — কলারকে তখন ভুল করে ডেমো লগইন করা যাবে না,
// স্পষ্ট ভুল বার্তা দেখাতে হবে।
export async function signInWithGoogle(): Promise<{ name: string; email: string } | null> {
  const a = getFirebaseAuth()
  if (!a) return null
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(a, provider)
  const user = result.user
  if (!user.email) return null
  return {
    name: user.displayName || user.email.split('@')[0] || 'Gmail user',
    email: user.email,
  }
}

// ---------- ইমেইল লিংক লগইন (পাসওয়ার্ড ছাড়া, Firebase passwordless) ----------
// লিংকে ট্যাপ করলেই লগইন — কোনো পাসওয়ার্ড লাগে না, কোনো ডেমো লগইন নেই।
const EMAIL_FOR_SIGN_IN_KEY = 'callguru:emailForSignIn'

function readStoredEmailForSignIn(): string | null {
  try { return localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY) } catch { return null }
}

/** এই পেজের URL-টাই কি Firebase ইমেইল-লিংক সাইন-ইন লিংক? */
export function isEmailLinkSignIn(): boolean {
  const a = getFirebaseAuth()
  if (!a) return false
  try { return isSignInWithEmailLink(a, window.location.href) } catch { return false }
}

/** ইমেইলে লগইন লিংক পাঠান — লিংক পাঠানোর সময় ইমেইলটি সংরক্ষণ করা হয়,
 *  যাতে লিংকে ফিরে এলে আর ইমেইল চাইতে না হয়। Config না থাকলে throw করে। */
export async function sendEmailLink(email: string): Promise<void> {
  const a = getFirebaseAuth()
  if (!a) throw new Error('firebase_not_configured')
  await sendSignInLinkToEmail(a, email, {
    url: 'https://picallbd.web.app/login',
    handleCodeInApp: true,
  })
  try { localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email) } catch { /* ignore */ }
}

/** লিংক থেকে লগইন সম্পূর্ণ করা — সফল হলে আসল নাম + যাচাই করা ইমেইল দেয়।
 *  সংরক্ষিত ইমেইল না থাকলে কলারকে ইমেইল দিতে হবে (email আর্গুমেন্টে)।
 *  লিংক মেয়াদোত্তীর্ণ/ভুল হলে null ফেরায়। সফল হলে সংরক্ষিত ইমেইল মুছে দেওয়া হয়। */
export async function completeEmailLink(emailArg?: string): Promise<{ name: string; email: string } | null> {
  const a = getFirebaseAuth()
  if (!a) return null
  const email = (emailArg || '').trim().toLowerCase() || readStoredEmailForSignIn()
  if (!email) return null
  try {
    const result = await signInWithEmailLink(a, email, window.location.href)
    const user = result.user
    if (!user.email) return null
    try { localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY) } catch { /* ignore */ }
    return {
      name: user.displayName || user.email.split('@')[0] || 'Email user',
      email: user.email,
    }
  } catch {
    return null
  }
}
