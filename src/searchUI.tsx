// PiCall — সার্চের ভাগ করা UI (হেডার সার্চ + বন্ধু খোঁজার ড্রপডাউন)।
// আগে এগুলো pages.tsx-এ ছিল; হেডার সার্চ TopBar (components.tsx) থেকেও
// ব্যবহার করে বলে এখানে সরানো হয়েছে — pages/components-এর মধ্যে
// সার্কুলার ইমপোর্ট এড়াতে। কোনো খোঁজার নিয়ম বদলায়নি: নাম/আইডি দিয়ে
// সাবস্ট্রিং, সব আসল ব্যবহারকারী (publicProfiles), নিজেকে বাদ, সর্বোচ্চ ৮ সাজেশন।
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { buildSearchablePeople, mergeAllUsers, searchPeople, searchPosts, suggestionsFor, type SearchablePerson } from './friendSearch'
import { fetchAllPublicProfiles } from './firestore'
import { FRIEND_SUGGESTIONS } from './data'
import { BUDDIES } from './buddies'
import type { NewMember } from './newMembers'

// টাইপ করা মান ~২৫০ মিলিসেকেন্ড পরে ধরা হয় (debounce) — প্রতি অক্ষরে খোঁজা চলে না।
export function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

// সব আসল ব্যবহারকারীসহ খোঁজা — লোকাল (বন্ধু + People You May Know + ৫ পারসোনা)
// + Firestore publicProfiles। টাইপ শুরু করলেই publicProfiles একবার আনে; না পেলে
// (নিয়ম/নেটওয়ার্ক নেই) লোকাল তালিকাতেই খোঁজা চলে — কখনো ক্র্যাশ করে না, ভুয়া
// কাউকে দেখায় না। নিজেকে কখনো দেখায় না। সাজেশন সর্বোচ্চ ৮টি।
export function useAllUserSearch(
  friends: { id: string; name: string; color: string; online: boolean }[],
  query: string,
) {
  const { uid } = useStore()
  const [allUsers, setAllUsers] = useState<NewMember[] | null>(null)
  const debounced = useDebouncedValue(query, 250)
  useEffect(() => {
    if (!debounced.trim() || allUsers !== null) return
    let cancelled = false
    fetchAllPublicProfiles(100).then(list => { if (!cancelled) setAllUsers(list) })
    return () => { cancelled = true }
  }, [debounced, allUsers])
  const local = useMemo(() => buildSearchablePeople(friends, FRIEND_SUGGESTIONS, BUDDIES), [friends])
  const searchable = useMemo(() => mergeAllUsers(local, allUsers ?? [], uid), [local, allUsers, uid])
  const results = useMemo(() => searchPeople(searchable, query), [searchable, query])
  const suggestions = useMemo(() => suggestionsFor(searchable, debounced), [searchable, debounced])
  return { results, suggestions }
}

// অটোকমপ্লিট ড্রপডাউন — সার্চ বাক্সের নিচে মেলা নাম/আইডি (সর্বোচ্চ ৮টি)।
// সাজেশনে ট্যাপ করলে তার নাম কোয়েরি হয় (ফল দেখায়), ড্রপডাউন লুকিয়ে যায়।
export function SearchSuggestions({ suggestions, onPick }: { suggestions: SearchablePerson[]; onPick: (p: SearchablePerson) => void }) {
  if (suggestions.length === 0) return null
  return (
    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-xl shadow-lg overflow-hidden">
      {suggestions.map(p => (
        <button key={p.id} onClick={() => onPick(p)} className="flex items-center gap-3 w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700">
          <span className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-sm shrink-0" style={{ background: p.color }}>{p.name.slice(0, 1)}</span>
          <span className="flex-1 min-w-0"><span className="font-medium text-sm block truncate">{p.name}</span><span className="block text-xs text-gray-400">আইডি: {p.referralCode ?? p.id}</span></span>
        </button>
      ))}
    </div>
  )
}

