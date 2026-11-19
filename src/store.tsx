import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { EXPERTS, roundPi, piMinWithdraw, piWithdrawFee, DEFAULT_PI_RATE_BDT, DEFAULT_USDT_RATE_BDT, DEFAULT_PI_WITHDRAW_FEE_PCT } from './data'

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

// ভাইরাল গ্রোথ — ডেইলি বোনাস: ৭ দিনে ধাপে ধাপে বাড়ে, ১ম দিন ০.০০০১ π থেকে ৭ম দিন ০.০০১ π, তারপর আবার ১ম দিন থেকে
export const DAILY_BONUS_REWARDS = [0.0001, 0.00025, 0.0004, 0.00055, 0.0007, 0.00085, 0.001]
// ৩০ দিনের গিফট বক্স — টানা ৩০ দিন ডেইলি বোনাস নিলে ডেইলি বোনাসের উপরে গিফট বক্স; লটারি — সর্বোচ্চ ১ π, বাকিরা ছোট পুরস্কার
export const GIFT_BOX_DAYS = 30
export const GIFT_BOX_PI = 1
export const GIFT_BOX_CONSOLATION = [0.0001, 0.00025, 0.0005, 0.001]
export const REF_WELCOME_PI = 10 // রেফার লিংকে এসে নতুন ব্যবহারকারী পাবেন (π)
export const REF_INVITER_PI = 20 // রেফার করা বন্ধুর প্রথম টপ-আপে আমন্ত্রণকারী পাবেন (π)
export const INVITE_BASE_URL = 'https://callguru-app.netlify.app/'

function todayStr(): string { return new Date().toLocaleDateString('en-CA') }
function yesterdayStr(): string { return new Date(Date.now() - 86400000).toLocaleDateString('en-CA') }
function randomCode(): string { return 'cg-' + Math.random().toString(36).slice(2, 8) }

type Store = {
  user: { name: string; email: string } | null
  login: (name: string, email: string) => void
  logout: () => void
  balance: number
  topUp: (amount: number, method: string) => void
  deduct: (amount: number) => boolean
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
  addPi: (n: number) => void
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
}

const Ctx = createContext<Store | null>(null)

