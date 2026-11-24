import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { EXPERTS, SEED_POSTS, roundPi, formatBDT, formatPi, piMinWithdraw, piWithdrawFee, DEFAULT_PI_RATE_BDT, DEFAULT_USDT_RATE_BDT, DEFAULT_PI_WITHDRAW_FEE_PCT, type Post } from './data'
import { BUDDIES, isBuddyId } from './buddies'
import { INSTALL_BONUS_PI, planGiftSpend, canClaimInstallBonus } from './giftPi'
import { getCurrentUid, onFirebaseAuthUser } from './firebase'
import { fetchUserDoc, writeUserDoc, fetchPublicConfig, writePublicConfig, writeTopUpDoc, updateTopUpStatus, fetchPendingTopUps, fetchMyTopUps, writePublicProfile, fetchAllPublicProfiles, setRoomBlocked, createFriendRequest, updateFriendRequestStatus, subscribeIncomingFriendRequests, subscribeSentFriendRequests, ensureNumericUid, findUserByNumericUid, createPiTransfer, fetchMyPiTransfers, subscribeMyPiTransfers, createPaymentRequest, updatePaymentRequestStatus, fetchMyPaymentRequests, subscribeMyPaymentRequests } from './firestore'
import { DEFAULT_TRANSFER_FEE_PCT, DEFAULT_MIN_TRANSFER_PI, cleanTransferFeePct, cleanMinTransfer, computeTransfer, validateTransferInput, transferRoles, buildTransferApplication, isTransferApplied, ADMIN_UID, type PiTransferDoc } from './piTransfer'
import { validatePaymentRequest, canPayRequest, canDeclineRequest, canCancelRequest, type PaymentRequestDoc } from './paymentRequest'
import { buildFriendRequestData, canSendFriendRequest, isIncomingVisible, looksLikeFirebaseUid, requestToFriend, requestToSentEntry } from './friendRequests'
import { colourForUid } from './newMembers'
import { blockRoomId, cleanUidList } from './blocking'
import { DEFAULT_SOUND_SETTINGS, loadSoundSettings, type SoundSettings } from './sounds'
import { DEFAULT_CALL_PRIVACY, loadCallPrivacy, type CallPrivacy } from './incomingCall'
import { toUserDoc, fromUserDoc, toPublicConfig, fromPublicConfig, toTopUpDoc, fromTopUpDoc, datingGateReached, type LocalUserState } from './firestoreMapping'
import { DEFAULT_TV_PLAYLIST_URL } from './tvPlaylist'
import { profileCompletion, type Gender, type ProfileFields } from './profile'
import { EMPTY_ANALYTICS_IDS, envAnalyticsIds, initAnalytics, resolveAnalyticsIds, type AnalyticsIds } from './analytics'
import { DEFAULT_PAYMENT_ENABLED, normalizePaymentEnabled, type PaymentEnabledMap } from './paymentMethods'
import { DEFAULT_AD_RATES, type AdRateSettings } from './ads'
import { togglePostLike as togglePostLikePure, addPostComment as addPostCommentPure, deletePost as deletePostPure, updatePost as updatePostPure } from './feedPosts'

export type CallRecord = { id: string; name: string; type: 'Expert' | 'Friend' | 'Dating' | 'Service'; rate: number; durationSec: number; cost: number; freeMinute: boolean; time: string; status: 'Completed' | 'Missed' | 'Auto-cut' }
export type Friend = { id: string; name: string; color: string; online: boolean; photo?: string; requestId?: string; numericUid?: number }
// requestId — আসা বন্ধু রিকোয়েস্টের friendRequests ডকের চাবি (শুধু রিকোয়েস্ট
// এন্ট্রিতে থাকে); Accept/Decline কোন ডকটা বদলাবে তা এটা দিয়েই চেনে।
export type ChatMsg = { id: string; from: string; text: string; time: string }
export type KycStatus = 'none' | 'pending' | 'approved' | 'rejected'
// ডেটিং KYC — জমা দিলে অ্যাডমিন দেখে মিলিয়ে অনুমোদন/বাতিল করেন; অনুমোদন হলেই ডেটিং খুলবে।
// পুরো NID নম্বর প্রথম ধাপ থেকেই সংরক্ষণ করা হয় (idNumber), যাতে অ্যাডমিন নম্বর মিলিয়ে দেখতে পারেন; idLast4 শুধু সংক্ষিপ্ত প্রদর্শনের জন্য।
// সতর্কতা: পুরো NID অত্যন্ত সংবেদনশীল ব্যক্তিগত তথ্য — আসল প্রোডাকশনে এটি প্লেইন টেক্সটে রাখা যাবে না, এনক্রিপ্ট করে ভেরিফায়েড KYC সার্ভিস দিয়ে পরিচালনা করতে হবে। ডেমোতে শুধু এই ডিভাইসের localStorage-এ থাকে।
// সেলফি ও লাইভ ভিডিও ক্লিপ শুধু অ্যাডমিন যাচাইয়ের জন্য রাখা হয়
export type KycInfo = { name: string; dob: string; idType: string; idNumber?: string; idLast4: string; selfie?: string; selfieVideo?: string; submittedAt: string; verifiedAt: string | null }
// হাতে করা (ম্যানুয়াল) টপ-আপ — bKash/Nagad/Rocket: টাকা পাঠিয়ে TrxID জমা দিলে অ্যাডমিন অনুমোদন দিলে ব্যালেন্স যোগ হয়
export type TopUpRequest = { id: string; method: string; network?: string; amount: number; currency: 'BDT' | 'USDT'; trxId: string; date: string; status: 'pending' | 'approved' | 'rejected' }
// Pi জমা/তোলার হিসাব — Pi নেটওয়ার্কে আসল ব্লকচেইন লেনদেন নয় (অফিসিয়াল Pi SDK
// যুক্ত না হওয়া পর্যন্ত স্থানীয় হিসাব); chain বলে দেয় কোন নেটওয়ার্কের জন্য রেকর্ডটি।
// পুনরুদ্ধার + দুই ধাপের যাচাই — ইমেইল + মোবাইল দুটোই (ঐচ্ছিক, সম্পাদনাযোগ্য);
// শুধু users/{uid} ব্যক্তিগত ডকে থাকে, publicProfiles-এ কখনো নয়।
export type SecuritySettings = { recoveryEmail: string; recoveryPhone: string; recoveryEmailVerified: boolean; recoveryPhoneVerified: boolean; twoFactorEnabled: boolean }
export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = { recoveryEmail: '', recoveryPhone: '', recoveryEmailVerified: false, recoveryPhoneVerified: false, twoFactorEnabled: false }
export type PiTx = { id: string; amount: number; ref?: string; address?: string; fee?: number; received?: number; date: string; status: string; chain?: string }
// π Pi রিপোর্টের লেনদেন খতিয়ান — প্রতিটি Pi ওঠানামা এক লাইনে (আয় +, খরচ −); localStorage-এ থাকে
export type PiLedgerRow = { id: string; date: string; type: string; label: string; amount: number }

// সরানো ডেমো বন্ধু/রিকোয়েস্ট — পুরোনো localStorage-এ থাকলেও লোডের সময় বাদ যায়
// (শুধু সিড id দিয়ে ফিল্টার — একই নামের আসল বন্ধু ভুলে বাদ যাবে না)
const REMOVED_DEMO_FRIEND_IDS = ['fr-1', 'fr-2']
const REMOVED_DEMO_REQUEST_IDS = ['rq-1', 'rq-2']

// ভাইরাল গ্রোথ — ডেইলি বোনাস: ৭ দিনে ধাপে ধাপে বাড়ে, ১ম দিন ০.০০০১ π থেকে ৭ম দিন ০.০০১ π, তারপর আবার ১ম দিন থেকে
export const DAILY_BONUS_REWARDS = [0.0001, 0.00025, 0.0004, 0.00055, 0.0007, 0.00085, 0.001]
// ৩০ দিনের গিফট বক্স — টানা ৩০ দিন ডেইলি বোনাস নিলে ডেইলি বোনাসের উপরে গিফট বক্স; লটারি — সর্বোচ্চ ১ π, বাকিরা ছোট পুরস্কার
export const GIFT_BOX_DAYS = 30
export const GIFT_BOX_PI = 1
export const GIFT_BOX_CONSOLATION = [0.0001, 0.00025, 0.0005, 0.001]
export const REF_WELCOME_PI = 1 // রেফার লিংকে এসে নতুন ব্যবহারকারী পাবেন (π) — বোনাস Pi (তোলা যাবে না)
export const REF_INVITER_PI = 1 // রেফার করা বন্ধুর প্রথম টপ-আপে আমন্ত্রণকারী পাবেন (π) — বোনাস Pi (তোলা যাবে না)
export const INVITE_BASE_URL = 'https://picallbd.web.app/'
// অ্যাপের একমাত্র অ্যাডমিন/মালিক — শুধু এই ইমেইলের ব্যবহারকারীই অ্যাডমিন প্যানেল দেখতে পান
export const ADMIN_EMAIL = 'avijitdey259@gmail.com'
// টপ-আপ অটো Pi রূপান্তর — টাকা হলে ÷ Pi দর, USDT হলে × USDT দর ÷ Pi দর (অ্যাডমিন-নির্ধারিত দরে)
// অ্যাডমিন সেটিংস — আসল তথ্য (SMS গেটওয়ে, ইমেইল SMTP, পেমেন্টের নম্বর/ঠিকানা) অ্যাডমিন
// প্যানেল থেকেই বসানো যায়; কোথাও hard-code করা নেই। গোপন মান (API key, App Password)
// কখনো পুরো দেখানো হয় না, খতিয়ানে/শেয়ারে লেখা হয় না।
export type SmsSettings = { provider: string; apiKey: string; senderId: string }
export type SmtpSettings = { host: string; port: number; user: string; pass: string; from: string }
export type PaymentSettings = { bkash: string; nagad: string; rocket: string; usdtBep20: string; usdtErc20: string; binancePayId: string; piDepositAddress: string; piTestnetAddress: string; enabled: PaymentEnabledMap }
// Analytics ID — Meta Pixel / GA4 / Clarity (সবার দেখা যায় এমন পরিচয়, গোপন নয়);
// খালি থাকলে ট্র্যাকার বন্ধ। অ্যাডমিন সেটিংস থেকে config/public-এ যায়।
export type AdminSettings = { sms: SmsSettings; smtp: SmtpSettings; payments: PaymentSettings; analytics: AnalyticsIds; ads: AdRateSettings }
export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  sms: { provider: 'Nishchit', apiKey: '', senderId: '' },
  smtp: { host: 'smtp.gmail.com', port: 587, user: '', pass: '', from: '' },
  payments: { bkash: '', nagad: '', rocket: '', usdtBep20: '', usdtErc20: '', binancePayId: '', piDepositAddress: '', piTestnetAddress: '', enabled: { ...DEFAULT_PAYMENT_ENABLED } },
  analytics: { ...EMPTY_ANALYTICS_IDS },
  ads: { ...DEFAULT_AD_RATES },
}

export function topUpPi(amount: number, currency: 'BDT' | 'USDT', piRateBDT: number, usdtRateBDT: number): number {
  const m = Number(amount)
  if (!Number.isFinite(m) || m <= 0) return 0
  return roundPi(currency === 'USDT' ? (m * usdtRateBDT) / piRateBDT : m / piRateBDT)
}

function todayStr(): string { return new Date().toLocaleDateString('en-CA') }
function yesterdayStr(): string { return new Date(Date.now() - 86400000).toLocaleDateString('en-CA') }
function randomCode(): string { return 'cg-' + Math.random().toString(36).slice(2, 8) }

