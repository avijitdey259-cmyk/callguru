import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { EXPERTS } from './data'

export type CallRecord = { id: string; name: string; type: 'Expert' | 'Friend' | 'Dating'; rate: number; durationSec: number; cost: number; freeMinute: boolean; time: string; status: 'Completed' | 'Missed' | 'Auto-cut' }
export type Friend = { id: string; name: string; color: string; online: boolean }
export type ChatMsg = { id: string; from: string; text: string; time: string }

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

  const value: Store = useMemo(() => ({
    user,
    login: (name, email) => setUser({ name, email }),
    logout: () => setUser(null),
    balance,
    topUp: (amount, _method) => setBalance(b => b + amount),
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
    expertRate: (id) => EXPERTS.find(e => e.id === id)?.rate ?? 10
  }), [user, balance, freeFirstMinuteUsed, calls, friends, requests, likesUsed, premium, coins, points, referrals, dark])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used inside StoreProvider')
  return s
}