function load<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem('callguru:' + key); return raw ? JSON.parse(raw) as T : fallback } catch { return fallback }
}
function save(key: string, value: unknown) { try { localStorage.setItem('callguru:' + key, JSON.stringify(value)) } catch { /* ignore */ } }

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ name: string; email: string } | null>(() => load('user', null))
  const [balance, setBalance] = useState<number>(() => load('balance', 0))
  const [freeFirstMinuteUsed, setFreeUsed] = useState<boolean>(() => load('freeUsed', false))
  const [calls, setCalls] = useState<CallRecord[]>(() => load('calls', []))
  const [friends, setFriends] = useState<Friend[]>(() => load('friends', [
    { id: 'fr-1', name: 'রাফি আহমেদ', color: '#1877F2', online: true },
    { id: 'fr-2', name: 'সাবরিনা খান', color: '#E91E63', online: false }
  ]))
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
  const [referralCode] = useState<string>(() => load('referralCode', randomCode()))
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
  // π Pi দর — অ্যাডমিন নির্ধারিত (ডিফল্ট ১ π = ৳১০০, ১ USDT = ৳১২০); তোলার সর্বনিম্ন এই দর থেকেই হিসাব হয়
  const [piRateBDT, setPiRateBDTState] = useState<number>(() => load('piRateBDT', DEFAULT_PI_RATE_BDT))
  const [usdtRateBDT, setUsdtRateBDTState] = useState<number>(() => load('usdtRateBDT', DEFAULT_USDT_RATE_BDT))
  // Pi তোলার ফি — অ্যাডমিন নির্ধারিত (ডিফল্ট ১%, সর্বনিম্ন ০.১ π)
  const [piWithdrawFeePct, setPiWithdrawFeePctState] = useState<number>(() => load('piWithdrawFeePct', DEFAULT_PI_WITHDRAW_FEE_PCT))

  useEffect(() => save('user', user), [user])
  useEffect(() => save('balance', balance), [balance])
  useEffect(() => save('freeUsed', freeFirstMinuteUsed), [freeFirstMinuteUsed])
  useEffect(() => save('calls', calls), [calls])
  useEffect(() => save('friends', friends), [friends])
  useEffect(() => save('requests', requests), [requests])
  useEffect(() => save('likesUsed', likesUsed), [likesUsed])
  useEffect(() => save('premium', premium), [premium])
  useEffect(() => save('piBalance', piBalance), [piBalance])
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
  useEffect(() => save('piRateBDT', piRateBDT), [piRateBDT])
  useEffect(() => save('usdtRateBDT', usdtRateBDT), [usdtRateBDT])
  useEffect(() => save('piWithdrawFeePct', piWithdrawFeePct), [piWithdrawFeePct])
  // ম্যানুয়াল টপ-আপের আবেদন — অ্যাডমিন অনুমোদন দিলে ব্যালেন্স যোগ হয়
  const [pendingTopUps, setPendingTopUps] = useState<TopUpRequest[]>(() => load('pendingTopUps', []))
  useEffect(() => save('pendingTopUps', pendingTopUps), [pendingTopUps])

  // ৩০ দিনের গিফট বক্সের অগ্রগতি — স্ট্রিক থেকেই ধরা হয় (একদিন মিস করলে স্ট্রিকের সঙ্গে চক্রও আবার শুরু)
  const giftBoxCycle = streak > 0 ? Math.floor((streak - 1) / GIFT_BOX_DAYS) : 0
  const giftBoxDays = streak > 0 ? streak - giftBoxCycle * GIFT_BOX_DAYS : 0
  const giftBoxClaimed = giftBoxClaimedCycle === giftBoxCycle
  const canClaimGiftBox = streak > 0 && giftBoxDays === GIFT_BOX_DAYS && !giftBoxClaimed

  const value: Store = useMemo(() => ({
    user,
    login: (name, email) => setUser({ name, email }),
    logout: () => setUser(null),
    balance,
    topUp: (amount, _method) => {
      setBalance(b => b + amount)
      // রেফারেল পুরস্কার: রেফার লিংকে এসে প্রথম টপ-আপ করলেই আমন্ত্রণকারী ২০ কয়েন পান (একবারই)
      if (referrer && !referralRewarded && !hasToppedUp) {
        setReferralRewarded(true)
        setReferrals(r => r + 1)
        setReferralPiEarned(c => c + REF_INVITER_PI)
        // ডেমোতে আমন্ত্রণকারী আর নতুন ব্যবহারকারী একই ডিভাইসে হলে (নিজের লিংকে নিজে এলে) Pi-টা এখানেই জমা হয়
        if (referrer === referralCode) setPiBalance(b => roundPi(b + REF_INVITER_PI))
        setRefNotice(`✅ আপনার প্রথম টপ-আপ সম্পূর্ণ হয়েছে — আপনার আমন্ত্রণকারী ${REF_INVITER_PI} π পেয়েছেন!`)
      }
      setHasToppedUp(true)
    },
    deduct: (amount) => {
      let ok = false
      setBalance(b => { if (b >= amount) { ok = true; return b - amount } return b })
      return ok
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
    removeFriend: (id) => setFriends(prev => prev.filter(x => x.id !== id)),
    likesUsed,
    useLike: () => {
      if (premium) return true
      if (likesUsed >= 30) return false
      setLikesUsed(n => n + 1); return true
    },
    premium,
    setPremium: (v) => setPremium(v),
    piBalance,
    addPi: (n) => setPiBalance(b => roundPi(b + n)),
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
    addLiveEarnings: (n) => { const m = roundPi(Number(n)); if (Number.isFinite(m) && m > 0) setLiveEarnings(e => roundPi(e + m)) },
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
      setReferrer(c); setRefWelcomeClaimed(true); setPiBalance(b => roundPi(b + REF_WELCOME_PI))
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
    addDemoPi: (n) => { const m = roundPi(Number(n)); if (Number.isFinite(m) && m > 0) setPiBalance(b => roundPi(b + m)) },
    piDeposits,
    piWithdrawals,
    depositPi: (amount, ref) => {
      const m = roundPi(Number(amount))
      if (!Number.isFinite(m) || m <= 0) return
      setPiBalance(b => roundPi(b + m))
      setPiDeposits(prev => [{ id: 'dep-' + Date.now(), amount: m, ref: ref.trim(), date: new Date().toLocaleString('bn-BD'), status: '✅ ডেমো জমা সম্পূর্ণ' }, ...prev])
    },
    withdrawPi: (amount, address) => {
      const m = roundPi(Number(amount))
      const min = piMinWithdraw(piRateBDT, usdtRateBDT)
      if (!Number.isFinite(m) || m < min || m > piBalance) return false
      const fee = piWithdrawFee(m, piWithdrawFeePct)
      const received = roundPi(m - fee)
      setPiBalance(b => roundPi(b - m))
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
    pendingTopUps,
    submitManualTopUp: (method, amount, trxId, currency = 'BDT', network) => {
      const m = currency === 'USDT' ? roundPi(Number(amount)) : Math.round(Number(amount))
      const t = (trxId || '').trim()
      if (!Number.isFinite(m) || m <= 0) return 'সঠিক পরিমাণ দিন।'
      if (!t) return 'রেফারেন্স দিন।'
      if (pendingTopUps.some(x => x.trxId.toLowerCase() === t.toLowerCase())) return 'এই রেফারেন্স আগেই ব্যবহার হয়েছে।'
      setPendingTopUps(prev => [{ id: 'tu-' + Date.now(), method, network, amount: m, currency, trxId: t, date: new Date().toLocaleString('bn-BD'), status: 'pending' }, ...prev])
      return null
    },
    approveTopUp: (id) => {
      const req = pendingTopUps.find(x => x.id === id)
      if (!req || req.status !== 'pending') return
      setPendingTopUps(prev => prev.map(x => x.id === id ? { ...x, status: 'approved' } : x))
      // USDT হলে অ্যাডমিন-নির্ধারিত দরে টাকায় বদলে ব্যালেন্সে যোগ হয়; টাকা হলে সরাসরি যোগ হয়
      const credit = req.currency === 'USDT' ? Math.round(req.amount * usdtRateBDT) : req.amount
      setBalance(b => b + credit)
      if (referrer && !referralRewarded && !hasToppedUp) {
        setReferralRewarded(true)
        setReferrals(r => r + 1)
        setReferralPiEarned(c => c + REF_INVITER_PI)
        if (referrer === referralCode) setPiBalance(b => roundPi(b + REF_INVITER_PI))
      }
      setHasToppedUp(true)
    },
    rejectTopUp: (id) => {
      setPendingTopUps(prev => prev.map(x => x.id === id ? { ...x, status: 'rejected' } : x))
    }
  }), [user, balance, freeFirstMinuteUsed, calls, friends, requests, likesUsed, premium, piBalance, points, referrals, dark, datingRate, liveRate, liveEarnings, kycStatus, kycInfo, kycRejectReason, referralCode, referrer, refWelcomeClaimed, refNotice, referralRewarded, referralPiEarned, hasToppedUp, lastClaimDate, streak, giftBoxCycle, giftBoxDays, giftBoxClaimed, canClaimGiftBox, giftBoxClaimedCycle, totalShares, reelShares, giftsSentPi, piWalletAddress, piDeposits, piWithdrawals, piRateBDT, usdtRateBDT, piWithdrawFeePct, pendingTopUps])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used inside StoreProvider')
  return s
}
