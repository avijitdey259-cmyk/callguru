// Login / registration pages — professional redesign (Pi purple→gold, filled icon
// set, dark-mode) — VISUAL ONLY, except the owner-ordered 2026-11-24 change:
// login is now email + password FIRST, Gmail 1-click LAST; Email Link and
// Email OTP were removed from this page (recovery OTP elsewhere is untouched).
// Run: node tests/login-pages.test.mjs
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

// ---------- লগইন পদ্ধতি — মালিকের সিদ্ধান্ত ২০২৬-১১-২৪: শুধু দুটি উপায় ----------
// ১) প্রথমে ইমেইল + পাসওয়ার্ড (Log in / Create account ট্যাব), ২) শেষে Gmail
// 1-ক্লিক। Email Link ও Email OTP এই পেজ থেকে সরানো হয়েছে (রিকভারি OTP
// অন্য জায়গায় আছে, সেটা ছোঁয়া হয়নি)।
check('only two login methods: email + password FIRST, Gmail 1-click LAST', () => {
  for (const s of [
    '1-Click Login with Gmail',
    'Continue with Google',
    'Log in with email + password',
    'Create account with email + password',
    'Create account',
    'Forgot password?',
  ]) assert.ok(login.includes(s), `'${s}' নেই`)
  for (const s of [
    'Send Login Link by Email',
    'Or log in with email OTP',
    'Send OTP',
    'Verify the code to log in',
    'Complete Login',
    'Email Link',
    'Email OTP',
    '6-digit code',
  ]) assert.ok(!login.includes(s), `'${s}' এখনো আছে — সরানোর কথা`)
  // ক্রম: পাসওয়ার্ড ট্যাব আগে, Gmail শেষে
  assert.ok(login.indexOf('role="tablist"') < login.indexOf('1-Click Login with Gmail'), 'Gmail ট্যাবের আগে আছে — পাসওয়ার্ড প্রথমে থাকার কথা')
  assert.ok(login.indexOf('Continue with Google') > login.indexOf('Create account'), 'Continue with Google শেষে নেই')
})
check('every user-visible login string is unchanged', () => {
  for (const s of [
    'Welcome to PiCall',
    'Email + Password • Gmail 1-Click Login',
    'Real Gmail login is on — log in with your Google account.',
    'Name',
    'Email',
    'Enter a valid email.',
    'Password must be at least 6 characters.',
    'Passwords do not match.',
    'This email is already registered — log in instead.',
    'No code needed — just the password you chose when you created your account.',
    'Your account is created right away — no code needed.',
    'Login is not set up — contact the admin.',
    'Google login did not complete — please try again.',
    'Google login failed — the pop-up was closed or there is a network problem. Please try again.',
    'Too many attempts — please try again in a little while.',
    'Could not reach the server — check your connection and try again.',
    'By logging in, you agree to the Terms and Privacy Policy. Only the admin can view call recordings (for appeals/disputes, stored 30 days).',
  ]) assert.ok(login.includes(s), `'${s}' নেই`)
})
check('all login handlers still wired (no logic change)', () => {
  for (const s of ['googleLogin', 'passwordLogin', 'createPasswordAccount', 'signInWithGoogle', 'signUpWithPassword', 'signInWithPassword', 'requestPasswordReset']) {
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
check('inputs are icon-adorned with violet focus ring (mail, user, lock)', () => {
  assert.ok(login.includes('<IconUser'), 'নামে IconUser নেই')
  assert.ok(login.includes('<IconMail'), 'ইমেইলে IconMail নেই')
  assert.ok(login.includes('<IconLock'), 'কোডে IconLock নেই')
  assert.ok(!login.includes('<IconCall'), 'লগইন পেজে মোবাইল আইকন থাকার কথা নয়')
  assert.ok(login.includes('focus:ring-2 focus:ring-violet-500'), 'ফোকাস রিং নেই')
  assert.ok(login.includes('rounded-xl'), 'গোল কোণা নেই')
  assert.ok(login.includes("placeholder=\"you@example.com\""), 'ইমেইল placeholder নেই')
  assert.ok(login.includes("placeholder=\"Your Name\""), 'নাম placeholder নেই')
  assert.ok(!login.includes("placeholder=\"01XXXXXXXXX\""), 'লগইন পেজে মোবাইল placeholder থাকার কথা নয়')
})
check('message shows as a soft notice (OTP tinted card is gone with the OTP section)', () => {
  assert.ok(login.includes('bg-gray-50 dark:bg-slate-800 text-gray-600'), 'বার্তার নোটিশ পিল নেই')
  assert.ok(!login.includes('bg-violet-50 dark:bg-violet-900/30'), 'OTP টিন্টেড কার্ড এখনো আছে')
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
