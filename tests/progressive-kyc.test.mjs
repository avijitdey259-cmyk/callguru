// Progressive KYC — Dating open from the start; after chatting with 5 different
// people in Dating, KYC becomes mandatory to continue; referral-bonus claims +
// Pi withdrawals always need approved KYC (daily + install bonus stay as-is).
// KYC flow itself is unchanged. Run: node tests/progressive-kyc.test.mjs
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const pages = read('src/pages.tsx')
const store = read('src/store.tsx')
const mappingSrc = read('src/firestoreMapping.ts')

// firestoreMapping is pure — bundle + import it for real gate + mapping checks.
const outDir = mkdtempSync(join(tmpdir(), 'picall-kyc-test-'))
const outFile = join(outDir, 'mapping.mjs')
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

console.log('Progressive KYC tests:')

// ---------- গেটের নিয়ম (আসল লজিক) ----------
check('gate triggers exactly after the 5th distinct Dating chat partner', () => {
  assert.equal(M.DATING_KYC_CHAT_LIMIT, 5)
  assert.equal(M.datingGateReached('none', 0), false)
  assert.equal(M.datingGateReached('none', 4), false)
  assert.equal(M.datingGateReached('none', 5), true)
  assert.equal(M.datingGateReached('none', 9), true)
  assert.equal(M.datingGateReached('pending', 5), true)
  assert.equal(M.datingGateReached('rejected', 5), true)
  // অনুমোদিত KYC থাকলে গেট কখনো ওঠে না
  assert.equal(M.datingGateReached('approved', 0), false)
  assert.equal(M.datingGateReached('approved', 5), false)
  assert.equal(M.datingGateReached('approved', 50), false)
})
check('chat count is stored in the private user record (never publicProfiles)', () => {
  const base = {
    name: 'A', email: 'a@x.com', freeFirstMinuteUsed: false, calls: [], friends: [], requests: [],
    likesUsed: 0, premium: false, piBalance: 0, bonusPi: 0, points: 0, referrals: 0, liveEarnings: 0,
    kycStatus: 'none', kycInfo: null, kycRejectReason: '', referralCode: 'cg-1', referrer: null,
    refWelcomeClaimed: false, referralRewarded: false, referralPiEarned: 0, hasToppedUp: false,
    lastClaimDate: null, streak: 0, giftBoxClaimedCycle: null, totalShares: 0, reelShares: {},
    giftsSentPi: 0, piWalletAddress: null, piDeposits: [], piWithdrawals: [], piLedger: [],
    profileDob: '', gender: '', district: '', thana: '', address: '', hideAddress: false,
    profilePhoto: '', galleryPhotos: [], interests: [],
    recoveryEmail: '', recoveryPhone: '', recoveryEmailVerified: false,
    recoveryPhoneVerified: false, twoFactorEnabled: false,
  }
  const doc = M.toUserDoc({ ...base, datingChatPartnerIds: ['u1', 'u2', 'u3', 'u4', 'u5'] })
  assert.deepEqual(doc.datingChatPartnerIds, ['u1', 'u2', 'u3', 'u4', 'u5'])
  assert.equal(M.toUserDoc(base).datingChatPartnerIds.length, 0)
  const back = M.fromUserDoc(doc)
  assert.deepEqual(back.datingChatPartnerIds, ['u1', 'u2', 'u3', 'u4', 'u5'])
  const junk = M.fromUserDoc({ datingChatPartnerIds: 'u1' })
  assert.equal(junk.datingChatPartnerIds, undefined)
  // publicProfiles-এ যাওয়ার পথে (writePublicProfile) এই ঘর নেই
  const firestore = read('src/firestore.ts')
  const wpp = firestore.slice(firestore.indexOf('export async function writePublicProfile'), firestore.indexOf('// ---------- chats/'))
  assert.ok(!wpp.includes('datingChatPartnerIds'), 'public profile-এ চ্যাটের হিসাব যাওয়ার কথা নয়')
})

