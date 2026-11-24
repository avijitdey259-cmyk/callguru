// Recovery contacts (email + mobile, both) + two-step verification toggle —
// Profile Settings, private users/{uid} record only, NEVER publicProfiles.
// SMS verification reuses the existing OTP path (gateway unwired → the
// existing not_configured message); no gateway is wired here.
// Run: node tests/recovery-2fa.test.mjs
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
const firestore = read('src/firestore.ts')
const mapping = read('src/firestoreMapping.ts')

// firestoreMapping is pure — bundle + import it for real round-trip checks.
const outDir = mkdtempSync(join(tmpdir(), 'picall-recovery-test-'))
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

console.log('Recovery + 2FA tests:')

// ---------- ম্যাপিং: ব্যক্তিগত ডকে যায়, পাবলিক প্রোফাইলে নয় ----------
check('toUserDoc carries recovery + 2FA fields with safe defaults', () => {
  const base = {
    name: 'A', email: 'a@x.com', freeFirstMinuteUsed: false, calls: [], friends: [], requests: [],
    likesUsed: 0, premium: false, piBalance: 0, bonusPi: 0, points: 0, referrals: 0, liveEarnings: 0,
    kycStatus: 'none', kycInfo: null, kycRejectReason: '', referralCode: 'cg-1', referrer: null,
    refWelcomeClaimed: false, referralRewarded: false, referralPiEarned: 0, hasToppedUp: false,
    lastClaimDate: null, streak: 0, giftBoxClaimedCycle: null, totalShares: 0, reelShares: {},
    giftsSentPi: 0, piWalletAddress: null, piDeposits: [], piWithdrawals: [], piLedger: [],
    profileDob: '', gender: '', district: '', thana: '', address: '', hideAddress: false,
    profilePhoto: '', galleryPhotos: [], interests: [],
  }
  const doc = M.toUserDoc(base)
  assert.equal(doc.recoveryEmail, '')
  assert.equal(doc.recoveryPhone, '')
  assert.equal(doc.recoveryEmailVerified, false)
  assert.equal(doc.recoveryPhoneVerified, false)
  assert.equal(doc.twoFactorEnabled, false)
  const doc2 = M.toUserDoc({
    ...base,
    recoveryEmail: 'r@x.com', recoveryPhone: '01712345678',
    recoveryEmailVerified: true, recoveryPhoneVerified: true, twoFactorEnabled: true,
  })
  assert.equal(doc2.recoveryEmail, 'r@x.com')
  assert.equal(doc2.recoveryPhone, '01712345678')
  assert.equal(doc2.recoveryEmailVerified, true)
  assert.equal(doc2.recoveryPhoneVerified, true)
  assert.equal(doc2.twoFactorEnabled, true)
})
check('fromUserDoc round-trips recovery + 2FA, ignores junk types', () => {
  const doc = M.toUserDoc({
    name: 'A', email: 'a@x.com', freeFirstMinuteUsed: false, calls: [], friends: [], requests: [],
    likesUsed: 0, premium: false, piBalance: 0, bonusPi: 0, points: 0, referrals: 0, liveEarnings: 0,
    kycStatus: 'none', kycInfo: null, kycRejectReason: '', referralCode: 'cg-1', referrer: null,
    refWelcomeClaimed: false, referralRewarded: false, referralPiEarned: 0, hasToppedUp: false,
    lastClaimDate: null, streak: 0, giftBoxClaimedCycle: null, totalShares: 0, reelShares: {},
    giftsSentPi: 0, piWalletAddress: null, piDeposits: [], piWithdrawals: [], piLedger: [],
    profileDob: '', gender: '', district: '', thana: '', address: '', hideAddress: false,
    profilePhoto: '', galleryPhotos: [], interests: [],
    recoveryEmail: 'r@x.com', recoveryPhone: '01712345678',
    recoveryEmailVerified: true, recoveryPhoneVerified: false, twoFactorEnabled: true,
  })
  const back = M.fromUserDoc(doc)
  assert.equal(back.recoveryEmail, 'r@x.com')
  assert.equal(back.recoveryPhone, '01712345678')
  assert.equal(back.recoveryEmailVerified, true)
  assert.equal(back.recoveryPhoneVerified, false)
  assert.equal(back.twoFactorEnabled, true)
  const junk = M.fromUserDoc({ recoveryEmail: 42, recoveryPhone: ['x'], recoveryEmailVerified: 'yes', twoFactorEnabled: 1 })
  assert.equal(junk.recoveryEmail, undefined)
  assert.equal(junk.recoveryPhone, undefined)
  assert.equal(junk.recoveryEmailVerified, undefined)
  assert.equal(junk.twoFactorEnabled, undefined)
})
check('recovery fields NEVER go to publicProfiles', () => {
  const wpp = firestore.slice(firestore.indexOf('export async function writePublicProfile'), firestore.indexOf('// ---------- chats/'))
  assert.ok(!wpp.includes('recovery'), 'writePublicProfile-এ recovery ঘর আছে')
  assert.ok(!wpp.includes('twoFactor'), 'writePublicProfile-এ twoFactor ঘর আছে')
  assert.ok(!wpp.includes('Phone') || wpp.includes('photo'), 'public profile-এ ফোন যাওয়ার কথা নয়')
  // ProfileSettingsForm-ও publicProfiles-এ recovery পাঠায় না — writePublicProfile
  // কলগুলো শুধু gender/district/interests/photo পাঠায়
  for (const m of pages.matchAll(/writePublicProfile\([^)]*\)/g)) {
    assert.ok(!m[0].includes('recovery'), `writePublicProfile কলে recovery: ${m[0]}`)
  }
})

