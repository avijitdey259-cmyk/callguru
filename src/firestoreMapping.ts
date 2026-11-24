// Firestore ডেটা মডেল — localStorage ↔ Firestore ফিল্ড ম্যাপিং।
// এই ফাইলটি PURE (কোনো Firebase import নেই), তাই Node-এ সরাসরি টেস্ট করা যায়
// (tests/firestore-mapping.test.mjs)। আসল Firestore পড়া/লেখা হয় src/firestore.ts-এ।
//
// ডক মডেল:
//   users/{uid}        — এক ব্যবহারকারীর সব ব্যক্তিগত ডেটা (ওয়ালেট, খতিয়ান, কল হিসাব,
//                        বন্ধু, বোনাস/স্ট্রিক, রেফারেল, লাইভ আয়, KYC — নিরাপদ অংশটুকু)
//   config/public      — সবার জন্য একটাই ডক: অ্যাডমিনের দর (Pi/USDT/ডেটিং/লাইভ) +
//                        পেমেন্টের আসল নম্বর/ঠিকানা (অ্যাডমিন লেখেন, সবাই পড়েন)
//   topups/{requestId} — একেকটি ম্যানুয়াল টপ-আপ আবেদন (ব্যবহারকারী নিজেরটা লেখেন,
//                        অ্যাডমিন সবগুলো পড়ে অনুমোদন/বাতিল করেন)
//
// যা Firestore-এ কখনো যায় না (localStorage-এই থাকে):
//   - KYC-র idNumber (পুরো NID), selfie, selfieVideo — এগুলো অত্যন্ত সংবেদনশীল;
//     ভেরিফায়েড এনক্রিপ্টেড KYC সার্ভিস ছাড়া ক্লাউডে প্লেইন টেক্সটে রাখা নিষেধ।
//     নিচের LOCAL_ONLY_KYC_FIELDS তালিকাই এটা জোর করে (toUserDoc থেকে বাদ যায়)।
//   - অ্যাডমিনের SMS API key, SMTP পাসওয়ার্ড/ইউজার (adminSettings-এর sms/smtp অংশ)
//   - dark মোড, চ্যাট মেসেজ (callguru:chatMsgs), refNotice — ডিভাইস/ক্ষণস্থায়ী জিনিস
//   - দরগুলো (piRateBDT, usdtRateBDT, piWithdrawFeePct, datingRate, liveRate) ব্যবহারকারীর
//     ডকে থাকে না — সেগুলো শুধু config/public-এ থাকে, নইলে যেকোনো ব্যবহারকারীর
//     লেখায় অ্যাডমিনের দর মুছে যেত।
import type { CallRecord, Friend, KycInfo, KycStatus, PiLedgerRow, PiTx, TopUpRequest } from './store'
import type { Gender } from './profile'
import { EMPTY_ANALYTICS_IDS, sanitizeAnalyticsId, type AnalyticsIds } from './analytics'

export const SCHEMA_VERSION = 1

// প্রগ্রেসিভ KYC — ডেটিংয়ে ৫ জন আলাদা মানুষের সাথে চ্যাট করলে KYC বাধ্যতামূলক
// হয় (তার আগে ডেটিং খোলা); অনুমোদিত KYC থাকলে গেট কখনো ওঠে না।
export const DATING_KYC_CHAT_LIMIT = 5
export function datingGateReached(kycStatus: KycStatus, distinctChatPartners: number): boolean {
  return kycStatus !== 'approved' && distinctChatPartners >= DATING_KYC_CHAT_LIMIT
}

// KYC-র এই ঘরগুলো কখনো Firestore-এ যাবে না — শুধু এই ডিভাইসের localStorage-এ থাকে।
export const LOCAL_ONLY_KYC_FIELDS = ['idNumber', 'selfie', 'selfieVideo'] as const

// users/{uid} ডকে KYC-র নিরাপদ অংশটুকুই যায় — নাম/জন্মতারিখ/আইডির ধরন/শেষ ৪ অঙ্ক + স্ট্যাটাস।
export type KycSync = {
  status: KycStatus
  reason: string
  name: string
  dob: string
  idType: string
  idLast4: string
  submittedAt: string
  verifiedAt: string | null
}

