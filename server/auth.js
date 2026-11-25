// PiCall server auth — Firebase ID-token verification + rate limiting.
// সব সুরক্ষিত API রুট + WebSocket presence এই মডিউল দিয়ে যাচাই করে।
// - Firebase ID token যাচাইয়ে কোনো service-account key লাগে না:
//   firebase-admin শুধু projectId দিয়ে Google-এর public key দিয়ে
//   RS256 স্বাক্ষর মেলায় (verifyIdToken)। চাবি Railway env-এ রাখার
//   দরকার নেই — এবং এই ফাইলে কোনো গোপন মান নেই।
// - firebase-admin v12+ -এ মডুলার API: ডিফল্ট এক্সপোর্টে `auth` ফাংশনই
//   থাকে না (14.5.1-এ যাচাই করা — পুরোনো ডাকটি TypeError দিত), তাই
//   পুরোনো কোডে getAdminAuth সবসময় null ফিরত আর verifyIdToken আসল
//   টোকেনও ফিরিয়ে দিত — কল রুম-জয়েনে 'unauthorized' আসত আর কল
//   কখনো যেত না। এখানে 'firebase-admin/app' + 'firebase-admin/auth'-এর
//   getAuth(app) ব্যবহার করা হয় (কোনো চাবি ছাড়াই, শুধু projectId)।
// - OTP কোড / ID token কখনো লগ করা হয় না — কোথাও console.log নেই।
// - __setTokenVerifier শুধু টেস্টের জন্য (tests/security-server.test.mjs);
//   প্রোডাকশন কোড এটা কখনো ডাকে না।
import crypto from 'node:crypto'

export const ADMIN_EMAIL = 'avijitdey259@gmail.com'
export const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'picall-76185'

let adminPromise = null
let verifierOverride = null

/** টেস্ট-শুধু: verifyIdToken-এর বদলে নিজের ফাংশন বসানো। প্রোডাকশনে ব্যবহার নয়। */
export function __setTokenVerifier(fn) {
  verifierOverride = fn
}

function getAdminAuth() {
  if (!adminPromise) {
    adminPromise = Promise.all([import('firebase-admin/app'), import('firebase-admin/auth')])
      .then(([appMod, authMod]) => {
        const app = appMod.getApps().length > 0 ? appMod.getApp() : appMod.initializeApp({ projectId: FIREBASE_PROJECT_ID })
        return authMod.getAuth(app)
      })
      .catch(() => null)
  }
  return adminPromise
}

/**
 * Firebase ID token যাচাই — সফল হলে { uid, email, name }, না হলে null।
 * ভুল/মেয়াদোত্তীর্ণ/অন্য প্রজেক্টের টোকেন সবই null। টোকেন কখনো লগ হয় না।
 */
export async function verifyIdToken(token) {
  if (typeof token !== 'string' || !token || token.length > 4096) return null
  if (verifierOverride) {
    try {
      const r = await verifierOverride(token)
      if (r && typeof r.uid === 'string' && r.uid) {
        return { uid: r.uid, email: typeof r.email === 'string' ? r.email : '', name: typeof r.name === 'string' ? r.name : '' }
      }
    } catch { /* fall through to null */ }
    return null
  }
  const auth = await getAdminAuth()
  if (!auth) return null
  try {
    const decoded = await auth.verifyIdToken(token)
    if (!decoded || typeof decoded.uid !== 'string' || !decoded.uid) return null
    return {
      uid: decoded.uid,
      email: typeof decoded.email === 'string' ? decoded.email : '',
      name: typeof decoded.name === 'string' ? decoded.name : '',
    }
  } catch {
    return null
  }
}

/** Authorization: Bearer <token> — হেডার থেকে টোকেন তোলা (টোকেন লগ হয় না)। */
export function getBearerToken(req) {
  const h = req?.headers?.authorization
  if (typeof h !== 'string') return null
  const m = /^Bearer\s+(.+)$/i.exec(h.trim())
  return m ? m[1].trim() : null
}

/** সুরক্ষিত রুট: বৈধ Firebase লগইন লাগবে। না থাকলে 401। */
export function requireAuth(req, res, next) {
  const token = getBearerToken(req)
  if (!token) return res.status(401).json({ ok: false, error: 'unauthorized' })
  verifyIdToken(token)
    .then((auth) => {
      if (!auth) return res.status(401).json({ ok: false, error: 'unauthorized' })
      req.auth = auth
      next()
    })
    .catch(() => res.status(401).json({ ok: false, error: 'unauthorized' }))
}

/** অ্যাডমিন-শুধু রুট: বৈধ লগইন + ADMIN_EMAIL হতে হবে। না হলে 401/403। */
export function requireAdmin(req, res, next) {
  const token = getBearerToken(req)
  if (!token) return res.status(401).json({ ok: false, error: 'unauthorized' })
  verifyIdToken(token)
    .then((auth) => {
      if (!auth) return res.status(401).json({ ok: false, error: 'unauthorized' })
      if (auth.email.toLowerCase() !== ADMIN_EMAIL) return res.status(403).json({ ok: false, error: 'forbidden' })
      req.auth = auth
      next()
    })
    .catch(() => res.status(401).json({ ok: false, error: 'unauthorized' }))
}

/** ক্লায়েন্ট IP — Railway X-Forwarded-For দেয়; প্রথমটাই আসল IP ধরা হয়। */
export function clientIp(req) {
  const xff = req?.headers?.['x-forwarded-for']
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim()
  return req?.socket?.remoteAddress || req?.ip || 'unknown'
}

// ---------- ইন-মেমোরি রেট লিমিট (রিস্টার্টে মুছে যায় — এক ইনস্ট্যান্সের জন্য যথেষ্ট) ----------
/**
 * rateLimit({ windowMs, max, key }) — সীমা ছাড়ালে 429 + Retry-After।
 * key ডিফল্ট: ক্লায়েন্ট IP। OTP-তে ইমেইল-ভিত্তিক সীমা (আগের কোড) এর
 * পাশাপাশি চলে — এটা IP-ভিত্তিক, যাতে এক আক্রমণকারী অনেক ইমেইলে
 * স্প্রে করতে না পারে।
 */
export function rateLimit({ windowMs, max, key }) {
  const hits = new Map() // key -> { count, windowStart }
  const keyFn = typeof key === 'function' ? key : (req) => clientIp(req)
  // মেমোরি লিক ঠেকাতে পুরনো উইন্ডো মাঝে মাঝে পরিষ্কার করা হয়।
  const sweep = () => {
    const now = Date.now()
    for (const [k, v] of hits) {
      if (now - v.windowStart > windowMs * 2) hits.delete(k)
    }
  }
  let lastSweep = 0
  return (req, res, next) => {
    const now = Date.now()
    if (now - lastSweep > windowMs) { lastSweep = now; sweep() }
    const k = keyFn(req)
    const rec = hits.get(k)
    if (rec && now - rec.windowStart < windowMs) {
      rec.count += 1
      if (rec.count > max) {
        res.setHeader('Retry-After', String(Math.ceil((windowMs - (now - rec.windowStart)) / 1000)))
        return res.status(429).json({ ok: false, error: 'rate_limited' })
      }
    } else {
      hits.set(k, { count: 1, windowStart: now })
    }
    next()
  }
}

/** এলোমেলো সেশন/ননস মান লাগলে — টোকেন/কোডের বদলে এটা ব্যবহার করা হয়। */
export function randomToken(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex')
}
