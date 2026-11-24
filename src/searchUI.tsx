// PiCall — সার্চের ভাগ করা UI (হেডার সার্চ + বন্ধু খোঁজার ড্রপডাউন + সার্চের ফলের পেজের হুক)।
// আগে এগুলো pages.tsx-এ ছিল; হেডার সার্চ TopBar (components.tsx) থেকেও
// ব্যবহার করে বলে এখানে সরানো হয়েছে — pages/components-এর মধ্যে
// সার্কুলার ইমপোর্ট এড়াতে। খোঁজার নিয়ম: নাম/আইডি দিয়ে সাবস্ট্রিং, সব আসল
// ব্যবহারকারী (publicProfiles), নিজেকে বাদ, সর্বোচ্চ ৮ সাজেশন।
// Facebook-স্টাইল: টাইপ করলেই ড্রপডাউনে People / Posts / Pages & Groups
// সেকশন, কিবোর্ডে (↑ ↓ Enter) চলা যায়, Enter বা "See all results"-এ
// পুরো ফলের পেজ (/search) খোলে, খালি বাক্সে ফোকাস করলে সাম্প্রতিক খোঁজা আসে।
// মানুষের ফলে ট্যাপ করলে তার প্রোফাইল খোলে (কোয়েরি বসে না) — raw Firebase
// uid কোথাও দেখানো হয় না, শুধু referralCode থাকলে সেটাই ID হিসেবে দেখায়।
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { Avatar } from './avatar'
import { buildSearchablePeople, mergeAllUsers, searchGroupsPages, searchPeople, searchPosts, suggestionsFor, type SearchableCommunity, type SearchablePerson, type SearchablePost } from './friendSearch'
import { fetchAllPublicProfiles, fetchGroups, fetchPages } from './firestore'
import { FRIEND_SUGGESTIONS } from './data'
import { BUDDIES } from './buddies'
import { IconFriends, IconSearch } from './icons'
import { loadRecentSearches, saveRecentSearch, removeRecentSearch, clearRecentSearches } from './recentSearches'
import { loadLocalGroups, loadLocalPages, mergeGroupLists, mergePageLists, saveLocalGroups, saveLocalPages, type GroupItem, type PageItem } from './groups'
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

// গ্রুপ + পেজ খোঁজা — লোকাল ক্যাশ (Groups পেজের মতো) আগে, Firestore থেকে
// একবার এনে মিশিয়ে নেওয়া হয়। টাইপ শুরু করলেই আনা হয়; না পেলে লোকাল
// তালিকাতেই খোঁজা চলে।
export function useCommunitySearch(query: string) {
  const [groups, setGroups] = useState<GroupItem[]>(() => loadLocalGroups())
  const [pages, setPages] = useState<PageItem[]>(() => loadLocalPages())
  const [fetched, setFetched] = useState(false)
  const debounced = useDebouncedValue(query, 250)
  useEffect(() => {
    if (!debounced.trim() || fetched) return
    setFetched(true)
    fetchGroups(50).then(list => { if (list.length > 0) { const m = mergeGroupLists(loadLocalGroups(), list); setGroups(m); saveLocalGroups(m) } }).catch(() => { /* লোকাল তালিকাই থাকে */ })
    fetchPages(50).then(list => { if (list.length > 0) { const m = mergePageLists(loadLocalPages(), list); setPages(m); saveLocalPages(m) } }).catch(() => { /* লোকাল তালিকাই থাকে */ })
  }, [debounced, fetched])
  const items = useMemo<SearchableCommunity[]>(() => [
    ...groups.map(g => ({ id: g.id, name: g.name, description: g.description, kind: 'group' as const, memberCount: g.memberUids.length })),
    ...pages.map(p => ({ id: p.id, name: p.name, description: p.description, kind: 'page' as const, category: p.category, memberCount: p.followerUids.length })),
  ], [groups, pages])
  const results = useMemo(() => searchGroupsPages(items, query), [items, query])
  return { results }
}