export type UserDoc = {
  schemaVersion: number
  name: string
  email: string
  freeFirstMinuteUsed: boolean
  calls: CallRecord[]
  friends: Friend[]
  requests: Friend[]
  likesUsed: number
  premium: boolean
  piBalance: number
  bonusPi: number
  points: number
  referrals: number
  liveEarnings: number
  kyc: KycSync
  referralCode: string
  referrer: string | null
  refWelcomeClaimed: boolean
  referralRewarded: boolean
  referralPiEarned: number
  hasToppedUp: boolean
  lastClaimDate: string | null
  streak: number
  giftBoxClaimedCycle: number | null
  totalShares: number
  reelShares: Record<string, number>
  giftsSentPi: number
  piWalletAddress: string | null
  piDeposits: PiTx[]
  piWithdrawals: PiTx[]
  piLedger: PiLedgerRow[]
  // প্রোফাইল সেটিংস — জন্মতারিখ/থানা/পুরো ঠিকানা ব্যক্তিগত (শুধু এই ডকে);
  // লিঙ্গ/জেলা/ইন্টারেস্ট/ছবি পাবলিক প্রোফাইলেও যায় (ম্যাচের জন্য)।
  profileDob: string
  gender: Gender
  district: string
  thana: string
  address: string
  hideAddress: boolean
  profilePhoto: string
  galleryPhotos: string[]
  interests: string[]
  // পুনরুদ্ধার + দুই ধাপের যাচাই — শুধু এই ব্যক্তিগত ডকে (publicProfiles-এ কখনো নয়);
  // মোবাইল নম্বর অন্য ব্যবহারকারীর কাছে দেখানো হয় না।
  recoveryEmail: string
  recoveryPhone: string
  recoveryEmailVerified: boolean
  recoveryPhoneVerified: boolean
  twoFactorEnabled: boolean
  // প্রগ্রেসিভ KYC — ডেটিংয়ে চ্যাট করা আলাদা মানুষের সংখ্যা (৫ হলে KYC বাধ্যতামূলক);
  // শুধু এই ব্যক্তিগত ডকে থাকে, publicProfiles-এ কখনো নয়।
  datingChatPartnerIds: string[]
}

// স্টোর থেকে যে স্ন্যাপশট নিয়ে ডক বানানো হয় (দরগুলো এখানে নেই — সেগুলো config/public-এ যায়)।
export type LocalUserState = {
  name: string
  email: string
  freeFirstMinuteUsed: boolean
  calls: CallRecord[]
  friends: Friend[]
  requests: Friend[]
  likesUsed: number
  premium: boolean
  piBalance: number
  bonusPi: number
  points: number
  referrals: number
  liveEarnings: number
  kycStatus: KycStatus
  kycInfo: KycInfo | null
  kycRejectReason: string
  referralCode: string
  referrer: string | null
  refWelcomeClaimed: boolean
  referralRewarded: boolean
  referralPiEarned: number
  hasToppedUp: boolean
  lastClaimDate: string | null
  streak: number
  giftBoxClaimedCycle: number | null
  totalShares: number
  reelShares: Record<string, number>
  giftsSentPi: number
  piWalletAddress: string | null
  piDeposits: PiTx[]
  piWithdrawals: PiTx[]
  piLedger: PiLedgerRow[]
  profileDob: string
  gender: Gender
  district: string
  thana: string
  address: string
  hideAddress: boolean
  profilePhoto: string
  galleryPhotos: string[]
  interests: string[]
  // পুনরুদ্ধার + দুই ধাপের যাচাই — শুধু এই ব্যক্তিগত ডকে (publicProfiles-এ কখনো নয়);
  // মোবাইল নম্বর অন্য ব্যবহারকারীর কাছে দেখানো হয় না।
  recoveryEmail: string
  recoveryPhone: string
  recoveryEmailVerified: boolean
  recoveryPhoneVerified: boolean
  twoFactorEnabled: boolean
  // প্রগ্রেসিভ KYC — ডেটিংয়ে চ্যাট করা আলাদা মানুষের সংখ্যা (৫ হলে KYC বাধ্যতামূলক);
  // শুধু এই ব্যক্তিগত ডকে থাকে, publicProfiles-এ কখনো নয়।
  datingChatPartnerIds: string[]
}