type Store = {
  user: { name: string; email: string } | null
  // Firebase Auth-এর UID (users/{uid} ডকের চাবি); OTP লগইনে null (Firebase সেশন নেই)
  uid: string | null
  // লগইন করা ব্যবহারকারী অ্যাডমিন কি না (ইমেইল অ্যাডমিনের ইমেইলের সঙ্গে মিললে তবেই true)
  isAdmin: boolean
  // অ্যাডমিন-নিয়ন্ত্রিত ব্যান — config/public-এর bannedUids তালিকা (UID)।
  // ব্যান হওয়া ব্যবহারকারী লগইনে ব্যান-স্ক্রিন দেখেন; কল/চ্যাট বন্ধ থাকে।
  // OTP লগইনে Firebase সেশন নেই (uid null) — সেখানে ব্যান লাগে না।
  bannedUids: string[]
  isBanned: boolean
  setBannedUids: (list: string[]) => Promise<boolean>
  login: (name: string, email: string) => void
  logout: () => void
  freeFirstMinuteUsed: boolean
  markFreeMinuteUsed: () => void
  calls: CallRecord[]
  addCall: (c: Omit<CallRecord, 'id' | 'time'>) => void
  friends: Friend[]
  requests: Friend[]
  addFriend: (f: Friend) => void
  acceptRequest: (id: string) => Promise<boolean>
  declineRequest: (id: string) => Promise<boolean>
  // পাঠানো (pending) রিকোয়েস্ট — "Request Sent" অবস্থা দেখাতে।
  sentRequests: { toUid: string; requestId: string }[]
  // আসল ব্যবহারকারীকে বন্ধু রিকোয়েস্ট পাঠানো (Facebook-এর মতো) — পারসোনা/
  // লোকাল id হলে আগের মতো সাথে সাথে লোকাল বন্ধু হয়ে যায়; OTP লগইনে
  // (Firebase সেশন নেই) লোকাল যোগই একমাত্র উপায়। false = পাঠানো যায়নি
  // (নিজেকে, ইতিমধ্যে বন্ধু, pending রিকোয়েস্ট আছে, ব্লক করা, বা সার্ভার ব্যর্থ)।
  sendFriendRequest: (f: Friend) => Promise<boolean>
  cancelFriendRequest: (toUid: string) => Promise<boolean>
  removeFriend: (id: string) => void
  // ফিডের খোঁজা + পোস্ট — হেডার সার্চ (সব পেজে) আর ফিড একই অবস্থা দেখে; সেশন-মাত্র
  feedQuery: string
  setFeedQuery: (q: string) => void
  posts: Post[]
  setPosts: React.Dispatch<React.SetStateAction<Post[]>>
  // এই সেশনে তৈরি পোস্টের id — ফিডে fresh (উপরে) বনাম cached (নিচে)
  // সাজাতে লাগে (src/feedCache.ts)। সেশন-মাত্র, সংরক্ষণ করা হয় না:
  // রিলোডের পর গত সেশনের পোস্ট ক্যাশ করা পোস্ট হিসেবেই নিচে যাবে।
  freshPostIds: string[]
  addPost: (p: Post) => void
  // লাইক করা পোস্টের id — রিলোডেও লাইক থাকে (localStorage); সংখ্যা পোস্টেই থাকে
  likedPostIds: string[]
  togglePostLike: (id: string) => void
  addPostComment: (postId: string, text: string) => void
  deletePost: (id: string) => void
  updatePost: (id: string, patch: Partial<Pick<Post, 'text' | 'location' | 'audience' | 'imageUrl' | 'videoUrl'>>) => void
  likesUsed: number
  useLike: () => boolean
  premium: boolean
  setPremium: (v: boolean) => void
  piBalance: number
  // বোনাস Pi — শুধু রেফারেল থেকে আসে; তোলা যায় না, শুধু কল/লাইভ গিফটে খরচ করা যায়
  bonusPi: number
  // গিফট Pi — অ্যাপ ইন্সটলের ৫ π বোনাস; শুধু গিফট কেনা যাবে, কল/লাইভ দেখা/তোলায় নয়
  giftPi: number
  // ইন্সটল বোনাস নেওয়া হয়েছে কি না (প্রতি ডিভাইসে একবার)
  installBonusClaimed: boolean
  claimInstallBonus: () => boolean
  // গিফটের খরচ — গিফট Pi আগে, তারপর বোনাস Pi, তারপর তোলা যায় এমন Pi; মোটের চেয়ে বেশি হলে false
  spendGiftPi: (n: number, type?: string, label?: string) => boolean
  // মোট Pi — তোলা যায় এমন + বোনাস + গিফট (ব্যবহারকারীকে এটাই দেখানো হয় — একটাই সংখ্যা)
  totalPi: number
  // Pi খরচ — বোনাস Pi আগে, তারপর তোলা যায় এমন Pi; মোটের চেয়ে বেশি হলে false
  spendPi: (n: number, type?: string, label?: string) => boolean
  // type/label দিলে খতিয়ানে (π Pi রিপোর্টে) লাইন যোগ হয়; না দিলে শুধু ব্যালেন্স বদলায়
  addPi: (n: number, type?: string, label?: string) => void
  points: number
  addPoints: (n: number) => void
  referrals: number
  dark: boolean
  toggleDark: () => void
  // সাউন্ড সেটিংস — চ্যাট সাউন্ড + কল রিংটোন (চালু/বন্ধ, রিংটোন ভলিউম);
  // মোবাইল আর কম্পিউটারে একই জায়গায় (মেনু + চ্যাট টগল), একই আচরণ
  soundSettings: SoundSettings
  setSoundSettings: (s: Partial<SoundSettings>) => void
  // কে কল দিতে পারবে — কলকারীর ইনভাইটে ওভারলে উঠবে কি না এটাই ঠিক করে;
  // ডিফল্ট 'friends' (শুধু বন্ধুরা)। localStorage-এ থাকে (সাউন্ড সেটিংসের মতোই)।
  callPrivacy: CallPrivacy
  setCallPrivacy: (v: CallPrivacy) => void
  expertRate: (id: string) => number
  datingRate: number
  setDatingRate: (v: number) => void
  liveRate: number
  setLiveRate: (v: number) => void
  liveEarnings: number
  addLiveEarnings: (n: number) => void
  kycStatus: KycStatus
  kycVerified: boolean
  kycInfo: KycInfo | null
  kycRejectReason: string
  submitKyc: (info: Omit<KycInfo, 'submittedAt' | 'verifiedAt'>) => void
  approveKyc: () => void
  rejectKyc: (reason: string) => void
  resetKyc: () => void
  // ভাইরাল গ্রোথ — রেফারেল/ইনভাইট, ডেইলি বোনাস, শেয়ার, লাইভ লিডারবোর্ড (ডেমো: এই ডিভাইসে ট্র্যাক করা হয়)
  referralCode: string
  // সংখ্যার UID (যেমন 100001) — লগইনে বরাদ্দ/ব্যাকফিল হয়; না থাকলে null
  numericUid: number | null
  referrer: string | null
  refNotice: string | null
  dismissRefNotice: () => void
  claimRefArrival: (code: string) => void
  refWelcomeClaimed: boolean
  referralRewarded: boolean
  referralPiEarned: number
  lastClaimDate: string | null
  streak: number
  dailyClaimedToday: boolean
  claimDailyBonus: () => { day: number; pi: number } | null
  // ৩০ দিনের গিফট বক্স — টানা ৩০ দিনের চক্র; একদিন মিস করলে স্ট্রিকের সঙ্গে এটাও আবার ১ম দিন থেকে
  giftBoxCycle: number
  giftBoxDays: number
  giftBoxClaimed: boolean
  canClaimGiftBox: boolean
  claimGiftBox: () => { pi: number; jackpot: boolean } | null
  totalShares: number
  reelShares: Record<string, number>
  recordShare: (id?: string) => void
  giftsSentPi: number
  addGiftsSent: (n: number) => void
  piWalletAddress: string | null
  piDeposits: PiTx[]
  piWithdrawals: PiTx[]
  // Pi জমা/তোলা — অফিসিয়াল Pi SDK না আসা পর্যন্ত স্থানীয় হিসাব (আসল ব্লকচেইন
  // লেনদেন নয়); chain সবসময় 'Pi Mainnet' (আসল Pi) — Testnet নেই।
  depositPi: (amount: number, ref: string, chain?: string) => void
  withdrawPi: (amount: number, address: string, chain?: string) => boolean
  // প্রোফাইল সেটিংস — নাম, জন্মতারিখ, লিঙ্গ, জেলা, থানা, ঠিকানা (+ লুকানো),
  // প্রোফাইল ছবি, গ্যালারি ছবি (সর্বোচ্চ ৮), ইন্টারেস্ট; profileCompletion ০–১০০।
  profileDob: string
  gender: Gender
  district: string
  thana: string
  address: string
  hideAddress: boolean
  profilePhoto: string
  galleryPhotos: string[]
  interests: string[]
  updateProfile: (p: Partial<ProfileFields>) => void
  profileCompletion: number
  // পুনরুদ্ধার + দুই ধাপের যাচাই — ইমেইল + মোবাইল দুটোই (ঐচ্ছিক, সম্পাদনাযোগ্য);
  // শুধু users/{uid} ব্যক্তিগত ডকে থাকে, publicProfiles-এ কখনো নয়।
  // মোবাইল নম্বর অন্য ব্যবহারকারীর কাছে দেখানো হয় না।
  recoveryEmail: string
  recoveryPhone: string
  recoveryEmailVerified: boolean
  recoveryPhoneVerified: boolean
  twoFactorEnabled: boolean
  updateSecurity: (p: Partial<SecuritySettings>) => void
  // প্রগ্রেসিভ KYC — ডেটিং প্রথমে খোলা; ৫ জন আলাদা মানুষের সাথে চ্যাট করলে
  // KYC বাধ্যতামূলক হয় (নতুন ম্যাচ/চ্যাট/কল বন্ধ, অনুমোদন পেলে আবার খুলবে)।
  // বোনাস দাবি + Pi তোলা সবসময় অনুমোদিত KYC চায় (ডেইলি + ইন্সটল বোনাস বাদ)।
  datingChatPartnerIds: string[]
  recordDatingChat: (partnerId: string) => void
  datingKycRequired: boolean
  // ব্লক — যেকোনো ব্যবহারকারী যেকোনো ব্যবহারকারীকে মেসেজ + কল থেকে ব্লক করতে
  // পারেন; ব্লক করা জনের মেসেজ/কল আর পৌঁছায় না; আনব্লকও করা যায়। UID-ই
  // সত্য (users/{uid} ডকে সিঙ্ক হয়); নাম শুধু এই ডিভাইসে দেখানোর সাহায্য।
  blockedUids: string[]
  blockedNames: Record<string, string>
  blockUser: (targetUid: string, targetName?: string) => void
  unblockUser: (targetUid: string) => void
  claimReferralBonus: () => boolean
  // π Pi রিপোর্ট — সব Pi লেনদেনের খতিয়ান (নতুনতম আগে), ওয়ালেটে দেখায়
  piLedger: PiLedgerRow[]
  piRateBDT: number
  setPiRateBDT: (v: number) => void
  usdtRateBDT: number
  setUsdtRateBDT: (v: number) => void
  piWithdrawFeePct: number
  setPiWithdrawFeePct: (v: number) => void
  piMinWithdraw: number
  // Pi ট্রান্সফার — ব্যবহারকারী থেকে ব্যবহারকারী (UID দিয়ে); ফি% আর সর্বনিম্ন
  // ট্রান্সফার অ্যাডমিন-নিয়ন্ত্রিত (config/public-এ সিঙ্ক হয়)
  piTransferFeePct: number
  setPiTransferFeePct: (v: number) => void
  piMinTransfer: number
  setPiMinTransfer: (v: number) => void
  // UID দিয়ে প্রাপক খোঁজা + Pi পাঠানো (ট্রানজ্যাকশনে; ব্যর্থ হলে কিছুই যায় না)
  lookupUserByUid: (numericUid: number) => Promise<{ uid: string; displayName: string; colour: string; photo?: string; numericUid: number } | null>
  sendPi: (to: { uid: string; name: string; numericUid?: number }, amount: number, opts?: { markRequestPaidId?: string }) => Promise<{ ok: true } | { ok: false; error: string }>
  // অ্যাডমিনের ম্যানুয়াল পাঠানো — ফি নেই, প্রাপক পুরোটাই পায়; অ্যাডমিনের
  // নিজের ব্যালেন্স থেকে যায় (কোনো Pi বানানো হয় না); শুধু অ্যাডমিন পারেন
  sendPiAsAdmin: (to: { uid: string; name: string; numericUid?: number }, amount: number, note?: string) => Promise<{ ok: true } | { ok: false; error: string }>
  // পেমেন্ট রিকোয়েস্ট — "আমাকে Pi দাও" অনুরোধ; Pay করলে item 6-এর
  // ট্রান্সফারই চলে (ট্রানজ্যাকশনে স্ট্যাটাস 'paid' হয় — দুবার Pay নয়)
  paymentRequests: PaymentRequestDoc[]
  requestPayment: (to: { uid: string; name: string; numericUid?: number }, amount: number, note?: string) => Promise<{ ok: true } | { ok: false; error: string }>
  payPaymentRequest: (req: PaymentRequestDoc) => Promise<{ ok: true } | { ok: false; error: string }>
  declinePaymentRequest: (req: PaymentRequestDoc) => Promise<boolean>
  cancelPaymentRequest: (req: PaymentRequestDoc) => Promise<boolean>
  // Live TV — ONE IPTV playlist URL (M3U) from config/public; empty = default playlist.
  tvPlaylistUrl: string
  setTvPlaylistUrl: (u: string) => void
  pendingTopUps: TopUpRequest[]
  submitManualTopUp: (method: string, amount: number, trxId: string, currency?: 'BDT' | 'USDT', network?: string) => string | null
  approveTopUp: (id: string) => void
  rejectTopUp: (id: string) => void
  // অ্যাডমিন সেটিংস (SMS গেটওয়ে, SMTP, পেমেন্টের আসল নম্বর/ঠিকানা) — localStorage-এ থাকে,
  // শুধু অ্যাডমিনই দেখেন/বদলান (রুট গেট করা আছে)
  adminSettings: AdminSettings
  setAdminSettings: (s: AdminSettings) => void
}

const Ctx = createContext<Store | null>(null)

