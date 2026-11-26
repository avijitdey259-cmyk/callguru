// "সব লগইন পদ্ধতিতে কল" — OTP লগইন + বেনামি সেশন + ইনভাইট (২০২৬-১১-২৫ রিবিল্ড)।
// চালানো: রিপো রুট থেকে `node tests/otp-login.test.mjs`
// (সোর্স পড়ে + callInvites বান্ডল করে যাচাই করা হয় — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) লগইন পেজে ইমেইল-কোড (OTP) লগইন আছে — পাসওয়ার্ড + Google-র পাশাপাশি
//   ২) SMTP না বসানো থাকলে সৎ বার্তা — "Email OTP is not on yet"
//   ৩) বেনামি সেশন হেল্পার — টোকেনের জন্য মাত্র, কখনো throw করে না
//   ৪) loginOtp — শুধু user বসে; uid/fsState ছোঁয়া হয় না
//   ৫) বেনামি গার্ড — onFirebaseAuthUser বেনামি UID বসায় না (b79c8910 থেকে)
//   ৬) OTP ব্যবহারকারীর ইনভাইট — fromUid = অ্যাপ-পরিচয় (uid ?? referralCode),
//      cg- পরিচয়েও পেলোড হয়; সার্ভার-মিন্টেড কাস্টম টোকেন নেই
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-otp-test-'))

