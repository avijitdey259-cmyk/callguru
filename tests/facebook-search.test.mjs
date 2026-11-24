// Facebook-স্টাইল সার্চ + চ্যাটের নাম → প্রোফাইল টেস্ট।
// চালানো: রিপো রুট থেকে `node tests/facebook-search.test.mjs`
// (esbuild দিয়ে src/friendSearch.ts + src/recentSearches.ts বান্ডল করে
// Node-এ চালায়; পেজ/রাউটারের গঠন সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) গ্রুপ/পেজ খোঁজা — নাম/বিবরণ/ক্যাটাগরিতে মেলে, কেস-ইনসেনসিটিভ, বাংলা
//   ২) ফলের পেজে সব মিল দেখায় (সাজেশনের ৮ সীমা শুধু ড্রপডাউনে)
//   ৩) সাম্প্রতিক খোঁজা — নতুন উপরে, ডুপ্লিকেট নয়, সর্বোচ্চ ৮, খালি নয়,
//      একটা মোছা যায়, সব মোছা যায়
//   ৪) /search আর /profile/:id রাউট আছে
//   ৫) হেডার ড্রপডাউন — People / Posts / Pages & Groups সেকশন, কিবোর্ড
//      (↑ ↓ Enter Esc), সাম্প্রতিক খোঁজা, মানুষের ট্যাপে প্রোফাইল,
//      Enter/See-all-এ ফলের পেজ
//   ৬) ফলের পেজ — All / People / Posts / Groups & Pages ট্যাব, নামে ট্যাপে
//      প্রোফাইল, Add Friend / Request Sent / Chat, পোস্ট/গ্রুপ/পেজে ট্যাপ
//   ৭) প্রোফাইল পেজ — পারসোনা (about + Chat), আসল ব্যবহারকারী
//      (publicProfiles), নিজের প্রোফাইল (Your ID + Copy), না পেলে বার্তা
//   ৮) চ্যাট — হেডারের নাম + মেসেজের নামে ট্যাপে প্রোফাইল, পূর্ণ-পর্দা চ্যাট
//      আর ব্যাক-ধাপ ভাঙে না
//   ৯) নতুন সারফেসে raw Firebase uid দেখানো হয় না — শুধু referralCode
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fsSrc = readFileSync(join(root, 'src/friendSearch.ts'), 'utf8')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const searchUISrc = readFileSync(join(root, 'src/searchUI.tsx'), 'utf8')
const appSrc = readFileSync(join(root, 'src/App.tsx'), 'utf8')
const recentSrc = readFileSync(join(root, 'src/recentSearches.ts'), 'utf8')

const outDir = mkdtempSync(join(tmpdir(), 'picall-fbsearch-test-'))
async function bundle(entry, name) {
  const outFile = join(outDir, name)
  await build({ entryPoints: [join(root, entry)], bundle: true, format: 'esm', platform: 'node', outfile: outFile, logLevel: 'silent' })
  return import(outFile)
}
const FS = await bundle('src/friendSearch.ts', 'friendSearch.mjs')
const RS = await bundle('src/recentSearches.ts', 'recentSearches.mjs')

const COMMUNITIES = [
  { id: 'g-1', name: 'পাই বাংলাদেশ', description: 'Pi Network lovers of Bangladesh', kind: 'group', memberCount: 120 },
  { id: 'g-2', name: 'Chattogram Riders', description: 'বাইক প্রেমীদের গ্রুপ', kind: 'group', memberCount: 45 },
  { id: 'p-1', name: 'Jhuli BD', description: 'Bengali children books', kind: 'page', category: 'Shopping', memberCount: 900 },
  { id: 'p-2', name: 'Fun Box', description: 'Kids rhymes and stories', kind: 'page', category: 'Entertainment', memberCount: 1145 },
]

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

check('গ্রুপ/পেজ খোঁজা — নামে মেলে', () => {
  assert.equal(FS.searchGroupsPages(COMMUNITIES, 'পাই').length, 1)
  assert.equal(FS.searchGroupsPages(COMMUNITIES, 'পাই')[0].id, 'g-1')
  assert.equal(FS.searchGroupsPages(COMMUNITIES, 'jhuli').length, 1)
  assert.equal(FS.searchGroupsPages(COMMUNITIES, 'JHULI').length, 1) // কেস-ইনসেনসিটিভ
  assert.equal(FS.searchGroupsPages(COMMUNITIES, 'fun box').length, 1)
})

check('গ্রুপ/পেজ খোঁজা — বিবরণ/ক্যাটাগরিতেও মেলে', () => {
  assert.equal(FS.searchGroupsPages(COMMUNITIES, 'বাইক').length, 1)
  assert.equal(FS.searchGroupsPages(COMMUNITIES, 'children books').length, 1)
  assert.equal(FS.searchGroupsPages(COMMUNITIES, 'Shopping').length, 1)
  assert.equal(FS.searchGroupsPages(COMMUNITIES, 'entertainment').length, 1)
})

