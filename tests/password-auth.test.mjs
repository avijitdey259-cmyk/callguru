// Email + password login — registration with a real email + password
// (Firebase createUserWithEmailAndPassword, visible Sign up option),
// returning login with email + password only (NO OTP), Google 1-click
// login untouched. SMS OTP is OFF entirely (owner decision 2026-11-24):
// no mobile tab on the login page, no SMS verification in Profile
// Settings. Firebase Auth is mocked (in-memory accounts, no network,
// no real SMS, no real keys). Run: node tests/password-auth.test.mjs
import { build } from 'esbuild'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const pages = read('src/pages.tsx')
const firebaseSrc = read('src/firebase.ts')
const analyticsSrc = read('src/analytics.ts')

const start = pages.indexOf('export function LoginPage()')
const end = pages.indexOf('// ---------- Feed ----------', start)
const login = pages.slice(start, end)
const psStart = pages.indexOf('function ProfileSettingsForm(')
const psEnd = pages.indexOf('export function MenuPage()', psStart)
const settings = pages.slice(psStart, psEnd)

let passed = 0
async function check(name, fn) {
  await fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('Password auth tests:')

// ---------- Static: firebase.ts wires real email+password auth ----------
await check('firebase.ts exports password helpers built on Firebase Email/Password', () => {
  for (const s of ['signUpWithPassword', 'signInWithPassword', 'PASSWORD_MIN_LENGTH', 'mapPasswordAuthError']) {
    assert.ok(firebaseSrc.includes(`function ${s}(`) || firebaseSrc.includes(`const ${s} =`), `${s} নেই`)
  }
  assert.ok(firebaseSrc.includes('createUserWithEmailAndPassword'), 'createUserWithEmailAndPassword নেই')
  assert.ok(firebaseSrc.includes('signInWithEmailAndPassword'), 'signInWithEmailAndPassword নেই')
  assert.ok(firebaseSrc.includes("from 'firebase/auth'"), 'firebase/auth import নেই')
})

await check('no synthetic-email / mobile-account scheme anywhere', () => {
  assert.ok(!firebaseSrc.includes('mobile.picall.app'), 'synthetic ডোমেইন এখনো আছে')
  assert.ok(!firebaseSrc.includes('phoneToAuthEmail'), 'phoneToAuthEmail এখনো আছে')
  assert.ok(!firebaseSrc.includes('normalizeBdPhone'), 'firebase.ts-এ মোবাইল normaliser এখনো আছে')
  assert.ok(!firebaseSrc.includes('mobile_already_registered'), 'মোবাইলের ডুপ্লিকেট কোড এখনো আছে')
  assert.ok(!firebaseSrc.includes('sendEmailVerification('), 'verification মেইল পাঠানো হচ্ছে')
  assert.ok(!/localStorage\.setItem\([^)]*password/i.test(firebaseSrc), 'পাসওয়ার্ড localStorage-এ যাচ্ছে')
  assert.ok(!firebaseSrc.includes('gateway'), 'firebase.ts-এ গেটওয়ে কোড থাকার কথা নয়')
})

await check('password signup is tracked as its own analytics method', () => {
  assert.ok(analyticsSrc.includes("'password'"), "SignupMethod-এ 'password' নেই")
  assert.ok(pages.includes("noteSignup('password', 'password:' + u.email.toLowerCase())"), 'পাসওয়ার্ড সাইন-আপের noteSignup নেই')
})

// ---------- Static: LoginPage — visible Log in / Create account toggle ----------
await check('login page has a visible Log in / Create account toggle', () => {
  assert.ok(login.includes('Create account'), "'Create account' টগল নেই")
  assert.ok(login.includes("setAuthMode('login')"), 'Log in টগলে যাওয়া যায় না')
  assert.ok(login.includes("setAuthMode('signup')"), 'Create account টগলে যাওয়া যায় না')
  assert.ok(login.includes("authMode === 'login'"), 'লগইন ফর্ম শর্ত নেই')
  assert.ok(login.includes("authMode === 'signup'"), 'সাইন-আপ ফর্ম শর্ত নেই')
})

await check('password forms: email + password inputs, confirm password on sign-up', () => {
  assert.ok(login.includes('Log in with email + password'), 'পাসওয়ার্ড লগইন শিরোনাম নেই')
  assert.ok(login.includes('Create account with email + password'), 'অ্যাকাউন্ট তৈরি শিরোনাম নেই')
  assert.ok(login.includes('Confirm password'), 'Confirm password নেই')
  assert.ok(login.includes('Create account</Btn>') || login.includes('>Create account<'), 'Create account বোতাম নেই')
  assert.ok((login.match(/type="password"/g) || []).length >= 3, '৩টি password ইনপুট নেই')
  assert.ok(login.includes('At least 6 characters'), '৬ অক্ষরের ইঙ্গিত নেই')
  assert.ok(login.includes('Password must be at least 6 characters.'), 'ছোট পাসওয়ার্ডের বার্তা নেই')
  assert.ok(login.includes('Passwords do not match.'), 'অমিল পাসওয়ার্ডের বার্তা নেই')
  assert.ok(login.includes('This email is already registered — log in instead.'), 'ডুপ্লিকেট ইমেইলের বার্তা নেই')
  assert.ok(login.includes('Your account is created right away — no code needed.'), 'কোড লাগে না — এমন নোট নেই')
})

await check('login with password asks NO OTP; sign-up asks NO OTP either', () => {
  const plStart = login.indexOf('const passwordLogin')
  const plEnd = login.indexOf('const createPasswordAccount', plStart)
  const passwordLoginFn = login.slice(plStart, plEnd)
  assert.ok(passwordLoginFn.includes('signInWithPassword'), 'passwordLogin-এ signInWithPassword নেই')
  assert.ok(!passwordLoginFn.includes('Otp'), 'passwordLogin-এ OTP চাওয়া হচ্ছে')
  const caStart = login.indexOf('const createPasswordAccount')
  const caEnd = login.indexOf('return (', caStart)
  const createFn = login.slice(caStart, caEnd)
  assert.ok(createFn.includes('signUpWithPassword'), 'createPasswordAccount-এ signUpWithPassword নেই')
  assert.ok(!createFn.includes('Otp'), 'অ্যাকাউন্ট তৈরিতে OTP চাওয়া হচ্ছে')
  assert.ok(login.includes('No code needed — just the password you chose when you created your account.'), 'লগইনে OTP লাগে না — এমন নোট নেই')
})

await check('SMS / mobile tab is ABSENT from the login page', () => {
  for (const s of ['Mobile Number', 'Send OTP by SMS', 'sendSmsOtp', 'verifySmsOtp', '01XXXXXXXXX', 'normalizeBdPhone', 'Or log in with mobile number', 'Verify the code & create account', 'mobile number + password']) {
    assert.ok(!login.includes(s), `লগইন পেজে SMS/মোবাইল ট্যাব এখনো আছে: '${s}'`)
  }
})

await check('Google 1-click login stays, equally visible, and email flows are untouched', () => {
  assert.ok(login.includes('1-Click Login with Gmail'), 'Gmail লগইন নেই')
  assert.ok(login.includes('googleLogin') && login.includes('signInWithGoogle'), 'Google হ্যান্ডলার নেই')
  for (const s of ['sendLink', 'sendOtp', 'verifyOtp', 'finishLinkWithEmail', 'completeEmailLink', 'sendEmailLink', 'sendEmailOtp', 'verifyEmailOtp', 'Send Login Link by Email', 'Or log in with email OTP']) {
    assert.ok(login.includes(s), `${s} নেই — ইমেইল লগইন ভেঙেছে`)
  }
  assert.ok(login.includes('Gmail 1-Click Login • Email + Password • Email Link • Email OTP'), 'সাবটাইটেলে Email + Password নেই')
})

await check('Profile Settings: recovery-mobile SMS verification is ABSENT, number field stays as plain storage', () => {
  for (const s of ['sendRecoverySmsOtp', 'verifyRecoverySmsOtp', 'sendSmsOtp', 'verifySmsOtp', 'Send OTP by SMS', 'Verify recovery mobile', 'Recovery mobile verified.']) {
    assert.ok(!settings.includes(s), `সেটিংসে SMS যাচাই এখনো আছে: '${s}'`)
  }
  assert.ok(settings.includes('Recovery Mobile Number'), 'Recovery Mobile ঘর নেই')
  assert.ok(settings.includes('no SMS code is sent to this number'), 'SMS বন্ধের নোট নেই')
  assert.ok(settings.includes('normalizeBdPhone(recPhone)'), 'মোবাইল নম্বর স্বাভাবিককরণ নেই')
  assert.ok(!settings.includes('SMS OTP once the SMS gateway is wired'), 'SMS অপেক্ষার নোট এখনো আছে')
})

// ---------- Behavioural: mocked Firebase Auth (no network, no SMS) ----------
const outDir = mkdtempSync(join(tmpdir(), 'picall-password-auth-'))
const stubAuth = join(outDir, 'stub-auth.mjs')
writeFileSync(stubAuth, `
// In-memory Firebase Auth mock: accounts keyed by real email.
export const __accounts = new Map()
export const __auth = { currentUser: null }
export class GoogleAuthProvider {}
export const getAuth = () => __auth
export const signInWithPopup = async () => ({ user: { email: 'gmail.user@example.com', displayName: 'Gmail User' } })
export const getAdditionalUserInfo = () => ({ isNewUser: true })
export const sendSignInLinkToEmail = async () => {}
export const signInWithEmailLink = async () => ({ user: { email: 'e@x.com', displayName: null } })
export const isSignInWithEmailLink = () => false
export const onAuthStateChanged = () => () => {}
export const updateProfile = async (user, { displayName }) => { user.displayName = displayName }
export const createUserWithEmailAndPassword = async (_auth, email, password) => {
  if (__accounts.has(email)) throw { code: 'auth/email-already-in-use' }
  if (password.length < 6) throw { code: 'auth/weak-password' }
  const user = { uid: 'uid-' + (__accounts.size + 1), email, password, displayName: null }
  __accounts.set(email, user)
  __auth.currentUser = user
  return { user }
}
export const sendPasswordResetEmail = async (_auth, email) => {
  if (!__accounts.has(email)) throw { code: 'auth/user-not-found' }
}
export const signInWithEmailAndPassword = async (_auth, email, password) => {
  const user = __accounts.get(email)
  if (!user || user.password !== password) throw { code: 'auth/invalid-credential' }
  __auth.currentUser = user
  return { user }
}
`)
const stubApp = join(outDir, 'stub-app.mjs')
writeFileSync(stubApp, `export const initializeApp = () => ({})\n`)

const outFile = join(outDir, 'firebase.mjs')
await build({
  entryPoints: [join(root, 'src/firebase.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
  alias: { 'firebase/auth': stubAuth, 'firebase/app': stubApp },
  define: {
    'import.meta.env': JSON.stringify({
      VITE_FIREBASE_API_KEY: 'test-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'test-proj',
      VITE_FIREBASE_APP_ID: 'test-app',
    }),
  },
})
const F = await import(outFile)

let registeredUid = null

await check('mocked Firebase is configured (test wiring)', () => {
  assert.equal(F.isFirebaseConfigured, true)
})

await check('register with email + password succeeds and creates a Firebase session', async () => {
  const u = await F.signUpWithPassword('test@example.com', 'secret1', 'Test User')
  assert.equal(u.email, 'test@example.com')
  assert.equal(u.name, 'Test User')
  assert.equal(u.isNewUser, true)
  assert.ok(!('phone' in u), 'রেজিস্ট্রেশন ফলে ফোন ঘর থাকার কথা নয়')
  registeredUid = F.getCurrentUid()
  assert.ok(registeredUid, 'রেজিস্ট্রেশনের পর Firebase সেশন নেই')
})

await check('email is normalised (trim + lowercase) at sign-up and login', async () => {
  const u = await F.signUpWithPassword('  Second@Example.COM ', 'secret2', 'Second User')
  assert.equal(u.email, 'second@example.com')
  const v = await F.signInWithPassword('SECOND@EXAMPLE.COM', 'secret2')
  assert.equal(v.email, 'second@example.com')
  assert.equal(v.name, 'Second User')
})

await check('duplicate email is rejected with the already-registered code', async () => {
  await assert.rejects(
    () => F.signUpWithPassword('TEST@example.com', 'otherpass', 'Someone Else'),
    (err) => err instanceof Error && err.message === 'email_already_registered',
  )
})

await check('login with password asks NO OTP and returns the same account', async () => {
  const u = await F.signInWithPassword('test@example.com', 'secret1')
  assert.equal(u.email, 'test@example.com')
  assert.equal(u.name, 'Test User')
  assert.equal(u.isNewUser, false)
  assert.ok(F.getCurrentUid(), 'পাসওয়ার্ড লগইনে Firebase সেশন নেই')
  assert.equal(F.getCurrentUid(), registeredUid, 'লগইনে নতুন অ্যাকাউন্ট তৈরি হয়েছে')
})

await check('wrong password is rejected', async () => {
  await assert.rejects(
    () => F.signInWithPassword('test@example.com', 'wrongpass'),
    (err) => err instanceof Error && err.message === 'wrong_password',
  )
})

await check('login with an unregistered email is rejected', async () => {
  await assert.rejects(
    () => F.signInWithPassword('nobody@example.com', 'secret1'),
    (err) => err instanceof Error && err.message === 'wrong_password',
  )
})

await check('short password is rejected at sign-up (Firebase minimum 6)', async () => {
  await assert.rejects(
    () => F.signUpWithPassword('short@example.com', '12345', 'Short'),
    (err) => err instanceof Error && err.message === 'password_too_short',
  )
  assert.equal(F.PASSWORD_MIN_LENGTH, 6)
})

await check('invalid email is rejected at sign-up and login', async () => {
  await assert.rejects(
    () => F.signUpWithPassword('not-an-email', 'secret1'),
    (err) => err instanceof Error && err.message === 'invalid_email',
  )
  await assert.rejects(
    () => F.signInWithPassword('not-an-email', 'secret1'),
    (err) => err instanceof Error && err.message === 'invalid_email',
  )
})

await check('Google login entry point still works (existing path untouched)', async () => {
  const u = await F.signInWithGoogle()
  assert.ok(u, 'signInWithGoogle null ফেরাল')
  assert.equal(u.email, 'gmail.user@example.com')
  assert.equal(u.isNewUser, true)
})

await check('mapPasswordAuthError maps Firebase codes to stable codes', () => {
  assert.equal(F.mapPasswordAuthError({ code: 'auth/email-already-in-use' }), 'email_already_registered')
  assert.equal(F.mapPasswordAuthError({ code: 'auth/weak-password' }), 'password_too_short')
  assert.equal(F.mapPasswordAuthError({ code: 'auth/invalid-credential' }), 'wrong_password')
  assert.equal(F.mapPasswordAuthError({ code: 'auth/user-not-found' }), 'account_not_found')
  assert.equal(F.mapPasswordAuthError({ code: 'auth/too-many-requests' }), 'too_many_attempts')
  assert.equal(F.mapPasswordAuthError({ code: 'auth/invalid-email' }), 'invalid_email')
  assert.equal(F.mapPasswordAuthError({ code: 'auth/something-else' }), 'password_auth_failed')
  assert.equal(F.mapPasswordAuthError(null), 'password_auth_failed')
})

console.log(`\nAll ${passed} password-auth tests passed.`)