// config/public — অ্যাডমিনের দর + পেমেন্টের আসল বিবরণ (গোপন কিছু এখানে নেই)।
export type PublicConfigDoc = {
  schemaVersion: number
  piRateBDT: number
  usdtRateBDT: number
  piWithdrawFeePct: number
  datingRate: number
  liveRate: number
  tvPlaylistUrl: string
  payments: { bkash: string; nagad: string; rocket: string; usdtBep20: string; usdtErc20: string; binancePayId: string; piDepositAddress: string; piTestnetAddress: string }
  // Analytics ID — Meta Pixel / GA4 / Clarity (সবার দেখা যায় এমন পরিচয়,
  // গোপন কিছু নয়); সাইন-ইন করা সব ব্যবহারকারী পড়ে।
  analytics: AnalyticsIds
}

export type TopUpDoc = {
  uid: string
  method: string
  network?: string
  amount: number
  currency: 'BDT' | 'USDT'
  trxId: string
  date: string
  status: 'pending' | 'approved' | 'rejected'
}

// ---------- নিরাপদ পড়া (ক্লাউডের ডেটা যাচাই করে নেওয়া হয় — ভুল/অসম্পূর্ণ ডেটায় অ্যাপ ভাঙবে না) ----------
function num(v: unknown, d: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : d
}
function str(v: unknown, d: string): string { return typeof v === 'string' ? v : d }
function rec(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, number> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const n = Number(val)
    if (Number.isFinite(n)) out[k] = n
  }
  return out
}
function kycStatus(v: unknown): KycStatus {
  return v === 'pending' || v === 'approved' || v === 'rejected' ? v : 'none'
}

// KYC-র নিরাপদ অংশটুকু বানানো — LOCAL_ONLY_KYC_FIELDS এখানে জোর করে বাদ যায়।
// idNumber/selfie/selfieVideo ইনপুটে থাকলেও আউটপুটে আসে না (টেস্টে যাচাই করা আছে)।
export function toKycSync(info: KycInfo | null, status: KycStatus, reason: string): KycSync {
  return {
    status,
    reason: reason || '',
    name: info?.name || '',
    dob: info?.dob || '',
    idType: info?.idType || '',
    idLast4: info?.idLast4 || '',
    submittedAt: info?.submittedAt || '',
    verifiedAt: info?.verifiedAt ?? null,
  }
}

// localStorage-র বর্তমান অবস্থা → users/{uid} ডক (কোনো মান বানানো হয় না, যা আছে তাই যায়)।
export function toUserDoc(s: LocalUserState): UserDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    name: s.name,
    email: s.email,
    freeFirstMinuteUsed: s.freeFirstMinuteUsed,
    calls: s.calls,
    friends: s.friends,
    requests: s.requests,
    likesUsed: s.likesUsed,
    premium: s.premium,
    piBalance: s.piBalance,
    bonusPi: s.bonusPi,
    points: s.points,
    referrals: s.referrals,
    liveEarnings: s.liveEarnings,
    kyc: toKycSync(s.kycInfo, s.kycStatus, s.kycRejectReason),
    referralCode: s.referralCode,
    referrer: s.referrer,
    refWelcomeClaimed: s.refWelcomeClaimed,
    referralRewarded: s.referralRewarded,
    referralPiEarned: s.referralPiEarned,
    hasToppedUp: s.hasToppedUp,
    lastClaimDate: s.lastClaimDate,
    streak: s.streak,
    giftBoxClaimedCycle: s.giftBoxClaimedCycle,
    totalShares: s.totalShares,
    reelShares: s.reelShares,
    giftsSentPi: s.giftsSentPi,
    piWalletAddress: s.piWalletAddress,
    piDeposits: s.piDeposits,
    piWithdrawals: s.piWithdrawals,
    piLedger: s.piLedger,
    profileDob: s.profileDob || '',
    gender: s.gender === 'Male' || s.gender === 'Female' ? s.gender : '',
    district: s.district || '',
    thana: s.thana || '',
    address: s.address || '',
    hideAddress: s.hideAddress === true,
    profilePhoto: s.profilePhoto || '',
    galleryPhotos: Array.isArray(s.galleryPhotos) ? s.galleryPhotos.filter((x): x is string => typeof x === 'string').slice(0, 8) : [],
    interests: Array.isArray(s.interests) ? s.interests.filter((x): x is string => typeof x === 'string').slice(0, 16) : [],
    recoveryEmail: s.recoveryEmail || '',
    recoveryPhone: s.recoveryPhone || '',
    recoveryEmailVerified: s.recoveryEmailVerified === true,
    recoveryPhoneVerified: s.recoveryPhoneVerified === true,
    twoFactorEnabled: s.twoFactorEnabled === true,
    datingChatPartnerIds: Array.isArray(s.datingChatPartnerIds) ? s.datingChatPartnerIds.filter((x): x is string => typeof x === 'string').slice(0, 50) : [],
  }
}