check('গ্রুপ/পেজ খোঁজা — খালি কোয়েরিতে কিছু না, না মিললে খালি', () => {
  assert.deepEqual(FS.searchGroupsPages(COMMUNITIES, ''), [])
  assert.deepEqual(FS.searchGroupsPages(COMMUNITIES, '   '), [])
  assert.deepEqual(FS.searchGroupsPages(COMMUNITIES, 'zzz-কেউ-না'), [])
})

check('ফলের পেজে সব মিল দেখায় — সাজেশনের ৮ সীমা শুধু ড্রপডাউনে', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ id: `u${i}`, name: `রহিম ${i}`, color: '#000', online: true, isFriend: false }))
  assert.equal(FS.searchPeople(many, 'রহিম').length, 20)
  assert.equal(FS.suggestionsFor(many, 'রহিম').length, 8)
})

check('সাম্প্রতিক খোঁজা — নতুন উপরে, ডুপ্লিকেট নয়, সর্বোচ্চ ৮, খালি নয়', () => {
  RS.clearRecentSearches()
  assert.deepEqual(RS.loadRecentSearches(), [])
  RS.saveRecentSearch('রিমা')
  RS.saveRecentSearch('করিম')
  RS.saveRecentSearch('রিমা') // আবার — উপরে উঠে আসে, দুবার নয়
  assert.deepEqual(RS.loadRecentSearches(), ['রিমা', 'করিম'])
  RS.saveRecentSearch('  ') // খালি জমে না
  assert.deepEqual(RS.loadRecentSearches(), ['রিমা', 'করিম'])
  RS.saveRecentSearch('Karim') // ল্যাটিনে একই নাম — কেস ভিন্ন হলেও ডুপ্লিকেট নয় (বাংলা করিম আলাদা নাম)
  assert.deepEqual(RS.loadRecentSearches(), ['Karim', 'রিমা', 'করিম'])
  RS.saveRecentSearch('KARIM') // একই ল্যাটিন নাম, কেস ভিন্ন — উপরে উঠে আসে, দুবার নয়
  assert.deepEqual(RS.loadRecentSearches(), ['KARIM', 'রিমা', 'করিম'])
  for (let i = 0; i < 10; i++) RS.saveRecentSearch(`q${i}`)
  const list = RS.loadRecentSearches()
  assert.equal(list.length, 8)
  assert.equal(list[0], 'q9')
  assert.equal(RS.RECENT_SEARCHES_MAX, 8)
  assert.equal(RS.RECENT_SEARCHES_KEY, 'callguru:recentSearches')
})

check('সাম্প্রতিক খোঁজা — একটা মোছা যায়, সব মোছা যায়', () => {
  RS.clearRecentSearches()
  RS.saveRecentSearch('a'); RS.saveRecentSearch('b'); RS.saveRecentSearch('c')
  assert.deepEqual(RS.removeRecentSearch('b'), ['c', 'a'])
  RS.clearRecentSearches()
  assert.deepEqual(RS.loadRecentSearches(), [])
})

check('/search আর /profile/:id রাউট আছে', () => {
  assert.ok(appSrc.includes('path="/search"'), '/search রাউট নেই')
  assert.ok(appSrc.includes('path="/profile/:id"'), '/profile/:id রাউট নেই')
  assert.ok(appSrc.includes('SearchResultsPage'), 'SearchResultsPage ইমপোর্ট নেই')
  assert.ok(appSrc.includes('UserProfilePage'), 'UserProfilePage ইমপোর্ট নেই')
  assert.ok(appSrc.includes('<Route path="/search" element={<SearchResultsPage />} />'), '/search রাউটে SearchResultsPage নেই')
  assert.ok(appSrc.includes('<Route path="/profile/:id" element={<UserProfilePage />} />'), '/profile রাউটে UserProfilePage নেই')
})

check('হেডার ড্রপডাউন — People / Posts / Pages & Groups সেকশন', () => {
  assert.ok(searchUISrc.includes('> People</p>'), 'People সেকশন নেই')
  assert.ok(searchUISrc.includes('>Posts</p>'), 'Posts সেকশন নেই')
  assert.ok(searchUISrc.includes('>Pages &amp; Groups</p>'), 'Pages & Groups সেকশন নেই')
  assert.ok(searchUISrc.includes('useCommunitySearch'), 'গ্রুপ/পেজ খোঁজার হুক নেই')
  assert.ok(searchUISrc.includes('mutual friends'), 'mutual-friend সংখ্যা দেখানো হয় না')
  assert.ok(searchUISrc.includes('See all results'), 'See all results বোতাম নেই')
})