async function loadModule(entry) {
  const outFile = join(outDir, entry.replace(/[^a-z]/gi, '') + '.mjs')
  await build({
    entryPoints: [join(root, 'src', entry)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: outFile,
    logLevel: 'silent',
    define: { 'import.meta.env.VITE_API_URL': '""' },
  })
  return import(outFile)
}

const CI = await loadModule('callInvites.ts')

const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
const firebaseSrc = readFileSync(join(root, 'src/firebase.ts'), 'utf8')
const apiSrc = readFileSync(join(root, 'src/api.ts'), 'utf8')
const authServerSrc = readFileSync(join(root, 'server/auth.js'), 'utf8')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

const loginStart = pagesSrc.indexOf('export function LoginPage()')
const loginEnd = pagesSrc.indexOf('export function ServicesSection()', loginStart)
assert.ok(loginStart >= 0 && loginEnd > loginStart, 'LoginPage খুঁজে পাওয়া যায়নি')
const loginSrc = pagesSrc.slice(loginStart, loginEnd)

check('লগইন পেজ — Google + পাসওয়ার্ড + ইমেইল-কোড (OTP) তিন পদ্ধতিই আছে', () => {
  assert.ok(loginSrc.includes('const u = await signInWithGoogle()'), 'Google লগইন নেই')
  assert.ok(loginSrc.includes('const u = await signInWithPassword(mail, password)'), 'পাসওয়ার্ড লগইন নেই')
  assert.ok(loginSrc.includes('Log in with email code'), 'OTP লগইন সেকশন নেই')
  assert.ok(loginSrc.includes('Send code'), 'কোড পাঠানোর বোতাম নেই')
  assert.ok(loginSrc.includes('Verify & log in'), 'যাচাই-লগইন বোতাম নেই')
  assert.ok(loginSrc.includes('6-digit code'), '৬ অঙ্কের কোড ঘর নেই')
  assert.ok(pagesSrc.includes('Email + Password • Email Code • Gmail 1-Click Login'), 'শিরোনামে Email Code নেই')
})

check('OTP লগইন — Railway /api/otp/send + /api/otp/verify পুনঃব্যবহার করে', () => {
  assert.ok(loginSrc.includes('sendEmailOtp(mail)'), 'কোড পাঠাতে sendEmailOtp ডাকা হয় না')
  assert.ok(loginSrc.includes('verifyEmailOtp(mail, otpCode)'), 'যাচাইয়ে verifyEmailOtp ডাকা হয় না')
  assert.ok(apiSrc.includes('export function sendEmailOtp'), 'api.ts-এ sendEmailOtp নেই')
  assert.ok(apiSrc.includes('export function verifyEmailOtp'), 'api.ts-এ verifyEmailOtp নেই')
})

check('SMTP না বসানো থাকলে সৎ বার্তা — "Email OTP is not on yet"', () => {
  assert.ok(loginSrc.includes('Email OTP is not on yet — the admin is setting it up.'), 'সৎ বার্তা নেই')
  assert.ok(loginSrc.includes("case 'not_configured': return 'Email OTP is not on yet"), 'not_configured-এ সৎ বার্তা বাঁধা নেই')
  assert.ok(loginSrc.includes("case 'expired': return 'The code has expired — send OTP again.'"), 'মেয়াদোত্তীর্ণ বার্তা নেই')
  assert.ok(loginSrc.includes("case 'wrong': return 'The code is wrong — check and enter it again.'") || loginSrc.includes("case 'invalid_code': return 'The code is wrong — check and enter it again.'"), 'ভুল কোডের বার্তা নেই')
})

check('বেনামি সেশন — ensureAnonymousSession আছে, টোকেনের জন্য মাত্র', () => {
  assert.ok(firebaseSrc.includes('signInAnonymously'), 'signInAnonymously ইমপোর্ট নেই')
  assert.ok(firebaseSrc.includes('export async function ensureAnonymousSession'), 'ensureAnonymousSession নেই')
  assert.ok(firebaseSrc.includes('if (a.currentUser) return true'), 'আগের সেশন থাকলে সেটাই থাকে না')
  assert.ok(firebaseSrc.includes('await signInAnonymously(a)'), 'বেনামি সাইন-ইন ডাকা হয় না')
  assert.ok(loginSrc.includes('await ensureAnonymousSession()'), 'OTP যাচাইয়ের পর বেনামি সেশন নেওয়া হয় না')
  assert.ok(loginSrc.includes('loginOtp(otpName, mail)'), 'OTP লগইনে loginOtp ডাকা হয় না')
})

check('loginOtp — শুধু user বসে; uid/fsState ছোঁয়া হয় না', () => {
  assert.ok(storeSrc.includes('loginOtp: (name: string, email: string) => void'), 'Store টাইপে loginOtp নেই')
  const implStart = storeSrc.indexOf('loginOtp: (name, email) => {')
  assert.ok(implStart >= 0, 'loginOtp বাস্তবায়ন নেই')
  const impl = storeSrc.slice(implStart, storeSrc.indexOf('logout: ()', implStart))
  assert.ok(impl.includes("setUser({ name, email })"), 'loginOtp শুধু user বসায় না')
  assert.ok(!impl.includes('setUid'), 'loginOtp uid ছোঁয় (বেনামি UID বসে যেত)')
  assert.ok(!impl.includes('getCurrentUid'), 'loginOtp Firebase UID নেয়')
  assert.ok(!impl.includes('setFsState'), 'loginOtp Firestore সিঙ্ক চালায়')
})

check('বেনামি গার্ড — onFirebaseAuthUser বেনামি UID বসায় না', () => {
  assert.ok(storeSrc.includes('if (!fbUser || fbUser.isAnonymous || !userRef.current) return'), 'বেনামি গার্ড নেই')
  assert.ok(!storeSrc.includes('if (fbUser && userRef.current) setUid('), 'গার্ড ছাড়া পুরোনো লাইন এখনো আছে')
})

check('OTP ব্যবহারকারীর ইনভাইট — fromUid অ্যাপ-পরিচয়, cg- পরিচয়েও পেলোড হয়', () => {
  assert.ok(pagesSrc.includes('fromUid: uid ?? referralCode'), 'ইনভাইটে fromUid অ্যাপ-পরিচয় নয়')
  assert.equal(CI.isCallableInviteTarget('cg-abc123'), true, 'cg- পরিচয়ে ইনভাইট যায় না')
  const p = CI.buildCallInvitePayload({ fromUid: 'cg-abc123', toUid: 'LXnGL8xA6VW8Gp7hvCaoakOha822', fromName: 'Avijit', fromColour: '#27AE60', kind: 'friend', code: 'abc123' })
  assert.ok(p, 'OTP ব্যবহারকারীর পেলোড বানানো যায় না')
  assert.equal(p.fromUid, 'cg-abc123')
  assert.ok(pagesSrc.includes("kind: type === 'service' ? 'service' : isDating ? 'dating' : 'friend'"), 'ডেটিং কলেও ইনভাইট যায় না')
})

check('সার্ভার-মিন্টেড কাস্টম টোকেন নয় — admin শুধু projectId দিয়ে চলে', () => {
  assert.ok(!authServerSrc.includes('createCustomToken'), 'createCustomToken ব্যবহার হচ্ছে (চাবি ছাড়া চলবে না)')
})

console.log(`\n${passed} passed`)
