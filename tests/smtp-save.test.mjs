// Admin SMTP/SMS save — ৩০ সেকেন্ড টাইমআউট + সত্যি বার্তা।
// চালানো: রিপো রুট থেকে `node tests/smtp-save.test.mjs`
// (api.ts বান্ডল করে ধ্রুবক পড়া হয়; পেজের সেভ-হ্যান্ডলার সোর্স পড়ে
// যাচাই করা হয় — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) ADMIN_TIMEOUT_MS ৩০০০০, API_TIMEOUT_MS ৫০০০-ই থাকে (OTP/সাধারণ কল বদলায় না)
//   ২) saveAdminSmtp/saveAdminSms ৩০ সেকেন্ড পায়; fetchJson-এ টাইমআউট প্যারামিটার
//   ৩) সেভের ঠিক পরের স্ট্যাটাস চেক ৩০ সেকেন্ড পায়
//   ৪) ব্যর্থ বার্তা "✅ SMTP saved" দিয়ে শুরু হয় না — ❌ দিয়ে শুরু, সার্ভার
//      না পাওয়ার কথা বলে; সাফল্য শুধু সার্ভারের smtpConfigured নিশ্চিত হলে
//   ৫) "✅ App Password saved" / "✅ API Key saved" হিন্ট শুধু সার্ভার
//      নিশ্চিত করলে (serverStatus.smtpConfigured/smsConfigured), লোকাল
//      state থেকে নয়; ব্যর্থ বার্তা লাল রঙে
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-smtp-test-'))
await build({
  entryPoints: [join(root, 'src/api.ts')],
  bundle: true, format: 'esm', platform: 'node', outdir: outDir, logLevel: 'silent',
  define: { 'import.meta.env.VITE_API_URL': '""' },
})
const API = await import(join(outDir, 'api.js'))

const apiSrc = readFileSync(join(root, 'src/api.ts'), 'utf8')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

check('ADMIN_TIMEOUT_MS ৩০০০০, API_TIMEOUT_MS ৫০০০-ই থাকে', () => {
  assert.equal(API.ADMIN_TIMEOUT_MS, 30000)
  assert.equal(API.API_TIMEOUT_MS, 5000)
})

check('saveAdminSmtp/saveAdminSms ৩০ সেকেন্ড পায়; fetchJson-এ টাইমআউট প্যারামিটার', () => {
  assert.ok(apiSrc.includes('async function fetchJson<T>(path: string, init?: RequestInit, timeoutMs: number = API_TIMEOUT_MS)'), 'fetchJson-এ টাইমআউট প্যারামিটার নেই')
  assert.ok(apiSrc.includes('const timer = setTimeout(() => ctrl.abort(), timeoutMs)'), 'fetchJson টাইমআউট প্যারামিটার ব্যবহার করে না')
  const smtpFn = apiSrc.slice(apiSrc.indexOf('export async function saveAdminSmtp'), apiSrc.indexOf('export function getAdminSettingsStatus'))
  assert.ok(smtpFn.includes('ADMIN_TIMEOUT_MS'), 'saveAdminSmtp ৩০ সেকেন্ড পায় না')
  assert.ok(!smtpFn.includes('API_TIMEOUT_MS'), 'saveAdminSmtp এখনো ৫ সেকেন্ডে মরে')
  const smsFn = apiSrc.slice(apiSrc.indexOf('export async function saveAdminSms'))
  assert.ok(smsFn.includes('ADMIN_TIMEOUT_MS'), 'saveAdminSms ৩০ সেকেন্ড পায় না')
  assert.ok(!smsFn.includes('API_TIMEOUT_MS'), 'saveAdminSms এখনো ৫ সেকেন্ডে মরে')
})

check('সেভের ঠিক পরের স্ট্যাটাস চেক ৩০ সেকেন্ড পায়', () => {
  assert.ok(apiSrc.includes('export function getAdminSettingsStatus(timeoutMs: number = API_TIMEOUT_MS)'), 'getAdminSettingsStatus-এ টাইমআউট প্যারামিটার নেই')
  assert.ok(apiSrc.includes("return fetchJson('/api/admin/settings', undefined, timeoutMs)"), 'স্ট্যাটাস চেক টাইমআউট প্যারামিটার পাঠায় না')
  assert.ok(pagesSrc.includes('getAdminSettingsStatus(ADMIN_TIMEOUT_MS)'), 'পেজে সেভের পরের চেক ৩০ সেকেন্ড পায় না')
  assert.ok(pagesSrc.includes('ADMIN_TIMEOUT_MS } from \'./api\''), 'ADMIN_TIMEOUT_MS আমদানি নেই')
})