// ---------- হেডার সার্চ (Facebook-এর মতো — লোগোর পাশে, সবার ওপরে) ----------
// এটাই আসল খোঁজা — বন্ধু + পোস্ট, অটোকমপ্লিট সাজেশনসহ। ফিডের নিচে আর আলাদা
// সার্চ বাক্স নেই। টাইপ করলে ড্রপডাউনে মেলা নাম/পোস্ট আসে (সর্বোচ্চ ৮টি:
// বন্ধু ৫ + পোস্ট ৩); বন্ধুর সাজেশনে ট্যাপ করলে ফিডে তার ফল দেখায়, পোস্টের
// সাজেশনে ট্যাপ করলে সরাসরি সেই পোস্টে যায়। মোবাইলেও একই বাক্স, একই আচরণ
// (লোগোর পাশের 🔍 বোতামে বাক্সটা খোলে)।
export function HeaderSearch() {
  const { friends, feedQuery, setFeedQuery, posts } = useStore()
  const { suggestions } = useAllUserSearch(friends, feedQuery)
  const [showSugg, setShowSugg] = useState(false)
  const navigate = useNavigate()
  const loc = useLocation()
  const searching = feedQuery.trim() !== ''
  const peopleSuggestions = suggestions.slice(0, 5)
  const postSuggestions = useMemo(() => searchPosts(posts, feedQuery).slice(0, 3), [posts, feedQuery])
  const hasSugg = searching && showSugg && (peopleSuggestions.length > 0 || postSuggestions.length > 0)
  const showEmpty = searching && showSugg && peopleSuggestions.length === 0 && postSuggestions.length === 0
  function goFeed() { if (loc.pathname !== '/feed') navigate('/feed') }
  function pickPerson(p: SearchablePerson) {
    setFeedQuery(p.name)
    setShowSugg(false)
    goFeed()
  }
  function pickPost(p: { id: string }) {
    setFeedQuery('')
    setShowSugg(false)
    navigate('/feed', { state: { postId: p.id } })
  }
  function submit() {
    setShowSugg(false)
    goFeed()
  }
  return (
    <div className="relative w-full">
      {showSugg && <div className="fixed inset-0 z-40" onClick={() => setShowSugg(false)} />}
      <span className="absolute left-3 top-1/2 -translate-y-1/2 z-50 text-gray-400 pointer-events-none">🔍</span>
      <input
        className="relative z-50 w-full bg-gray-100 dark:bg-slate-700 rounded-full pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fb-blue"
        value={feedQuery}
        onChange={e => { setFeedQuery(e.target.value); setShowSugg(true) }}
        onFocus={() => { if (feedQuery.trim()) setShowSugg(true) }}
        onKeyDown={e => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') { setShowSugg(false); (e.target as HTMLInputElement).blur() }
        }}
        placeholder="খুঁজুন — নাম, আইডি বা পোস্ট…"
      />
      {hasSugg && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-xl shadow-lg overflow-hidden">
          {peopleSuggestions.length > 0 && <p className="px-3 pt-2 pb-1 text-xs font-bold text-gray-400">👥 বন্ধু</p>}
          {peopleSuggestions.map(p => (
            <button key={p.id} onClick={() => pickPerson(p)} className="flex items-center gap-3 w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700">
              <span className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-sm shrink-0" style={{ background: p.color }}>{p.name.slice(0, 1)}</span>
              <span className="flex-1 min-w-0"><span className="font-medium text-sm block truncate">{p.name}</span><span className="block text-xs text-gray-400">আইডি: {p.referralCode ?? p.id}</span></span>
            </button>
          ))}
          {postSuggestions.length > 0 && <p className="px-3 pt-2 pb-1 text-xs font-bold text-gray-400">📝 পোস্ট</p>}
          {postSuggestions.map(p => (
            <button key={p.id} onClick={() => pickPost(p)} className="block w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700">
              <span className="font-medium text-sm block truncate">{p.author}</span>
              <span className="block text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{p.text}</span>
            </button>
          ))}
          <button onClick={submit} className="block w-full text-left px-3 py-2 text-sm font-medium text-fb-blue border-t dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700">🔍 “{feedQuery.trim()}” — সব ফলাফল দেখুন</button>
        </div>
      )}
      {showEmpty && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-xl shadow-lg px-3 py-2 text-sm text-gray-500">কিছু পাওয়া যায়নি — নাম বা আইডি ঠিক আছে কি না দেখুন।</div>
      )}
    </div>
  )
}