function load<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem('callguru:' + key); return raw ? JSON.parse(raw) as T : fallback } catch { return fallback }
}
function save(key: string, value: unknown) { try { localStorage.setItem('callguru:' + key, JSON.stringify(value)) } catch { /* ignore */ } }

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ name: string; email: string } | null>(() => load('user', null))
  // Firestore সিঙ্কের UID — Firebase Auth-এর UID (users/{uid} ডকের চাবি)।
  // OTP লগইনে Firebase সেশন থাকে না বলে uid null থাকে — তখন অ্যাপ localStorage-এই চলে।
  const [uid, setUid] = useState<string | null>(() => load('uid', null))
  // Firebase সেশন ফিরেছে কি না (রিলোডের পর async) — সেশন না ফেরা পর্যন্ত Firestore ছোঁয়া হয় না।
  const [authReady, setAuthReady] = useState<boolean>(false)
  // Firestore সিঙ্কের অবস্থা — off (localStorage মোড) / syncing / on / error (localStorage মোড)।
  // error হলেও অ্যাপ থামে না — localStorage ক্যাশেই সব চলে।
  const [fsState, setFsState] = useState<'off' | 'syncing' | 'on' | 'error'>('off')
  const [freeFirstMinuteUsed, setFreeUsed] = useState<boolean>(() => load('freeUsed', false))
  const [calls, setCalls] = useState<CallRecord[]>(() => load('calls', []))
  // ফিডের খোঁজা + পোস্ট — হেডার সার্চ আর ফিড একই অবস্থা দেখে (পোস্ট আগে ফিডের
  // লোকাল state-এ ছিল, নেভিগেট করলেই হারাত; এখন সেশনে থাকে, Firestore-এ যায় না)
  const [feedQuery, setFeedQuery] = useState('')
  const [posts, setPosts] = useState<Post[]>(() => {
    const base = load<Post[]>('posts', SEED_POSTS)
    // পারসোনা পোস্ট (রিমা/শাকিল/ফাহিম/মিম/আশা + নতুন ৬ বন্ধু) — ফিড যাতে খালি
    // না লাগে: পুরোনো ডিভাইসেও একবার মিশে যায়; ডুপ্লিকেট হয় না, আর ফিরে আসে না।
    if (!load('personaPostsSeeded', false)) {
      const have = new Set(base.map(p => p.id))
      const missing = SEED_POSTS.filter(p => !have.has(p.id))
      if (missing.length > 0) return [...missing, ...base]
    }
    return base
  })
  useEffect(() => save('personaPostsSeeded', true), [])
  const [freshPostIds, setFreshPostIds] = useState<string[]>([])
  // লাইক করা পোস্টের id — রিলোডেও লাইক থাকে; সংখ্যা পোস্টেই থাকে
  const [likedPostIds, setLikedPostIds] = useState<string[]>(() => load('likedPostIds', []))
  useEffect(() => save('likedPostIds', likedPostIds), [likedPostIds])
  // চ্যাট বন্ধুরা (রিমা, শাকিল, ফাহিম, মিম, আশা) বন্ধু তালিকায় থাকে — আগের
  // সংরক্ষিত তালিকায় না থাকলে একবার যোগ হয়; আনফ্রেন্ড করা হলে আর ফিরে আসে না
  const [friends, setFriends] = useState<Friend[]>(() => {
    const stored = load<Friend[] | null>('friends', null)
    // সরানো ডেমো বন্ধু (রাফি/সাবরিনা) পুরোনো localStorage-এ থাকলেও আর দেখাবে না
    const base = (stored ?? []).filter(f => !REMOVED_DEMO_FRIEND_IDS.includes(f.id))
    const removed = load<string[]>('buddiesRemoved', [])
    const merged = [...base]
    for (const b of BUDDIES) {
      if (!removed.includes(b.id) && !merged.some(f => f.id === b.id)) {
        merged.push({ id: b.id, name: b.name, color: b.color, online: b.online })
      }
    }
    return merged
  })
  const [requests, setRequests] = useState<Friend[]>(() =>
    // সরানো ডেমো রিকোয়েস্ট (হাসান/প্রিয়া) পুরোনো localStorage-এ থাকলেও আর দেখাবে না
    load<Friend[]>('requests', []).filter(f => !REMOVED_DEMO_REQUEST_IDS.includes(f.id))
  )
  // পাঠানো (pending) বন্ধু রিকোয়েস্ট — "Request Sent" অবস্থা দেখাতে;
  // সাবস্ক্রিপশন থেকেই আসে (নিচের friendRequests সাবস্ক্রিপশন দেখুন)।
  const [sentRequests, setSentRequests] = useState<{ toUid: string; requestId: string }[]>([])
  const [likesUsed, setLikesUsed] = useState<number>(() => load('likesUsed', 0))
  const [premium, setPremium] = useState<boolean>(() => load('premium', false))
  // অ্যাপের একমাত্র মুদ্রা Pi — আগের 'coins' ব্যালেন্স ১:১-এ Pi হয়ে গেছে
  const [piBalance, setPiBalance] = useState<number>(() => {
    const v = load<number | null>('piBalance', null)
    if (v !== null && Number.isFinite(v)) return v
    return load('coins', 20)
  })
  const [points, setPoints] = useState<number>(() => load('points', 0))
  // বোনাস Pi — রেফারেল বোনাস এখানে জমা হয়; তোলা যায় না, খরচে আগে ব্যবহার হয়
  const [bonusPi, setBonusPi] = useState<number>(() => load('bonusPi', 0))
  // গিফট Pi — অ্যাপ ইন্সটলের ৫ π বোনাস; শুধু গিফট কেনা যাবে, কল/লাইভ দেখা/তোলায় নয়
  const [giftPi, setGiftPi] = useState<number>(() => load('giftPi', 0))
  // ইন্সটল বোনাস নেওয়া হয়েছে কি না — প্রতি ডিভাইসে একবার (localStorage ফ্ল্যাগ)
  const [installBonusClaimed, setInstallBonusClaimed] = useState<boolean>(() => load('installBonusClaimed', false))
  const [referrals, setReferrals] = useState<number>(() => load('referrals', 0))
  const [dark, setDark] = useState<boolean>(() => load('dark', false))
  // সাউন্ড সেটিংস — localStorage-এ থাকে (প্রতি ডিভাইসে নিজের সেটিংস, বাকি
  // সব সেটিংসের মতোই); মোবাইল/কম্পিউটার দুটোতেই একই ডিফল্ট ও আচরণ
  const [soundSettings, setSoundSettingsState] = useState<SoundSettings>(() => loadSoundSettings(load<unknown>('soundSettings', null)))
  useEffect(() => save('soundSettings', soundSettings), [soundSettings])
  // কে কল দিতে পারবে — 'everyone' | 'friends' | 'nobody'; ডিফল্ট 'friends'
  const [callPrivacy, setCallPrivacyState] = useState<CallPrivacy>(() => loadCallPrivacy(load<unknown>('callPrivacy', null)))
  useEffect(() => save('callPrivacy', callPrivacy), [callPrivacy])
  // ডেটিং কল রেট এখন Pi-তে (ডিফল্ট π ০.১/মিনিট) — আগের টাকার রেট (≥১) থাকলে ÷১০০ করে Pi করা হয়
  const [datingRate, setDatingRateState] = useState<number>(() => {
    const v = load<number | null>('datingRate', null)
    if (v === null || !Number.isFinite(v)) return 0.1
    return v >= 1 ? roundPi(v / 100) : v
  })
  // ডেটিং লাইভ দেখার রেট — কলের রেট থেকে আলাদা, লাইভে টাকা কম কাটবে (ডিফল্ট ৳৫/মিনিট)
  // ডেটিং লাইভ রেট এখন Pi-তে (ডিফল্ট π ০.০৫/মিনিট) — আগের টাকার রেট (≥১) থাকলে ÷১০০ করে Pi করা হয়
  const [liveRate, setLiveRateState] = useState<number>(() => {
    const v = load<number | null>('liveRate', null)
    if (v === null || !Number.isFinite(v)) return 0.05
    return v >= 1 ? roundPi(v / 100) : v
  })
  // হোস্টের মোট লাইভ আয় (নিজের লাইভ থেকে ৭০% শেয়ার জমা হয়) — স্থায়ীভাবে সংরক্ষিত
  // লাইভ আয় এখন Pi-তে — আগের টাকার আয় (≥১) থাকলে ÷১০০ করে Pi করা হয়
  const [liveEarnings, setLiveEarnings] = useState<number>(() => {
    const v = load('liveEarnings', 0)
    return v >= 1 ? roundPi(v / 100) : v
  })
  // ডেটিং KYC — জমা → অ্যাডমিন পর্যালোচনা → অনুমোদন হলেই ডেটিং খুলবে; অনুমোদিত হলে আর কখনো চাওয়া হয় না
  const [kycStatus, setKycStatus] = useState<KycStatus>(() => {
    const s = load<KycStatus | null>('kycStatus', null)
    if (s) return s
    // পুরোনো ডেমোতে যারা আগে (অটো) যাচাই হয়েছিল, তারা অনুমোদিতই থাকবে — আবার KYC লাগবে না
    return load('kycVerified', false) ? 'approved' : 'none'
  })
  const [kycInfo, setKycInfo] = useState<KycInfo | null>(() => {
    const info = load<KycInfo | null>('kycInfo', null)
    if (info && !info.submittedAt) return { ...info, submittedAt: info.verifiedAt ?? new Date().toISOString() }
    return info
  })
  const [kycRejectReason, setKycRejectReason] = useState<string>(() => load('kycRejectReason', ''))
  // ভাইরাল গ্রোথ — রেফারেল কোড একবার তৈরি হয়ে স্থায়ী থাকে; ?ref= লিংকে এলে ওয়েলকাম বোনাস একবারই মেলে
  const [referralCode, setReferralCodeState] = useState<string>(() => load('referralCode', randomCode()))
  // সংখ্যার UID — লগইনে বরাদ্দ/ব্যাকফিল হয় (ensureNumericUid); একবার বসলে আর বদলায় না
  const [numericUid, setNumericUidState] = useState<number | null>(() => load('numericUid', null))
  const [referrer, setReferrer] = useState<string | null>(() => load('referrer', null))
  const [refWelcomeClaimed, setRefWelcomeClaimed] = useState<boolean>(() => load('refWelcomeClaimed', false))
  const [refNotice, setRefNotice] = useState<string | null>(() => load('refNotice', null))
  const [referralRewarded, setReferralRewarded] = useState<boolean>(() => load('referralRewarded', false))
  const [referralPiEarned, setReferralPiEarned] = useState<number>(() => load('referralPiEarned', load('referralCoinsEarned', 0)))
  const [hasToppedUp, setHasToppedUp] = useState<boolean>(() => load('hasToppedUp', false))
  // ডেইলি বোনাস — শেষ দাবির তারিখ ও টানা দিনের সংখ্যা; একদিন মিস করলে স্ট্রিক আবার ১ম দিন থেকে
  const [lastClaimDate, setLastClaimDate] = useState<string | null>(() => load('lastClaimDate', null))
  const [streak, setStreak] = useState<number>(() => load('streak', 0))
  // ৩০ দিনের গিফট বক্স — কোন ৩০ দিনের চক্রের বক্স নেওয়া হয়েছে (null = এই চক্রের বক্স এখনো নেওয়া হয়নি)
  const [giftBoxClaimedCycle, setGiftBoxClaimedCycle] = useState<number | null>(() => load('giftBoxClaimedCycle', null))
  // শেয়ার — মোট শেয়ার ও প্রতি রিলের শেয়ার সংখ্যা
  const [totalShares, setTotalShares] = useState<number>(() => load('totalShares', 0))
  const [reelShares, setReelShares] = useState<Record<string, number>>(() => load('reelShares', {}))
  // লিডারবোর্ডের জন্য এই ডিভাইসে পাঠানো মোট গিফট (কয়েনে)
  const [giftsSentPi, setGiftsSentPi] = useState<number>(() => load('giftsSentPi', load('giftsSentCoins', 0)))
  // π Pi ওয়ালেট — জমা/তোলার হিসাব (অফিসিয়াল Pi SDK না আসা পর্যন্ত স্থানীয় হিসাব)
  const [piWalletAddress, setPiWalletAddress] = useState<string | null>(() => load('piWalletAddress', null))
  // প্রোফাইল সেটিংস — অ্যাকাউন্ট করার পর ব্যবহারকারী নিজে সাজায়
  const [profileDob, setProfileDob] = useState<string>(() => load('profileDob', ''))
  const [gender, setGender] = useState<Gender>(() => load<Gender>('gender', ''))
  const [district, setDistrict] = useState<string>(() => load('district', ''))
  const [thana, setThana] = useState<string>(() => load('thana', ''))
  const [address, setAddress] = useState<string>(() => load('address', ''))
  const [hideAddress, setHideAddress] = useState<boolean>(() => load('hideAddress', false))
  const [profilePhoto, setProfilePhoto] = useState<string>(() => load('profilePhoto', ''))
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>(() => load('galleryPhotos', []))
  const [interests, setInterests] = useState<string[]>(() => load('interests', []))
  // পুনরুদ্ধার + দুই ধাপের যাচাই — ইমেইল + মোবাইল দুটোই (ঐচ্ছিক); যাচাইয়ের
  // অবস্থাসহ localStorage-এ থাকে, users/{uid} ব্যক্তিগত ডকেও সিঙ্ক হয়।
  const [recoveryEmail, setRecoveryEmail] = useState<string>(() => load('recoveryEmail', ''))
  const [recoveryPhone, setRecoveryPhone] = useState<string>(() => load('recoveryPhone', ''))
  const [recoveryEmailVerified, setRecoveryEmailVerified] = useState<boolean>(() => load('recoveryEmailVerified', false))
  const [recoveryPhoneVerified, setRecoveryPhoneVerified] = useState<boolean>(() => load('recoveryPhoneVerified', false))
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(() => load('twoFactorEnabled', false))
  // প্রগ্রেসিভ KYC — ডেটিংয়ে চ্যাট করা আলাদা মানুষের তালিকা (ID দিয়ে, নামে নয়);
  // ৫ জন হলেই KYC বাধ্যতামূলক হয়। users/{uid} ব্যক্তিগত ডকেও সিঙ্ক হয়।
  const [datingChatPartnerIds, setDatingChatPartnerIds] = useState<string[]>(() => load('datingChatPartnerIds', []))
  // ব্লক করা ব্যবহারকারী (UID) — localStorage ক্যাশ + users/{uid} ডকে সিঙ্ক;
  // নাম শুধু এই ডিভাইসে ব্লক তালিকায় দেখানোর সাহায্য (ব্লকের সত্য UID-ই)।
  const [blockedUids, setBlockedUids] = useState<string[]>(() => cleanUidList(load<string[]>('blockedUids', [])))
  // অ্যাডমিন-নিয়ন্ত্রিত ব্যান তালিকা — config/public-ই সত্য; localStorage শুধু
  // ক্যাশ, যাতে ব্যান হওয়া ব্যবহারকারী পরের লগইনেই ব্যান-স্ক্রিন দেখেন।
  const [bannedUids, setBannedUidsState] = useState<string[]>(() => cleanUidList(load<string[]>('bannedUids', [])))
  const [blockedNames, setBlockedNames] = useState<Record<string, string>>(() => load('blockedNames', {}))
  useEffect(() => save('blockedUids', blockedUids), [blockedUids])
  useEffect(() => save('bannedUids', bannedUids), [bannedUids])
  useEffect(() => save('blockedNames', blockedNames), [blockedNames])
  // পুরোনো সংরক্ষিত "Demo" লেখা থাকলে নিরবে নতুন লেখায় বদলে যায় (ইতিহাস থাকে, লেখা থাকে না)
  const sanitizePiTx = (list: PiTx[]): PiTx[] => list.map(t => ({
    ...t,
    status: t.status === '✅ Demo deposit complete' ? '✅ Deposit recorded'
      : t.status === '⏳ Processing (demo)' ? '⏳ Processing' : t.status,
  }))
  const sanitizeLedger = (rows: PiLedgerRow[]): PiLedgerRow[] => rows.map(r => (
    r.type === 'Demo Pi' || r.type === 'ডেমো Pi'
      ? { ...r, type: 'Bonus', label: r.label === 'Add demo Pi' ? 'Add Pi' : r.label }
      : r
  ))
  const [piDeposits, setPiDeposits] = useState<PiTx[]>(() => sanitizePiTx(load('piDeposits', [])))
  const [piWithdrawals, setPiWithdrawals] = useState<PiTx[]>(() => sanitizePiTx(load('piWithdrawals', [])))
  // π Pi রিপোর্টের খতিয়ান — প্রথমবার পুরোনো হিসাব (জমা/তোলা/কল/লাইভ আয়/গিফট/রেফারেল) থেকে বানানো হয়;
  // যা থেকে বানানো যায় না (যেমন আগের ডেইলি বোনাস) তা 'Adjustment' লাইনে ধরা হয়, যাতে যোগফল বর্তমান ব্যালেন্সের সঙ্গে মেলে।
  // কোনো পরিমাণ বানানো হয় না — খতিয়ানে শুধু সংরক্ষিত হিসাবেরই অঙ্ক থাকে।
  const [piLedger, setPiLedger] = useState<PiLedgerRow[]>(() => {
    const saved = load<PiLedgerRow[] | null>('piLedger', null)
    if (saved && saved.length > 0) return sanitizeLedger(saved)
    const rows: PiLedgerRow[] = []
    piDeposits.forEach(d => rows.push({ id: d.id, date: d.date, type: 'Deposit', label: `Pi deposit${d.ref ? ' — ' + d.ref : ''}`, amount: roundPi(d.amount) }))
    piWithdrawals.forEach(w => rows.push({ id: w.id, date: w.date, type: 'Withdraw', label: `Pi withdrawal — fee ${formatPi(w.fee ?? 0)}`, amount: -roundPi(w.amount) }))
    calls.filter(c => c.cost > 0).forEach(c => rows.push({ id: c.id, date: c.time, type: 'Call Cost', label: `Call — ${c.name} (${c.type === 'Expert' ? 'Expert' : c.type === 'Dating' ? 'Dating' : 'Friend'})`, amount: -roundPi(c.cost) }))
    if (liveEarnings > 0) rows.push({ id: 'le-mig', date: '—', type: 'Live Earnings', label: 'Live earnings (earlier total)', amount: roundPi(liveEarnings) })
    if (giftsSentPi > 0) rows.push({ id: 'gs-mig', date: '—', type: 'Gifts Sent', label: 'Live gifts (earlier total)', amount: -roundPi(giftsSentPi) })
    if (referralPiEarned > 0) rows.push({ id: 'ref-mig', date: '—', type: 'Referral', label: 'Referral earnings (earlier total)', amount: roundPi(referralPiEarned) })
    const residual = roundPi(piBalance - rows.reduce((s, r) => s + r.amount, 0))
    if (residual !== 0) rows.push({ id: 'open-mig', date: '—', type: 'Adjustment', label: 'Adjustment for earlier transactions', amount: residual })
    return rows
  })
  // π Pi দর — অ্যাডমিন নির্ধারিত (ডিফল্ট ১ π = ৳১০০, ১ USDT = ৳১২০); তোলার সর্বনিম্ন এই দর থেকেই হিসাব হয়
  const [piRateBDT, setPiRateBDTState] = useState<number>(() => load('piRateBDT', DEFAULT_PI_RATE_BDT))
  const [usdtRateBDT, setUsdtRateBDTState] = useState<number>(() => load('usdtRateBDT', DEFAULT_USDT_RATE_BDT))
  // Pi তোলার ফি — অ্যাডমিন নির্ধারিত (ডিফল্ট ১%, সর্বনিম্ন ০.১ π)
  const [piWithdrawFeePct, setPiWithdrawFeePctState] = useState<number>(() => load('piWithdrawFeePct', DEFAULT_PI_WITHDRAW_FEE_PCT))
  // Pi ট্রান্সফারের ফি% (ডিফল্ট ২%) + সর্বনিম্ন ট্রান্সফার (ডিফল্ট ০.১ π) — অ্যাডমিন সেট করেন, config/public-এ সিঙ্ক হয়
  const [piTransferFeePct, setPiTransferFeePctState] = useState<number>(() => load('piTransferFeePct', DEFAULT_TRANSFER_FEE_PCT))
  // পেমেন্ট রিকোয়েস্ট — আমার পাঠানো + আমার কাছে আসা অনুরোধের তালিকা
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequestDoc[]>([])
  const [piMinTransfer, setPiMinTransferState] = useState<number>(() => load('piMinTransfer', DEFAULT_MIN_TRANSFER_PI))
  // Live TV প্লেলিস্টের লিঙ্ক — অ্যাডমিন নির্ধারিত (ডিফল্ট: Eamin Tv M3U); খালি মানে ডিফল্ট
  const [tvPlaylistUrl, setTvPlaylistUrlState] = useState<string>(() => load('tvPlaylistUrl', DEFAULT_TV_PLAYLIST_URL))

  useEffect(() => save('user', user), [user])
  useEffect(() => save('uid', uid), [uid])
  useEffect(() => save('freeUsed', freeFirstMinuteUsed), [freeFirstMinuteUsed])
  useEffect(() => save('calls', calls), [calls])
  useEffect(() => save('friends', friends), [friends])
  useEffect(() => save('requests', requests), [requests])
  useEffect(() => save('likesUsed', likesUsed), [likesUsed])
  useEffect(() => save('premium', premium), [premium])
  useEffect(() => save('piBalance', piBalance), [piBalance])
  useEffect(() => save('bonusPi', bonusPi), [bonusPi])
  useEffect(() => save('giftPi', giftPi), [giftPi])
  useEffect(() => save('installBonusClaimed', installBonusClaimed), [installBonusClaimed])
  useEffect(() => save('points', points), [points])
  useEffect(() => save('referrals', referrals), [referrals])
  useEffect(() => { save('dark', dark); document.documentElement.classList.toggle('dark', dark) }, [dark])
  useEffect(() => save('datingRate', datingRate), [datingRate])
  useEffect(() => save('liveRate', liveRate), [liveRate])
  useEffect(() => save('liveEarnings', liveEarnings), [liveEarnings])
  useEffect(() => save('kycStatus', kycStatus), [kycStatus])
  useEffect(() => save('kycInfo', kycInfo), [kycInfo])
  useEffect(() => save('kycRejectReason', kycRejectReason), [kycRejectReason])
  useEffect(() => save('referralCode', referralCode), [referralCode])
  useEffect(() => save('numericUid', numericUid), [numericUid])
  useEffect(() => save('referrer', referrer), [referrer])
  useEffect(() => save('refWelcomeClaimed', refWelcomeClaimed), [refWelcomeClaimed])
  useEffect(() => save('refNotice', refNotice), [refNotice])
  useEffect(() => save('referralRewarded', referralRewarded), [referralRewarded])
  useEffect(() => save('referralPiEarned', referralPiEarned), [referralPiEarned])
  useEffect(() => save('hasToppedUp', hasToppedUp), [hasToppedUp])
  useEffect(() => save('lastClaimDate', lastClaimDate), [lastClaimDate])
  useEffect(() => save('streak', streak), [streak])
  useEffect(() => save('giftBoxClaimedCycle', giftBoxClaimedCycle), [giftBoxClaimedCycle])
  useEffect(() => save('totalShares', totalShares), [totalShares])
  useEffect(() => save('reelShares', reelShares), [reelShares])
  useEffect(() => save('giftsSentPi', giftsSentPi), [giftsSentPi])
  useEffect(() => save('piWalletAddress', piWalletAddress), [piWalletAddress])
  useEffect(() => save('posts', posts.slice(0, 20)), [posts])
  useEffect(() => save('profileDob', profileDob), [profileDob])
  useEffect(() => save('gender', gender), [gender])
  useEffect(() => save('district', district), [district])
  useEffect(() => save('thana', thana), [thana])
  useEffect(() => save('address', address), [address])
  useEffect(() => save('hideAddress', hideAddress), [hideAddress])
  useEffect(() => save('profilePhoto', profilePhoto), [profilePhoto])
  useEffect(() => save('galleryPhotos', galleryPhotos), [galleryPhotos])
  useEffect(() => save('interests', interests), [interests])
  useEffect(() => save('recoveryEmail', recoveryEmail), [recoveryEmail])
  useEffect(() => save('recoveryPhone', recoveryPhone), [recoveryPhone])
  useEffect(() => save('recoveryEmailVerified', recoveryEmailVerified), [recoveryEmailVerified])
  useEffect(() => save('recoveryPhoneVerified', recoveryPhoneVerified), [recoveryPhoneVerified])
  useEffect(() => save('twoFactorEnabled', twoFactorEnabled), [twoFactorEnabled])
  useEffect(() => save('datingChatPartnerIds', datingChatPartnerIds), [datingChatPartnerIds])
  useEffect(() => save('piDeposits', piDeposits), [piDeposits])
  useEffect(() => save('piWithdrawals', piWithdrawals), [piWithdrawals])
  useEffect(() => save('piLedger', piLedger), [piLedger])
  useEffect(() => save('piRateBDT', piRateBDT), [piRateBDT])
  useEffect(() => save('usdtRateBDT', usdtRateBDT), [usdtRateBDT])
  useEffect(() => save('piWithdrawFeePct', piWithdrawFeePct), [piWithdrawFeePct])
  useEffect(() => save('piTransferFeePct', piTransferFeePct), [piTransferFeePct])
  useEffect(() => save('piMinTransfer', piMinTransfer), [piMinTransfer])
  useEffect(() => save('tvPlaylistUrl', tvPlaylistUrl), [tvPlaylistUrl])
  // ম্যানুয়াল টপ-আপের আবেদন — অ্যাডমিন অনুমোদন দিলে ব্যালেন্স যোগ হয়
  const [pendingTopUps, setPendingTopUps] = useState<TopUpRequest[]>(() => load('pendingTopUps', []))
  useEffect(() => save('pendingTopUps', pendingTopUps), [pendingTopUps])
  // অ্যাডমিন সেটিংস — পুরোনো সংরক্ষণে কোনো ঘর না থাকলে ডিফল্ট বসে
  const [adminSettings, setAdminSettingsState] = useState<AdminSettings>(() => {
    const v = load<AdminSettings | null>('adminSettings', null)
    if (!v) return DEFAULT_ADMIN_SETTINGS
    return {
      sms: { ...DEFAULT_ADMIN_SETTINGS.sms, ...(v.sms || {}) },
      smtp: { ...DEFAULT_ADMIN_SETTINGS.smtp, ...(v.smtp || {}) },
      payments: { ...DEFAULT_ADMIN_SETTINGS.payments, ...(v.payments || {}), enabled: normalizePaymentEnabled({ ...DEFAULT_ADMIN_SETTINGS.payments.enabled, ...((v.payments || {}).enabled || {}) }) },
      analytics: { ...DEFAULT_ADMIN_SETTINGS.analytics, ...(v.analytics || {}) },
      ads: { ...DEFAULT_ADMIN_SETTINGS.ads, ...(v.ads || {}) },
    }
  })
  useEffect(() => save('adminSettings', adminSettings), [adminSettings])

  // Analytics — ID এলেই (build env বা config/public থেকে) ট্র্যাকার চালু হয়;
  // ID না থাকলে কিছুই লোড হয় না। initAnalytics idempotent — বারবার ডাকা নিরাপদ।
  useEffect(() => {
    initAnalytics(resolveAnalyticsIds(envAnalyticsIds(), adminSettings.analytics))
  }, [adminSettings.analytics])

  // ================= Firestore সিঙ্ক (আসল ডেটা স্তর) =================
  // নিয়ম: Firestore চালু/পৌঁছানো গেলে users/{uid} ডকই আসল সত্য; localStorage তখন
  // অফলাইন ক্যাশ (প্রতি বদলে লেখা হয়)। Firestore না থাকলে (কনসোলে চালু হয়নি / নেট
  // নেই / OTP লগইন) অ্যাপ ঠিক আগের মতো localStorage-এই চলে — কিছুই ভাঙে না।
  const fsReadyRef = useRef(false) // এই uid-র প্রথম সিঙ্ক শেষ হয়েছে কি না
  const fsSyncUidRef = useRef<string | null>(null)
  const friendPhotoUidRef = useRef<string | null>(null)
  const fsWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userRef = useRef(user)

  // সাবস্ক্রিপশন কলব্যাকের জন্য ব্লক তালিকার সবশেষ কপি (ক্লোজার বাসি হলে ব্লক করা প্রেরকের রিকোয়েস্ট দেখা যেত)।
  const blockedUidsRef = useRef<string[]>([])
  useEffect(() => { blockedUidsRef.current = blockedUids }, [blockedUids])

  // গ্রহণ হওয়া রিকোয়েস্ট একবারই বন্ধু তালিকায় যোগ হয় — ডক id মনে রাখা হয়
  // (localStorage-এ থাকে, প্রতি ডিভাইসে আলাদা); নইলে আনফ্রেন্ডের পর আবার
  // অ্যাপ খুললেই পুরোনো গ্রহণ-ডক দেখে বন্ধু ফিরে আসত।
  const handledAcceptedRef = useRef<Set<string> | null>(null)
  const getHandledAccepted = (): Set<string> => {
    if (!handledAcceptedRef.current) handledAcceptedRef.current = new Set(load<string[]>('frAcceptedHandled', []))
    return handledAcceptedRef.current
  }
  const markAcceptedHandled = (id: string) => {
    const s = getHandledAccepted()
    if (!s.has(id)) { s.add(id); save('frAcceptedHandled', [...s]) }
  }
  // একই ব্যবহারকারীকে দ্রুত দুবার চাপলে দুটো রিকোয়েস্ট ডক না বসে — পাঠানো
  // চলছে এমন id মনে রাখা হয় (sendFriendRequest-এ ব্যবহার হয়)।
  const sendInFlightRef = useRef<Set<string>>(new Set())
  userRef.current = user

  // Firebase সেশন ফিরে এলে UID ধরা হয় (রিলোডের পর সেশন async ফেরে)।
  useEffect(() => {
    const unsub = onFirebaseAuthUser((fbUser) => {
      setAuthReady(true)
      if (fbUser && userRef.current) setUid((prev) => (prev === fbUser.uid ? prev : fbUser.uid))
    })
    return unsub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // স্টোরের বর্তমান অবস্থা → Firestore ডকে লেখার মতো স্ন্যাপশট (দরগুলো এখানে নেই — config/public-এ যায়)।
  const collectSnapshot = (): LocalUserState => ({
    name: user?.name ?? '',
    email: user?.email ?? '',
    freeFirstMinuteUsed, calls, friends, requests, likesUsed, premium,
    piBalance, bonusPi, points, referrals, liveEarnings,
    kycStatus, kycInfo, kycRejectReason,
    referralCode, referrer, refWelcomeClaimed, referralRewarded, referralPiEarned, hasToppedUp,
    numericUid,
    lastClaimDate, streak, giftBoxClaimedCycle,
    totalShares, reelShares, giftsSentPi,
    piWalletAddress, piDeposits, piWithdrawals, piLedger,
    profileDob, gender, district, thana, address, hideAddress, profilePhoto, galleryPhotos, interests,
    recoveryEmail, recoveryPhone, recoveryEmailVerified, recoveryPhoneVerified, twoFactorEnabled,
    datingChatPartnerIds,
    blockedUids,
  })

  // ক্লাউডের ডক → স্টোরে বসানো (যা ঘর ডকে নেই, সেটা বদলায় না)।
  const applyHydrated = (h: Partial<LocalUserState>) => {
    if (h.freeFirstMinuteUsed !== undefined) setFreeUsed(h.freeFirstMinuteUsed)
    if (h.calls !== undefined) setCalls(h.calls)
    if (h.friends !== undefined) setFriends(h.friends)
    // requests এখানে বসে না — আসা রিকোয়েস্ট friendRequests সাবস্ক্রিপশন
    // থেকেই আসে (নিচে); ডকের পুরোনো কপি বসালে বাতিল/গ্রহণ হওয়া রিকোয়েস্ট
    // আবার ফিরে আসত। ডকে requests লেখা হয় (collectSnapshot) — শুধু ক্যাশ হিসেবে।
    if (h.likesUsed !== undefined) setLikesUsed(h.likesUsed)
    if (h.premium !== undefined) setPremium(h.premium)
    if (h.piBalance !== undefined) setPiBalance(h.piBalance)
    if (h.bonusPi !== undefined) setBonusPi(h.bonusPi)
    if (h.points !== undefined) setPoints(h.points)
    if (h.referrals !== undefined) setReferrals(h.referrals)
    if (h.liveEarnings !== undefined) setLiveEarnings(h.liveEarnings)
    if (h.kycStatus !== undefined) setKycStatus(h.kycStatus)
    if (h.kycRejectReason !== undefined) setKycRejectReason(h.kycRejectReason)
    // KYC তথ্য: ক্লাউডে শুধু নিরাপদ অংশটুকু থাকে; এই ডিভাইসে পুরো তথ্য (NID/সেলফি)
    // থাকলে আর সেটা একই জমার (submittedAt মিলে) হলে স্থানীয়টাই থাকে — নইলে ক্লাউডেরটা বসে।
    if (h.kycInfo !== undefined) {
      setKycInfo((prev) => {
        if (h.kycInfo && prev && prev.submittedAt && h.kycInfo.submittedAt && prev.submittedAt === h.kycInfo.submittedAt) return prev
        return h.kycInfo as KycInfo | null
      })
    }
    if (h.referralCode !== undefined) setReferralCodeState(h.referralCode)
    if (h.numericUid !== undefined) setNumericUidState(h.numericUid)
    if (h.referrer !== undefined) setReferrer(h.referrer)
    if (h.refWelcomeClaimed !== undefined) setRefWelcomeClaimed(h.refWelcomeClaimed)
    if (h.referralRewarded !== undefined) setReferralRewarded(h.referralRewarded)
    if (h.referralPiEarned !== undefined) setReferralPiEarned(h.referralPiEarned)
    if (h.hasToppedUp !== undefined) setHasToppedUp(h.hasToppedUp)
    if (h.lastClaimDate !== undefined) setLastClaimDate(h.lastClaimDate)
    if (h.streak !== undefined) setStreak(h.streak)
    if (h.giftBoxClaimedCycle !== undefined) setGiftBoxClaimedCycle(h.giftBoxClaimedCycle)
    if (h.totalShares !== undefined) setTotalShares(h.totalShares)
    if (h.reelShares !== undefined) setReelShares(h.reelShares)
    if (h.giftsSentPi !== undefined) setGiftsSentPi(h.giftsSentPi)
    if (h.piWalletAddress !== undefined) setPiWalletAddress(h.piWalletAddress)
    if (h.piDeposits !== undefined) setPiDeposits(sanitizePiTx(h.piDeposits))
    if (h.piWithdrawals !== undefined) setPiWithdrawals(sanitizePiTx(h.piWithdrawals))
    if (h.piLedger !== undefined) setPiLedger(sanitizeLedger(h.piLedger))
    if (h.profileDob !== undefined) setProfileDob(h.profileDob)
    if (h.gender !== undefined) setGender(h.gender)
    if (h.district !== undefined) setDistrict(h.district)
    if (h.thana !== undefined) setThana(h.thana)
    if (h.address !== undefined) setAddress(h.address)
    if (h.hideAddress !== undefined) setHideAddress(h.hideAddress)
    if (h.profilePhoto !== undefined) setProfilePhoto(h.profilePhoto)
    if (h.galleryPhotos !== undefined) setGalleryPhotos(h.galleryPhotos)
    if (h.interests !== undefined) setInterests(h.interests)
    if (h.recoveryEmail !== undefined) setRecoveryEmail(h.recoveryEmail)
    if (h.recoveryPhone !== undefined) setRecoveryPhone(h.recoveryPhone)
    if (h.recoveryEmailVerified !== undefined) setRecoveryEmailVerified(h.recoveryEmailVerified)
    if (h.recoveryPhoneVerified !== undefined) setRecoveryPhoneVerified(h.recoveryPhoneVerified)
    if (h.twoFactorEnabled !== undefined) setTwoFactorEnabled(h.twoFactorEnabled)
    if (h.datingChatPartnerIds !== undefined) setDatingChatPartnerIds(h.datingChatPartnerIds)
    if (h.blockedUids !== undefined) setBlockedUids(cleanUidList(h.blockedUids))
  }

  // config/public → স্টোরের দর + পেমেন্টের বিবরণ (sms/smtp গোপন অংশ ছোঁয়া হয় না)।
  const applyPublicConfig = (c: Partial<{ piRateBDT: number; usdtRateBDT: number; piWithdrawFeePct: number; piTransferFeePct: number; piMinTransfer: number; datingRate: number; liveRate: number; tvPlaylistUrl: string; payments: { bkash: string; nagad: string; rocket: string; usdtBep20: string; usdtErc20: string; binancePayId: string; piDepositAddress: string; enabled?: PaymentEnabledMap }; analytics: AnalyticsIds; adRates: AdRateSettings; bannedUids: string[] }>) => {
    if (c.piRateBDT !== undefined) setPiRateBDTState(c.piRateBDT)
    if (c.usdtRateBDT !== undefined) setUsdtRateBDTState(c.usdtRateBDT)
    if (c.piWithdrawFeePct !== undefined) setPiWithdrawFeePctState(c.piWithdrawFeePct)
    if (c.piTransferFeePct !== undefined) setPiTransferFeePctState(c.piTransferFeePct)
    if (c.piMinTransfer !== undefined) setPiMinTransferState(c.piMinTransfer)
    if (c.datingRate !== undefined) setDatingRateState(c.datingRate)
    if (c.liveRate !== undefined) setLiveRateState(c.liveRate)
    if (c.tvPlaylistUrl !== undefined) setTvPlaylistUrlState(c.tvPlaylistUrl)
    if (c.payments !== undefined) setAdminSettingsState((prev) => ({ ...prev, payments: { ...prev.payments, ...c.payments, enabled: normalizePaymentEnabled({ ...prev.payments.enabled, ...(c.payments?.enabled ?? {}) }) } }))
    if (c.analytics !== undefined) setAdminSettingsState((prev) => ({ ...prev, analytics: { ...prev.analytics, ...c.analytics } }))
    if (c.adRates !== undefined) setAdminSettingsState((prev) => ({ ...prev, ads: { ...prev.ads, ...c.adRates } }))
    if (c.bannedUids !== undefined) { const clean = cleanUidList(c.bannedUids); setBannedUidsState(clean); save('bannedUids', clean) }
  }

  // খতিয়ানের সর্বশেষ সারি (ট্রান্সফার জমায় পুরোনো ক্লোজার না ধরে — একই
  // ট্রান্সফার দুবার জমা ঠেকাতে খতিয়ানের id-ই দেখা হয়)।
  const ledgerRef = useRef<PiLedgerRow[]>([])
  ledgerRef.current = piLedger

  // ট্রান্সফার জমা — piTransfers ডক থেকে নিজের ভূমিকার জমা: প্রাপক +net,
  // অ্যাডমিন +fee, পাঠক −amount (অন্য ডিভাইস থেকে পাঠানো হলে — এই ডিভাইসে
  // পাঠালে sendPi-তেই জমা হয়)। খতিয়ানে সারি থাকলে আর জমা হয় না।
  // knownRowIds — লগইনে ক্লাউডের খতিয়ান থেকেও মেলানো হয় (স্থানীয়
  // খতিয়ান তখনো পুরোনো হতে পারে)।
  const applyPiTransfer = (t: PiTransferDoc, knownRowIds?: string[]) => {
    if (!uid) return
    const roles = transferRoles(t, uid)
    if (roles.length === 0) return
    const ids = knownRowIds ?? ledgerRef.current.map(r => r.id)
    let delta = 0
    const rows: PiLedgerRow[] = []
    for (const role of roles) {
      if (isTransferApplied(ids, t.id, role)) continue
      const app = buildTransferApplication(t, role)
      delta = roundPi(delta + app.delta)
      rows.push(app.row)
    }
    if (rows.length === 0) return
    setPiBalance(b => roundPi(b + delta))
    setPiLedger(prev => [...rows.filter(r => !prev.some(x => x.id === r.id)), ...prev].slice(0, 200))
  }

  // অন্য ব্যবহারকারীর ক্যাশে লগইন করলে — আগের ব্যবহারকারীর ডেটা নতুন ব্যবহারকারীর
  // ডকে উঠে যাওয়া ঠেকাতে সিঙ্ক করা অবস্থা নতুন ডিভাইসের মতো শূন্য করে দেওয়া হয়।
  // (একই ব্যবহারকারী আবার এলে রিসেট হয় না — ক্যাশের UID মিলে যায়।)
  const resetSyncableState = () => {
    setFreeUsed(false)
    setCalls([])
    setFriends(() => {
      const removed = load<string[]>('buddiesRemoved', [])
      const base: Friend[] = []
      for (const b of BUDDIES) {
        if (!removed.includes(b.id) && !base.some((f) => f.id === b.id)) base.push({ id: b.id, name: b.name, color: b.color, online: b.online })
      }
      return base
    })
    setRequests([])
    setLikesUsed(0)
    setPremium(false)
    setPiBalance(20)
    setBonusPi(0)
    setPoints(0)
    setReferrals(0)
    setDatingRateState(0.1)
    setLiveRateState(0.05)
    setLiveEarnings(0)
    setKycStatus('none')
    setKycInfo(null)
    setKycRejectReason('')
    setReferralCodeState(randomCode())
    setReferrer(null)
    setRefWelcomeClaimed(false)
    setRefNotice(null)
    setReferralRewarded(false)
    setReferralPiEarned(0)
    setHasToppedUp(false)
    setLastClaimDate(null)
    setStreak(0)
    setGiftBoxClaimedCycle(null)
    setTotalShares(0)
    setReelShares({})
    setGiftsSentPi(0)
    setPiWalletAddress(null)
    setPiDeposits([])
    setPiWithdrawals([])
    setProfileDob('')
    setGender('')
    setDistrict('')
    setThana('')
    setAddress('')
    setHideAddress(false)
    setProfilePhoto('')
    setGalleryPhotos([])
    setInterests([])
    setRecoveryEmail('')
    setRecoveryPhone('')
    setRecoveryEmailVerified(false)
    setRecoveryPhoneVerified(false)
    setTwoFactorEnabled(false)
    setDatingChatPartnerIds([])
    setBlockedUids([])
    setBlockedNames({})
    setPiLedger([{ id: 'open-mig', date: '—', type: 'Adjustment', label: 'Adjustment for earlier transactions', amount: 20 }])
    setPiRateBDTState(DEFAULT_PI_RATE_BDT)
    setUsdtRateBDTState(DEFAULT_USDT_RATE_BDT)
    setPiWithdrawFeePctState(DEFAULT_PI_WITHDRAW_FEE_PCT)
    setTvPlaylistUrlState(DEFAULT_TV_PLAYLIST_URL)
    setPendingTopUps([])
    setAdminSettingsState(DEFAULT_ADMIN_SETTINGS)
  }

  // প্রথম সিঙ্ক — লগইনে একবার: ডক থাকলে ক্লাউড থেকে নেওয়া হয় (hydrate),
  // না থাকলে localStorage-র অবস্থা একবারই ক্লাউডে ওঠে (migration, কোনো মান বানানো হয় না)।
  // Firestore না থাকলে/ব্যর্থ হলে error হয় — অ্যাপ localStorage মোডেই চলতে থাকে।
  useEffect(() => {
    if (!user || !uid || !authReady) {
      if (!user) { setFsState('off'); fsReadyRef.current = false; fsSyncUidRef.current = null; friendPhotoUidRef.current = null }
      return
    }
    if (fsSyncUidRef.current === uid) return
    fsSyncUidRef.current = uid
    let cancelled = false
    const run = async () => {
      const cachedUid = load<string | null>('fsCacheUid', null)
      if (cachedUid && cachedUid !== uid) resetSyncableState()
      save('fsCacheUid', uid)
      setFsState('syncing')
      fsReadyRef.current = false
      try {
        const docData = await fetchUserDoc(uid)
        if (cancelled) return
        // সংখ্যার UID — আগে থেকে থাকলে সেটাই, না থাকলে কাউন্টার থেকে নতুন
        // বরাদ্দ (১০০০০১ থেকে); ব্যর্থ হলে null — পরের লগইনে আবার চেষ্টা হয়।
        const myNumericUid = await ensureNumericUid(uid)
        if (myNumericUid !== null) setNumericUidState(myNumericUid)
        if (cancelled) return
        const profileExtra = { gender, district, interests, photo: profilePhoto, ...(myNumericUid !== null ? { numericUid: myNumericUid } : {}) }
        if (docData) {
          applyHydrated(fromUserDoc(docData))
          // পুরোনো প্রোফাইলে referralCode না থাকলে লগইনে ব্যাকফিল — নাম/আইডি
          // খোঁজায় যাতে সব আসল ব্যবহারকারী মেলে। অ্যাডমিনও সাধারণ ব্যবহারকারীর
          // মতো — তার প্রোফাইলও লেখা হয়, নতুন সদস্যের তালিকায় আসে।
          await writePublicProfile(uid, user.name, referralCode, profileExtra)
          if (cancelled) return
        } else {
          await writeUserDoc(uid, toUserDoc({ ...collectSnapshot(), numericUid: myNumericUid }))
          if (cancelled) return
          // প্রথম লগইন — পাবলিক প্রোফাইল (নাম + যোগদানের সময় + রং + পাবলিক আইডি)
          // লেখা হয়, যাতে "নতুন সদস্য" সেকশনে আর নাম/আইডি খোঁজায় আসল নতুন
          // ব্যবহারকারীরা দেখা যায়। অ্যাডমিনও সাধারণ ব্যবহারকারীর মতো — তার
          // প্রোফাইলও লেখা হয়।
          await writePublicProfile(uid, user.name, referralCode, profileExtra)
          if (cancelled) return
        }
        const cfg = await fetchPublicConfig()
        if (cancelled) return
        if (cfg) {
          applyPublicConfig(fromPublicConfig(cfg))
        } else if (user.email.trim().toLowerCase() === ADMIN_EMAIL) {
          // অ্যাডমিন প্রথমবার — নিজের দর + পেমেন্টের বিবরণ ক্লাউডে ওঠে (গোপন অংশ ছাড়া)
          await writePublicConfig(toPublicConfig({ piRateBDT, usdtRateBDT, piWithdrawFeePct, piTransferFeePct, piMinTransfer, datingRate, liveRate }, adminSettings.payments, tvPlaylistUrl, adminSettings.analytics, adminSettings.ads, bannedUids))
          if (cancelled) return
        }
        if (user.email.trim().toLowerCase() === ADMIN_EMAIL) {
          // অ্যাডমিন হলে ক্লাউডের pending টপ-আপগুলো স্থানীয় তালিকায় মেশে
          const pend = await fetchPendingTopUps()
          if (cancelled) return
          if (pend.length > 0) {
            setPendingTopUps((prev) => {
              const merged = [...prev]
              for (const p of pend) {
                const req = fromTopUpDoc(p.id, p.data)
                if (req && !merged.some((x) => x.id === req.id)) merged.push(req)
              }
              return merged
            })
          }
        } else {
          // সাধারণ ব্যবহারকারী নিজের আবেদনগুলোর স্ট্যাটাস ক্লাউড থেকে আপডেট পান
          const mine = await fetchMyTopUps(uid)
          if (cancelled) return
          if (mine.length > 0) {
            setPendingTopUps((prev) => prev.map((x) => {
              const m = mine.find((y) => y.id === x.id)
              if (!m) return x
              const req = fromTopUpDoc(m.id, m.data)
              return req ? { ...x, status: req.status } : x
            }))
          }
        }
        if (cancelled) return
        // আমার Pi ট্রান্সফার — লগইনে ক্লাউড থেকে এনে খতিয়ানে নেই এমন জমা
        // প্রয়োগ করা হয় (অন্য ডিভাইস থেকে পাঠানো / পাওয়া / ফি)। ক্লাউডের
        // খতিয়ানেও মেলানো হয় — স্থানীয় খতিয়ান তখনো পুরোনো হতে পারে।
        const transfers = await fetchMyPiTransfers(uid)
        if (cancelled) return
        if (transfers.length > 0) {
          const cloudLedger = docData && Array.isArray((docData as Record<string, unknown>).piLedger)
            ? ((docData as Record<string, unknown>).piLedger as { id?: unknown }[]).map(r => typeof r.id === 'string' ? r.id : '').filter(Boolean)
            : []
          const knownIds = [...new Set([...cloudLedger, ...ledgerRef.current.map(r => r.id)])]
          transfers.forEach(t => applyPiTransfer(t, knownIds))
        }
        // আমার পেমেন্ট রিকোয়েস্ট — লগইনে ক্লাউড থেকে এনে তালিকা বসানো হয়
        const reqs = await fetchMyPaymentRequests(uid)
        if (cancelled) return
        setPaymentRequests(reqs)
        fsReadyRef.current = true
        setFsState('on')
      } catch {
        if (!cancelled) { fsReadyRef.current = false; setFsState('error') }
      }
    }
    run()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, user, authReady])

  // বন্ধু রিকোয়েস্ট — Firestore সাবস্ক্রিপশন (আসা + পাঠানো), uid থাকলেই চলে।
  // আসা (toUid == আমি): শুধু pending দেখায়; ব্লক করা প্রেরকেরটা লুকানো থাকে।
  // পাঠানো (fromUid == আমি): pending "Request Sent" অবস্থা দেখায়; কোনো
  // রিকোয়েস্ট গ্রহণ হলে প্রাপক আমার বন্ধু তালিকায় ওঠে — একবারই
  // (frAcceptedHandled মনে রাখে, নইলে আনফ্রেন্ডের পর ফিরে আসত)।
  useEffect(() => {
    if (!uid) return
    const unsubIn = subscribeIncomingFriendRequests(uid, (docs) => {
      const visible = docs.filter(d => d.status === 'pending' && isIncomingVisible(d, blockedUidsRef.current))
      setRequests(visible.map(requestToFriend))
    })
    const unsubOut = subscribeSentFriendRequests(uid, (docs) => {
      setSentRequests(docs.filter(d => d.status === 'pending').map(requestToSentEntry))
      for (const d of docs) {
        if (d.status === 'accepted' && !getHandledAccepted().has(d.id)) {
          markAcceptedHandled(d.id)
          setFriends(prev => {
            if (prev.some(f => f.id === d.toUid)) return prev
            return [...prev, { id: d.toUid, name: d.toName, color: d.toColour, online: true, ...(d.toPhoto ? { photo: d.toPhoto } : {}), ...(d.toNumericUid !== undefined ? { numericUid: d.toNumericUid } : {}) }]
          })
        }
      }
    })
    return () => { unsubIn?.(); unsubOut?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  // Pi ট্রান্সফার — লাইভ সাবস্ক্রিপশন; নতুন ট্রান্সফার এলেই নিজের ভূমিকার
  // জমা প্রয়োগ হয় (প্রাপক/ফি — পাঠকের কাটা ট্রানজ্যাকশনেই হয়েছে)।
  // fsState 'on' হওয়ার পরেই চলে — লগইন সিঙ্কের জমা আগে শেষ হয়।
  useEffect(() => {
    if (!uid || fsState !== 'on') return
    const unsub = subscribeMyPiTransfers(uid, (docs) => { docs.forEach(t => applyPiTransfer(t)) })
    return () => { unsub?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, fsState])

  // পেমেন্ট রিকোয়েস্ট — লাইভ সাবস্ক্রিপশন; নতুন অনুরোধ এলেই বা স্ট্যাটাস
  // বদলালেই (Pay/Decline/Cancel) তালিকা তাজা হয়।
  useEffect(() => {
    if (!uid || fsState !== 'on') return
    const unsub = subscribeMyPaymentRequests(uid, (docs) => { setPaymentRequests(docs) })
    return () => { unsub?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, fsState])

  // Write-through — সিঙ্ক চালু থাকলে প্রতি বদল (৮০০ মিলিসেকেন্ড দেরিতে) ক্লাউডে যায়;
  // localStorage-তো আগেই প্রতি বদলে লেখা হয় (অফলাইন ক্যাশ)। অ্যাডমিনের দর/পেমেন্টের
  // বিবরণ config/public-এ যায় (গোপন অংশ কখনো নয়)। সিঙ্ক শেষ হওয়ার আগের বদল লেখা হয় না।
  useEffect(() => {
    if (fsState !== 'on' || !uid || !user || !fsReadyRef.current) return
    if (fsWriteTimer.current) clearTimeout(fsWriteTimer.current)
    fsWriteTimer.current = setTimeout(() => {
      writeUserDoc(uid, toUserDoc(collectSnapshot())).catch(() => { /* localStorage ক্যাশেই থাকে */ })
      if (user.email.trim().toLowerCase() === ADMIN_EMAIL) {
        writePublicConfig(toPublicConfig({ piRateBDT, usdtRateBDT, piWithdrawFeePct, piTransferFeePct, piMinTransfer, datingRate, liveRate }, adminSettings.payments, tvPlaylistUrl, adminSettings.analytics, adminSettings.ads, bannedUids)).catch(() => { /* ignore */ })
      }
    }, 800)
    return () => { if (fsWriteTimer.current) clearTimeout(fsWriteTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fsState, uid, user, freeFirstMinuteUsed, calls, friends, requests, likesUsed, premium, piBalance, bonusPi, points, referrals, liveEarnings, kycStatus, kycInfo, kycRejectReason, referralCode, numericUid, referrer, refWelcomeClaimed, referralRewarded, referralPiEarned, hasToppedUp, lastClaimDate, streak, giftBoxClaimedCycle, totalShares, reelShares, giftsSentPi, piWalletAddress, piDeposits, piWithdrawals, piLedger, piRateBDT, usdtRateBDT, piWithdrawFeePct, piTransferFeePct, piMinTransfer, datingRate, liveRate, tvPlaylistUrl, adminSettings, profileDob, gender, district, thana, address, hideAddress, profilePhoto, galleryPhotos, interests, recoveryEmail, recoveryPhone, recoveryEmailVerified, recoveryPhoneVerified, twoFactorEnabled, datingChatPartnerIds, blockedUids, bannedUids])

  // পাবলিক প্রোফাইল সিঙ্ক — প্রোফাইল সেটিংস বদলালে (লিঙ্গ/জেলা/ইন্টারেস্ট/ছবি)
  // publicProfiles-ও আপডেট হয়, যাতে ম্যাচে নতুন তথ্য দেখায়। পুরো ঠিকানা +
  // জন্মতারিখ এখানে যায় না — সেগুলো শুধু users/{uid} ডকে থাকে। অ্যাডমিনও
  // সাধারণ ব্যবহারকারীর মতো — তার প্রোফাইলও এখানে সিঙ্ক হয়।
  useEffect(() => {
    if (fsState !== 'on' || !uid || !user || !fsReadyRef.current) return
    const t = setTimeout(() => {
      writePublicProfile(uid, user.name, referralCode, { gender, district, interests, photo: profilePhoto }).catch(() => { /* ignore */ })
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fsState, uid, user, profileDob, gender, district, interests, profilePhoto])

  // Friend photos refresh — a friend's changed photo lives in their
  // publicProfiles doc, not in my friends snapshot (users/{uid}.friends),
  // so without this my friends list / chat / stories would keep showing
  // the old photo (or initials) forever. Once per login, merge the latest
  // public photo of each friend by uid; friends with no photo keep initials.
  useEffect(() => {
    if (fsState !== 'on' || !uid || !user || !fsReadyRef.current) return
    if (friendPhotoUidRef.current === uid) return
    friendPhotoUidRef.current = uid
    let cancelled = false
    fetchAllPublicProfiles(100).then(list => {
      if (cancelled || list.length === 0) return
      const byId = new Map(list.map(m => [m.id, m.photo] as const))
      setFriends(prev => {
        let changed = false
        const next = prev.map(f => {
          const photo = byId.get(f.id)
          if (photo && f.photo !== photo) { changed = true; return { ...f, photo } }
          return f
        })
        return changed ? next : prev
      })
    }).catch(() => { /* friends keep their last photo; initials if none */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fsState, uid, user])

  // ৩০ দিনের গিফট বক্সের অগ্রগতি — স্ট্রিক থেকেই ধরা হয় (একদিন মিস করলে স্ট্রিকের সঙ্গে চক্রও আবার শুরু)
  const giftBoxCycle = streak > 0 ? Math.floor((streak - 1) / GIFT_BOX_DAYS) : 0
  const giftBoxDays = streak > 0 ? streak - giftBoxCycle * GIFT_BOX_DAYS : 0
  const giftBoxClaimed = giftBoxClaimedCycle === giftBoxCycle
  const canClaimGiftBox = streak > 0 && giftBoxDays === GIFT_BOX_DAYS && !giftBoxClaimed

  // π Pi রিপোর্টে নতুন লাইন — খতিয়ানে সবসময় নতুনতম আগে
  const recordPi = (type: string, label: string, amount: number) => {
    const m = roundPi(amount)
    if (!Number.isFinite(m) || m === 0) return
    setPiLedger(prev => [{ id: 'pl-' + Date.now() + '-' + Math.floor(Math.random() * 1000), date: new Date().toLocaleString('en-GB'), type, label, amount: m }, ...prev])
  }

  // খরচের মুহূর্তের সর্বশেষ ব্যালেন্স (হ্যান্ডলারে পুরোনো ক্লোজার না ধরে)
  const balRef = useRef({ pi: 0, bonus: 0, gift: 0 })
  balRef.current = { pi: piBalance, bonus: bonusPi, gift: giftPi }

  // Pi খরচ — বোনাস Pi আগে, তারপর তোলা যায় এমন Pi; মোটের চেয়ে বেশি চাইলে false, কিছুই কাটে না
  // (গিফট Pi এখানে ছোঁয়া হয় না — কল/লাইভ দেখা/বুস্ট/সুপার লাইক গিফট Pi থেকে কাটে না)
  const spendPiImpl = (n: number, type?: string, label?: string): boolean => {
    const m = roundPi(Number(n))
    if (!Number.isFinite(m) || m <= 0) return false
    const total = roundPi(balRef.current.pi + balRef.current.bonus)
    if (m > total) return false
    const fromBonus = Math.min(balRef.current.bonus, m)
    const fromMain = roundPi(m - fromBonus)
    if (fromBonus > 0) setBonusPi(b => roundPi(b - fromBonus))
    if (fromMain > 0) setPiBalance(b => roundPi(b - fromMain))
    if (type) recordPi(type, label || type, -m)
    return true
  }

  // গিফটের খরচ — গিফট Pi আগে, তারপর বোনাস Pi, তারপর তোলা যায় এমন Pi;
  // মোটের চেয়ে বেশি চাইলে false, কিছুই কাটে না। খতিয়ানে কোন উৎস থেকে কাটলো লেখা থাকে।
  const spendGiftPiImpl = (n: number, type?: string, label?: string): boolean => {
    const plan = planGiftSpend(balRef.current.gift, balRef.current.bonus, balRef.current.pi, n)
    if (!plan.ok) return false
    if (plan.fromGift > 0) setGiftPi(g => roundPi(g - plan.fromGift))
    if (plan.fromBonus > 0) setBonusPi(b => roundPi(b - plan.fromBonus))
    if (plan.fromMain > 0) setPiBalance(b => roundPi(b - plan.fromMain))
    if (type) {
      if (plan.fromGift > 0) recordPi(type, `${label || type} — from gift Pi ${formatPi(plan.fromGift)}`, -plan.fromGift)
      if (plan.fromBonus > 0) recordPi(type, `${label || type} — from bonus Pi ${formatPi(plan.fromBonus)}`, -plan.fromBonus)
      if (plan.fromMain > 0) recordPi(type, `${label || type} — from Pi balance ${formatPi(plan.fromMain)}`, -plan.fromMain)
    }
    return true
  }

  // PWA ইন্সটল বোনাস — ৫ π, শুধু গিফট কেনা যাবে; প্রতি ডিভাইসে একবার।
  // ডাবল-ক্লিক/ডাবল-ইফেক্টেও দুবার ক্রেডিট হবে না (ref গার্ড + ফ্ল্যাগ)।
  const installClaimedRef = useRef(false)
  const claimInstallBonus = (): boolean => {
    if (installClaimedRef.current) return false
    installClaimedRef.current = true
    if (!canClaimInstallBonus(installBonusClaimed)) return false
    setInstallBonusClaimed(true)
    setGiftPi(g => roundPi(g + INSTALL_BONUS_PI))
    recordPi('Install Bonus', 'App install bonus — gifts only', INSTALL_BONUS_PI)
    return true
  }

  // ইন্সটল ধরা — 'appinstalled' ইভেন্টে, আর ব্রাউজার মেনু থেকে ইন্সটল করা
  // থাকলে (standalone-এ চলছে) লোডেই চেক; দুটোতেই claimInstallBonus একবারই দেয়।
  useEffect(() => {
    const onInstalled = () => { claimInstallBonus() }
    window.addEventListener('appinstalled', onInstalled)
    try {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone?: boolean }).standalone === true
      if (standalone) claimInstallBonus()
    } catch { /* matchMedia না থাকলে ইভেন্টেই ধরা হবে */ }
    return () => window.removeEventListener('appinstalled', onInstalled)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // পুরনো টাকা ব্যালেন্স একবার Pi-তে রূপান্তর — এই পরিবর্তনের পর টাকার ব্যালেন্স আর কোথাও থাকে না;
  // সংরক্ষিত টাকা থাকলে তা Pi হয়ে Pi ব্যালেন্সে যোগ হয়, খতিয়ানে 'Adjustment' লাইন পড়ে, আর টাকার হিসাব শূন্য করে দেওয়া হয়।
  const migratedBdtRef = useRef(false)
  useEffect(() => {
    if (migratedBdtRef.current) return
    migratedBdtRef.current = true
    const old = load<number>('balance', 0)
    if (old > 0) {
      const pi = topUpPi(old, 'BDT', piRateBDT, usdtRateBDT)
      if (pi > 0) { setPiBalance(b => roundPi(b + pi)); recordPi('Adjustment', 'Adjustment — old money balance converted to Pi', pi) }
      save('balance', 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // লোকাল বন্ধু যোগ — পারসোনা + OTP/লোকাল লগইনের জন্য (Firestore রিকোয়েস্ট
  // নয়); ইতিমধ্যে বন্ধু হলে শুধু ছবি তাজা হয়। addFriend আর acceptRequest
  // দুজনেই এটা ব্যবহার করে।
  const addFriendLocal = (f: Friend) => setFriends(prev => {
    const i = prev.findIndex(x => x.id === f.id)
    if (i === -1) return [...prev, f]
    if (f.photo && prev[i].photo !== f.photo) return prev.map(x => x.id === f.id ? { ...x, photo: f.photo } : x)
    return prev
  })

  const value: Store = useMemo(() => ({
    user,
    uid,
    isAdmin: !!user && user.email.trim().toLowerCase() === ADMIN_EMAIL,
    login: (name, email) => {
      setUser({ name, email })
      // Firebase লগইন হলে (Google/ইমেইল লিংক/পাসওয়ার্ড) UID ধরা হয় — OTP লগইনে Firebase সেশন নেই, uid null থাকে
      const u = getCurrentUid()
      setUid(u)
      if (!u) { setFsState('off'); fsReadyRef.current = false; fsSyncUidRef.current = null; friendPhotoUidRef.current = null }
    },
    logout: () => { setUser(null); setUid(null); setFsState('off'); fsReadyRef.current = false; fsSyncUidRef.current = null; friendPhotoUidRef.current = null },
    // (ব্যাংক তাৎক্ষণিক টপ-আপ বাদ দেওয়া হয়েছে — মালিকের নির্দেশে ২০২৬-১১-২০; এখন সব টপ-আপ ম্যানুয়াল অনুমোদনের মাধ্যমে হয়, approveTopUp-এ Pi যোগ হয়)
    freeFirstMinuteUsed,
    markFreeMinuteUsed: () => setFreeUsed(true),
    calls,
    addCall: (c) => setCalls(prev => [{ ...c, id: 'call-' + Date.now(), time: new Date().toLocaleString('en-GB') }, ...prev]),
    friends,
    feedQuery,
    setFeedQuery,
    posts,
    setPosts,
    freshPostIds,
    addPost: (p) => {
      setPosts((prev) => [p, ...prev])
      setFreshPostIds((prev) => (prev.includes(p.id) ? prev : [p.id, ...prev]))
    },
    likedPostIds,
    togglePostLike: (id) => {
      const r = togglePostLikePure(posts, likedPostIds, id)
      setPosts(r.posts)
      setLikedPostIds(r.likedIds)
    },
    addPostComment: (postId, text) => {
      const t = text.trim()
      if (!t) return
      setPosts((prev) => addPostCommentPure(prev, postId, { id: 'c' + Date.now(), author: user?.name || 'You', text: t, time: 'Now' }))
    },
    deletePost: (id) => {
      setPosts((prev) => deletePostPure(prev, id))
      setFreshPostIds((prev) => prev.filter(x => x !== id))
    },
    updatePost: (id, patch) => setPosts((prev) => updatePostPure(prev, id, patch)),
    requests,
    addFriend: addFriendLocal,
    acceptRequest: async (id) => {
      const r = requests.find(x => x.requestId === id || x.id === id)
      if (!r) return false
      // লোকাল-মাত্র রিকোয়েস্ট (পুরোনো সিড/ক্যাশ, ডক নেই) — আগের মতোই সাথে সাথে বন্ধু।
      if (!r.requestId) { addFriendLocal(r); setRequests(prev => prev.filter(x => x.id !== r.id)); return true }
      // আসল রিকোয়েস্ট: প্রথমে ডকে গ্রহণ লেখা হয় — সফল হলেই প্রেরক আমার
      // বন্ধু তালিকায় ওঠে (write-through-এ users/{আমি}-তে যায়); ব্যর্থ হলে
      // রিকোয়েস্ট তালিকাতেই থাকে, চুপচাপ বন্ধু দেখায় না।
      const ok = await updateFriendRequestStatus(r.requestId, 'accepted')
      if (!ok) return false
      addFriendLocal(r)
      setRequests(prev => prev.filter(x => x.requestId !== r.requestId))
      return true
    },
    declineRequest: async (id) => {
      const r = requests.find(x => x.requestId === id || x.id === id)
      if (!r) return false
      if (!r.requestId) { setRequests(prev => prev.filter(x => x.id !== r.id)); return true }
      const ok = await updateFriendRequestStatus(r.requestId, 'declined')
      if (!ok) return false
      setRequests(prev => prev.filter(x => x.requestId !== r.requestId))
      return true
    },
    sentRequests,
    sendFriendRequest: async (f) => {
      // পারসোনা বা লোকাল id (bd-…/fr-…/f1…) — Firestore রিকোয়েস্ট যায় না,
      // সাথে সাথে লোকাল বন্ধু (আগের আচরণ)।
      if (isBuddyId(f.id) || !looksLikeFirebaseUid(f.id)) { addFriendLocal(f); return true }
      // OTP লগইন (Firebase সেশন নেই, uid null) — রিকোয়েস্ট পাঠানোর উপায়
      // নেই, লোকাল যোগই থাকে।
      if (!uid) { addFriendLocal(f); return true }
      const verdict = canSendFriendRequest(f.id, { uid, friendIds: friends.map(x => x.id), sentToUids: sentRequests.map(s => s.toUid), blockedUids })
      if (verdict !== 'ok') return false
      if (sendInFlightRef.current.has(f.id)) return false
      sendInFlightRef.current.add(f.id)
      try {
        const payload = buildFriendRequestData(
          { uid, name: user?.name || 'User', colour: colourForUid(uid), ...(profilePhoto ? { photo: profilePhoto } : {}), ...(numericUid !== null ? { numericUid } : {}) },
          { uid: f.id, name: f.name, colour: f.color, ...(f.photo ? { photo: f.photo } : {}), ...(f.numericUid !== undefined ? { numericUid: f.numericUid } : {}) },
        )
        if (!payload) return false
        const requestId = await createFriendRequest(payload)
        if (!requestId) return false
        setSentRequests(prev => prev.some(s => s.toUid === f.id) ? prev : [...prev, { toUid: f.id, requestId }])
        return true
      } finally {
        sendInFlightRef.current.delete(f.id)
      }
    },
    cancelFriendRequest: async (toUid) => {
      const sent = sentRequests.find(s => s.toUid === toUid)
      if (!sent) return false
      const ok = await updateFriendRequestStatus(sent.requestId, 'cancelled')
      if (!ok) return false
      setSentRequests(prev => prev.filter(s => s.toUid !== toUid))
      return true
    },
    removeFriend: (id) => {
      if (BUDDIES.some(b => b.id === id)) {
        const removed = load<string[]>('buddiesRemoved', [])
        if (!removed.includes(id)) save('buddiesRemoved', [...removed, id])
      }
      setFriends(prev => prev.filter(x => x.id !== id))
    },
    likesUsed,
    useLike: () => {
      if (premium) return true
      if (likesUsed >= 30) return false
      setLikesUsed(n => n + 1); return true
    },
    premium,
    setPremium: (v) => setPremium(v),
    piBalance,
    bonusPi,
    giftPi,
    installBonusClaimed,
    claimInstallBonus,
    spendGiftPi: spendGiftPiImpl,
    totalPi: roundPi(piBalance + bonusPi + giftPi),
    spendPi: spendPiImpl,
    addPi: (n, type, label) => { const m = roundPi(Number(n)); if (!Number.isFinite(m) || m === 0) return; if (m < 0) { spendPiImpl(-m, type, label); return } setPiBalance(b => roundPi(b + m)); if (type) recordPi(type, label || type, m) },
    points,
    addPoints: (n) => setPoints(p => p + n),
    referrals,
    dark,
    toggleDark: () => setDark(d => !d),
    soundSettings,
    setSoundSettings: (s) => setSoundSettingsState(prev => loadSoundSettings({ ...prev, ...s })),
    callPrivacy,
    setCallPrivacy: (v) => setCallPrivacyState(loadCallPrivacy(v)),
    expertRate: (id) => roundPi((EXPERTS.find(e => e.id === id)?.rate ?? 10) / 100),
    datingRate,
    setDatingRate: (v) => { const n = roundPi(Number(v)); if (Number.isFinite(n) && n >= 0.01) setDatingRateState(n) },
    liveRate,
    setLiveRate: (v) => { const n = roundPi(Number(v)); if (Number.isFinite(n) && n >= 0.01) setLiveRateState(n) },
    liveEarnings,
    // লাইভ আয় (হোস্টের ৭০% শেয়ার) — Pi ব্যালেন্সেও যোগ হয়, যাতে আয় তোলা যায়; খতিয়ানে 'Live Earnings' লাইন পড়ে
    addLiveEarnings: (n) => { const m = roundPi(Number(n)); if (Number.isFinite(m) && m > 0) { setLiveEarnings(e => roundPi(e + m)); setPiBalance(b => roundPi(b + m)); recordPi('Live Earnings', 'Live earnings (70%)', m) } },
    kycStatus,
    kycVerified: kycStatus === 'approved',
    kycInfo,
    kycRejectReason,
    submitKyc: (info) => { setKycInfo({ ...info, submittedAt: new Date().toISOString(), verifiedAt: null }); setKycRejectReason(''); setKycStatus('pending') },
    approveKyc: () => { setKycInfo(prev => prev ? { ...prev, verifiedAt: new Date().toISOString() } : prev); setKycStatus('approved') },
    rejectKyc: (reason) => { setKycRejectReason(reason.trim()); setKycStatus('rejected') },
    resetKyc: () => { setKycInfo(null); setKycRejectReason(''); setKycStatus('none') },
    referralCode,
    numericUid,
    referrer,
    refNotice,
    dismissRefNotice: () => { setRefNotice(null) },
    refWelcomeClaimed,
    claimRefArrival: (code) => {
      const c = (code || '').trim()
      if (!c || c === referralCode || refWelcomeClaimed) return
      setReferrer(c)
      // প্রগ্রেসিভ KYC — বোনাস দাবি করতে অনুমোদিত KYC লাগে; KYC না থাকলে
      // লিংকটা ধরে রাখা হয়, বোনাসটা পরে দাবি করা যায় (claimReferralBonus)।
      if (kycStatus !== 'approved') {
        setRefNotice(`🎉 You came through a friend's link — complete KYC once to claim your ${REF_WELCOME_PI} π welcome bonus!`)
        return
      }
      setRefWelcomeClaimed(true); setBonusPi(b => roundPi(b + REF_WELCOME_PI))
      recordPi('Referral', 'Referral welcome bonus (bonus Pi — usable only for calls/live gifts, cannot be withdrawn)', REF_WELCOME_PI)
      setRefNotice(`🎉 You came through a friend's link — you got ${REF_WELCOME_PI} π bonus!`)
    },
    // আটকে থাকা রেফারেল বোনাস দাবি — KYC অনুমোদনের পরেই মেলে (ওয়েলকাম বোনাস
    // + বন্ধুর প্রথম টপ-আপের পুরস্কার, যা যা বাকি আছে); কিছু না থাকলে false।
    claimReferralBonus: () => {
      if (kycStatus !== 'approved') return false
      let granted = false
      if (referrer && !refWelcomeClaimed) {
        setRefWelcomeClaimed(true); setBonusPi(b => roundPi(b + REF_WELCOME_PI))
        recordPi('Referral', 'Referral welcome bonus (bonus Pi — usable only for calls/live gifts, cannot be withdrawn)', REF_WELCOME_PI)
        granted = true
      }
      if (referrer && hasToppedUp && !referralRewarded) {
        setReferralRewarded(true)
        setReferrals(r => r + 1)
        setReferralPiEarned(c => c + REF_INVITER_PI)
        if (referrer === referralCode) { setBonusPi(b => roundPi(b + REF_INVITER_PI)); recordPi('Referral', 'Referral reward — friend\'s first top-up (bonus Pi — cannot be withdrawn)', REF_INVITER_PI) }
        granted = true
      }
      if (granted) setRefNotice('🎉 Referral bonus claimed!')
      return granted
    },
    referralRewarded,
    referralPiEarned,
    lastClaimDate,
    streak,
    dailyClaimedToday: lastClaimDate === todayStr(),
    claimDailyBonus: () => {
      const today = todayStr()
      if (lastClaimDate === today) return null
      const continues = lastClaimDate === yesterdayStr()
      const nextStreak = continues ? streak + 1 : 1
      // স্ট্রিক ভাঙলে (একদিন মিস) গিফট বক্সের চক্রও আবার শুরু — আগের চক্রের দাবি মুছে যায়
      if (!continues) setGiftBoxClaimedCycle(null)
      const day = ((nextStreak - 1) % 7) + 1
      const reward = DAILY_BONUS_REWARDS[day - 1]
      setStreak(nextStreak); setLastClaimDate(today); setPiBalance(b => roundPi(b + reward))
      recordPi('Daily Bonus', `Daily bonus — Day ${day}`, reward)
      return { day, pi: reward }
    },
    giftBoxCycle,
    giftBoxDays,
    giftBoxClaimed,
    canClaimGiftBox,
    claimGiftBox: () => {
      if (!canClaimGiftBox) return null
      // গিফট বক্সের পুরস্কার তোলা যায় এমন Pi — তাই অনুমোদিত KYC ছাড়া দাবি করা যায় না
      if (kycStatus !== 'approved') return null
      // লটারি — সর্বোচ্চ ১ π; বাকিরা ভিতরের ছোট পুরস্কারগুলোর একটা পাবে (দাবির মুহূর্তে Math.random() দিয়ে ড্র)
      const jackpot = Math.random() < 1 / 3000
      const prize = jackpot ? GIFT_BOX_PI : GIFT_BOX_CONSOLATION[Math.floor(Math.random() * GIFT_BOX_CONSOLATION.length)]
      setGiftBoxClaimedCycle(giftBoxCycle)
      setPiBalance(b => roundPi(b + prize))
      recordPi('Gift Box', jackpot ? 'Gift box — Jackpot!' : 'Gift Box', prize)
      return { pi: prize, jackpot }
    },
    totalShares,
    reelShares,
    recordShare: (id) => {
      setTotalShares(t => t + 1)
      if (id) setReelShares(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
    },
    giftsSentPi,
    addGiftsSent: (n) => { const m = roundPi(Number(n)); if (Number.isFinite(m) && m > 0) setGiftsSentPi(g => roundPi(g + m)) },
    piWalletAddress,
    piDeposits,
    piWithdrawals,
    depositPi: (amount, ref, chain) => {
      const m = roundPi(Number(amount))
      if (!Number.isFinite(m) || m <= 0) return
      setPiBalance(b => roundPi(b + m))
      recordPi('Deposit', `Pi deposit${ref.trim() ? ' — ' + ref.trim() : ''}`, m)
      setPiDeposits(prev => [{ id: 'dep-' + Date.now(), amount: m, ref: ref.trim(), date: new Date().toLocaleString('en-GB'), status: '✅ Deposit recorded', chain: chain || 'Pi Mainnet' }, ...prev])
    },
    withdrawPi: (amount, address, chain) => {
      // Pi তোলা সবসময় অনুমোদিত KYC চায় — KYC ছাড়া তোলা যায় না
      if (kycStatus !== 'approved') return false
      const m = roundPi(Number(amount))
      const min = piMinWithdraw(piRateBDT, usdtRateBDT)
      if (!Number.isFinite(m) || m < min || m > piBalance) return false
      const fee = piWithdrawFee(m, piWithdrawFeePct)
      const received = roundPi(m - fee)
      setPiBalance(b => roundPi(b - m))
      recordPi('Withdraw', `Pi withdrawal — fee ${formatPi(fee)}`, -m)
      setPiWithdrawals(prev => [{ id: 'wd-' + Date.now(), amount: m, fee, received, address, date: new Date().toLocaleString('en-GB'), status: '⏳ Processing', chain: chain || 'Pi Mainnet' }, ...prev])
      return true
    },
    lookupUserByUid: (numericUid) => findUserByNumericUid(numericUid),
    sendPi: async (to, amount, opts) => {
      // শুধু আসল Pi — বোনাস/গিফট Pi কখনো নয়; পাঠাতে অনুমোদিত KYC লাগে
      if (!uid || !user) return { ok: false, error: 'Log in again and try.' }
      if (fsState !== 'on') return { ok: false, error: 'No connection — try again.' }
      const err = validateTransferInput({ amount: roundPi(Number(amount)), balance: balRef.current.pi, minTransfer: piMinTransfer, kycApproved: kycStatus === 'approved', isSelf: to.uid === uid })
      if (err) return { ok: false, error: err }
      const { amount: a } = computeTransfer(amount, piTransferFeePct)
      // ক্লাউডের ব্যালেন্স তাজা করা — ট্রানজ্যাকশন যাতে পুরোনো অঙ্ক না পড়ে
      try { await writeUserDoc(uid, toUserDoc(collectSnapshot())) } catch { /* ট্রানজ্যাকশন ক্লাউড ব্যালেন্স যাচাই করেই */ }
      const res = await createPiTransfer({ fromUid: uid, toUid: to.uid, fromName: user.name || 'User', toName: to.name, ...(numericUid !== null ? { fromNumericUid: numericUid } : {}), ...(to.numericUid !== undefined ? { toNumericUid: to.numericUid } : {}), amount: a, feePct: piTransferFeePct, ...(opts?.markRequestPaidId ? { markRequestPaidId: opts.markRequestPaidId } : {}) })
      if (!res.ok) return res
      // সফল — স্থানীয় ব্যালেন্স ট্রানজ্যাকশনের ফলে বসানো হয়; খতিয়ানের
      // সারি ট্রানজ্যাকশনেই ক্লাউডে গেছে, এখানে একই সারি স্থানীয়ভাবে বসে
      setPiBalance(res.newBalance)
      const row = buildTransferApplication(res.transfer, 'sent').row
      setPiLedger(prev => prev.some(r => r.id === row.id) ? prev : [row, ...prev].slice(0, 200))
      return { ok: true }
    },
    sendPiAsAdmin: async (to, amount, note) => {
      // অ্যাডমিনের ম্যানুয়াল পাঠানো — ফি নেই, প্রাপক পুরোটাই পায়; যায়
      // অ্যাডমিনের নিজের ব্যালেন্স থেকে (কোনো Pi বানানো হয় না)। শুধু অ্যাডমিন।
      if (!uid || !user) return { ok: false, error: 'Log in again and try.' }
      if (user.email.trim().toLowerCase() !== ADMIN_EMAIL) return { ok: false, error: 'Only the admin can send Pi from the Admin Wallet.' }
      if (fsState !== 'on') return { ok: false, error: 'No connection — try again.' }
      const m = roundPi(Number(amount))
      if (!Number.isFinite(m) || m <= 0) return { ok: false, error: 'Enter a valid amount.' }
      if (m < piMinTransfer) return { ok: false, error: `Minimum transfer: ${formatPi(piMinTransfer)}.` }
      if (to.uid === uid) return { ok: false, error: 'You cannot send Pi to yourself.' }
      if (m > balRef.current.pi) return { ok: false, error: 'Not enough Pi balance in the Admin Wallet — the admin cannot send more than the wallet holds.' }
      try { await writeUserDoc(uid, toUserDoc(collectSnapshot())) } catch { /* ট্রানজ্যাকশন ক্লাউড ব্যালেন্স যাচাই করেই */ }
      const res = await createPiTransfer({ fromUid: uid, toUid: to.uid, fromName: user.name || 'Admin', toName: to.name, ...(numericUid !== null ? { fromNumericUid: numericUid } : {}), ...(to.numericUid !== undefined ? { toNumericUid: to.numericUid } : {}), amount: m, feePct: 0, kind: 'admin', ...(typeof note === 'string' && note.trim() ? { note: note.trim().slice(0, 200) } : {}), skipKycCheck: true })
      if (res.ok === false) return res
      setPiBalance(res.newBalance)
      const row = buildTransferApplication(res.transfer, 'sent').row
      setPiLedger(prev => prev.some(r => r.id === row.id) ? prev : [row, ...prev].slice(0, 200))
      return { ok: true }
    },
    // পেমেন্ট রিকোয়েস্ট — অনুরোধ পাঠানো / Pay / Decline / Cancel।
    // Pay = sendPi-ই (ট্রানজ্যাকশনে request 'paid' হয়; দুবার Pay নয়);
    // Pay-এর সময়ও payer-এর KYC + ব্যালেন্স sendPi-তেই যাচাই হয়।
    paymentRequests,
    requestPayment: async (to, amount, note) => {
      if (!uid || !user) return { ok: false, error: 'Log in again and try.' }
      if (fsState !== 'on') return { ok: false, error: 'No connection — try again.' }
      const err = validatePaymentRequest({ amount: roundPi(Number(amount)), minTransfer: piMinTransfer, isSelf: to.uid === uid })
      if (err) return { ok: false, error: err }
      const id = await createPaymentRequest({ fromUid: uid, toUid: to.uid, fromName: user.name || 'User', toName: to.name, ...(profilePhoto ? { fromPhoto: profilePhoto } : {}), ...(numericUid !== null ? { fromNumericUid: numericUid } : {}), ...(to.numericUid !== undefined ? { toNumericUid: to.numericUid } : {}), amount: roundPi(Number(amount)), ...(typeof note === 'string' && note.trim() ? { note: note.trim().slice(0, 200) } : {}) })
      if (!id) return { ok: false, error: 'Could not send the request — try again.' }
      return { ok: true }
    },
    payPaymentRequest: async (req) => {
      if (!uid || !user) return { ok: false, error: 'Log in again and try.' }
      if (!canPayRequest(req, uid)) return { ok: false, error: 'This payment request is no longer pending.' }
      const res = await value.sendPi({ uid: req.fromUid, name: req.fromName, ...(req.fromNumericUid !== undefined ? { numericUid: req.fromNumericUid } : {}) }, req.amount, { markRequestPaidId: req.id })
      return res
    },
    declinePaymentRequest: async (req) => {
      if (!uid) return false
      if (!canDeclineRequest(req, uid)) return false
      return updatePaymentRequestStatus(req.id, 'declined')
    },
    cancelPaymentRequest: async (req) => {
      if (!uid) return false
      if (!canCancelRequest(req, uid)) return false
      return updatePaymentRequestStatus(req.id, 'cancelled')
    },
    profileDob,
    gender,
    district,
    thana,
    address,
    hideAddress,
    profilePhoto,
    galleryPhotos,
    interests,
    updateProfile: (p) => {
      if (p.profileDob !== undefined) setProfileDob(p.profileDob)
      if (p.gender !== undefined) setGender(p.gender)
      if (p.district !== undefined) setDistrict(p.district)
      if (p.thana !== undefined) setThana(p.thana)
      if (p.address !== undefined) setAddress(p.address)
      if (p.hideAddress !== undefined) setHideAddress(p.hideAddress)
      if (p.profilePhoto !== undefined) setProfilePhoto(p.profilePhoto)
      if (p.galleryPhotos !== undefined) setGalleryPhotos(p.galleryPhotos.slice(0, 8))
      if (p.interests !== undefined) setInterests(p.interests.slice(0, 16))
    },
    profileCompletion: profileCompletion(user?.name ?? '', { profileDob, gender, district, thana, address, hideAddress, profilePhoto, galleryPhotos, interests }),
    recoveryEmail,
    recoveryPhone,
    recoveryEmailVerified,
    recoveryPhoneVerified,
    twoFactorEnabled,
    updateSecurity: (p) => {
      if (p.recoveryEmail !== undefined) setRecoveryEmail(p.recoveryEmail)
      if (p.recoveryPhone !== undefined) setRecoveryPhone(p.recoveryPhone)
      if (p.recoveryEmailVerified !== undefined) setRecoveryEmailVerified(p.recoveryEmailVerified)
      if (p.recoveryPhoneVerified !== undefined) setRecoveryPhoneVerified(p.recoveryPhoneVerified)
      if (p.twoFactorEnabled !== undefined) setTwoFactorEnabled(p.twoFactorEnabled)
    },
    datingChatPartnerIds,
    recordDatingChat: (partnerId) => {
      const id = (partnerId || '').trim()
      if (!id) return
      setDatingChatPartnerIds(prev => prev.includes(id) ? prev : [...prev, id].slice(0, 50))
    },
    datingKycRequired: datingGateReached(kycStatus, datingChatPartnerIds.length),
    blockedUids,
    blockedNames,
    blockUser: (targetUid, targetName) => {
      const t = (targetUid || '').trim()
      if (!t || t === uid) return
      if (isBuddyId(t)) return // চ্যাট পারসোনা আসল মানুষ নয় — ব্লকের দরকার নেই
      setBlockedUids(prev => prev.includes(t) ? prev : [...prev, t])
      if (targetName && targetName.trim()) setBlockedNames(prev => ({ ...prev, [t]: targetName.trim() }))
      // শেয়ার করা রুম ডকেও ব্লক লেখা হয় — ব্লক হওয়া পক্ষ পাঠানোর/কল করার আগেই জানতে পারেন
      if (uid) setRoomBlocked(blockRoomId(uid, t), uid, true).catch(() => { /* localStorage ক্যাশেই ব্লক থাকে */ })
    },
    unblockUser: (targetUid) => {
      const t = (targetUid || '').trim()
      if (!t) return
      setBlockedUids(prev => prev.filter(x => x !== t))
      setBlockedNames(prev => { const next = { ...prev }; delete next[t]; return next })
      if (uid) setRoomBlocked(blockRoomId(uid, t), uid, false).catch(() => { /* ignore */ })
    },
    piRateBDT,
    setPiRateBDT: (v) => { const n = roundPi(Number(v)); if (Number.isFinite(n) && n >= 1) setPiRateBDTState(n) },
    usdtRateBDT,
    setUsdtRateBDT: (v) => { const n = roundPi(Number(v)); if (Number.isFinite(n) && n >= 1) setUsdtRateBDTState(n) },
    piWithdrawFeePct,
    setPiWithdrawFeePct: (v) => { const n = Math.round(Number(v) * 10) / 10; if (Number.isFinite(n) && n >= 0 && n <= 10) setPiWithdrawFeePctState(n) },
    piTransferFeePct,
    setPiTransferFeePct: (v) => { const n = cleanTransferFeePct(v); if (n !== null) setPiTransferFeePctState(n) },
    piMinTransfer,
    setPiMinTransfer: (v) => { const n = cleanMinTransfer(v); if (n !== null) setPiMinTransferState(n) },
    tvPlaylistUrl,
    setTvPlaylistUrl: (u) => { const v = String(u ?? '').trim(); if (v === '' || (/^https?:\/\//.test(v) && v.length <= 500)) setTvPlaylistUrlState(v) },
    piMinWithdraw: piMinWithdraw(piRateBDT, usdtRateBDT),
    piLedger,
    pendingTopUps,
    submitManualTopUp: (method, amount, trxId, currency = 'BDT', network) => {
      const m = currency === 'USDT' ? roundPi(Number(amount)) : Math.round(Number(amount))
      const t = (trxId || '').trim()
      if (!Number.isFinite(m) || m <= 0) return 'Enter a valid amount.'
      if (!t) return 'Enter the reference.'
      if (pendingTopUps.some(x => x.trxId.toLowerCase() === t.toLowerCase())) return 'This reference has already been used.'
      const req: TopUpRequest = { id: 'tu-' + Date.now(), method, network, amount: m, currency, trxId: t, date: new Date().toLocaleString('en-GB'), status: 'pending' }
      setPendingTopUps(prev => [req, ...prev])
      // Firestore চালু থাকলে আবেদনটা topups কালেকশনেও যায় (অ্যাডমিন অন্য ডিভাইস থেকে দেখেন)
      if (fsState === 'on' && uid) writeTopUpDoc(req.id, toTopUpDoc(req, uid)).catch(() => { /* localStorage ক্যাশেই থাকে */ })
      return null
    },
    approveTopUp: (id) => {
      const req = pendingTopUps.find(x => x.id === id)
      if (!req || req.status !== 'pending') return
      setPendingTopUps(prev => prev.map(x => x.id === id ? { ...x, status: 'approved' } : x))
      if (fsState === 'on') updateTopUpStatus(id, 'approved').catch(() => { /* ignore */ })
      // অনুমোদনে টপ-আপ অটো Pi হয়ে Pi ব্যালেন্সে যোগ হয় (টাকা ÷ Pi দর; USDT × USDT দর ÷ Pi দর), খতিয়ানে 'Deposit' লাইন পড়ে
      const pi = topUpPi(req.amount, req.currency, piRateBDT, usdtRateBDT)
      if (pi > 0) {
        setPiBalance(b => roundPi(b + pi))
        recordPi('Deposit', `Deposit — ${req.currency === 'USDT' ? `${req.amount} USDT` : formatBDT(req.amount)} → ${formatPi(pi)}`, pi)
      }
      // রেফারেল পুরস্কার (বন্ধুর প্রথম টপ-আপে) — বোনাস দাবি, তাই অনুমোদিত KYC
      // ছাড়া এখন দেওয়া হয় না; KYC হলে claimReferralBonus-এ পরে দাবি করা যায়।
      if (referrer && !referralRewarded && !hasToppedUp && kycStatus === 'approved') {
        setReferralRewarded(true)
        setReferrals(r => r + 1)
        setReferralPiEarned(c => c + REF_INVITER_PI)
        if (referrer === referralCode) { setBonusPi(b => roundPi(b + REF_INVITER_PI)); recordPi('Referral', 'Referral reward — friend\'s first top-up (bonus Pi — cannot be withdrawn)', REF_INVITER_PI) }
      }
      setHasToppedUp(true)
    },
    rejectTopUp: (id) => {
      setPendingTopUps(prev => prev.map(x => x.id === id ? { ...x, status: 'rejected' } : x))
      if (fsState === 'on') updateTopUpStatus(id, 'rejected').catch(() => { /* ignore */ })
    },
    adminSettings,
    setAdminSettings: (s) => setAdminSettingsState(s),
    bannedUids,
    isBanned: !!uid && bannedUids.includes(uid),
    // অ্যাডমিন-নিয়ন্ত্রিত ব্যান — শুধু অ্যাডমিন বদলাতে পারেন; config/public-এ
    // লেখা হয় (সব ডিভাইসে সিঙ্ক হয়)। Firebase Auth ব্যবহারকারী মোছা যায় না
    // ক্লায়েন্ট থেকে — ব্যান মানেই অ্যাপ-স্তরে বন্ধ, ডিলিট নয়।
    setBannedUids: async (list) => {
      if (!user || user.email.trim().toLowerCase() !== ADMIN_EMAIL) return false
      const next = cleanUidList(list)
      setBannedUidsState(next)
      save('bannedUids', next)
      try {
        return await writePublicConfig(toPublicConfig({ piRateBDT, usdtRateBDT, piWithdrawFeePct, piTransferFeePct, piMinTransfer, datingRate, liveRate }, adminSettings.payments, tvPlaylistUrl, adminSettings.analytics, adminSettings.ads, next))
      } catch { return false }
    },
  }), [user, uid, fsState, freeFirstMinuteUsed, calls, friends, feedQuery, posts, freshPostIds, likedPostIds, requests, likesUsed, premium, piBalance, bonusPi, giftPi, installBonusClaimed, points, referrals, dark, soundSettings, callPrivacy, datingRate, liveRate, liveEarnings, kycStatus, kycInfo, kycRejectReason, referralCode, numericUid, referrer, refWelcomeClaimed, refNotice, referralRewarded, referralPiEarned, hasToppedUp, lastClaimDate, streak, giftBoxCycle, giftBoxDays, giftBoxClaimed, canClaimGiftBox, giftBoxClaimedCycle, totalShares, reelShares, giftsSentPi, piWalletAddress, piDeposits, piWithdrawals, piLedger, piRateBDT, usdtRateBDT, piWithdrawFeePct, piTransferFeePct, piMinTransfer, tvPlaylistUrl, pendingTopUps, adminSettings, recoveryEmail, recoveryPhone, recoveryEmailVerified, recoveryPhoneVerified, twoFactorEnabled, datingChatPartnerIds, bannedUids, sentRequests, blockedUids, profilePhoto, paymentRequests])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used inside StoreProvider')
  return s
}
