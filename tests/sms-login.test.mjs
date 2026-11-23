// SMS OTP mobile login — frontend only (workstream I). No backend, no gateway
// SDK/key/secret anywhere: the app only calls POST /api/otp/send + /api/otp/verify
// with { channel:'sms', phone } and shows a clear message when the backend
// answers 'not_configured'. Run: node tests/sms-login.test.mjs
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const pages = read('src/pages.tsx')
const api = read('src/api.ts')

const outDir = mkdtempSync(join(tmpdir(), 'picall-phone-test-'))
const outFile = join(outDir, 'phone.mjs')
await build({
  entryPoints: [join(root, 'src/phone.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
})
const P = await import(outFile)

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('SMS login tests:')
check('phone normalisation: plain 11-digit number stays', () => {
  assert.equal(P.normalizeBdPhone('01712345678'), '01712345678')
  assert.equal(P.normalizeBdPhone('01912345678'), '01912345678')
})
check('phone normalisation: +880 / 880 prefixes become 01', () => {
  assert.equal(P.normalizeBdPhone('+8801712345678'), '01712345678')
  assert.equal(P.normalizeBdPhone('8801712345678'), '01712345678')
})
check('phone normalisation: Bengali digits become Latin', () => {
  assert.equal(P.normalizeBdPhone('০১৭১২৩৪৫৬৭৮'), '01712345678')
  assert.equal(P.normalizeBdPhone('+৮৮০১৭১২৩৪৫৬৭৮'), '01712345678')
})
check('phone normalisation: spaces and dashes are ignored', () => {
  assert.equal(P.normalizeBdPhone('01712 345 678'), '01712345678')
  assert.equal(P.normalizeBdPhone('01712-345678'), '01712345678')
})
check('phone normalisation: invalid numbers are null', () => {
  assert.equal(P.normalizeBdPhone('01212345678'), null) // 012 is not a mobile prefix
  assert.equal(P.normalizeBdPhone('01112345678'), null) // 011 is not a mobile prefix
  assert.equal(P.normalizeBdPhone('0171234567'), null) // 10 digits
  assert.equal(P.normalizeBdPhone('017123456789'), null) // 12 digits
  assert.equal(P.normalizeBdPhone('abc'), null)
  assert.equal(P.normalizeBdPhone(''), null)
})

check('api.ts: SMS OTP calls the existing OTP endpoints with channel sms', () => {
  assert.ok(api.includes("export function sendSmsOtp(phone: string)"), 'sendSmsOtp নেই')
  assert.ok(api.includes("export function verifySmsOtp(phone: string, code: string)"), 'verifySmsOtp নেই')
  assert.ok(api.includes("postOtp('/api/otp/send', { channel: 'sms', phone })"), 'send body-তে channel sms নেই')
  assert.ok(api.includes("postOtp('/api/otp/verify', { channel: 'sms', phone, code })"), 'verify body-তে channel sms নেই')
  assert.ok(!api.includes('gateway'), 'api.ts-এ গেটওয়ে কোড থাকার কথা নয়')
})

check('login page: mobile number option exists next to email/Google', () => {
  const start = pages.indexOf('export function LoginPage()')
  const end = pages.indexOf('// ফিডের স্টোরি ক্যাপশন', start)
  const login = pages.slice(start, end)
  assert.ok(login.includes('Or log in with mobile number'), 'মোবাইল অপশন নেই')
  assert.ok(login.includes('Send OTP by SMS'), 'SMS OTP বোতাম নেই')
  assert.ok(login.includes('Mobile Number'), 'মোবাইল নম্বর ইনপুট নেই')
  assert.ok(login.includes('SMS login is not set up yet — please use email login for now.'), 'not_configured বার্তা নেই')
  assert.ok(login.includes('normalizeBdPhone(phone)'), 'নম্বর স্বাভাবিককরণ ব্যবহার হয় না')
  assert.ok(!login.includes('gateway'), 'লগইন পেজে গেটওয়ে কোড থাকার কথা নয়')
})

check('login page: email + Google login untouched', () => {
  assert.ok(pages.includes('1-Click Login with Gmail'), 'Gmail লগইন নেই')
  assert.ok(pages.includes('Send Login Link by Email'), 'ইমেইল লিংক লগইন নেই')
  assert.ok(pages.includes('Or log in with email OTP'), 'ইমেইল OTP সেকশন নেই')
  assert.ok(pages.includes('sendEmailOtp'), 'ইমেইল OTP কল নেই')
})

console.log(`\nAll ${passed} SMS login tests passed.`)