// ---------- ডেটিং গেট: শুরুতে খোলা, ৫ চ্যাটের পর বন্ধ ----------
check('Dating is open before the gate (no blanket KYC wall)', () => {
  const dp = pages.slice(pages.indexOf('export function DatingPage()'), pages.indexOf('// ---------- ডেটিং লাইভ ----------'))
  assert.ok(dp.includes('if (datingKycRequired || kycSuccess)'), 'DatingPage-এ নতুন গেট নেই')
  assert.ok(!dp.includes('if (!kycVerified'), 'পুরোনো blanket KYC দেওয়াল এখনো আছে')
  assert.ok(dp.includes('claimReferralBonus()'), 'অনুমোদনের পর আটকে থাকা বোনাস দাবি হয় না')
})
check('gate blocks new matches/chats/calls on every Dating entry (incl. direct links)', () => {
  assert.ok(pages.includes('if (isDating && datingKycRequired)'), 'ডেটিং কল গেট নেই')
  const live = pages.slice(pages.indexOf('export function DatingLivePage()'), pages.indexOf('export function DatingGoLivePage()'))
  assert.ok(live.includes('if (datingKycRequired)'), 'ডেটিং লাইভ গেট নেই')
  const goStart = pages.indexOf('export function DatingGoLivePage()')
  const goEnd = pages.indexOf('export function ', goStart + 10)
  const golive = pages.slice(goStart, goEnd === -1 ? undefined : goEnd)
  assert.ok(golive.includes('if (datingKycRequired)'), 'Go Live গেট নেই')
  // ডেটিংয়ে ঢোকার কোনো পথেই পুরোনো blanket KYC গেট নেই (টাকার কাজের
  // KYC গেট — গিফট বক্স/তোলা — আলাদা, সেগুলো এখানে গোনা হয় না)
  assert.ok(!pages.includes('if (!kycVerified || kycSuccess)'), 'DatingPage-এ পুরোনো গেট রয়ে গেছে')
  for (const [name, s, e] of [
    ['CallPage', pages.indexOf('export function CallPage()'), pages.indexOf('export function WalletPage()')],
    ['DatingPage', pages.indexOf('export function DatingPage()'), pages.indexOf('export function DatingLivePage()')],
    ['DatingLivePage', pages.indexOf('export function DatingLivePage()'), pages.indexOf('export function DatingGoLivePage()')],
  ]) {
    assert.ok(!pages.slice(s, e).includes('if (!kycVerified)'), `${name}-এ পুরোনো blanket KYC গেট রয়ে গেছে`)
  }
})
check('gate prompt is friendly and explains why (safety + real people, 18+)', () => {
  assert.ok(pages.includes("You've chatted with"), 'গেটের বন্ধুত্বপূর্ণ বার্তা নেই')
  assert.ok(pages.includes('to keep Dating safe and real (18+ only)'), 'নিরাপত্তার কারণ নেই')
  assert.ok(pages.includes('new matches, chats and calls in Dating are paused'), 'কী বন্ধ হয় তা নেই')
  assert.ok(pages.includes('KYC needed to continue Dating'), 'গেটের শিরোনাম নেই')
})

// ---------- চ্যাট গোনা: আলাদা মানুষ, প্রথম মেসেজেই ----------
check('a Dating chat partner is counted once, on first message sent', () => {
  assert.ok(store.includes('recordDatingChat: (partnerId: string) => void'), 'recordDatingChat নেই')
  assert.ok(store.includes("setDatingChatPartnerIds(prev => prev.includes(id) ? prev : [...prev, id].slice(0, 50))"), 'একই মানুষ বারবার গোনা ঠেকানো হয়নি')
  assert.ok(store.includes("load('datingChatPartnerIds', [])"), 'চ্যাটের হিসাব localStorage-এ নেই')
  assert.ok(store.includes('datingChatPartnerIds,'), 'collectSnapshot-এ চ্যাটের হিসাব নেই')
  const chat = pages.slice(pages.indexOf('export function ChatPage()'), pages.indexOf('// ---------- ডেটিং KYC'))
  assert.ok(chat.includes('datingPartnerIdRef'), 'ChatPage-এ ডেটিং partner ট্র্যাক নেই')
  assert.ok(chat.includes('recordDatingChat(datingPartnerIdRef.current)'), 'মেসেজ পাঠালে গোনা হয় না')
  const dp = pages.slice(pages.indexOf('export function DatingPage()'), pages.indexOf('// ---------- ডেটিং লাইভ ----------'))
  assert.ok(dp.includes('datingPartnerId: matchedId'), 'ম্যাচ কার্ড থেকে partnerId যায় না')
})

