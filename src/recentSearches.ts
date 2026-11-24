// সাম্প্রতিক খোঁজা (Facebook-স্টাইল সার্চ) — শুধু এই ডিভাইসে (localStorage),
// সার্ভারে কিছু যায় না, কারো কাছে দেখা যায় না। সর্বোচ্চ ৮টি, নতুনটা উপরে,
// একই কোয়েরি দুবার জমে না, খালি কোয়েরি জমে না। localStorage না থাকলে
// (টেস্ট/প্রাইভেট মোড) মেমরিতেই থাকে — কখনো ক্র্যাশ করে না।
export const RECENT_SEARCHES_KEY = 'callguru:recentSearches'
export const RECENT_SEARCHES_MAX = 8

let memoryFallback: string[] = []

function readRaw(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [...memoryFallback]
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return [...memoryFallback]
  }
}

function writeRaw(list: string[]): void {
  try {
    if (typeof localStorage === 'undefined') { memoryFallback = list; return }
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list))
  } catch {
    memoryFallback = list
  }
}

export function loadRecentSearches(): string[] {
  return readRaw().slice(0, RECENT_SEARCHES_MAX)
}

// সার্চ চালালে কোয়েরিটা উপরে ওঠে (আগে থাকলে পুরোনো জায়গা থেকে সরে আসে);
// খালি কোয়েরি জমে না। নতুন তালিকাটা ফেরে।
export function saveRecentSearch(query: string): string[] {
  const q = query.trim()
  if (!q) return loadRecentSearches()
  const next = [q, ...readRaw().filter(x => x.toLowerCase() !== q.toLowerCase())].slice(0, RECENT_SEARCHES_MAX)
  writeRaw(next)
  return next
}

export function removeRecentSearch(query: string): string[] {
  const q = query.trim().toLowerCase()
  const next = readRaw().filter(x => x.toLowerCase() !== q)
  writeRaw(next)
  return next
}

export function clearRecentSearches(): void {
  writeRaw([])
}
