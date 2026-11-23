// KYC স্ক্রিনের লেখা — ব্যবহারকারীর স্ক্রিনে অ্যাডমিন দেখবে/চেক করবে জাতীয় লেখা নেই।
// চালানো: রিপো রুট থেকে `node tests/kyc-text.test.mjs`
// (src/pages.tsx-এর KycPage + DatingKycBlocked অংশের লেখা পড়ে যাচাই করে —
//  ফর্ম, ১৮+ যাচাই, জমা দেওয়ার ফ্লো আর অ্যাডমিনের KYC যাচাই ট্যাব অপরিবর্তিত থাকতে হবে।)
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

// ব্যবহারকারীর KYC স্ক্রিনের অংশ (KycPage + DatingKycBlocked) — অ্যাডমিন ট্যাব নয়।
const start = pagesSrc.indexOf('function KycPage(')
const end = pagesSrc.indexOf('export function DatingPage()')
assert.ok(start > 0 && end > start, 'KycPage / DatingKycBlocked অংশ পাওয়া যায়নি')
const kycUserRegion = pagesSrc.slice(start, end)
// কোড কমেন্ট (// ...) বাদ দিয়ে শুধু UI-এর লেখা দেখা হয়।
const kycUserUi = kycUserRegion.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

// ---- বাদ দেওয়া লেখাগুলো: পুরো ফাইলে কোথাও (UI-তে) থাকবে না ----
const REMOVED = [
  'অ্যাডমিন যাচাই করবেন', // জমা দিন বাটন: "KYC জমা দিন (অ্যাডমিন যাচাই করবেন)"
  'অ্যাডমিন এটাই দেখবেন', // ভিডিও ক্লিপের ক্যাপশন
  'অ্যাডমিন আপনার KYC বাতিল করেছেন', // বাতিলের স্ক্রিন (দুটো জায়গা)
  'অ্যাডমিন দেখে মিলিয়ে অনুমোদন করলে', // গেট স্ক্রিনের অপেক্ষার লেখা
  'অ্যাডমিন আপনার নাম, বয়স, আইডি আর সেলফি মিলিয়ে দেখছেন', // অপেক্ষার স্ক্রিন
  'অ্যাডমিন আপনার নাম-বয়স-আইডির সাথে ছবি ও ভিডিও মিলিয়ে দেখবেন', // সেলফির নির্দেশনা
]
for (const phrase of REMOVED) {
  check(`বাদ: "${phrase}"`, () => assert.ok(!pagesSrc.includes(phrase), `এখনো আছে: ${phrase}`))
}

// ব্যবহারকারীর KYC অংশে (কমেন্ট বাদে) "অ্যাডমিন" শব্দটাই থাকবে না।
check('ব্যবহারকারীর KYC স্ক্রিনে "অ্যাডমিন" শব্দ নেই', () => {
  assert.ok(!kycUserUi.includes('অ্যাডমিন'), 'KycPage/DatingKycBlocked-এর UI-তে এখনো "অ্যাডমিন" আছে')
})

// ---- বিস্তারিত (ফর্ম, নির্দেশনা, অবস্থা) সব আগের মতোই আছে ----
const KEPT = [
  'পুরো নাম', // ধাপ ১: নামের ঘর
  'জন্ম তারিখ', // ধাপ ১: জন্ম তারিখের ঘর
  'আইডির ধরন', // ধাপ ১: আইডির ধরনের ঘর
  'আইডি নম্বর', // ধাপ ১: আইডি নম্বরের ঘর
  'ডেটিংয়ের জন্য বয়স কমপক্ষে ১৮ বছর হতে হবে।', // ১৮+ যাচাই
  '🔒 পুরো NID নম্বর সংরক্ষণ করা হয় — অন্য ব্যবহারকারীদের সাথে শেয়ার করা হয় না', // NID-র গোপনীয়তার নোট
  'ছবি ও ভিডিও শুধু যাচাইয়ের জন্য রাখা হয়।', // সেলফির নির্দেশনা
  '🎥 আপনার লাইভ ভিডিও ক্লিপ</p>', // ভিডিও ক্লিপের ক্যাপশন
  '📤 KYC জমা দিন</Btn>', // জমা দিন বাটন
  'আপনার KYC জমা হয়েছে', // অপেক্ষার অবস্থা
  'আপনার KYC বাতিল হয়েছে।', // বাতিলের অবস্থা
  '⏳ KYC পর্যালোচনাধীন', // অপেক্ষার শিরোনাম
  '📸 ছবি তুলুন', // সেলফি তোলার বাটন
]
for (const phrase of KEPT) {
  check(`থাকে: "${phrase}"`, () => assert.ok(kycUserUi.includes(phrase), `নেই: ${phrase}`))
}

// জমা দেওয়ার ফ্লো অপরিবর্তিত: স্টোরে KYC জমা হয়, তারপর সম্পূর্ণ হয়।
check('জমা দেওয়ার ফ্লো অপরিবর্তিত (submitKycToStore + onComplete)', () => {
  assert.ok(kycUserRegion.includes('submitKycToStore({'), 'submitKycToStore কল নেই')
  assert.ok(kycUserRegion.includes('onComplete()'), 'onComplete কল নেই')
})

// অ্যাডমিনের KYC যাচাই ট্যাব অপরিবর্তিত — ওটা অ্যাডমিনের স্ক্রিন, ব্যবহারকারীর নয়।
check('অ্যাডমিনের KYC যাচাই ট্যাব অপরিবর্তিত', () => {
  assert.ok(pagesSrc.includes('🛡️ ডেটিং KYC যাচাই — অ্যাডমিন'), 'অ্যাডমিন KYC ট্যাবের শিরোনাম নেই')
})

console.log(`\n${passed} passed`)
