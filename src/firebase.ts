// Firebase — আসল ১-ক্লিক Gmail (Google) লগইন।
// Config শুধু environment variable থেকে আসে (GitHub Actions-এ VITE_FIREBASE_* secrets হিসেবে বসাতে হয়)।
// কোনো key এখানে hard-code করা নেই, কোনো project ID বানানো নেই।
// কোনো একটা value না থাকলে isFirebaseConfigured false হয় আর লগইন পেজ ডেমো মোডে চলে।
import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth, GoogleAuthProvider, signInWithPopup, getAdditionalUserInfo,
  sendSignInLinkToEmail, signInWithEmailLink, isSignInWithEmailLink,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, updateProfile,
  signInAnonymously,
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

// ---------- বেনামি সেশন (শুধু টোকেনের জন্য — OTP লগইন) ----------
// OTP-তে যাচাই করা ইমেইল দিয়ে লগইন করা ব্যবহারকারীর Firebase সেশন নেই —
// Firestore লেখা/পড়া (কল ইনভাইট, বন্ধু রিকোয়েস্ট) আর সুরক্ষিত API-তে
// টোকেন লাগে। এই ফাংশন বেনামি সাইন-ইন করে শুধু টোকেন দেয়: পরিচয় নয়।
// আগে থেকে কোনো সেশন (Google/পাসওয়ার্ড/ইমেইল-লিংক) থাকলে সেটাই থাকে,
// কিছু বদলায় না। Anonymous প্রোভাইডার কনসোলে চালু না থাকলে false ফেরে
// (কখনো throw করে না) — তখন OTP লগইন লোকালই থাকে, কল ইনভাইট যাবে না।
// বেনামি UID কখনো অ্যাপ-পরিচয় হয় না: onFirebaseAuthUser-এর গার্ড
// (store.tsx) বেনামি ব্যবহারকারীর UID বসায় না, Firestore সিঙ্কও চালায় না।
export async function ensureAnonymousSession(): Promise<boolean> {
  const a = getFirebaseAuth()
  if (!a) return false
  try {
    if (a.currentUser) return true
    await signInAnonymously(a)
    return true
  } catch { return false }
}

// এখন লগইন করা Firebase ব্যবহারকারীর UID (users/{uid} ডকের চাবি)।
// লগইন না থাকলে, বা Firebase সেটআপ না থাকলে, বা OTP লগইনে (Firebase সেশন নেই) null।
export function getCurrentUid(): string | null {
  try { return getFirebaseAuth()?.currentUser?.uid ?? null } catch { return null }
}

// এখন সাইন-ইন করা Firebase ব্যবহারকারীর পরিচয় (uid + ইমেইল + নাম) —
// সিঙ্কের গার্ডের জন্য: লেখার আগে এই পরিচয়ের সঙ্গে মিলিয়ে নেওয়া হয়,
// যাতে আগের সেশনের পরিচয় অন্য কারো ডকে না ওঠে (২০২৬-১১-২৫)। বেনামি
// (OTP) সেশনে null — বেনামি UID কখনো অ্যাপ-পরিচয় হয় না।
export function getCurrentAuthIdentity(): { uid: string; email: string; displayName: string } | null {
  try {
    const u = getFirebaseAuth()?.currentUser
    if (!u || u.isAnonymous) return null
    return { uid: u.uid, email: u.email || '', displayName: u.displayName || '' }
  } catch { return null }
}

// এখন লগইন করা Firebase ব্যবহারকারীর ID token — সুরক্ষিত API রুট
// (অ্যাডমিন সেটিংস, লাইভ রুম, পুশ সাবস্ক্রিপশন, কল-ইনভাইট পুশ) +
// কল রুম-WS-এ Authorization হিসেবে পাঠানো হয়। লগইন না থাকলে null।
// টোকেন কখনো লগ হয় না।
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
// স্পষ্ট ভুল বার্তা দেখাতে হবে। isNewUser = এই প্রথম সাইন-আপ কি না (Pixel/
// GA4-এ CompleteRegistration শুধু প্রথম সাইন-আপেই যায়, বারবার লগইনে নয়)।
export async function signInWithGoogle(): Promise<{ name: string; email: string; isNewUser: boolean } | null> {
  const a = getFirebaseAuth()
  if (!a) return null
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(a, provider)
  const user = result.user
  if (!user.email) return null
  return {
    name: user.displayName || user.email.split('@')[0] || 'Gmail user',
    email: user.email,
    isNewUser: getAdditionalUserInfo(result)?.isNewUser ?? false,
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
 *  লিংক মেয়াদোত্তীর্ণ/ভুল হলে null ফেরায়। সফল হলে সংরক্ষিত ইমেইল মুছে দেওয়া হয়।
 *  isNewUser = এই প্রথম সাইন-আপ কি না (CompleteRegistration শুধু তখনই)। */
export async function completeEmailLink(emailArg?: string): Promise<{ name: string; email: string; isNewUser: boolean } | null> {
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
      isNewUser: getAdditionalUserInfo(result)?.isNewUser ?? false,
    }
  } catch {
    return null
  }
}