// ---------- স্টোর: স্থায়ী + সিঙ্ক ----------
check('store: security state, localStorage persistence, updateSecurity', () => {
  assert.ok(store.includes('recoveryEmail: string'), 'store-এ recoveryEmail নেই')
  assert.ok(store.includes('recoveryPhone: string'), 'store-এ recoveryPhone নেই')
  assert.ok(store.includes('twoFactorEnabled: boolean'), 'store-এ twoFactorEnabled নেই')
  assert.ok(store.includes('updateSecurity: (p: Partial<SecuritySettings>) => void'), 'updateSecurity নেই')
  assert.ok(store.includes("load('recoveryEmail', '')"), 'recoveryEmail localStorage নেই')
  assert.ok(store.includes("load('recoveryPhone', '')"), 'recoveryPhone localStorage নেই')
  assert.ok(store.includes("load('twoFactorEnabled', false)"), 'twoFactorEnabled localStorage নেই')
  assert.ok(store.includes('recoveryEmail, recoveryPhone, recoveryEmailVerified, recoveryPhoneVerified, twoFactorEnabled,'), 'collectSnapshot-এ নেই')
  assert.ok(store.includes('if (h.twoFactorEnabled !== undefined) setTwoFactorEnabled(h.twoFactorEnabled)'), 'hydrate-এ নেই')
})

// ---------- Profile Settings UI ----------
const psStart = pages.indexOf('function ProfileSettingsForm(')
const psEnd = pages.indexOf('export function MenuPage()', psStart)
const ps = pages.slice(psStart, psEnd)
check('Profile Settings: both recovery fields + 2FA toggle render', () => {
  assert.ok(ps.includes('Recovery & Two-Step Verification'), 'সেকশন শিরোনাম নেই')
  assert.ok(ps.includes('Recovery Email'), 'Recovery Email ঘর নেই')
  assert.ok(ps.includes('Recovery Mobile Number'), 'Recovery Mobile ঘর নেই')
  assert.ok(ps.includes('Two-step verification'), 'টু-স্টেপ টগল নেই')
  assert.ok(ps.includes('twoFactorEnabled ?'), 'টগল অবস্থা নেই')
  assert.ok(ps.includes('never shown to other users'), 'গোপনীয়তা নোট নেই')
  assert.ok(ps.includes('✓ Verified') && ps.includes('Not verified'), 'যাচাই ব্যাজ নেই')
})
check('recovery verification reuses the existing OTP paths (no gateway)', () => {
  assert.ok(ps.includes('sendRecoveryEmailOtp') && ps.includes('sendEmailOtp'), 'ইমেইল OTP যাচাই নেই')
  assert.ok(ps.includes('verifyRecoveryEmailOtp') && ps.includes('verifyEmailOtp'), 'ইমেইল OTP ভেরিফাই নেই')
  assert.ok(ps.includes('sendRecoverySmsOtp') && ps.includes('sendSmsOtp'), 'SMS OTP যাচাই নেই')
  assert.ok(ps.includes('verifyRecoverySmsOtp') && ps.includes('verifySmsOtp'), 'SMS OTP ভেরিফাই নেই')
  assert.ok(ps.includes('normalizeBdPhone(recPhone)'), 'মোবাইল নম্বর স্বাভাবিককরণ নেই')
  // 'gateway' শব্দটা শুধু ব্যবহারকারীকে দেখানো স্থিতি-নোটে আছে ("once the SMS
  // gateway is wired") — গেটওয়ে কোড/চাবি/প্রোভাইডার কোথাও বসানো হয়নি।
  assert.ok(!ps.includes('Nishchit'), 'গেটওয়ে নাম থাকার কথা নয়')
  assert.ok(!ps.includes('apiKey'), 'API চাবি থাকার কথা নয়')
  assert.ok(!ps.includes('BulkSMSBD'), 'গেটওয়ে প্রোভাইডার থাকার কথা নয়')
  assert.ok(!ps.includes('fetch('), 'সেটিংস থেকে সরাসরি fetch থাকার কথা নয়')
  assert.ok(ps.includes('Email OTP is not on yet — the admin is setting it up.'), 'ইমেইল OTP not_configured বার্তা নেই')
  assert.ok(ps.includes('SMS login is not set up yet — please use email login for now.'), 'SMS not_configured বার্তা নেই')
  assert.ok(ps.includes('SMS OTP once the SMS gateway is wired'), 'SMS অপেক্ষার নোট নেই')
})
check('editing a verified contact resets its verified flag; save persists both', () => {
  assert.ok(ps.includes('recoveryEmailVerified: false'), 'ইমেইল বদলে যাচাই বাতিল হয় না')
  assert.ok(ps.includes('recoveryPhoneVerified: false'), 'মোবাইল বদলে যাচাই বাতিল হয় না')
  assert.ok(ps.includes('recoveryEmail: re,'), 'Save-এ recoveryEmail যায় না')
  assert.ok(ps.includes('recoveryPhone: rp,'), 'Save-এ recoveryPhone যায় না')
})
check('2FA toggle only stores the preference (no login-flow change here)', () => {
  // টগল শুধু updateSecurity ডাকে — LoginPage-এ twoFactor পড়া হয় না এখনো
  // (ইমেইল OTP এখনো চালু নয় বলে জোর করা যাবে না — রিপোর্টে বলা আছে)
  const loginStart = pages.indexOf('export function LoginPage()')
  const loginEnd = pages.indexOf('// ফিডের স্টোরি ক্যাপশন', loginStart)
  assert.ok(!pages.slice(loginStart, loginEnd).includes('twoFactor'), 'লগইন ফ্লোতে 2FA জোর করা হয়নি')
})

console.log(`\nAll ${passed} recovery + 2FA tests passed.`)
