// Firestore ম্যাপিং টেস্ট — localStorage অবস্থা ↔ Firestore ডক, কোনো ক্ষতি ছাড়া।
// চালানো: রিপো রুট থেকে `node tests/firestore-mapping.test.mjs`
// (esbuild দিয়ে src/firestoreMapping.ts বান্ডল করে Node-এ চালায় — Firebase লাগে না।)
// যাচাই করে:
//   ১) ব্যালেন্স, খতিয়ান, স্ট্রিক, কল হিসাব রাউন্ড-ট্রিপে হুবহু ফেরে
//   ২) পুরো NID (idNumber), সেলফি, লাইভ ভিডিও কখনো ডকে যায় না
//   ৩) দর + SMS/SMTP গোপন অংশ ব্যবহারকারীর ডকে যায় না (দর config/public-এ যায়)
//   ৪) খালি/ভুল ডকে অ্যাপ ভাঙে না — নিরাপদ ডিফল্ট ফেরে
import { build } from 'esbuild'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-fs-test-'))
const outFile = join(outDir, 'firestoreMapping.mjs')
await build({
  entryPoints: [join(root, 'src/firestoreMapping.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
})
const M = await import(outFile)

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

// ---------- নমুনা localStorage অবস্থা (বাস্তব মান) ----------
const sample = {
  name: 'পরীক্ষা ব্যবহারকারী',
  email: 'test@example.com',
  freeFirstMinuteUsed: true,
  calls: [
    { id: 'call-1', name: 'ডা. রাহাত হোসেন', type: 'Expert', rate: 0.15, durationSec: 600, cost: 1.5, freeMinute: false, time: '২০/১১/২০২৬', status: 'Completed' },
    { id: 'call-2', name: 'তানিয়া', type: 'Dating', rate: 0.1, durationSec: 300, cost: 0.5, freeMinute: false, time: '২০/১১/২০২৬', status: 'Completed' },
  ],
  friends: [{ id: 'fr-1', name: 'রাফি আহমেদ', color: '#1877F2', online: true }],
  requests: [{ id: 'rq-1', name: 'হাসান মাহমুদ', color: '#27AE60', online: true }],
  likesUsed: 7,
  premium: false,
  piBalance: 12.5,
  bonusPi: 1,
  points: 3,
  referrals: 2,
  liveEarnings: 4.25,
  kycStatus: 'pending',
  kycInfo: {
    name: 'পরীক্ষা ব্যবহারকারী',
    dob: '2000-01-15',
    idType: 'NID',
    idNumber: '1234567890',
    idLast4: '7890',
    selfie: 'data:image/jpeg;base64,AAA',
    selfieVideo: 'data:video/webm;base64,BBB',
    submittedAt: '2026-11-20T06:00:00.000Z',
    verifiedAt: null,
  },
  kycRejectReason: '',
  referralCode: 'cg-abc123',
  referrer: 'cg-xyz999',
  refWelcomeClaimed: true,
  referralRewarded: true,
  referralPiEarned: 1,
  hasToppedUp: true,
  lastClaimDate: '2026-11-20',
  streak: 5,
  giftBoxClaimedCycle: null,
  totalShares: 4,
  reelShares: { r1: 2, r2: 1 },
  giftsSentPi: 0.75,
  piWalletAddress: 'G6NBQ4XDRDLSB7VTNDAOO6DKUYADIUNNQF34OTCOWBFG5L2ZD7REPL65',
  piDeposits: [{ id: 'dep-1', amount: 12, ref: 'TX123', date: '২০/১১/২০২৬', status: '✅ ডেমো জমা সম্পূর্ণ' }],
  piWithdrawals: [],
  piLedger: [
    { id: 'pl-1', date: '২০/১১/২০২৬', type: 'জমা', label: 'Pi জমা', amount: 12 },
    { id: 'pl-2', date: '২০/১১/২০২৬', type: 'কল খরচ', label: 'কল — ডা. রাহাত', amount: -1.5 },
    { id: 'pl-3', date: '২০/১১/২০২৬', type: 'রেফারেল', label: 'রেফারেল ওয়েলকাম বোনাস', amount: 1 },
  ],
}

console.log('Firestore mapping tests:')

const doc = M.toUserDoc(sample)

check('ব্যালেন্স/বোনাস/স্ট্রিক/আয় ডকে হুবহু যায়', () => {
  assert.equal(doc.piBalance, 12.5)
  assert.equal(doc.bonusPi, 1)
  assert.equal(doc.streak, 5)
  assert.equal(doc.liveEarnings, 4.25)
  assert.equal(doc.lastClaimDate, '2026-11-20')
  assert.equal(doc.referralPiEarned, 1)
  assert.equal(doc.schemaVersion, 1)
})

check('কল হিসাব, বন্ধু, খতিয়ান, জমা ডকে হুবহু যায়', () => {
  assert.equal(doc.calls.length, 2)
  assert.equal(doc.calls[0].cost, 1.5)
  assert.equal(doc.calls[1].type, 'Dating')
  assert.equal(doc.friends[0].name, 'রাফি আহমেদ')
  assert.equal(doc.piLedger.length, 3)
  assert.equal(doc.piLedger[1].amount, -1.5)
  assert.equal(doc.piDeposits[0].ref, 'TX123')
  assert.deepEqual(doc.reelShares, { r1: 2, r2: 1 })
})

check('পুরো NID / সেলফি / লাইভ ভিডিও ডকে যায় না', () => {
  const json = JSON.stringify(doc)
  assert.equal('idNumber' in doc.kyc, false)
  assert.equal('selfie' in doc.kyc, false)
  assert.equal('selfieVideo' in doc.kyc, false)
  assert.equal(json.includes('1234567890'), false)
  assert.equal(json.includes('data:image'), false)
  assert.equal(json.includes('data:video'), false)
  assert.equal(doc.kyc.idLast4, '7890')
  assert.equal(doc.kyc.status, 'pending')
  assert.equal(doc.kyc.name, 'পরীক্ষা ব্যবহারকারী')
})

check('দর / SMS / SMTP ব্যবহারকারীর ডকে যায় না', () => {
  const json = JSON.stringify(doc)
  assert.equal('piRateBDT' in doc, false)
  assert.equal('datingRate' in doc, false)
  assert.equal('liveRate' in doc, false)
  assert.equal('sms' in doc, false)
  assert.equal('smtp' in doc, false)
  assert.equal(json.includes('BulkSMSBD'), false)
})

check('LOCAL_ONLY_KYC_FIELDS তালিকায় তিনটি নিষিদ্ধ ঘরই আছে', () => {
  assert.deepEqual([...M.LOCAL_ONLY_KYC_FIELDS], ['idNumber', 'selfie', 'selfieVideo'])
})

const back = M.fromUserDoc(doc)

check('ডক থেকে ফিরে ব্যালেন্স/স্ট্রিক/খতিয়ান হুবহু মেলে', () => {
  assert.equal(back.piBalance, 12.5)
  assert.equal(back.bonusPi, 1)
  assert.equal(back.streak, 5)
  assert.equal(back.lastClaimDate, '2026-11-20')
  assert.equal(back.piLedger.length, 3)
  assert.equal(back.piLedger[1].amount, -1.5)
  assert.equal(back.calls.length, 2)
  assert.equal(back.kycStatus, 'pending')
  assert.equal(back.kycInfo.name, 'পরীক্ষা ব্যবহারকারী')
  assert.equal(back.kycInfo.idLast4, '7890')
  assert.equal(back.kycInfo.dob, '2000-01-15')
})

check('ফেরত KYC-তে NID/সেলফি/ভিডিও নেই (বিষাক্ত ডক হলেও)', () => {
  const poisoned = JSON.parse(JSON.stringify(doc))
  poisoned.kyc.idNumber = '1234567890'
  poisoned.kyc.selfie = 'data:image/jpeg;base64,AAA'
  const b2 = M.fromUserDoc(poisoned)
  assert.equal('idNumber' in (b2.kycInfo || {}), false)
  assert.equal('selfie' in (b2.kycInfo || {}), false)
  assert.equal(JSON.stringify(b2).includes('1234567890'), false)
})

check('দ্বিতীয় রাউন্ড-ট্রিপ স্থির থাকে (কোনো মান বদলায় না)', () => {
  const doc2 = M.toUserDoc({ ...sample, ...back, kycInfo: sample.kycInfo })
  assert.deepEqual(doc2, doc)
})

check('অ্যাডমিন config: দর + পেমেন্ট যায়, গোপন অংশ যায় না', () => {
  const cfg = M.toPublicConfig(
    { piRateBDT: 100, usdtRateBDT: 120, piWithdrawFeePct: 1, datingRate: 0.1, liveRate: 0.05 },
    { bkash: '01XXXXXXXXX', nagad: '', rocket: '', usdtBep20: '0xabc', usdtErc20: '', binancePayId: 'PICALL-1', piDepositAddress: 'GABC' },
  )
  assert.equal(cfg.piRateBDT, 100)
  assert.equal(cfg.datingRate, 0.1)
  assert.equal(cfg.payments.bkash, '01XXXXXXXXX')
  assert.equal(cfg.payments.usdtBep20, '0xabc')
  const json = JSON.stringify(cfg)
  assert.equal(json.includes('apiKey'), false)
  assert.equal(json.includes('smtp'), false)
  assert.equal(json.includes('BulkSMSBD'), false)
  const backCfg = M.fromPublicConfig(cfg)
  assert.equal(backCfg.piRateBDT, 100)
  assert.equal(backCfg.payments.bkash, '01XXXXXXXXX')
})

check('ভুল দর config থেকে বাদ যায়', () => {
  const bad = M.fromPublicConfig({ piRateBDT: 0, usdtRateBDT: -5, piWithdrawFeePct: 99, datingRate: 0.001, liveRate: 0.05 })
  assert.equal('piRateBDT' in bad, false)
  assert.equal('usdtRateBDT' in bad, false)
  assert.equal('piWithdrawFeePct' in bad, false)
  assert.equal('datingRate' in bad, false)
  assert.equal(bad.liveRate, 0.05)
})

check('টপ-আপ ডক: uid + সব ঘর যায়, ফিরেও মেলে', () => {
  const req = { id: 'tu-1', method: 'bKash', amount: 500, currency: 'BDT', trxId: 'TRX9', date: '২০/১১/২০২৬', status: 'pending' }
  const tdoc = M.toTopUpDoc(req, 'uid-123')
  assert.equal(tdoc.uid, 'uid-123')
  assert.equal(tdoc.trxId, 'TRX9')
  assert.equal(tdoc.status, 'pending')
  const backReq = M.fromTopUpDoc('tu-1', tdoc)
  assert.deepEqual(backReq, req)
  assert.equal(M.fromTopUpDoc('x', null), null)
  assert.equal(M.fromTopUpDoc('x', { method: 'bKash' }), null)
})

check('খালি/ভুল ডকে ভাঙে না — নিরাপদ ফল ফেরে', () => {
  assert.deepEqual(M.fromUserDoc(null), {})
  assert.deepEqual(M.fromUserDoc({}), {})
  assert.deepEqual(M.fromPublicConfig(null), {})
  const partial = M.fromUserDoc({ piBalance: 'নষ্ট', streak: NaN, calls: 'নষ্ট', piLedger: null })
  assert.equal('piBalance' in partial, false)
  assert.equal(partial.streak, 0)
  assert.equal('calls' in partial, false)
  assert.equal('piLedger' in partial, false)
})

console.log(`\nAll ${passed} Firestore mapping tests passed.`)