// ---------- Email + password login ----------
// Registration and login with a REAL email + password (Firebase
// Email/Password auth, provider already enabled in the console). No mobile
// number, no SMS OTP, no synthetic email, no lookup table — the email the
// user types IS the Firebase credential. Google 1-click login stays
// alongside; the user chooses freely. Passwords are held only by Firebase
// Auth; this code never stores one. SMS OTP is OFF entirely by the owner's
// decision (2026-11-24) — the server SMS code stays dormant for a future
// provider switch, but nothing user-visible sends or asks for an SMS code.
export const PASSWORD_MIN_LENGTH = 6

export type PasswordAuthResult = { name: string; email: string; isNewUser: boolean }

/** Firebase error -> a stable code the login page maps to a message. */
export function mapPasswordAuthError(err: unknown): string {
  const code = (err as { code?: unknown } | null | undefined)?.code
  if (typeof code !== 'string') return 'password_auth_failed'
  switch (code) {
    case 'auth/email-already-in-use': return 'email_already_registered'
    case 'auth/weak-password': return 'password_too_short'
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'wrong_password'
    case 'auth/user-not-found': return 'account_not_found'
    case 'auth/too-many-requests': return 'too_many_attempts'
    case 'auth/invalid-email': return 'invalid_email'
    case 'auth/network-request-failed': return 'network_error'
    default: return 'password_auth_failed'
  }
}

function normalizeAuthEmail(rawEmail: string): string | null {
  const mail = rawEmail.trim().toLowerCase()
  if (!mail.includes('@')) return null
  return mail
}

/** Create an email+password account. Throws Error with a stable code (see
 *  mapPasswordAuthError): invalid_email, password_too_short,
 *  firebase_not_configured, email_already_registered, network_error,
 *  password_auth_failed. Returns the Firebase session identity; the
 *  caller logs the user in with it (normal first-login Firestore sync). */
export async function signUpWithPassword(rawEmail: string, password: string, displayName?: string): Promise<PasswordAuthResult> {
  const mail = normalizeAuthEmail(rawEmail)
  if (!mail) throw new Error('invalid_email')
  if (password.length < PASSWORD_MIN_LENGTH) throw new Error('password_too_short')
  const a = getFirebaseAuth()
  if (!a) throw new Error('firebase_not_configured')
  try {
    const result = await createUserWithEmailAndPassword(a, mail, password)
    const name = (displayName || '').trim() || mail.split('@')[0] || 'PiCall User'
    if ((displayName || '').trim()) {
      try { await updateProfile(result.user, { displayName: name }) } catch { /* name is still returned below */ }
    }
    return { name, email: mail, isNewUser: true }
  } catch (err) {
    throw new Error(mapPasswordAuthError(err))
  }
}

/** Send a password-reset email — the "Forgot password?" path (email only,
 *  no SMS). Throws Error with a stable code (see mapPasswordAuthError):
 *  invalid_email, firebase_not_configured, account_not_found,
 *  too_many_attempts, network_error, password_auth_failed. */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const mail = normalizeAuthEmail(rawEmail)
  if (!mail) throw new Error('invalid_email')
  const a = getFirebaseAuth()
  if (!a) throw new Error('firebase_not_configured')
  try {
    await sendPasswordResetEmail(a, mail)
  } catch (err) {
    throw new Error(mapPasswordAuthError(err))
  }
}

/** Log in with email + password — NO OTP. Throws Error with a stable code:
 *  invalid_email, firebase_not_configured, wrong_password,
 *  account_not_found, too_many_attempts, network_error,
 *  password_auth_failed. */
export async function signInWithPassword(rawEmail: string, password: string): Promise<PasswordAuthResult> {
  const mail = normalizeAuthEmail(rawEmail)
  if (!mail) throw new Error('invalid_email')
  const a = getFirebaseAuth()
  if (!a) throw new Error('firebase_not_configured')
  try {
    const result = await signInWithEmailAndPassword(a, mail, password)
    const user = result.user
    return {
      name: user.displayName || user.email?.split('@')[0] || 'PiCall User',
      email: user.email || mail,
      isNewUser: false,
    }
  } catch (err) {
    throw new Error(mapPasswordAuthError(err))
  }
}