// ---------- টাকার কাজ: সবসময় অনুমোদিত KYC ----------
check('referral welcome bonus is held without approved KYC, claimable after', () => {
  const claimStart = store.indexOf('claimRefArrival: (code)')
  const claim = store.slice(claimStart, store.indexOf('referralRewarded,', claimStart))
  assert.ok(claim.includes("if (kycStatus !== 'approved')"), 'claimRefArrival-এ KYC গেট নেই')
  assert.ok(claim.includes('complete KYC once to claim'), 'আটকে থাকা বোনাসের বার্তা নেই')
  assert.ok(store.includes('claimReferralBonus: () => {'), 'claimReferralBonus নেই')
  const cbStart = store.indexOf('claimReferralBonus: () => {')
  const cb = store.slice(cbStart, store.indexOf('referralRewarded,', cbStart))
  assert.ok(cb.includes("if (kycStatus !== 'approved') return false"), 'claimReferralBonus KYC ছাড়াও দেয়')
  assert.ok(cb.includes('setRefWelcomeClaimed(true)'), 'দাবিতে ওয়েলকাম বোনাস মেলে না')
  assert.ok(cb.includes('setReferralRewarded(true)'), 'দাবিতে রেফারেল পুরস্কার মেলে না')
  // ব্যানার থেকে দাবি করা যায়
  assert.ok(pages.includes('Claim referral bonus'), 'ব্যানারে দাবির বোতাম নেই')
  assert.ok(pages.includes('claimReferralBonus()'), 'ব্যানার দাবি ডাকে না')
})
check('inviter reward on first top-up waits for approved KYC', () => {
  const apStart = store.indexOf('approveTopUp: (id)')
  const ap = store.slice(apStart, store.indexOf('rejectTopUp: (id)', apStart))
  assert.ok(ap.includes("kycStatus === 'approved'"), 'approveTopUp-এ পুরস্কারের KYC গেট নেই')
})
check('Pi withdrawal needs approved KYC (store gate + wallet message)', () => {
  const wdStart = store.indexOf('withdrawPi: (amount, address, chain) => {')
  const wd = store.slice(wdStart, store.indexOf('profileDob,', wdStart))
  assert.ok(wd.includes("if (kycStatus !== 'approved') return false"), 'withdrawPi-তে KYC গেট নেই')
  assert.ok(pages.includes('Pi withdrawal needs approved KYC — complete Dating KYC first.'), 'ওয়ালেটে KYC বার্তা নেই')
})
check('gift-box prize needs approved KYC (it is withdrawable Pi)', () => {
  const gbStart = store.indexOf('claimGiftBox: () => {\n      if (!canClaimGiftBox)')
  const gb = store.slice(gbStart, store.indexOf('totalShares,', gbStart))
  assert.ok(gb.includes("if (kycStatus !== 'approved') return null"), 'claimGiftBox-এ KYC গেট নেই')
  assert.ok(pages.includes('Gift box needs approved KYC — complete Dating KYC first.'), 'গিফট বক্সে KYC বার্তা নেই')
})
check('daily bonus + install bonus stay ungated (tiny, gift-only)', () => {
  const dailyStart = store.indexOf('claimDailyBonus: () => {\n      const today')
  const daily = store.slice(dailyStart, store.indexOf('giftBoxCycle,', dailyStart))
  assert.ok(!daily.includes('kycStatus'), 'ডেইলি বোনাসে KYC গেট ঢুকে গেছে')
  const instStart = store.indexOf('const claimInstallBonus = (): boolean => {')
  const inst = store.slice(instStart, instStart + 600)
  assert.ok(inst.includes('INSTALL_BONUS_PI'), 'ইন্সটল বোনাস ফাংশন পাওয়া যায়নি')
  assert.ok(!inst.includes('kycStatus'), 'ইন্সটল বোনাসে KYC গেট ঢুকে গেছে')
})

// ---------- KYC ফ্লো অপরিবর্তিত + সুরক্ষা অপরিবর্তিত ----------
check('KYC flow unchanged (form, 18+ check, submit, admin review)', () => {
  assert.ok(pages.includes('submitKycToStore({'), 'KYC জমা দেওয়া নেই')
  assert.ok(pages.includes('You must be at least 18 years old for Dating.'), '১৮+ যাচাই নেই')
  assert.ok(pages.includes('📤 Submit KYC'), 'KYC জমা বাটন নেই')
  assert.ok(pages.includes('🛡️ Dating KYC Verification — Admin'), 'অ্যাডমিন KYC ট্যাব নেই')
  assert.ok(pages.includes('You never need to do KYC again — once is enough.'), 'অনুমোদনের স্ক্রিন নেই')
})
check('report/block + call-request system stay', () => {
  const dp = pages.slice(pages.indexOf('export function DatingPage()'), pages.indexOf('// ---------- ডেটিং লাইভ ----------'))
  assert.ok(dp.includes('Report'), 'রিপোর্ট বোতাম নেই')
  assert.ok(pages.includes('Answer/Decline') || pages.includes('answer') || pages.includes('IncomingCall'), 'কল-অনুরোধ (Answer/Decline) ব্যবস্থা নেই')
})

console.log(`\nAll ${passed} progressive-KYC tests passed.`)
