// Firebase — আসল ১-ক্লিক Gmail (Google) লগইন।
// Config শুধু environment variable থেকে আসে (Netlify-তে VITE_FIREBASE_* হিসেবে বসাতে হয়)।
// কোনো key এখানে hard-code করা নেই, কোনো project ID বানানো নেই।
// কোনো একটা value না থাকলে isFirebaseConfigured false হয় আর লগইন পেজ ডেমো মোডে চলে।
import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, type Auth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
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

// আসল Google Sign-In — popup থেকে ফেরত আসা আসল নাম + ইমেইল দেয়।
// Config না থাকলে null ফেরায় (কলার তখন ডেমো মোডে যাবে)।
export async function signInWithGoogle(): Promise<{ name: string; email: string } | null> {
  const a = getFirebaseAuth()
  if (!a) return null
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(a, provider)
  const user = result.user
  if (!user.email) return null
  return {
    name: user.displayName || user.email.split('@')[0] || 'Gmail ব্যবহারকারী',
    email: user.email,
  }
}
