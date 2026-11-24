// Facebook-এর মতো হোমপেজ + হেডার সার্চ + মোবাইল/কম্পিউটার একই আচরণ টেস্ট।
// চালানো: রিপো রুট থেকে `node tests/facebook-home.test.mjs`
// (সোর্স পড়ে যাচাই — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) হেডার সার্চই আসল সার্চ — লোগোর পাশে, ফিডের নিচে আর বাক্স নেই
//   ২) হেডার সার্চে বন্ধু + পোস্ট সাজেশন (সর্বোচ্চ ৮: বন্ধু ৫ + পোস্ট ৩)
//   ৩) ফিডের ক্রম: ব্যানার → স্টোরি → কম্পোজার → ফল → নতুন সদস্য → পোস্ট
//   ৪) স্টোরি Facebook-এর মতো কার্ড, পোস্টের অ্যাকশন তিন সমান বোতাম
//   ৫) হেডার নেভ মোবাইলেও কম্পিউটারেও একই; নিচে BottomNav আছে (মোবাইল-only)
//   ৬) ওয়ালেট বোতাম সব স্ক্রিনে দেখায়; মোবাইলে সার্চ সারি সবসময় খোলা
//   ৭) সাইডবারের সব লিংক মেনুতেও আছে — ছোট More লিংক তালিকায়, টাইলে নয় (মোবাইলে পৌঁছায়); Marketplace লিংক কোথাও নেই (Services-ই একমাত্র)
//   ৮) Contacts/Sponsored দুই জায়গায় — ডেস্কটপ সাইডবার + মোবাইল ফিড
//   ৯) স্টোরে ফিডের খোঁজা + পোস্ট (হেডার আর ফিড একই অবস্থা দেখে)
//  ১০) চ্যাটে যাওয়া সব জায়গায় একই (হেডার চ্যাট আইকন, Contacts, ফলের সারি)
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const compSrc = readFileSync(join(root, 'src/components.tsx'), 'utf8')
const searchUISrc = readFileSync(join(root, 'src/searchUI.tsx'), 'utf8')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

function feedSpan() {
  const a = pagesSrc.indexOf('export function Feed()')
  const b = pagesSrc.indexOf('// ---------- Marketplace', a)
  assert.ok(a !== -1 && b !== -1, 'Feed ফাংশন পাওয়া যায়নি')
  return pagesSrc.slice(a, b)
}

check('হেডার সার্চই আসল সার্চ — লোগোর পাশে, ফিডের নিচে আর বাক্স নেই', () => {
  assert.ok(compSrc.includes('HeaderSearch'), 'TopBar-এ HeaderSearch নেই')
  const topBar = compSrc.slice(compSrc.indexOf('export function TopBar()'), compSrc.indexOf('export function Sidebar()'))
  assert.ok(topBar.indexOf('PiCall') < topBar.indexOf('<HeaderSearch />'), 'লোগোর পাশে সার্চ নেই')
  assert.ok(searchUISrc.includes('export function HeaderSearch'), 'searchUI-তে HeaderSearch নেই')
  // 'Find Friends' এখন শুধু Friends পেজে ১ বার (ফিডের কার্ড সরানো হয়েছে)
  const count = (pagesSrc.match(/Find Friends/g) || []).length
  assert.equal(count, 1, `Find Friends ${count} বার — Friends পেজে ১ বার হওয়ার কথা`)
  assert.ok(!feedSpan().includes('Find Friends'), 'ফিডে এখনো সার্চ কার্ড আছে')
})

check('হেডার সার্চে বন্ধু + পোস্ট সাজেশন (বন্ধু ৫ + পোস্ট ৩)', () => {
  assert.ok(searchUISrc.includes("searchPosts(posts, feedQuery).slice(0, 3)"), 'পোস্ট সাজেশন ৩টি নয়')
  assert.ok(searchUISrc.includes('suggestions.slice(0, 5)'), 'বন্ধু সাজেশন ৫টি নয়')
  assert.ok(searchUISrc.includes('IconFriends'), 'বন্ধু সেকশনে আইকন নেই')
  assert.ok(searchUISrc.includes('> Friends</p>'), 'বন্ধু সেকশন নেই')
  assert.ok(searchUISrc.includes('>Post</p>'), 'পোস্ট সেকশন নেই')
  assert.ok(searchUISrc.includes('See all results'), 'সব-ফলাফল বোতাম নেই')
  assert.ok(searchUISrc.includes("setShowSugg(false)"), 'ট্যাপে ড্রপডাউন লুকায় না')
  assert.ok(searchUISrc.includes("e.key === 'Enter'"), 'Enter-এ খোঁজা যায় না')
})