check('হেডার ড্রপডাউন — কিবোর্ডে চলা যায় (↑ ↓ Enter Esc)', () => {
  assert.ok(searchUISrc.includes("e.key === 'ArrowDown'"), 'ArrowDown নেই')
  assert.ok(searchUISrc.includes("e.key === 'ArrowUp'"), 'ArrowUp নেই')
  assert.ok(searchUISrc.includes("e.key === 'Enter'"), 'Enter নেই')
  assert.ok(searchUISrc.includes("e.key === 'Escape'"), 'Escape নেই')
  assert.ok(searchUISrc.includes('activeIdx'), 'বেছে নেওয়া সারির state নেই')
})

check('হেডার ড্রপডাউন — সাম্প্রতিক খোঁজা (ফোকাসে খালি বাক্সে, একটা/সব মোছা যায়)', () => {
  assert.ok(searchUISrc.includes('Recent searches'), 'Recent searches শিরোনাম নেই')
  assert.ok(searchUISrc.includes('Clear all'), 'Clear all নেই')
  assert.ok(searchUISrc.includes('removeRecentSearch'), 'একটা মোছার কল নেই')
  assert.ok(searchUISrc.includes('clearRecentSearches'), 'সব মোছার কল নেই')
  assert.ok(searchUISrc.includes('loadRecentSearches'), 'সাম্প্রতিক খোঁজা লোড নেই')
  assert.ok(recentSrc.includes("localStorage.getItem(RECENT_SEARCHES_KEY)"), 'localStorage-এ জমে না')
})

check('হেডার ড্রপডাউন — মানুষের ট্যাপে প্রোফাইল, Enter/See-all-এ ফলের পেজ', () => {
  assert.ok(searchUISrc.includes("navigate(`/profile/${encodeURIComponent(p.id)}`)"), 'মানুষের ট্যাপে প্রোফাইলে যায় না')
  assert.ok(searchUISrc.includes("navigate(`/search?q=${encodeURIComponent(q)}`)"), 'ফলের পেজে যায় না (/search?q=)')
  assert.ok(searchUISrc.includes('saveRecentSearch'), 'সার্চ চালালে সাম্প্রতিক খোঁজায় জমে না')
  assert.ok(searchUISrc.includes("navigate(item.kind === 'group' ? `/groups/"), 'গ্রুপ/পেজে ট্যাপে যায় না')
})

check('ফলের পেজ — All / People / Posts / Groups & Pages ট্যাব', () => {
  assert.ok(pagesSrc.includes('export function SearchResultsPage'), 'SearchResultsPage নেই')
  assert.ok(pagesSrc.includes("label: 'All'"), 'All ট্যাব নেই')
  assert.ok(pagesSrc.includes("label: 'People'"), 'People ট্যাব নেই')
  assert.ok(pagesSrc.includes("label: 'Posts'"), 'Posts ট্যাব নেই')
  assert.ok(pagesSrc.includes("label: 'Groups & Pages'"), 'Groups & Pages ট্যাব নেই')
  assert.ok(pagesSrc.includes('useSearchParams'), 'q URL প্যারাম থেকে পড়ে না')
  assert.ok(pagesSrc.includes("params.get('q')"), 'q প্যারাম পড়ে না')
})

check('ফলের পেজ — নামে ট্যাপে প্রোফাইল, Add Friend / Request Sent / Chat', () => {
  assert.ok(pagesSrc.includes("navigate(`/profile/${encodeURIComponent(p.id)}`"), 'ফলে নামে ট্যাপে প্রোফাইল খোলে না')
  assert.ok(pagesSrc.includes('>Add Friend</Btn>'), 'ফলে Add Friend নেই')
  assert.ok(pagesSrc.includes('>Request Sent</Btn>'), 'ফলে Request Sent নেই')
  assert.ok(pagesSrc.includes("navigate('/feed', { state: { postId: p.id } })"), 'ফলে পোস্টে ট্যাপে পোস্টে যায় না')
  assert.ok(pagesSrc.includes("navigate(item.kind === 'group' ? `/groups/"), 'ফলে গ্রুপ/পেজে ট্যাপে যায় না')
})