// অটোকমপ্লিট ড্রপডাউন — সার্চ বাক্সের নিচে মেলা নাম/আইডি (সর্বোচ্চ ৮টি)।
// সাজেশনে ট্যাপ করলে তার নাম কোয়েরি হয় (ফল দেখায়), ড্রপডাউন লুকিয়ে যায়।
// (Friends পেজের বাক্সে ব্যবহার হয় — হেডার সার্চের নিজের ড্রপডাউন আলাদা।)
export function SearchSuggestions({ suggestions, onPick }: { suggestions: SearchablePerson[]; onPick: (p: SearchablePerson) => void }) {
  if (suggestions.length === 0) return null
  return (
    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-xl shadow-lg overflow-hidden">
      {suggestions.map(p => (
        <button key={p.id} onClick={() => onPick(p)} className="flex items-center gap-3 w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-slate-700">
          <Avatar photo={p.photo} name={p.name} color={p.color} className="w-8 h-8 text-sm" />
          <span className="flex-1 min-w-0"><span className="font-medium text-sm block truncate">{p.name}</span><span className="block text-xs text-gray-400">ID: {p.numericUid ?? p.referralCode ?? '—'}</span></span>
        </button>
      ))}
    </div>
  )
}

// ড্রপডাউনের এক সারি — কিবোর্ডে (↑ ↓) ঘোরার জন্য একটাই সমতল তালিকা।
type DropdownRow =
  | { kind: 'person'; person: SearchablePerson }
  | { kind: 'post'; post: SearchablePost }
  | { kind: 'community'; item: SearchableCommunity }
  | { kind: 'recent'; query: string }
  | { kind: 'seeAll' }