check('ফিডের ক্রম: ব্যানার → স্টোরি → কম্পোজার → ফল → নতুন সদস্য → পোস্ট', () => {
  const f = feedSpan()
  const idx = (s) => {
    const i = f.indexOf(s)
    assert.ok(i !== -1, `ফিডে ${s} নেই`)
    return i
  }
  const order = [
    idx('🎁 Install the app and get 5 π free!'),
    idx('Add your story'),
    idx("What's on your mind?"),
    idx('Friends ('),
    idx('<NewMembersSection />'),
    idx('visiblePosts.map('),
  ]
  for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `ফিডের ক্রম ভুল: ${order}`)
})

check('স্টোরি Style 6 গ্রেডিয়েন্ট-রিং অ্যাভাটার, পোস্টের অ্যাকশন তিন সমান বোতাম', () => {
  const f = feedSpan()
  assert.ok(f.includes('story-ring'), 'স্টোরি গ্রেডিয়েন্ট রিং নেই')
  assert.ok(f.includes('w-[68px] h-[68px] rounded-full'), 'স্টোরি অ্যাভাটার বৃত্তাকার নয়')
  assert.ok(!f.includes('w-28 h-44'), 'পুরোনো স্টোরি কার্ড এখনো আছে')
  assert.ok(f.includes('flex-1 py-1.5 rounded-lg hover:bg-gray-100'), 'পোস্ট অ্যাকশন তিন সমান বোতাম নয়')
  assert.ok(f.includes('Comments ('), 'কমেন্ট বোতাম নেই')
  assert.ok(f.includes('Share ('), 'শেয়ার বোতাম নেই')
})

check('হেডার নেভ মোবাইলেও কম্পিউটারেও একই; নিচে BottomNav আছে (মোবাইল-only)', () => {
  assert.ok(compSrc.includes('BottomNav'), 'BottomNav নেই')
  assert.ok(compSrc.includes('fixed bottom-0'), 'নিচের নেভ বার নেই')
  assert.ok(compSrc.includes('<BottomNav />'), 'Layout-এ BottomNav নেই')
  for (const r of ['/feed', '/friends', '/reels', '/dating', '/live-tv']) {
    assert.ok(compSrc.includes(`to: '${r}'`), `নেভে ${r} নেই`)
  }
  // কম্পিউটারে হেডারের মাঝে; মোবাইলে হেডারের নিচের ট্যাব সারি সরিয়ে BottomNav
  assert.ok(compSrc.includes('hidden md:flex flex-1 justify-center'), 'কম্পিউটারের মাঝের নেভ নেই')
  assert.ok(!compSrc.includes('md:hidden border-t'), 'মোবাইলের পুরোনো ট্যাব সারি এখনো আছে')
})

check('ওয়ালেট বোতাম সব স্ক্রিনে দেখায়; মোবাইলে সার্চ সারি সবসময় খোলা', () => {
  const m = compSrc.match(/<button onClick=\{\(\) => navigate\('\/wallet'\)\} className="([^"]*)"/)
  assert.ok(m, 'ওয়ালেট বোতাম নেই')
  assert.ok(!m[1].includes('hidden'), 'ওয়ালেট বোতাম মোবাইলে লুকানো')
  assert.ok(!compSrc.includes('mobileSearchOpen'), 'মোবাইল সার্চ টগল এখনো আছে')
  assert.ok(compSrc.includes('md:hidden px-3 pb-2'), 'মোবাইলে সবসময়-খোলা সার্চ সারি নেই')
})