check('প্রোফাইল পেজ — পারসোনা (about + Chat), আসল ব্যবহারকারী, নিজের প্রোফাইল, না-পাওয়া', () => {
  assert.ok(pagesSrc.includes('export function UserProfilePage'), 'UserProfilePage নেই')
  assert.ok(pagesSrc.includes('getBuddy(decodedId)'), 'পারসোনা প্রোফাইল মেলে না')
  assert.ok(pagesSrc.includes('fetchAllPublicProfiles(100)'), 'আসল ব্যবহারকারীর প্রোফাইল আনে না')
  assert.ok(pagesSrc.includes('This user could not be found.'), 'না-পাওয়া বার্তা নেই')
  assert.ok(pagesSrc.includes('Your ID:'), 'নিজের প্রোফাইলে Your ID নেই')
  assert.ok(pagesSrc.includes('Edit profile'), 'নিজের প্রোফাইলে Edit profile নেই')
  assert.ok(pagesSrc.includes("navigate('/menu')"), 'Edit profile মেনুতে যায় না')
})

check('চ্যাট — হেডারের নাম + মেসেজের নামে ট্যাপে প্রোফাইল খোলে', () => {
  assert.ok(pagesSrc.includes('function openProfile()'), 'openProfile নেই')
  assert.ok(pagesSrc.includes("navigate(`/profile/${encodeURIComponent(activeFriend.id)}`)"), 'চ্যাট থেকে প্রোফাইলে যায় না')
  assert.ok(pagesSrc.includes('<button onClick={openProfile} className="truncate text-left hover:underline"'), 'হেডারের নাম বোতাম নয়')
  assert.ok(pagesSrc.includes('<button onClick={openProfile} className="font-bold hover:underline"'), 'মেসেজের নাম বোতাম নয়')
  assert.ok(pagesSrc.includes("title={`View ${active}'s profile`}"), 'হেডারের নামে প্রোফাইল টাইটেল নেই')
})

check('চ্যাট — পূর্ণ-পর্দা চ্যাট আর ব্যাক-ধাপ ভাঙেনি', () => {
  assert.ok(pagesSrc.includes('function backToList()'), 'backToList নেই')
  assert.ok(pagesSrc.includes("navigate(-1)"), 'ব্যাক-ধাপের হিস্ট্রি ব্যাক নেই')
  assert.ok(pagesSrc.includes("navigate('/chat', { replace: true })"), 'সরাসরি খোলা চ্যাটের ব্যাক নেই')
  assert.ok(pagesSrc.includes('function openChat(name: string)'), 'তালিকা থেকে চ্যাট খোলা নেই')
  assert.ok(pagesSrc.includes("navigate('/chat', { state: { with: name } })"), 'চ্যাট খোলার হিস্ট্রি এন্ট্রি নেই')
  assert.ok(!pagesSrc.includes("navigate(`/profile/${encodeURIComponent(active)}`)"), 'নাম দিয়ে (id ছাড়া) প্রোফাইলে যাওয়ার ভুল পথ আছে')
})

check('নতুন সারফেসে raw Firebase uid দেখানো হয় না — শুধু সংখ্যার UID (ফলব্যাক referralCode)', () => {
  // হেডার ড্রপডাউনের মানুষের সারি + ফলের পেজের সারি: ID সংখ্যার UID আগে, না থাকলে referralCode
  assert.ok(searchUISrc.includes('ID: ${p.numericUid ?? p.referralCode}'), 'হেডার সারিতে সংখ্যার UID-ভিত্তিক ID নেই')
  assert.ok(pagesSrc.includes('ID: ${p.numericUid ?? p.referralCode}'), 'ফলের সারিতে সংখ্যার UID-ভিত্তিক ID নেই')
  // প্রোফাইল পেজ: showId = সংখ্যার UID (আসল) / buddy id (পারসোনা) / নিজের সংখ্যার UID — কখনো raw uid নয়
  assert.ok(pagesSrc.includes("const showId = buddy ? buddy.id : (isSelf ? String(numericUid ?? referralCode) : (profile?.numericUid !== undefined ? String(profile.numericUid) : (profile?.referralCode ?? '')))"), 'প্রোফাইলে সংখ্যার UID-ভিত্তিক ID নেই')
  assert.ok(!pagesSrc.includes('ID: {decodedId}'), 'প্রোফাইলে raw uid দেখানো হয়')
  assert.ok(!pagesSrc.includes('ID: {profile.id}'), 'প্রোফাইলে raw uid দেখানো হয়')
})

check('Friends পেজের খোঁজা আগের মতোই (সাজেশন + ফল + Add Friend)', () => {
  assert.ok(pagesSrc.includes('useAllUserSearch(friends, query)'), 'Friends পেজের খোঁজা নেই')
  assert.ok(pagesSrc.includes('<SearchSuggestions suggestions={suggestions}'), 'Friends পেজের সাজেশন ড্রপডাউন নেই')
  assert.ok(pagesSrc.includes('ID: {p.numericUid ?? p.referralCode ??'), 'Friends পেজের ফলের ID নেই')
})

console.log(`\n${passed}/18 passed`)
