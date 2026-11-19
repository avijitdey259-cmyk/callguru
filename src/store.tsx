import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { EXPERTS } from './data'

export type CallRecord = { id: string; name: string; type: 'Expert' | 'Friend' | 'Dating'; rate: number; durationSec: number; cost: number; freeMinute: boolean; time: string; status: 'Completed' | 'Missed' | 'Auto-cut' }
export type Friend = { id: string; name: string; color: string; online: boolean }
export type ChatMsg = { id: string; from: string; text: string; time: string }
export type KycStatus = 'none' | 'pending' | 'approved' | 'rejected'
// ডেটিং KYC — জমা দিলে অ্যাডমিন দেখে মিলিয়ে অনুমোদন/বাতিল করেন; অনুমোদন হলেই ডেটিং খুলবে।
// পুরো NID নম্বর প্রথম ধাপ থেকেই সংরক্ষণ করা হয় (idNumber), যাতে অ্যাডমিন নম্বর মিলিয়ে দেখতে পারেন; idLast4 শুধু সংক্ষিপ্ত প্রদর্শনের জন্য।
// সতর্কতা: পুরো NID অত্যন্ত সংবেদনশীল ব্যক্তিগত তথ্য — আসল প্রোডাকশনে এটি প্লেইন টেক্সটে রাখা যাবে না, এনক্রিপ্ট করে ভেরিফায়েড KYC সার্ভিস দিয়ে পরিচালনা করতে হবে। ডেমোতে শুধু এই ডিভাইসের localStorage-এ থাকে।
// সেলফি ও লাইভ ভিডিও ক্লিপ শুধু অ্যাডমিন যাচাইয়ের জন্য রাখা হয়
export type KycInfo = { name: string; dob: string; idType: string; idNumber?: string; idLast4: string; selfie?: string; selfieVideo?: string; submittedAt: string; verifiedAt: string | null }