check('সাইডবারের সব লিংক মেনুতেও আছে — ছোট More লিংক তালিকায়, টাইলে নয় (মোবাইলে পৌঁছায়)', () => {
  const sidebar = compSrc.slice(compSrc.indexOf('export function Sidebar()'), compSrc.indexOf('export function SponsoredCard'))
  const menu = pagesSrc.slice(pagesSrc.indexOf('export function MenuPage()'))
  const tos = (s) => [...s.matchAll(/to: '([^']+)'/g)].map(x => x[1])
  const sideLinks = tos(sidebar)
  assert.ok(sideLinks.length >= 10, `সাইডবার লিংক ${sideLinks.length}টি — কম`)
  for (const to of sideLinks) {
    if (to === '/menu') continue // সেটিংস = মেনু পেজ নিজেই; মোবাইলে প্রোফাইল অ্যাভাটারে চাপলে যায়
    assert.ok(tos(menu).includes(to), `মেনুতে ${to} নেই — মোবাইলে পৌঁছায় না`)
  }
  // মেনুর নেভিগেশন ছোট লাইন-লিংকের More তালিকা — টাইল/কার্ড গ্রিড নয়
  assert.ok(menu.includes('const moreLinks = ['), 'মেনুতে moreLinks তালিকা নেই')
  assert.ok(menu.includes('<h2 className="font-bold">More</h2>'), 'মেনুতে More শিরোনাম নেই')
  assert.ok(!menu.includes('grid grid-cols-2 gap-3'), 'মেনুতে পুরোনো টাইল গ্রিড এখনো আছে')
  // Marketplace আর Services একই জিনিস — নেভিগেশনে শুধু Services, Marketplace লিংক কোথাও নেই
  assert.ok(!tos(menu).includes('/marketplace'), 'মেনুতে Marketplace লিংক এখনো আছে')
  assert.ok(!tos(sidebar).includes('/marketplace'), 'সাইডবারে Marketplace লিংক এখনো আছে')
  assert.ok(tos(menu).includes('/services'), 'মেনুতে Services লিংক নেই')
  // User product ads (self-serve): Ads link in Sidebar + Menu, real AdsPage form —
  // photo, title, description, price, website link; submit saves PENDING for
  // admin review. No invented reach, no payment yet. (Adsterra is separate.)
  assert.ok(tos(menu).includes('/ads'), 'মেনুতে Ads লিংক নেই')
  assert.ok(tos(sidebar).includes('/ads'), 'সাইডবারে Ads লিংক নেই')
  assert.ok(pagesSrc.includes('export function AdsPage()'), 'AdsPage ফর্ম নেই')
  // মেনু পেজে যাওয়া: হেডারের প্রোফাইল অ্যাভাটার + সাইডবারের প্রোফাইল কার্ড
  assert.ok(compSrc.includes("navigate('/menu')"), 'হেডার অ্যাভাটার মেনুতে যায় না')
  assert.ok(compSrc.includes('to="/menu"'), 'সাইডবার প্রোফাইল মেনুতে যায় না')
})

check('Contacts/Sponsored দুই জায়গায় — ডেস্কটপ সাইডবার + মোবাইল ফিড', () => {
  assert.ok(compSrc.includes('export function SponsoredCard'), 'SponsoredCard নেই')
  assert.ok(compSrc.includes('export function ContactsCard'), 'ContactsCard নেই')
  assert.ok(compSrc.includes('<SponsoredCard />') && compSrc.includes('<ContactsCard />'), 'ডান সাইডবারে কার্ড নেই')
  const f = feedSpan()
  assert.ok(f.includes('lg:hidden'), 'ফিডে মোবাইলের কার্ড ব্লক নেই')
  assert.ok(f.includes('<ContactsCard />') && f.includes('<SponsoredCard />'), 'ফিডের নিচে কার্ড নেই')
})

check('স্টোরে ফিডের খোঁজা + পোস্ট (হেডার আর ফিড একই অবস্থা দেখে)', () => {
  assert.ok(storeSrc.includes('feedQuery: string'), 'feedQuery নেই')
  assert.ok(storeSrc.includes('setFeedQuery: (q: string) => void'), 'setFeedQuery নেই')
  assert.ok(storeSrc.includes('posts: Post[]'), 'posts নেই')
  assert.ok(storeSrc.includes('setPosts: React.Dispatch<React.SetStateAction<Post[]>>'), 'setPosts ফাংশন-আপডেট নেয় না')
  assert.ok(pagesSrc.includes('feedQuery: query, setFeedQuery: setQuery'), 'ফিড স্টোরের কোয়েরি ব্যবহার করে না')
})

check('চ্যাটে যাওয়া সব জায়গায় একই', () => {
  assert.ok(compSrc.includes("navigate('/chat')"), 'হেডারের চ্যাট বোতাম চ্যাটে যায় না')
  assert.ok(compSrc.includes("navigate('/chat', { state: { with: f.name } })"), 'Contacts থেকে চ্যাটে যায় না')
  assert.ok(pagesSrc.includes("navigate('/chat', { state: { with: p.name } })"), 'খোঁজার ফল থেকে চ্যাটে যায় না')
})

check('কোনো নতুন ডেমো/ভুয়া ডেটা নেই', () => {
  assert.ok(!pagesSrc.includes('SEED_POSTS'), 'pages-এ SEED_POSTS ফিরে এসেছে')
  assert.ok(!compSrc.includes('SEED_'), 'components-এ সিড ডেটা আছে')
  assert.ok(!searchUISrc.includes('SEED_'), 'searchUI-তে সিড ডেটা আছে')
})

console.log(`\n${passed}/11 passed`)
