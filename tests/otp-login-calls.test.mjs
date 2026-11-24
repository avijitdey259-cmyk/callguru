// "সব লগইন পদ্ধতিতে কল" — নির্ণয় + গার্ড।
// চালানো: রিপো রুট থেকে `node tests/otp-login-calls.test.mjs`
// (সোর্স পড়ে যাচাই করা হয় — Firebase/React লাগে না।)
// নির্ণয় (কোড থেকে যাচাই করা):
//   ১) লগইন পেজে শুধু দুই পদ্ধতি — Google 1-ক্লিক আর ইমেইল+পাসওয়ার্ড;
//      দুটোই Firebase সেশন (getIdToken চলে) — এদের কল আগেই চলে।
//   ২) ইমেইল-OTP লগইন পেজে নেই — OTP শুধু প্রোফাইলে পুনরুদ্ধার-ইমেইল
//      যাচাইয়ে (Profile Settings); SMS লগইন বন্ধ। ইমেইল-লিংক কোড
//      আছে কিন্তু লগইন পেজে ডাকা হয় না।
//   ৩) Firebase সেশন ছাড়া একমাত্র অবস্থা — পুরোনো OTP লগইনের
//      localStorage-ক্যাশ (uid null)। তাদের presence রেজিস্টার হয় না,
//      কারণ সার্ভার টোকেন থেকে uid নেয় আর টোকেন ছাড়া রেজিস্টার দেয় না;
//      ইনভাইটও যায় না (fromId null হলে সার্ভার ফেলে দেয়)।
//   ৪) সার্ভার-মিন্টেড কাস্টম টোকেন (a) করা হয়নি — সার্ভারের
//      firebase-admin শুধু projectId দিয়ে চলে, createCustomToken-এ
//      সার্ভিস-অ্যাকাউন্ট চাবি লাগে (চাবি বানানো হয়নি)।
//   ৫) বেনামি সাইন-ইন (b) করা হয়নি — Anonymous প্রোভাইডার কনসোলে চালু
//      নেই (রেকর্ড করা প্রোভাইডার: Google, Email/Password, Email link),
//      আর বেনামি UID কারো বন্ধু-তালিকায় নেই বলে বন্ধু-কল গেটে
//      'not-friend'-এ আটকাত — Google ব্যবহারকারীর মতো কল হতো না।
//      বেনামি সেশন এলে স্টোর সিঙ্ক যাতে না চলে, সেই গার্ড এখানে যাচাই হয়।
// যাচাই করে:
//   ১) লগইন পেজ — শুধু Firebase পদ্ধতি; OTP লগইন পথ নেই
//   ২) presence — টোকেন ছাড়া রেজিস্টার হয় না; ইনভাইটে পরিচয় টোকেন থেকে
//   ৩) onFirebaseAuthUser গার্ড — বেনামি ব্যবহারকারীর UID বসে না
//   ৪) getCurrentUid শুধু login()-এ (Firebase লগইনের পর) — বেনামি UID
//      কোনো Firestore লেখায় যেতে পারে না
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
const firebaseSrc = readFileSync(join(root, 'src/firebase.ts'), 'utf8')
const presenceSrc = readFileSync(join(root, 'src/presence.ts'), 'utf8')
const serverSrc = readFileSync(join(root, 'server/index.js'), 'utf8')
const authServerSrc = readFileSync(join(root, 'server/auth.js'), 'utf8')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

check('লগইন পেজ — শুধু Firebase পদ্ধতি (Google + ইমেইল/পাসওয়ার্ড)', () => {
  assert.ok(pagesSrc.includes('const u = await signInWithGoogle()'), 'Google লগইন নেই')
  assert.ok(pagesSrc.includes('const u = await signInWithPassword(mail, password)'), 'পাসওয়ার্ড লগইন নেই')
  assert.ok(pagesSrc.includes('const u = await signUpWithPassword(mail, password, name.trim() || undefined)'), 'পাসওয়ার্ড সাইন-আপ নেই')
  assert.ok(pagesSrc.includes('Email + Password • Gmail 1-Click Login'), 'লগইন পেজের শিরোনামে শুধু দুই পদ্ধতি নয়')
})

