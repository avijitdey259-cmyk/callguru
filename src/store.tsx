import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { EXPERTS, roundPi, formatBDT, formatPi, piMinWithdraw, piWithdrawFee, DEFAULT_PI_RATE_BDT, DEFAULT_USDT_RATE_BDT, DEFAULT_PI_WITHDRAW_FEE_PCT } from './data'
import { BUDDIES } from './buddies'
import { getCurrentUid, onFirebaseAuthUser } from './firebase'
import { fetchUserDoc, writeUserDoc, fetchPublicConfig, writePublicConfig, writeTopUpDoc, updateTopUpStatus, fetchPendingTopUps, fetchMyTopUps } from './firestore'
import { toUserDoc, fromUserDoc, toPublicConfig, fromPublicConfig, toTopUpDoc, fromTopUpDoc, type LocalUserState } from './firestoreMapping'

export type CallRecord = { id: string; name: string; type: 'Expert' | 'Friend' | 'Dating'; rate: number; durationSec: number; cost: number; freeMinute: boolean; time: string; status: 'Completed' | 'Missed' | 'Auto-cut' }
export type Friend = { id: string; name: string; color: string; online: boolean }
export type ChatMsg = { id: string; from: string; text: string; time: string }
export type KycStatus = 'none' | 'pending' | 'approved' | 'rejected'
// ডেটিং KYC — জমা দিলে অ্যাডমিন দেখে মিলিয়ে অনুমোদন/বাতিল করেন; অনুমোদন হলেই ডেটিং খুলবে।
// পুরো NID নম্বর প্রথম ধাপ থেকেই সংরক্ষণ করা হয় (idNumber), যাতে অ্যাডমিন নম্বর মিলিয়ে দেখতে পারেন; idLast4 শুধু সংক্ষিপ্ত প্রদর্শনের জন্য।
// সতর্কতা: পুরো NID অত্যন্ত সংবেদনশীল ব্যক্তিগত তথ্য — আসল প্রোডাকশনে এটি প্লেইন টেক্সটে রাখা যাবে না, এনক্রিপ্ট করে ভেরিফায়েড KYC সার্ভিস দিয়ে পরিচালনা করতে হবে। ডেমোতে শুধু এই ডিভাইসের localStorage-এ থাকে।
// সেলফি ও লাইভ ভিডিও ক্লিপ শুধু অ্যাডমিন যাচাইয়ের জন্য রাখা হয়
export type KycInfo = { name: string; dob: string; idType: string; idNumber?: string; idLast4: string; selfie?: string; selfieVideo?: string; submittedAt: string; verifiedAt: string | null }
// হাতে করা (ম্যানুয়াল) টপ-আপ — bKash/Nagad/Rocket: টাকা পাঠিয়ে TrxID জমা দিলে অ্যাডমিন অনুমোদন দিলে ব্যালেন্স যোগ হয়
export type TopUpRequest = { id: string; method: string; network?: string; amount: number; currency: 'BDT' | 'USDT'; trxId: string; date: string; status: 'pending' | 'approved' | 'rejected' }
// Pi জমা/তোলার হিসাব — ডেমো লেনদেন, আসল Pi ব্লকচেইন লেনদেন নয়
export type PiTx = { id: string; amount: number; ref?: string; address?: string; fee?: number; received?: number; date: string; status: string }
// π Pi রিপোর্টের লেনদেন খতিয়ান — প্রতিটি Pi ওঠানামা এক লাইনে (আয় +, খরচ −); localStorage-এ থাকে
export type PiLedgerRow = { id: string; date: string; type: string; label: string; amount: number }

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
export type PaymentSettings = { bkash: string; nagad: string; rocket: string; usdtBep20: string; usdtErc20: string; binancePayId: string; piDepositAddress: string }
export type AdminSettings = { sms: SmsSettings; smtp: SmtpSettings; payments: PaymentSettings }
export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  sms: { provider: 'BulkSMSBD', apiKey: '', senderId: '' },
  smtp: { host: 'smtp.gmail.com', port: 587, user: '', pass: '', from: '' },
  payments: { bkash: '', nagad: '', rocket: '', usdtBep20: '', usdtErc20: '', binancePayId: '', piDepositAddress: '' },
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
  // লগইন করা ব্যবহারকারী অ্যাডমিন কি না (ইমেইল অ্যাডমিনের ইমেইলের সঙ্গে মিললে তবেই true)
  isAdmin: boolean
  login: (name: string, email: string) => void
  logout: () => void
  topUp: (amount: number, method: string) => void
  freeFirstMinuteUsed: boolean
  markFreeMinuteUsed: () => void
  calls: CallRecord[]
  addCall: (c: Omit<CallRecord, 'id' | 'time'>) => void
  friends: Friend[]
  requests: Friend[]
  addFriend: (f: Friend) => void
  acceptRequest: (id: string) => void
  removeFriend: (id: string) => void
  likesUsed: number
  useLike: () => boolean
  premium: boolean
  setPremium: (v: boolean) => void
  piBalance: number
  // বোনাস Pi — শুধু রেফারেল থেকে আসে; তোলা যায় না, শুধু কল/লাইভ গিফটে খরচ করা যায়
  bonusPi: number
  // মোট Pi — তোলা যায় এমন + বোনাস (ব্যবহারকারীকে এটাই দেখানো হয়)
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
  referrer: string | null
  refNotice: string | null
  dismissRefNotice: () => void
  claimRefArrival: (code: string) => void
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
  connectPiWallet: () => void
  addDemoPi: (n: number) => void
  piDeposits: PiTx[]
  piWithdrawals: PiTx[]
  depositPi: (amount: number, ref: string) => void
  withdrawPi: (amount: number, address: string) => boolean
  // π Pi রিপোর্ট — সব Pi লেনদেনের খতিয়ান (নতুনতম আগে), ওয়ালেটে দেখায়
  piLedger: PiLedgerRow[]
  piRateBDT: number
  setPiRateBDT: (v: number) => void
  usdtRateBDT: number
  setUsdtRateBDT: (v: number) => void
  piWithdrawFeePct: number
  setPiWithdrawFeePct: (v: number) => void
  piMinWithdraw: number
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
  // চ্যাট বন্ধুরা (রিমা, শাকিল, ফাহিম, মিম, আশা) বন্ধু তালিকায় থাকে — আগের
  // সংরক্ষিত তালিকায় না থাকলে একবার যোগ হয়; আনফ্রেন্ড করা হলে আর ফিরে আসে না
  const [friends, setFriends] = useState<Friend[]>(() => {
    const stored = load<Friend[] | null>('friends', null)
    const base = stored ?? [
      { id: 'fr-1', name: 'রাফি আহমেদ', color: '#1877F2', online: true },
      { id: 'fr-2', name: 'সাবরিনা খান', color: '#E91E63', online: false }
    ]
    const removed = load<string[]>('buddiesRemoved', [])
    const merged = [...base]
    for (const b of BUDDIES) {
      if (!removed.includes(b.id) && !merged.some(f => f.id === b.id)) {
        merged.push({ id: b.id, name: b.name, color: b.color, online: b.online })
      }
    }
    return merged
  })
  const [requests, setRequests] = useState<Friend[]>(() => load('requests', [
    { id: 'rq-1', name: 'হাসান মাহমুদ', color: '#27AE60', online: true },
    { id: 'rq-2', name: 'প্রিয়া দাস', color: '#9C27B0', online: false }
  ]))
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
  const [referrals, setReferrals] = useState<number>(() => load('referrals', 0))
  const [dark, setDark] = useState<boolean>(() => load('dark', false))
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
  // π Pi ওয়ালেট — ডেমো ঠিকানা, জমা/তোলার হিসাব (আসল Pi ব্লকচেইন লেনদেন নয়)
  const [piWalletAddress, setPiWalletAddress] = useState<string | null>(() => load('piWalletAddress', null))
  const [piDeposits, setPiDeposits] = useState<PiTx[]>(() => load('piDeposits', []))
  const [piWithdrawals, setPiWithdrawals] = useState<PiTx[]>(() => load('piWithdrawals', []))
  // π Pi রিপোর্টের খতিয়ান — প্রথমবার পুরোনো হিসাব (জমা/তোলা/কল/লাইভ আয়/গিফট/রেফারেল) থেকে বানানো হয়;
  // যা থেকে বানানো যায় না (যেমন আগের ডেইলি বোনাস) তা 'সমন্বয়' লাইনে ধরা হয়, যাতে যোগফল বর্তমান ব্যালেন্সের সঙ্গে মেলে।
  // কোনো পরিমাণ বানানো হয় না — খতিয়ানে শুধু সংরক্ষিত হিসাবেরই অঙ্ক থাকে।
  const [piLedger, setPiLedger] = useState<PiLedgerRow[]>(() => {
    const saved = load<PiLedgerRow[] | null>('piLedger', null)
    if (saved && saved.length > 0) return saved
    const rows: PiLedgerRow[] = []
    piDeposits.forEach(d => rows.push({ id: d.id, date: d.date, type: 'জমা', label: `Pi জমা${d.ref ? ' — ' + d.ref : ''}`, amount: roundPi(d.amount) }))
    piWithdrawals.forEach(w => rows.push({ id: w.id, date: w.date, type: 'তোলা', label: `Pi তোলা — ফি ${formatPi(w.fee ?? 0)}`, amount: -roundPi(w.amount) }))
    calls.filter(c => c.cost > 0).forEach(c => rows.push({ id: c.id, date: c.time, type: 'কল খরচ', label: `কল — ${c.name} (${c.type === 'Expert' ? 'এক্সপার্ট' : c.type === 'Dating' ? 'ডেটিং' : 'বন্ধু'})`, amount: -roundPi(c.cost) }))
    if (liveEarnings > 0) rows.push({ id: 'le-mig', date: '—', type: 'লাইভ আয়', label: 'লাইভ আয় (আগের মোট)', amount: roundPi(liveEarnings) })
    if (giftsSentPi > 0) rows.push({ id: 'gs-mig', date: '—', type: 'গিফট দেওয়া', label: 'লাইভ গিফট (আগের মোট)', amount: -roundPi(giftsSentPi) })
    if (referralPiEarned > 0) rows.push({ id: 'ref-mig', date: '—', type: 'রেফারেল', label: 'রেফারেল আয় (আগের মোট)', amount: roundPi(referralPiEarned) })
    const residual = roundPi(piBalance - rows.reduce((s, r) => s + r.amount, 0))
    if (residual !== 0) rows.push({ id: 'open-mig', date: '—', type: 'সমন্বয়', label: 'আগের লেনদেনের সমন্বয়', amount: residual })
    return rows
  })
  // π Pi দর — অ্যাডমিন নির্ধারিত (ডিফল্ট ১ π = ৳১০০, ১ USDT = ৳১২০); তোলার সর্বনিম্ন এই দর থেকেই হিসাব হয়
  const [piRateBDT, setPiRateBDTState] = useState<number>(() => load('piRateBDT', DEFAULT_PI_RATE_BDT))
  const [usdtRateBDT, setUsdtRateBDTState] = useState<number>(() => load('usdtRateBDT', DEFAULT_USDT_RATE_BDT))
  // Pi তোলার ফি — অ্যাডমিন নির্ধারিত (ডিফল্ট ১%, সর্বনিম্ন ০.১ π)
  const [piWithdrawFeePct, setPiWithdrawFeePctState] = useState<number>(() => load('piWithdrawFeePct', DEFAULT_PI_WITHDRAW_FEE_PCT))

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
  useEffect(() => save('piDeposits', piDeposits), [piDeposits])
  useEffect(() => save('piWithdrawals', piWithdrawals), [piWithdrawals])
  useEffect(() => save('piLedger', piLedger), [piLedger])
  useEffect(() => save('piRateBDT', piRateBDT), [piRateBDT])
  useEffect(() => save('usdtRateBDT', usdtRateBDT), [usdtRateBDT])
  useEffect(() => save('piWithdrawFeePct', piWithdrawFeePct), [piWithdrawFeePct])
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
      payments: { ...DEFAULT_ADMIN_SETTINGS.payments, ...(v.payments || {}) },
    }
  })
  useEffect(() => save('adminSettings', adminSettings), [adminSettings])

  // ================= Firestore সিঙ্ক (আসল ডেটা স্তর) =================
  // নিয়ম: Firestore চালু/পৌঁছানো গেলে users/{uid} ডকই আসল সত্য; localStorage তখন
  // অফলাইন ক্যাশ (প্রতি বদলে লেখা হয়)। Firestore না থাকলে (কনসোলে চালু হয়নি / নেট
  // নেই / OTP লগইন) অ্যাপ ঠিক আগের মতো localStorage-এই চলে — কিছুই ভাঙে না।
  const fsReadyRef = useRef(false) // এই uid-র প্রথম সিঙ্ক শেষ হয়েছে কি না
  const fsSyncUidRef = useRef<string | null>(null)
  const fsWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userRef = useRef(user)
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
    lastClaimDate, streak, giftBoxClaimedCycle,
    totalShares, reelShares, giftsSentPi,
    piWalletAddress, piDeposits, piWithdrawals, piLedger,
  })

  // ক্লাউডের ডক → স্টোরে বসানো (যা ঘর ডকে নেই, সেটা বদলায় না)।
  const applyHydrated = (h: Partial<LocalUserState>) => {
    if (h.freeFirstMinuteUsed !== undefined) setFreeUsed(h.freeFirstMinuteUsed)
    if (h.calls !== undefined) setCalls(h.calls)
    if (h.friends !== undefined) setFriends(h.friends)
    if (h.requests !== undefined) setRequests(h.requests)
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
    if (h.piDeposits !== undefined) setPiDeposits(h.piDeposits)
    if (h.piWithdrawals !== undefined) setPiWithdrawals(h.piWithdrawals)
    if (h.piLedger !== undefined) setPiLedger(h.piLedger)
  }

  // config/public → স্টোরের দর + পেমেন্টের বিবরণ (sms/smtp গোপন অংশ ছোঁয়া হয় না)।
  const applyPublicConfig = (c: Partial<{ piRateBDT: number; usdtRateBDT: number; piWithdrawFeePct: number; datingRate: number; liveRate: number; payments: { bkash: string; nagad: string; rocket: string; usdtBep20: string; usdtErc20: string; binancePayId: string; piDepositAddress: string } }>) => {
    if (c.piRateBDT !== undefined) setPiRateBDTState(c.piRateBDT)
    if (c.usdtRateBDT !== undefined) setUsdtRateBDTState(c.usdtRateBDT)
    if (c.piWithdrawFeePct !== undefined) setPiWithdrawFeePctState(c.piWithdrawFeePct)
    if (c.datingRate !== undefined) setDatingRateState(c.datingRate)
    if (c.liveRate !== undefined) setLiveRateState(c.liveRate)
    if (c.payments !== undefined) setAdminSettingsState((prev) => ({ ...prev, payments: { ...prev.payments, ...c.payments } }))
  }

  // অন্য ব্যবহারকারীর ক্যাশে লগইন করলে — আগের ব্যবহারকারীর ডেটা নতুন ব্যবহারকারীর
  // ডকে উঠে যাওয়া ঠেকাতে সিঙ্ক করা অবস্থা নতুন ডিভাইসের মতো শূন্য করে দেওয়া হয়।
  // (একই ব্যবহারকারী আবার এলে রিসেট হয় না — ক্যাশের UID মিলে যায়।)
  const resetSyncableState = () => {
    setFreeUsed(false)
    setCalls([])
    setFriends(() => {
      const removed = load<string[]>('buddiesRemoved', [])
      const base: Friend[] = [
        { id: 'fr-1', name: 'রাফি আহমেদ', color: '#1877F2', online: true },
        { id: 'fr-2', name: 'সাবরিনা খান', color: '#E91E63', online: false },
      ]
      for (const b of BUDDIES) {
        if (!removed.includes(b.id) && !base.some((f) => f.id === b.id)) base.push({ id: b.id, name: b.name, color: b.color, online: b.online })
      }
      return base
    })
    setRequests([
      { id: 'rq-1', name: 'হাসান মাহমুদ', color: '#27AE60', online: true },
      { id: 'rq-2', name: 'প্রিয়া দাস', color: '#9C27B0', online: false },
    ])
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
    setPiLedger([{ id: 'open-mig', date: '—', type: 'সমন্বয়', label: 'আগের লেনদেনের সমন্বয়', amount: 20 }])
    setPiRateBDTState(DEFAULT_PI_RATE_BDT)
    setUsdtRateBDTState(DEFAULT_USDT_RATE_BDT)
    setPiWithdrawFeePctState(DEFAULT_PI_WITHDRAW_FEE_PCT)
    setPendingTopUps([])
    setAdminSettingsState(DEFAULT_ADMIN_SETTINGS)
  }

  // প্রথম সিঙ্ক — লগইনে একবার: ডক থাকলে ক্লাউড থেকে নেওয়া হয় (hydrate),
  // না থাকলে localStorage-র অবস্থা একবারই ক্লাউডে ওঠে (migration, কোনো মান বানানো হয় না)।
  // Firestore না থাকলে/ব্যর্থ হলে error হয় — অ্যাপ localStorage মোডেই চলতে থাকে।
  useEffect(() => {
    if (!user || !uid || !authReady) {
      if (!user) { setFsState('off'); fsReadyRef.current = false; fsSyncUidRef.current = null }
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
        if (docData) {
          applyHydrated(fromUserDoc(docData))
        } else {
          await writeUserDoc(uid, toUserDoc(collectSnapshot()))
          if (cancelled) return
        }
        const cfg = await fetchPublicConfig()
        if (cancelled) return
        if (cfg) {
          applyPublicConfig(fromPublicConfig(cfg))
        } else if (user.email.trim().toLowerCase() === ADMIN_EMAIL) {
          // অ্যাডমিন প্রথমবার — নিজের দর + পেমেন্টের বিবরণ ক্লাউডে ওঠে (গোপন অংশ ছাড়া)
          await writePublicConfig(toPublicConfig({ piRateBDT, usdtRateBDT, piWithdrawFeePct, datingRate, liveRate }, adminSettings.payments))
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

  // Write-through — সিঙ্ক চালু থাকলে প্রতি বদল (৮০০ মিলিসেকেন্ড দেরিতে) ক্লাউডে যায়;
  // localStorage-তো আগেই প্রতি বদলে লেখা হয় (অফলাইন ক্যাশ)। অ্যাডমিনের দর/পেমেন্টের
  // বিবরণ config/public-এ যায় (গোপন অংশ কখনো নয়)। সিঙ্ক শেষ হওয়ার আগের বদল লেখা হয় না।
  useEffect(() => {
    if (fsState !== 'on' || !uid || !user || !fsReadyRef.current) return
    if (fsWriteTimer.current) clearTimeout(fsWriteTimer.current)
    fsWriteTimer.current = setTimeout(() => {
      writeUserDoc(uid, toUserDoc(collectSnapshot())).catch(() => { /* localStorage ক্যাশেই থাকে */ })
      if (user.email.trim().toLowerCase() === ADMIN_EMAIL) {
        writePublicConfig(toPublicConfig({ piRateBDT, usdtRateBDT, piWithdrawFeePct, datingRate, liveRate }, adminSettings.payments)).catch(() => { /* ignore */ })
      }
    }, 800)
    return () => { if (fsWriteTimer.current) clearTimeout(fsWriteTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fsState, uid, user, freeFirstMinuteUsed, calls, friends, requests, likesUsed, premium, piBalance, bonusPi, points, referrals, liveEarnings, kycStatus, kycInfo, kycRejectReason, referralCode, referrer, refWelcomeClaimed, referralRewarded, referralPiEarned, hasToppedUp, lastClaimDate, streak, giftBoxClaimedCycle, totalShares, reelShares, giftsSentPi, piWalletAddress, piDeposits, piWithdrawals, piLedger, piRateBDT, usdtRateBDT, piWithdrawFeePct, datingRate, liveRate, adminSettings])

  // ৩০ দিনের গিফট বক্সের অগ্রগতি — স্ট্রিক থেকেই ধরা হয় (একদিন মিস করলে স্ট্রিকের সঙ্গে চক্রও আবার শুরু)
  const giftBoxCycle = streak > 0 ? Math.floor((streak - 1) / GIFT_BOX_DAYS) : 0
  const giftBoxDays = streak > 0 ? streak - giftBoxCycle * GIFT_BOX_DAYS : 0
  const giftBoxClaimed = giftBoxClaimedCycle === giftBoxCycle
  const canClaimGiftBox = streak > 0 && giftBoxDays === GIFT_BOX_DAYS && !giftBoxClaimed

  // π Pi রিপোর্টে নতুন লাইন — খতিয়ানে সবসময় নতুনতম আগে
  const recordPi = (type: string, label: string, amount: number) => {
    const m = roundPi(amount)
    if (!Number.isFinite(m) || m === 0) return
    setPiLedger(prev => [{ id: 'pl-' + Date.now() + '-' + Math.floor(Math.random() * 1000), date: new Date().toLocaleString('bn-BD'), type, label, amount: m }, ...prev])
  }

  // খরচের মুহূর্তের সর্বশেষ ব্যালেন্স (হ্যান্ডলারে পুরোনো ক্লোজার না ধরে)
  const balRef = useRef({ pi: 0, bonus: 0 })
  balRef.current = { pi: piBalance, bonus: bonusPi }

  // Pi খরচ — বোনাস Pi আগে, তারপর তোলা যায় এমন Pi; মোটের চেয়ে বেশি চাইলে false, কিছুই কাটে না
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

  // পুরনো টাকা ব্যালেন্স একবার Pi-তে রূপান্তর — এই পরিবর্তনের পর টাকার ব্যালেন্স আর কোথাও থাকে না;
  // সংরক্ষিত টাকা থাকলে তা Pi হয়ে Pi ব্যালেন্সে যোগ হয়, খতিয়ানে 'সমন্বয়' লাইন পড়ে, আর টাকার হিসাব শূন্য করে দেওয়া হয়।
  const migratedBdtRef = useRef(false)
  useEffect(() => {
    if (migratedBdtRef.current) return
    migratedBdtRef.current = true
    const old = load<number>('balance', 0)
    if (old > 0) {
      const pi = topUpPi(old, 'BDT', piRateBDT, usdtRateBDT)
      if (pi > 0) { setPiBalance(b => roundPi(b + pi)); recordPi('সমন্বয়', 'সমন্বয় — পুরনো টাকা ব্যালেন্স Pi-তে রূপান্তর', pi) }
      save('balance', 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value: Store = useMemo(() => ({
    user,
    isAdmin: !!user && user.email.trim().toLowerCase() === ADMIN_EMAIL,
    login: (name, email) => {
      setUser({ name, email })
      // Firebase লগইন হলে (Google/ইমেইল লিংক) UID ধরা হয় — OTP লগইনে Firebase সেশন নেই, uid null থাকে
      const u = getCurrentUid()
      setUid(u)
      if (!u) { setFsState('off'); fsReadyRef.current = false; fsSyncUidRef.current = null }
    },
    logout: () => { setUser(null); setUid(null); setFsState('off'); fsReadyRef.current = false; fsSyncUidRef.current = null },
    // ব্যাংক তাৎক্ষণিক টপ-আপ — টাকা অটো Pi হয়ে Pi ব্যালেন্সে যোগ হয় (টাকা ÷ Pi দর), খতিয়ানে 'জমা' লাইন পড়ে
    topUp: (amount, _method) => {
      const pi = topUpPi(amount, 'BDT', piRateBDT, usdtRateBDT)
      if (pi > 0) { setPiBalance(b => roundPi(b + pi)); recordPi('জমা', `জমা — ${formatBDT(amount)} → ${formatPi(pi)}`, pi) }
      // রেফারেল পুরস্কার: রেফার লিংকে এসে প্রথম টপ-আপ করলেই আমন্ত্রণকারী ১ π বোনাস পান (একবারই) — বোনাস Pi, তোলা যাবে না
      if (referrer && !referralRewarded && !hasToppedUp) {
        setReferralRewarded(true)
        setReferrals(r => r + 1)
        setReferralPiEarned(c => c + REF_INVITER_PI)
        // ডেমোতে আমন্ত্রণকারী আর নতুন ব্যবহারকারী একই ডিভাইসে হলে (নিজের লিংকে নিজে এলে) বোনাস Pi-টা এখানেই জমা হয়
        if (referrer === referralCode) { setBonusPi(b => roundPi(b + REF_INVITER_PI)); recordPi('রেফারেল', 'রেফারেল পুরস্কার — বন্ধুর প্রথম টপ-আপ (বোনাস Pi — তোলা যাবে না)', REF_INVITER_PI) }
        setRefNotice(`✅ আপনার প্রথম টপ-আপ সম্পূর্ণ হয়েছে — আপনার আমন্ত্রণকারী ${REF_INVITER_PI} π বোনাস পেয়েছেন!`)
      }
      setHasToppedUp(true)
    },
    freeFirstMinuteUsed,
    markFreeMinuteUsed: () => setFreeUsed(true),
    calls,
    addCall: (c) => setCalls(prev => [{ ...c, id: 'call-' + Date.now(), time: new Date().toLocaleString('bn-BD') }, ...prev]),
    friends,
    requests,
    addFriend: (f) => setFriends(prev => prev.some(x => x.id === f.id) ? prev : [...prev, f]),
    acceptRequest: (id) => {
      const r = requests.find(x => x.id === id)
      if (r) { setFriends(prev => [...prev, r]); setRequests(prev => prev.filter(x => x.id !== id)) }
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
    totalPi: roundPi(piBalance + bonusPi),
    spendPi: spendPiImpl,
    addPi: (n, type, label) => { const m = roundPi(Number(n)); if (!Number.isFinite(m) || m === 0) return; if (m < 0) { spendPiImpl(-m, type, label); return } setPiBalance(b => roundPi(b + m)); if (type) recordPi(type, label || type, m) },
    points,
    addPoints: (n) => setPoints(p => p + n),
    referrals,
    dark,
    toggleDark: () => setDark(d => !d),
    expertRate: (id) => roundPi((EXPERTS.find(e => e.id === id)?.rate ?? 10) / 100),
    datingRate,
    setDatingRate: (v) => { const n = roundPi(Number(v)); if (Number.isFinite(n) && n >= 0.01) setDatingRateState(n) },
    liveRate,
    setLiveRate: (v) => { const n = roundPi(Number(v)); if (Number.isFinite(n) && n >= 0.01) setLiveRateState(n) },
    liveEarnings,
    // লাইভ আয় (হোস্টের ৭০% শেয়ার) — Pi ব্যালেন্সেও যোগ হয়, যাতে আয় তোলা যায়; খতিয়ানে 'লাইভ আয়' লাইন পড়ে
    addLiveEarnings: (n) => { const m = roundPi(Number(n)); if (Number.isFinite(m) && m > 0) { setLiveEarnings(e => roundPi(e + m)); setPiBalance(b => roundPi(b + m)); recordPi('লাইভ আয়', 'লাইভ আয় (৭০%)', m) } },
    kycStatus,
    kycVerified: kycStatus === 'approved',
    kycInfo,
    kycRejectReason,
    submitKyc: (info) => { setKycInfo({ ...info, submittedAt: new Date().toISOString(), verifiedAt: null }); setKycRejectReason(''); setKycStatus('pending') },
    approveKyc: () => { setKycInfo(prev => prev ? { ...prev, verifiedAt: new Date().toISOString() } : prev); setKycStatus('approved') },
    rejectKyc: (reason) => { setKycRejectReason(reason.trim()); setKycStatus('rejected') },
    resetKyc: () => { setKycInfo(null); setKycRejectReason(''); setKycStatus('none') },
    referralCode,
    referrer,
    refNotice,
    dismissRefNotice: () => { setRefNotice(null) },
    claimRefArrival: (code) => {
      const c = (code || '').trim()
      if (!c || c === referralCode || refWelcomeClaimed) return
      setReferrer(c); setRefWelcomeClaimed(true); setBonusPi(b => roundPi(b + REF_WELCOME_PI))
      recordPi('রেফারেল', 'রেফারেল ওয়েলকাম বোনাস (বোনাস Pi — শুধু কল/লাইভ গিফটে ব্যবহারযোগ্য, তোলা যাবে না)', REF_WELCOME_PI)
      setRefNotice(`🎉 বন্ধুর লিংকে এসেছেন — ${REF_WELCOME_PI} π বোনাস পেয়েছেন!`)
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
      recordPi('ডেইলি বোনাস', `ডেইলি বোনাস — দিন ${day}`, reward)
      return { day, pi: reward }
    },
    giftBoxCycle,
    giftBoxDays,
    giftBoxClaimed,
    canClaimGiftBox,
    claimGiftBox: () => {
      if (!canClaimGiftBox) return null
      // লটারি — সর্বোচ্চ ১ π; বাকিরা ভিতরের ছোট পুরস্কারগুলোর একটা পাবে (দাবির মুহূর্তে Math.random() দিয়ে ড্র)
      const jackpot = Math.random() < 1 / 3000
      const prize = jackpot ? GIFT_BOX_PI : GIFT_BOX_CONSOLATION[Math.floor(Math.random() * GIFT_BOX_CONSOLATION.length)]
      setGiftBoxClaimedCycle(giftBoxCycle)
      setPiBalance(b => roundPi(b + prize))
      recordPi('গিফট বক্স', jackpot ? 'গিফট বক্স — জ্যাকপট!' : 'গিফট বক্স', prize)
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
    connectPiWallet: () => {
      if (piWalletAddress) return
      const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
      let a = 'G'
      for (let i = 0; i < 55; i++) a += alpha[Math.floor(Math.random() * alpha.length)]
      setPiWalletAddress(a)
    },
    addDemoPi: (n) => { const m = roundPi(Number(n)); if (Number.isFinite(m) && m > 0) { setPiBalance(b => roundPi(b + m)); recordPi('ডেমো Pi', 'ডেমো Pi যোগ', m) } },
    piDeposits,
    piWithdrawals,
    depositPi: (amount, ref) => {
      const m = roundPi(Number(amount))
      if (!Number.isFinite(m) || m <= 0) return
      setPiBalance(b => roundPi(b + m))
      recordPi('জমা', `Pi জমা${ref.trim() ? ' — ' + ref.trim() : ''}`, m)
      setPiDeposits(prev => [{ id: 'dep-' + Date.now(), amount: m, ref: ref.trim(), date: new Date().toLocaleString('bn-BD'), status: '✅ ডেমো জমা সম্পূর্ণ' }, ...prev])
    },
    withdrawPi: (amount, address) => {
      const m = roundPi(Number(amount))
      const min = piMinWithdraw(piRateBDT, usdtRateBDT)
      if (!Number.isFinite(m) || m < min || m > piBalance) return false
      const fee = piWithdrawFee(m, piWithdrawFeePct)
      const received = roundPi(m - fee)
      setPiBalance(b => roundPi(b - m))
      recordPi('তোলা', `Pi তোলা — ফি ${formatPi(fee)}`, -m)
      setPiWithdrawals(prev => [{ id: 'wd-' + Date.now(), amount: m, fee, received, address, date: new Date().toLocaleString('bn-BD'), status: '⏳ প্রক্রিয়াধীন (ডেমো)' }, ...prev])
      return true
    },
    piRateBDT,
    setPiRateBDT: (v) => { const n = roundPi(Number(v)); if (Number.isFinite(n) && n >= 1) setPiRateBDTState(n) },
    usdtRateBDT,
    setUsdtRateBDT: (v) => { const n = roundPi(Number(v)); if (Number.isFinite(n) && n >= 1) setUsdtRateBDTState(n) },
    piWithdrawFeePct,
    setPiWithdrawFeePct: (v) => { const n = Math.round(Number(v) * 10) / 10; if (Number.isFinite(n) && n >= 0 && n <= 10) setPiWithdrawFeePctState(n) },
    piMinWithdraw: piMinWithdraw(piRateBDT, usdtRateBDT),
    piLedger,
    pendingTopUps,
    submitManualTopUp: (method, amount, trxId, currency = 'BDT', network) => {
      const m = currency === 'USDT' ? roundPi(Number(amount)) : Math.round(Number(amount))
      const t = (trxId || '').trim()
      if (!Number.isFinite(m) || m <= 0) return 'সঠিক পরিমাণ দিন।'
      if (!t) return 'রেফারেন্স দিন।'
      if (pendingTopUps.some(x => x.trxId.toLowerCase() === t.toLowerCase())) return 'এই রেফারেন্স আগেই ব্যবহার হয়েছে।'
      const req: TopUpRequest = { id: 'tu-' + Date.now(), method, network, amount: m, currency, trxId: t, date: new Date().toLocaleString('bn-BD'), status: 'pending' }
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
      // অনুমোদনে টপ-আপ অটো Pi হয়ে Pi ব্যালেন্সে যোগ হয় (টাকা ÷ Pi দর; USDT × USDT দর ÷ Pi দর), খতিয়ানে 'জমা' লাইন পড়ে
      const pi = topUpPi(req.amount, req.currency, piRateBDT, usdtRateBDT)
      if (pi > 0) {
        setPiBalance(b => roundPi(b + pi))
        recordPi('জমা', `জমা — ${req.currency === 'USDT' ? `${req.amount} USDT` : formatBDT(req.amount)} → ${formatPi(pi)}`, pi)
      }
      if (referrer && !referralRewarded && !hasToppedUp) {
        setReferralRewarded(true)
        setReferrals(r => r + 1)
        setReferralPiEarned(c => c + REF_INVITER_PI)
        if (referrer === referralCode) { setBonusPi(b => roundPi(b + REF_INVITER_PI)); recordPi('রেফারেল', 'রেফারেল পুরস্কার — বন্ধুর প্রথম টপ-আপ (বোনাস Pi — তোলা যাবে না)', REF_INVITER_PI) }
      }
      setHasToppedUp(true)
    },
    rejectTopUp: (id) => {
      setPendingTopUps(prev => prev.map(x => x.id === id ? { ...x, status: 'rejected' } : x))
      if (fsState === 'on') updateTopUpStatus(id, 'rejected').catch(() => { /* ignore */ })
    },
    adminSettings,
    setAdminSettings: (s) => setAdminSettingsState(s),
  }), [user, uid, fsState, freeFirstMinuteUsed, calls, friends, requests, likesUsed, premium, piBalance, bonusPi, points, referrals, dark, datingRate, liveRate, liveEarnings, kycStatus, kycInfo, kycRejectReason, referralCode, referrer, refWelcomeClaimed, refNotice, referralRewarded, referralPiEarned, hasToppedUp, lastClaimDate, streak, giftBoxCycle, giftBoxDays, giftBoxClaimed, canClaimGiftBox, giftBoxClaimedCycle, totalShares, reelShares, giftsSentPi, piWalletAddress, piDeposits, piWithdrawals, piLedger, piRateBDT, usdtRateBDT, piWithdrawFeePct, pendingTopUps, adminSettings])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used inside StoreProvider')
  return s
}