// users/{uid} ডক → স্টোরে বসানোর মতো অবস্থা (যা ঘর ডকে নেই, সেটা বদলায় না — Partial ফেরে)।
export function fromUserDoc(doc: unknown): Partial<LocalUserState> {
  if (!doc || typeof doc !== 'object') return {}
  const d = doc as Record<string, unknown>
  const k = (d.kyc && typeof d.kyc === 'object' ? d.kyc : {}) as Record<string, unknown>
  const out: Partial<LocalUserState> = {}
  if (typeof d.name === 'string') out.name = d.name
  if (typeof d.email === 'string') out.email = d.email
  if (typeof d.freeFirstMinuteUsed === 'boolean') out.freeFirstMinuteUsed = d.freeFirstMinuteUsed
  if (Array.isArray(d.calls)) out.calls = d.calls as CallRecord[]
  if (Array.isArray(d.friends)) out.friends = d.friends as Friend[]
  if (Array.isArray(d.requests)) out.requests = d.requests as Friend[]
  if (typeof d.likesUsed === 'number') out.likesUsed = num(d.likesUsed, 0)
  if (typeof d.premium === 'boolean') out.premium = d.premium
  if (typeof d.piBalance === 'number') out.piBalance = num(d.piBalance, 0)
  if (typeof d.bonusPi === 'number') out.bonusPi = num(d.bonusPi, 0)
  if (typeof d.points === 'number') out.points = num(d.points, 0)
  if (typeof d.referrals === 'number') out.referrals = num(d.referrals, 0)
  if (typeof d.liveEarnings === 'number') out.liveEarnings = num(d.liveEarnings, 0)
  if (typeof d.referralCode === 'string') out.referralCode = d.referralCode
  if (d.referrer === null || typeof d.referrer === 'string') out.referrer = d.referrer as string | null
  if (typeof d.refWelcomeClaimed === 'boolean') out.refWelcomeClaimed = d.refWelcomeClaimed
  if (typeof d.referralRewarded === 'boolean') out.referralRewarded = d.referralRewarded
  if (typeof d.referralPiEarned === 'number') out.referralPiEarned = num(d.referralPiEarned, 0)
  if (typeof d.hasToppedUp === 'boolean') out.hasToppedUp = d.hasToppedUp
  if (d.lastClaimDate === null || typeof d.lastClaimDate === 'string') out.lastClaimDate = d.lastClaimDate as string | null
  if (typeof d.streak === 'number') out.streak = num(d.streak, 0)
  if (d.giftBoxClaimedCycle === null || typeof d.giftBoxClaimedCycle === 'number') out.giftBoxClaimedCycle = d.giftBoxClaimedCycle as number | null
  if (typeof d.totalShares === 'number') out.totalShares = num(d.totalShares, 0)
  if (d.reelShares && typeof d.reelShares === 'object') out.reelShares = rec(d.reelShares)
  if (typeof d.giftsSentPi === 'number') out.giftsSentPi = num(d.giftsSentPi, 0)
  if (d.piWalletAddress === null || typeof d.piWalletAddress === 'string') out.piWalletAddress = d.piWalletAddress as string | null
  if (Array.isArray(d.piDeposits)) out.piDeposits = d.piDeposits as PiTx[]
  if (Array.isArray(d.piWithdrawals)) out.piWithdrawals = d.piWithdrawals as PiTx[]
  if (Array.isArray(d.piLedger)) out.piLedger = d.piLedger as PiLedgerRow[]
  if (typeof d.profileDob === 'string') out.profileDob = d.profileDob
  if (d.gender === 'Male' || d.gender === 'Female') out.gender = d.gender
  if (typeof d.district === 'string') out.district = d.district
  if (typeof d.thana === 'string') out.thana = d.thana
  if (typeof d.address === 'string') out.address = d.address
  if (typeof d.hideAddress === 'boolean') out.hideAddress = d.hideAddress
  if (typeof d.profilePhoto === 'string') out.profilePhoto = d.profilePhoto
  if (Array.isArray(d.galleryPhotos)) out.galleryPhotos = (d.galleryPhotos as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 8)
  if (Array.isArray(d.interests)) out.interests = (d.interests as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 16)
  // পুনরুদ্ধার + দুই ধাপ — শুধু users/{uid} ব্যক্তিগত ডক থেকে পড়া হয়।
  if (typeof d.recoveryEmail === 'string') out.recoveryEmail = d.recoveryEmail
  if (typeof d.recoveryPhone === 'string') out.recoveryPhone = d.recoveryPhone
  if (typeof d.recoveryEmailVerified === 'boolean') out.recoveryEmailVerified = d.recoveryEmailVerified
  if (typeof d.recoveryPhoneVerified === 'boolean') out.recoveryPhoneVerified = d.recoveryPhoneVerified
  if (typeof d.twoFactorEnabled === 'boolean') out.twoFactorEnabled = d.twoFactorEnabled
  // প্রগ্রেসিভ KYC — ডেটিং চ্যাটের সংখ্যা শুধু users/{uid} ব্যক্তিগত ডক থেকে পড়া হয়।
  if (Array.isArray(d.datingChatPartnerIds)) out.datingChatPartnerIds = (d.datingChatPartnerIds as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 50)
  // KYC: শুধু নিরাপদ ঘরগুলো ফেরে; idNumber/selfie/selfieVideo ডকে থাকার কথা নয়,
  // থাকলেও এখানে পড়া হয় না (সেগুলো শুধু এই ডিভাইসের localStorage-এ থাকে)।
  // ডকে KYC-র স্ট্যাটাস না থাকলে (পুরোনো ডক) স্ট্যাটাস বদলানো হয় না।
  if (typeof k.status === 'string' || typeof k.kycStatus === 'string') out.kycStatus = kycStatus(k.kycStatus ?? k.status)
  if (typeof k.reason === 'string') out.kycRejectReason = k.reason
  const hasKycName = typeof k.name === 'string' && k.name !== ''
  const hasKycSubmission = typeof k.submittedAt === 'string' && k.submittedAt !== ''
  // ডকে KYC জমা না থাকলে kycInfo ঘরটাই ফেরে না — স্থানীয় KYC তথ্য মুছে যাওয়া ঠেকাতে।
  if (hasKycName || hasKycSubmission) {
    out.kycInfo = {
      name: str(k.name, ''),
      dob: str(k.dob, ''),
      idType: str(k.idType, ''),
      idLast4: str(k.idLast4, ''),
      submittedAt: str(k.submittedAt, ''),
      verifiedAt: typeof k.verifiedAt === 'string' ? k.verifiedAt : null,
    }
  }
  return out
}