// ---------- হেডার সার্চ (Facebook-এর মতো — লোগোর পাশে, সবার ওপরে) ----------
// টাইপ করলেই ড্রপডাউনে People (ছবি, নাম, mutual-friend সংখ্যা যেখানে জানা,
// অনলাইন) / Posts / Pages & Groups সেকশন আসে; ↑ ↓ দিয়ে সারি বদলানো যায়,
// Enter-এ খোলে (মানুষ হলে তার প্রোফাইল, পোস্ট হলে সেই পোস্ট, গ্রুপ/পেজ
// হলে তার পেজ), Esc-এ ড্রপডাউন বন্ধ হয়। Enter (কোনো সারি না বেছে) বা
// "See all results"-এ পুরো ফলের পেজ (/search?q=…) খোলে। খালি বাক্সে ফোকাস
// করলে সাম্প্রতিক খোঁজা দেখায় — একটা মুছে ফেলা যায়, সব মুছে ফেলা যায়।
// মোবাইলেও একই বাক্স, একই আচরণ (লোগোর পাশের সার্চ বোতামে বাক্সটা খোলে)।
export function HeaderSearch() {
  const { friends, feedQuery, setFeedQuery, posts } = useStore()
  const { suggestions } = useAllUserSearch(friends, feedQuery)
  const { results: communityResults } = useCommunitySearch(feedQuery)
  const [showSugg, setShowSugg] = useState(false)
  const [recents, setRecents] = useState<string[]>(() => loadRecentSearches())
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const navigate = useNavigate()
  const searching = feedQuery.trim() !== ''
  const peopleSuggestions = suggestions.slice(0, 5)
  const postSuggestions = useMemo(() => searchPosts(posts, feedQuery).slice(0, 3), [posts, feedQuery])
  const communitySuggestions = communityResults.slice(0, 3)
  const rows: DropdownRow[] = searching
    ? [
        ...peopleSuggestions.map((person): DropdownRow => ({ kind: 'person', person })),
        ...postSuggestions.map((post): DropdownRow => ({ kind: 'post', post })),
        ...communitySuggestions.map((item): DropdownRow => ({ kind: 'community', item })),
        { kind: 'seeAll' },
      ]
    : recents.map((query): DropdownRow => ({ kind: 'recent', query }))
  const hasRows = showSugg && rows.length > 0
  const showEmpty = searching && showSugg && peopleSuggestions.length === 0 && postSuggestions.length === 0 && communitySuggestions.length === 0
  // কোয়েরি/ড্রপডাউন বদলালে কিবোর্ডের বেছে নেওয়া সারি আবার শুরু থেকে
  useEffect(() => { setActiveIdx(null) }, [feedQuery, showSugg])
  function close() { setShowSugg(false); setActiveIdx(null) }
  function openProfile(p: SearchablePerson) {
    saveRecentSearch(feedQuery)
    setRecents(loadRecentSearches())
    close()
    navigate(`/profile/${encodeURIComponent(p.id)}`)
  }
  function pickPost(p: { id: string }) {
    saveRecentSearch(feedQuery)
    setRecents(loadRecentSearches())
    close()
    navigate('/feed', { state: { postId: p.id } })
  }
  function pickCommunity(item: SearchableCommunity) {
    saveRecentSearch(feedQuery)
    setRecents(loadRecentSearches())
    close()
    navigate(item.kind === 'group' ? `/groups/${encodeURIComponent(item.id)}` : `/pages/${encodeURIComponent(item.id)}`)
  }
  function submit() {
    const q = feedQuery.trim()
    if (!q) return
    saveRecentSearch(q)
    setRecents(loadRecentSearches())
    close()
    navigate(`/search?q=${encodeURIComponent(q)}`)
  }
  function pickRecent(q: string) {
    setFeedQuery(q)
    saveRecentSearch(q)
    setRecents(loadRecentSearches())
    close()
    navigate(`/search?q=${encodeURIComponent(q)}`)
  }
  function activate(row: DropdownRow) {
    if (row.kind === 'person') openProfile(row.person)
    else if (row.kind === 'post') pickPost(row.post)
    else if (row.kind === 'community') pickCommunity(row.item)
    else if (row.kind === 'recent') pickRecent(row.query)
    else submit()
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { close(); (e.target as HTMLInputElement).blur(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!showSugg) { setShowSugg(true); return }
      setActiveIdx(i => (i === null ? 0 : Math.min(i + 1, rows.length - 1)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!showSugg) { setShowSugg(true); return }
      setActiveIdx(i => (i === null ? rows.length - 1 : Math.max(i - 1, 0)))
      return
    }
    if (e.key === 'Enter') {
      if (activeIdx !== null && rows[activeIdx]) { e.preventDefault(); activate(rows[activeIdx]) }
      else submit()
    }
  }
  const rowClass = (i: number) => `flex items-center gap-3 w-full text-left px-3 py-2 ${activeIdx === i ? 'bg-gray-100 dark:bg-slate-700' : 'hover:bg-gray-100 dark:hover:bg-slate-700'}`
  // সারির নম্বর — কিবোর্ডে বেছে নেওয়া সারি চিনতে (people 0.., তারপর post, তারপর community, শেষে seeAll)
  let rowNo = -1
  return (
    <div className="relative w-full">
      {showSugg && <div className="fixed inset-0 z-40" onClick={close} />}
      <span className="absolute left-3 top-1/2 -translate-y-1/2 z-50 text-gray-400 pointer-events-none flex"><IconSearch className="w-4 h-4" /></span>
      <input
        className="relative z-50 w-full bg-gray-100 dark:bg-slate-700 rounded-full pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-fb-blue"
        value={feedQuery}
        onChange={e => { setFeedQuery(e.target.value); setShowSugg(true) }}
        onFocus={() => { setRecents(loadRecentSearches()); setShowSugg(true) }}
        onKeyDown={onKeyDown}
        placeholder="Search people, posts, groups…"
        aria-label="Search"
      />
      {hasRows && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-xl shadow-lg overflow-hidden">
          {!searching && (
            <div className="flex items-center justify-between px-3 pt-2 pb-1">
              <p className="text-xs font-bold text-gray-400">Recent searches</p>
              <button onClick={() => { clearRecentSearches(); setRecents([]) }} className="text-xs text-fb-blue font-medium">Clear all</button>
            </div>
          )}
          {searching && peopleSuggestions.length > 0 && <p className="px-3 pt-2 pb-1 text-xs font-bold text-gray-400 flex items-center gap-1.5"><IconFriends className="w-3.5 h-3.5" /> People</p>}
          {peopleSuggestions.map(p => {
            rowNo++
            const i = rowNo
            return (
              <button key={p.id} onClick={() => openProfile(p)} onMouseEnter={() => setActiveIdx(i)} className={rowClass(i)}>
                <Avatar photo={p.photo} name={p.name} color={p.color} className="w-8 h-8 text-sm" />
                <span className="flex-1 min-w-0"><span className="font-medium text-sm block truncate">{p.name}</span><span className="block text-xs text-gray-400 truncate">{(p.numericUid ?? p.referralCode) ? `ID: ${p.numericUid ?? p.referralCode}` : ''}{(p.numericUid ?? p.referralCode) && p.mutual ? ' • ' : ''}{p.mutual ? `${p.mutual} mutual friends` : ''}{!(p.numericUid ?? p.referralCode) && !p.mutual ? (p.online ? '● Online' : '○ Offline') : ''}{(p.numericUid ?? p.referralCode) || p.mutual ? (p.online ? ' • ● Online' : ' • ○ Offline') : ''}</span></span>
              </button>
            )
          })}
          {searching && postSuggestions.length > 0 && <p className="px-3 pt-2 pb-1 text-xs font-bold text-gray-400">Posts</p>}
          {postSuggestions.map(p => {
            rowNo++
            const i = rowNo
            return (
              <button key={p.id} onClick={() => pickPost(p)} onMouseEnter={() => setActiveIdx(i)} className={rowClass(i)}>
                <span className="flex-1 min-w-0 text-left"><span className="font-medium text-sm block truncate">{p.author}</span><span className="block text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{p.text}</span></span>
              </button>
            )
          })}
          {searching && communitySuggestions.length > 0 && <p className="px-3 pt-2 pb-1 text-xs font-bold text-gray-400">Pages &amp; Groups</p>}
          {communitySuggestions.map(item => {
            rowNo++
            const i = rowNo
            return (
              <button key={`${item.kind}-${item.id}`} onClick={() => pickCommunity(item)} onMouseEnter={() => setActiveIdx(i)} className={rowClass(i)}>
                <span className="w-8 h-8 rounded-full bg-fb-blue/10 text-fb-blue grid place-items-center text-xs font-bold shrink-0">{item.kind === 'group' ? 'G' : 'P'}</span>
                <span className="flex-1 min-w-0"><span className="font-medium text-sm block truncate">{item.name}</span><span className="block text-xs text-gray-400 truncate">{item.kind === 'group' ? 'Group' : 'Page'}{item.memberCount !== undefined ? ` • ${item.memberCount} ${item.kind === 'group' ? 'members' : 'followers'}` : ''}</span></span>
              </button>
            )
          })}
          {searching && (() => { rowNo++; const i = rowNo; return (
            <button onClick={submit} onMouseEnter={() => setActiveIdx(i)} className={`flex items-center gap-2 w-full text-left px-3 py-2 text-sm font-medium text-fb-blue border-t dark:border-slate-600 ${activeIdx === i ? 'bg-gray-100 dark:bg-slate-700' : 'hover:bg-gray-100 dark:hover:bg-slate-700'}`}><IconSearch className="w-4 h-4 shrink-0" /> “{feedQuery.trim()}” — See all results</button>
          ) })()}
          {!searching && recents.map(q => (
            <div key={q} className={`flex items-center gap-2 w-full px-3 py-1 ${activeIdx === recents.indexOf(q) ? 'bg-gray-100 dark:bg-slate-700' : ''}`}>
              <button onClick={() => pickRecent(q)} onMouseEnter={() => setActiveIdx(recents.indexOf(q))} className="flex items-center gap-3 flex-1 min-w-0 text-left py-1"><IconSearch className="w-4 h-4 text-gray-400 shrink-0" /><span className="font-medium text-sm truncate">{q}</span></button>
              <button onClick={() => { setRecents(removeRecentSearch(q)) }} className="shrink-0 w-6 h-6 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600 text-sm leading-none" title={`Remove “${q}”`}>✕</button>
            </div>
          ))}
        </div>
      )}
      {showEmpty && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-xl shadow-lg px-3 py-2 text-sm text-gray-500">Nothing found — check whether the name or ID is correct.</div>
      )}
    </div>
  )
}