check('OTP লগইন পথ নেই — OTP শুধু পুনরুদ্ধার-ইমেইল যাচাইয়ে', () => {
  // LoginPage-এ sendEmailOtp/verifyEmailOtp ডাকা হয় না।
  const loginStart = pagesSrc.indexOf('export function LoginPage()')
  const loginEnd = pagesSrc.indexOf('export function ServicesSection()', loginStart)
  assert.ok(loginStart >= 0 && loginEnd > loginStart, 'LoginPage খুঁজে পাওয়া যায়নি')
  const loginSrc = pagesSrc.slice(loginStart, loginEnd)
  assert.ok(!loginSrc.includes('sendEmailOtp') && !loginSrc.includes('verifyEmailOtp'), 'লগইন পেজে OTP লগইন পথ আছে')
  assert.ok(!loginSrc.includes('completeEmailLink'), 'লগইন পেজে ইমেইল-লিংক লগইন আছে')
  // OTP শুধু প্রোফাইলে পুনরুদ্ধার-ইমেইল যাচাইয়ে।
  assert.ok(pagesSrc.includes('const sendRecoveryEmailOtp = async ()'), 'পুনরুদ্ধার-ইমেইল OTP নেই')
  assert.ok(pagesSrc.includes('const verifyRecoveryEmailOtp = async ()'), 'পুনরুদ্ধার-ইমেইল যাচাই নেই')
})

check('presence — টোকেন ছাড়া রেজিস্টার হয় না; ইনভাইটে পরিচয় টোকেন থেকে', () => {
  assert.ok(presenceSrc.includes('getIdToken()'), 'presence টোকেন নেয় না')
  assert.ok(serverSrc.includes("if (!auth) { send(ws, { type: 'presence-error', error: 'unauthorized' }); return }"), 'সার্ভার টোকেন ছাড়া রেজিস্টার দেয় না')
  assert.ok(serverSrc.includes('const userId = auth.uid'), 'সার্ভার uid টোকেন থেকে নেয় না')
  assert.ok(serverSrc.includes('const fromId = ws._presence.userId'), 'ইনভাইটে পরিচয় presence থেকে নয়')
  assert.ok(serverSrc.includes('if (!fromId) return'), 'presence ছাড়া ইনভাইট ফেলে দেওয়া হয় না')
})

check('onFirebaseAuthUser গার্ড — বেনামি ব্যবহারকারীর UID বসে না', () => {
  assert.ok(storeSrc.includes('if (fbUser && !fbUser.isAnonymous && userRef.current) setUid('), 'বেনামি গার্ড নেই')
  assert.ok(!storeSrc.includes('if (fbUser && userRef.current) setUid('), 'গার্ড ছাড়া পুরোনো লাইন এখনো আছে')
})

check('getCurrentUid শুধু login()-এ — বেনামি UID কোনো Firestore লেখায় যায় না', () => {
  const uses = storeSrc.split('getCurrentUid()').length - 1
  assert.equal(uses, 1, 'getCurrentUid() একাধিক জায়গায় ব্যবহৃত হচ্ছে')
  const loginStart = storeSrc.indexOf('login: (name, email) => {')
  assert.ok(loginStart >= 0, 'login() খুঁজে পাওয়া যায়নি')
  const loginFn = storeSrc.slice(loginStart, storeSrc.indexOf('logout: ()', loginStart))
  assert.ok(loginFn.includes('const u = getCurrentUid()'), 'login() UID Firebase থেকে নেয় না')
  assert.ok(!firebaseSrc.includes('signInAnonymously'), 'বেনামি সাইন-ইন কোডে আছে (প্রোভাইডার চালু নেই)')
})

check('সার্ভার-মিন্টেড কাস্টম টোকেন নয় — admin শুধু projectId দিয়ে চলে', () => {
  assert.ok(!authServerSrc.includes('createCustomToken'), 'createCustomToken ব্যবহার হচ্ছে (চাবি ছাড়া চলবে না)')
  assert.ok(serverSrc.includes("version: '6.1.0'"), 'সার্ভার সংস্করণ বদলে গেছে')
})

console.log(`\n${passed} passed`)