check('OTP পথ ৫ সেকেন্ডেই থাকে (সাধারণ কল বদলায় না)', () => {
  const otpFn = apiSrc.slice(apiSrc.indexOf('async function postOtp'), apiSrc.indexOf('export function sendEmailOtp'))
  assert.ok(otpFn.includes('API_TIMEOUT_MS'), 'OTP টাইমআউট বদলে গেছে')
  assert.ok(!otpFn.includes('ADMIN_TIMEOUT_MS'), 'OTP ৩০ সেকেন্ড পাচ্ছে')
})

check('ব্যর্থ বার্তা "✅ SMTP saved" দিয়ে শুরু হয় না — ❌ দিয়ে শুরু', () => {
  assert.ok(!pagesSrc.includes('✅ SMTP saved on this device'), 'পুরোনো বিভ্রান্তিকর SMTP বার্তা এখনো আছে')
  assert.ok(!pagesSrc.includes('✅ SMS info saved on this device'), 'পুরোনো বিভ্রান্তিকর SMS বার্তা এখনো আছে')
  assert.ok(pagesSrc.includes('❌ SMTP not saved — it did not reach the server'), 'SMTP ব্যর্থ বার্তা নেই')
  assert.ok(pagesSrc.includes('❌ SMS key not saved — it did not reach the server'), 'SMS ব্যর্থ বার্তা নেই')
})

check('সাফল্য শুধু সার্ভারের নিশ্চিতকরণে (st?.smtpConfigured / st?.smsConfigured)', () => {
  assert.ok(pagesSrc.includes('const confirmed = ok && st?.smtpConfigured === true'), 'SMTP সাফল্য সার্ভারের নিশ্চিতকরণ ছাড়া')
  assert.ok(pagesSrc.includes('const confirmed = ok && st?.smsConfigured === true'), 'SMS সাফল্য সার্ভারের নিশ্চিতকরণ ছাড়া')
  assert.ok(pagesSrc.includes('⚠️ SMTP sent to the server, but the confirmation check did not come back'), 'অনিশ্চিত অবস্থার বার্তা নেই')
})

check('"✅ App Password saved" / "✅ API Key saved" হিন্ট শুধু সার্ভার নিশ্চিত করলে', () => {
  assert.ok(pagesSrc.includes('{serverStatus?.smtpConfigured && smtp.pass && <p className="text-xs text-green-600 mt-1">✅ App Password saved</p>}'), 'App Password হিন্ট সার্ভার-গেট ছাড়া')
  assert.ok(pagesSrc.includes('{serverStatus?.smsConfigured && sms.apiKey && <p className="text-xs text-green-600 mt-1">✅ API Key saved</p>}'), 'API Key হিন্ট সার্ভার-গেট ছাড়া')
  assert.ok(!pagesSrc.includes('{smtp.pass && <p className="text-xs text-green-600 mt-1">✅ App Password saved</p>}'), 'App Password হিন্ট এখনো শুধু লোকাল state থেকে')
  assert.ok(!pagesSrc.includes('{sms.apiKey && <p className="text-xs text-green-600 mt-1">✅ API Key saved</p>}'), 'API Key হিন্ট এখনো শুধু লোকাল state থেকে')
})

check('ব্যর্থ বার্তা লাল রঙে, সাফল্য সবুজে (adminMsgCls)', () => {
  assert.ok(pagesSrc.includes("function adminMsgCls(msg: string)"), 'adminMsgCls নেই')
  assert.ok(pagesSrc.includes("msg.startsWith('❌') ? 'text-red-600'"), '❌ বার্তা লাল নয়')
  assert.ok(pagesSrc.includes('{smtpMsg && <p className={adminMsgCls(smtpMsg)}>{smtpMsg}</p>}'), 'SMTP বার্তায় রঙের নিয়ম নেই')
  assert.ok(pagesSrc.includes('{smsMsg && <p className={adminMsgCls(smsMsg)}>{smsMsg}</p>}'), 'SMS বার্তায় রঙের নিয়ম নেই')
})

console.log(`\n${passed} passed`)
