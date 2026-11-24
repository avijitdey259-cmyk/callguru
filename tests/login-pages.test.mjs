// Login / registration pages — professional redesign (Pi purple→gold, filled icon
// set, dark-mode) — VISUAL ONLY: every string, handler and login method is
// unchanged. Run: node tests/login-pages.test.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const pages = read('src/pages.tsx')
const app = read('src/App.tsx')
const icons = read('src/icons.tsx')

const start = pages.indexOf('export function LoginPage()')
const end = pages.indexOf('// ---------- Feed ----------', start)
const login = pages.slice(start, end)

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('Login pages tests:')

// ---------- সব লগইন পদ্ধতি + সব কপি অপরিবর্তিত ----------
check('all login methods still render (Google, email link, email OTP, SMS)', () => {
  for (const s of [
    '1-Click Login with Gmail',
    'Send Login Link by Email',
    'Or log in with email OTP',
    'Send OTP',
    'Verify the code to log in',
    'Or log in with mobile number',
    'Mobile Number',
    'Send OTP by SMS',
    'Complete Login',
  ]) assert.ok(login.includes(s), `'${s}' নেই`)
})
check('every user-visible login string is unchanged', () => {
  for (const s of [
    'Welcome to PiCall',
    'Gmail 1-Click Login • Email Link • Email OTP • Mobile OTP',
    'Real Gmail login is on — log in with your Google account.',
    'Enter your email to complete login — it must be the email the link was sent to.',
    'Name',
    '(will be shown after verification)',
    'Email',
    'Check your email — tap the link to log in.',
    '6-digit code',
    'The code is valid for 10 minutes.',
    'Verifying link…',
    'Enter a valid email.',
    'Enter the 6-digit code.',
    'Enter a valid Bangladeshi mobile number (11 digits, starting with 01).',
    'Login is not set up — contact the admin.',
    'Email link login is not set up — contact the admin.',
    'Google login did not complete — please try again.',
    'Google login failed — the pop-up was closed or there is a network problem. Please try again.',
    'The link has expired or is wrong — send the link again.',
    'Could not send the link — check the email and try again.',
    'Email OTP is not on yet — the admin is setting it up.',
    'Too many attempts — please try again in a little while.',
    'A 6-digit code has been sent to your email — valid for 10 minutes.',
    'A 6-digit code has been sent to your mobile — valid for 10 minutes.',
    'The code has expired — send OTP again.',
    'Wrong code entered many times — send OTP again.',
    'The code is wrong — check and enter it again.',
    'SMS login is not set up yet — please use email login for now.',
    'Could not reach the server — check your connection and try again.',
    'Could not send the code — please try again.',
    'By logging in, you agree to the Terms and Privacy Policy. Only the admin can view call recordings (for appeals/disputes, stored 30 days).',
  ]) assert.ok(login.includes(s), `'${s}' নেই`)
})
check('all login handlers still wired (no logic change)', () => {
  for (const s of ['googleLogin', 'sendLink', 'sendOtp', 'verifyOtp', 'sendSms', 'verifySms', 'finishLinkWithEmail', 'completeEmailLink', 'signInWithGoogle', 'sendEmailOtp', 'verifyEmailOtp', 'sendSmsOtp', 'verifySmsOtp', 'normalizeBdPhone(phone)']) {
    assert.ok(login.includes(s), `${s} নেই`)
  }
  assert.ok(!login.includes('gateway'), 'লগইন পেজে গেটওয়ে কোড থাকার কথা নয়')
})

// ---------- নতুন পেশাদার চেহারা ----------
check('brand header: gradient Pi badge + gradient PiCall wordmark (header style)', () => {
  assert.ok(login.includes('pb-gradient text-white text-3xl'), 'গ্রেডিয়েন্ট π ব্যাজ নেই')
  assert.ok(login.includes('pb-gradient-text'), 'গ্রেডিয়েন্ট PiCall লেখা নেই')
  assert.ok(login.includes('h-1.5 pb-gradient'), 'উপরের গ্রেডিয়েন্ট বার নেই')
})
check('inputs are icon-adorned with violet focus ring (mail, user, phone, lock)', () => {
  assert.ok(login.includes('<IconUser'), 'নামে IconUser নেই')
  assert.ok(login.includes('<IconMail'), 'ইমেইলে IconMail নেই')
  assert.ok(login.includes('<IconCall'), 'মোবাইলে IconCall নেই')
  assert.ok(login.includes('<IconLock'), 'কোডে IconLock নেই')
  assert.ok(login.includes('focus:ring-2 focus:ring-violet-500'), 'ফোকাস রিং নেই')
  assert.ok(login.includes('rounded-xl'), 'গোল কোণা নেই')
  assert.ok(login.includes("placeholder=\"you@example.com\""), 'ইমেইল placeholder নেই')
  assert.ok(login.includes("placeholder=\"01XXXXXXXXX\""), 'মোবাইল placeholder নেই')
  assert.ok(login.includes("placeholder=\"Your Name\""), 'নাম placeholder নেই')
})
check('OTP sections are tinted cards; message shows as a soft notice', () => {
  assert.ok(login.includes('bg-violet-50 dark:bg-violet-900/30'), 'OTP টিন্টেড কার্ড নেই')
  assert.ok(login.includes('bg-gray-50 dark:bg-slate-800 text-gray-600'), 'বার্তার নোটিশ পিল নেই')
})
check('dark mode: toggle on the login screen + dark: classes in login markup', () => {
  assert.ok(login.includes('toggleDark'), 'ডার্ক টগল নেই')
  assert.ok(login.includes('<IconMoon') && login.includes('<IconSun'), 'Moon/Sun আইকন নেই')
  assert.ok(login.includes('dark:bg-fb-dark'), 'ডার্ক পটভূমি নেই')
  assert.ok(login.includes('dark:bg-fb-card'), 'ডার্ক কার্ড নেই')
  assert.ok(login.includes('dark:text-gray-100') || login.includes('dark:text-gray-300'), 'ডার্ক লেখার রং নেই')
})
check('icons.tsx exports the new mail + lock icons', () => {
  assert.ok(icons.includes('export function IconMail'), 'IconMail নেই')
  assert.ok(icons.includes('export function IconLock'), 'IconLock নেই')
})

// ---------- লগইন দেওয়াল + Layout-এর বাইরে (অপরিবর্তিত) ----------
check('login page still renders OUTSIDE Layout; login wall intact', () => {
  assert.ok(app.includes('<Route path="/login" element={<LoginPage />} />'), '/login রুট নেই')
  assert.ok(app.includes("if (!user && loc.pathname !== '/login') return <Navigate to=\"/login\" replace />"), 'লগইন দেওয়াল নেই')
  // LoginPage-এর ভেতরে TopBar/Sidebar/BottomNav/Layout আসে না
  assert.ok(!login.includes('TopBar') && !login.includes('BottomNav') && !login.includes('<Layout'), 'লগইন পেজে Layout/নেভ ঢুকে গেছে')
})

console.log(`\nAll ${passed} login-pages tests passed.`)