// অ্যাডমিন সেটিংস → config/public (শুধু দর + পেমেন্টের বিবরণ + Live TV প্লেলিস্টের লিঙ্ক + Analytics ID; sms/smtp গোপন অংশ বাদ যায়)।
export function toPublicConfig(rates: { piRateBDT: number; usdtRateBDT: number; piWithdrawFeePct: number; datingRate: number; liveRate: number }, payments: PublicConfigDoc['payments'], tvPlaylistUrl = '', analytics: AnalyticsIds = EMPTY_ANALYTICS_IDS): PublicConfigDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    piRateBDT: rates.piRateBDT,
    usdtRateBDT: rates.usdtRateBDT,
    piWithdrawFeePct: rates.piWithdrawFeePct,
    datingRate: rates.datingRate,
    liveRate: rates.liveRate,
    tvPlaylistUrl,
    payments: { ...payments },
    analytics: { ...analytics },
  }
}

// config/public → স্টোরের দর + পেমেন্টের বিবরণ + Live TV প্লেলিস্টের লিঙ্ক + Analytics ID (যা ঘর ডকে নেই, সেটা বদলায় না)।
export function fromPublicConfig(doc: unknown): Partial<{ piRateBDT: number; usdtRateBDT: number; piWithdrawFeePct: number; datingRate: number; liveRate: number; tvPlaylistUrl: string; payments: PublicConfigDoc['payments']; analytics: AnalyticsIds }> {
  if (!doc || typeof doc !== 'object') return {}
  const d = doc as Record<string, unknown>
  const out: Record<string, unknown> = {}
  if (typeof d.piRateBDT === 'number' && Number.isFinite(d.piRateBDT) && d.piRateBDT >= 1) out.piRateBDT = d.piRateBDT
  if (typeof d.usdtRateBDT === 'number' && Number.isFinite(d.usdtRateBDT) && d.usdtRateBDT >= 1) out.usdtRateBDT = d.usdtRateBDT
  if (typeof d.piWithdrawFeePct === 'number' && Number.isFinite(d.piWithdrawFeePct) && d.piWithdrawFeePct >= 0 && d.piWithdrawFeePct <= 10) out.piWithdrawFeePct = d.piWithdrawFeePct
  if (typeof d.datingRate === 'number' && Number.isFinite(d.datingRate) && d.datingRate >= 0.01) out.datingRate = d.datingRate
  if (typeof d.liveRate === 'number' && Number.isFinite(d.liveRate) && d.liveRate >= 0.01) out.liveRate = d.liveRate
  // প্লেলিস্টের লিঙ্ক — যেকোনো http(s) লিঙ্ক (শর্ট লিঙ্কও চলে: আসল .m3u-তে রিডাইরেক্ট হয়)।
  if (typeof d.tvPlaylistUrl === 'string' && /^https?:\/\//.test(d.tvPlaylistUrl.trim()) && d.tvPlaylistUrl.trim().length <= 500) out.tvPlaylistUrl = d.tvPlaylistUrl.trim()
  if (d.payments && typeof d.payments === 'object') {
    const p = d.payments as Record<string, unknown>
    const pay: Record<string, string> = {}
    for (const k of ['bkash', 'nagad', 'rocket', 'usdtBep20', 'usdtErc20', 'binancePayId', 'piDepositAddress', 'piTestnetAddress']) {
      if (typeof p[k] === 'string') pay[k] = p[k] as string
    }
    if (Object.keys(pay).length > 0) out.payments = pay as PublicConfigDoc['payments']
  }
  // Analytics ID — তিনটিই সবার দেখা যায় এমন পরিচয়; খালি থাকলে ট্র্যাকার বন্ধ।
  if (d.analytics && typeof d.analytics === 'object') {
    const a = d.analytics as Record<string, unknown>
    const an: AnalyticsIds = {
      pixelId: sanitizeAnalyticsId(a.pixelId),
      ga4Id: sanitizeAnalyticsId(a.ga4Id),
      clarityId: sanitizeAnalyticsId(a.clarityId),
    }
    if (an.pixelId || an.ga4Id || an.clarityId) out.analytics = an
  }
  return out as Partial<{ piRateBDT: number; usdtRateBDT: number; piWithdrawFeePct: number; datingRate: number; liveRate: number; tvPlaylistUrl: string; payments: PublicConfigDoc['payments']; analytics: AnalyticsIds }>
}

// ম্যানুয়াল টপ-আপ আবেদন → topups/{id} ডক।
export function toTopUpDoc(req: TopUpRequest, uid: string): TopUpDoc {
  return {
    uid,
    method: req.method,
    network: req.network,
    amount: req.amount,
    currency: req.currency,
    trxId: req.trxId,
    date: req.date,
    status: req.status,
  }
}

export function fromTopUpDoc(id: string, doc: unknown): TopUpRequest | null {
  if (!doc || typeof doc !== 'object') return null
  const d = doc as Record<string, unknown>
  if (typeof d.method !== 'string' || typeof d.trxId !== 'string') return null
  const req: TopUpRequest = {
    id,
    method: d.method,
    amount: num(d.amount, 0),
    currency: d.currency === 'USDT' ? 'USDT' : 'BDT',
    trxId: d.trxId,
    date: str(d.date, ''),
    status: d.status === 'approved' || d.status === 'rejected' ? d.status : 'pending',
  }
  if (typeof d.network === 'string') req.network = d.network
  return req
}