// ভাইরাল গ্রোথ — ডেইলি বোনাস চক্র (৭ দিন, তারপর আবার ১ম দিন থেকে)
export const DAILY_BONUS_REWARDS = [5, 10, 15, 20, 25, 30, 50]
export const REF_WELCOME_COINS = 10 // রেফার লিংকে এসে নতুন ব্যবহারকারী পাবেন
export const REF_INVITER_COINS = 20 // রেফার করা বন্ধুর প্রথম টপ-আপে আমন্ত্রণকারী পাবেন
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
  coins: number
  addCoins: (n: number) => void
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
  referralCoinsEarned: number
  lastClaimDate: string | null
  streak: number
  dailyClaimedToday: boolean
  claimDailyBonus: () => { day: number; coins: number } | null
  totalShares: number
  reelShares: Record<string, number>
  recordShare: (id?: string) => void
  giftsSentCoins: number
  addGiftsSent: (n: number) => void
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
  const [coins, setCoins] = useState<number>(() => load('coins', 20))
  const [points, setPoints] = useState<number>(() => load('points', 0))
  const [referrals, setReferrals] = useState<number>(() => load('referrals', 0))
  const [dark, setDark] = useState<boolean>(() => load('dark', false))
  const [datingRate, setDatingRateState] = useState<number>(() => load('datingRate', 10))
  // ডেটিং লাইভ দেখার রেট — কলের রেট থেকে আলাদা, লাইভে টাকা কম কাটবে (ডিফল্ট ৳৫/মিনিট)
  const [liveRate, setLiveRateState] = useState<number>(() => load('liveRate', 5))
  // হোস্টের মোট লাইভ আয় (নিজের লাইভ থেকে ৭০% শেয়ার জমা হয়) — স্থায়ীভাবে সংরক্ষিত
  const [liveEarnings, setLiveEarnings] = useState<number>(() => load('liveEarnings', 0))
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
  const [referralCoinsEarned, setReferralCoinsEarned] = useState<number>(() => load('referralCoinsEarned', 0))
  const [hasToppedUp, setHasToppedUp] = useState<boolean>(() => load('hasToppedUp', false))
  // ডেইলি বোনাস — শেষ দাবির তারিখ ও টানা দিনের সংখ্যা; একদিন মিস করলে স্ট্রিক আবার ১ম দিন থেকে
  const [lastClaimDate, setLastClaimDate] = useState<string | null>(() => load('lastClaimDate', null))
  const [streak, setStreak] = useState<number>(() => load('streak', 0))
  // শেয়ার — মোট শেয়ার ও প্রতি রিলের শেয়ার সংখ্যা
  const [totalShares, setTotalShares] = useState<number>(() => load('totalShares', 0))
  const [reelShares, setReelShares] = useState<Record<string, number>>(() => load('reelShares', {}))
  // লিডারবোর্ডের জন্য এই ডিভাইসে পাঠানো মোট গিফট (কয়েনে)
  const [giftsSentCoins, setGiftsSentCoins] = useState<number>(() => load('giftsSentCoins', 0))

  useEffect(() => save('user', user), [user])
  useEffect(() => save('balance', balance), [balance])
  useEffect(() => save('freeUsed', freeFirstMinuteUsed), [freeFirstMinuteUsed])
  useEffect(() => save('calls', calls), [calls])
  useEffect(() => save('friends', friends), [friends])
  useEffect(() => save('requests', requests), [requests])
  useEffect(() => save('likesUsed', likesUsed), [likesUsed])
  useEffect(() => save('premium', premium), [premium])
  useEffect(() => save('coins', coins), [coins])
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
  useEffect(() => save('referralCoinsEarned', referralCoinsEarned), [referralCoinsEarned])
  useEffect(() => save('hasToppedUp', hasToppedUp), [hasToppedUp])
  useEffect(() => save('lastClaimDate', lastClaimDate), [lastClaimDate])
  useEffect(() => save('streak', streak), [streak])
  useEffect(() => save('totalShares', totalShares), [totalShares])
  useEffect(() => save('reelShares', reelShares), [reelShares])
  useEffect(() => save('giftsSentCoins', giftsSentCoins), [giftsSentCoins])

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
        setReferralCoinsEarned(c => c + REF_INVITER_COINS)
        // ডেমোতে আমন্ত্রণকারী আর নতুন ব্যবহারকারী একই ডিভাইসে হলে (নিজের লিংকে নিজে এলে) কয়েনটা এখানেই জমা হয়
        if (referrer === referralCode) setCoins(c => c + REF_INVITER_COINS)
        setRefNotice(`✅ আপনার প্রথম টপ-আপ সম্পূর্ণ হয়েছে — আপনার আমন্ত্রণকারী ${REF_INVITER_COINS} কয়েন পেয়েছেন!`)
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
    coins,
    addCoins: (n) => setCoins(c => c + n),
    points,
    addPoints: (n) => setPoints(p => p + n),
    referrals,
    dark,
    toggleDark: () => setDark(d => !d),
    expertRate: (id) => EXPERTS.find(e => e.id === id)?.rate ?? 10,
    datingRate,
    setDatingRate: (v) => { const n = Math.floor(Number(v)); if (Number.isFinite(n) && n >= 1) setDatingRateState(n) },
    liveRate,
    setLiveRate: (v) => { const n = Math.floor(Number(v)); if (Number.isFinite(n) && n >= 1) setLiveRateState(n) },
    liveEarnings,
    addLiveEarnings: (n) => { const m = Math.floor(Number(n)); if (Number.isFinite(m) && m > 0) setLiveEarnings(e => e + m) },
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
      setReferrer(c); setRefWelcomeClaimed(true); setCoins(coins => coins + REF_WELCOME_COINS)
      setRefNotice(`🎉 বন্ধুর লিংকে এসেছেন — ${REF_WELCOME_COINS} কয়েন বোনাস পেয়েছেন!`)
    },
    referralRewarded,
    referralCoinsEarned,
    lastClaimDate,
    streak,
    dailyClaimedToday: lastClaimDate === todayStr(),
    claimDailyBonus: () => {
      const today = todayStr()
      if (lastClaimDate === today) return null
      const nextStreak = lastClaimDate === yesterdayStr() ? streak + 1 : 1
      const day = ((nextStreak - 1) % 7) + 1
      const reward = DAILY_BONUS_REWARDS[day - 1]
      setStreak(nextStreak); setLastClaimDate(today); setCoins(c => c + reward)
      return { day, coins: reward }
    },
    totalShares,
    reelShares,
    recordShare: (id) => {
      setTotalShares(t => t + 1)
      if (id) setReelShares(prev => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
    },
    giftsSentCoins,
    addGiftsSent: (n) => { const m = Math.floor(Number(n)); if (Number.isFinite(m) && m > 0) setGiftsSentCoins(g => g + m) }
  }), [user, balance, freeFirstMinuteUsed, calls, friends, requests, likesUsed, premium, coins, points, referrals, dark, datingRate, liveRate, liveEarnings, kycStatus, kycInfo, kycRejectReason, referralCode, referrer, refWelcomeClaimed, refNotice, referralRewarded, referralCoinsEarned, hasToppedUp, lastClaimDate, streak, totalShares, reelShares, giftsSentCoins])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used inside StoreProvider')
  return s
}
