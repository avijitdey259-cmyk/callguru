// Style 6 · Pinterest Blend + UI refresh (Pi purple → gold, filled icon set,
// BottomNav, notification bell, always-open mobile search) — visual style checks.
// Run: node tests/style6.test.mjs
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const pages = read('src/pages.tsx')
const comp = read('src/components.tsx')
const css = read('src/index.css')
const tailwind = read('tailwind.config.js')
const data = read('src/data.ts')
const icons = read('src/icons.tsx')
const searchUI = read('src/searchUI.tsx')

let n = 0
function check(name, fn) {
  n++
  try { fn(); console.log(`ok ${n} - ${name}`) }
  catch (e) { console.error(`not ok ${n} - ${name}\n  ${e.message}`); process.exitCode = 1 }
}

// ---------- Design tokens (UI refresh: Pi purple → gold) ----------
check('tailwind: primary is violet #7C3AED, page bg is white #FFFFFF, pi gold #F59E0B', () => {
  assert.ok(tailwind.includes("blue: '#7C3AED'"), 'fb.blue violet নয়')
  assert.ok(tailwind.includes("bg: '#FFFFFF'"), 'fb.bg সাদা নয়')
  assert.ok(tailwind.includes('pb:'), 'pb প্যালেট নেই')
  assert.ok(tailwind.includes("gold: '#F59E0B'"), 'pi.gold নেই')
  assert.ok(tailwind.includes("purple: '#7C3AED'"), 'pi.purple নেই')
  assert.ok(tailwind.includes("deep: '#D97706'"), 'pi.deep নেই')
})
check('index.css: story-ring conic gradient + violet→gold pb-gradient + pb-match + glass', () => {
  assert.ok(css.includes('.story-ring'), '.story-ring নেই')
  assert.ok(css.includes('conic-gradient'), 'conic-gradient নেই')
  assert.ok(css.includes('.pb-gradient'), '.pb-gradient নেই')
  assert.ok(css.includes('linear-gradient(135deg, #7C3AED, #F59E0B)'), 'violet→gold gradient নেই')
  assert.ok(!css.includes('linear-gradient(135deg, #7C3AED, #EC4899)'), 'পুরোনো violet→pink gradient এখনো আছে')
  assert.ok(css.includes('.pb-match'), '.pb-match নেই')
  assert.ok(css.includes('linear-gradient(135deg, #EC4899, #EF4444)'), 'pink→red match gradient নেই')
  assert.ok(css.includes('.glass'), '.glass নেই')
  assert.ok(css.includes('backdrop-filter: blur'), 'glass blur নেই')
})

// ---------- Icon set ----------
check('icons.tsx: filled-rounded icon set (all refresh icons exported)', () => {
  for (const name of ['IconHome', 'IconFriends', 'IconReels', 'IconDating', 'IconLiveTV', 'IconChat', 'IconWallet', 'IconSearch', 'IconBell', 'IconMoon', 'IconSun', 'IconDownload', 'IconSettings', 'IconShield', 'IconStore', 'IconHistory', 'IconMegaphone', 'IconBriefcase', 'IconCall', 'IconPhoto', 'IconVideo', 'IconImage', 'IconShare', 'IconExpand', 'IconSend', 'IconClose', 'IconPlus', 'IconSparkle', 'IconChevronLeft', 'IconUser']) {
    assert.ok(icons.includes(`export function ${name}`), `${name} নেই`)
  }
  assert.ok(icons.includes('fill="currentColor"'), 'filled renderer নেই')
  assert.ok(icons.includes('strokeWidth={2.2}'), 'stroked renderer নেই')
})

// ---------- Header / nav ----------
check('TopBar: gradient logo + gradient-pill active nav (no blue underline)', () => {
  assert.ok(comp.includes('pb-gradient-text'), 'লোগোতে gradient text নেই')
  assert.ok(comp.includes("pb-gradient text-white shadow-sm"), 'active nav gradient pill নয়')
  assert.ok(!comp.includes('border-b-2 border-fb-blue'), 'পুরোনো নীল underline এখনো আছে')
})
check('TopBar: notification bell with gold badge → /friends', () => {
  assert.ok(comp.includes('IconBell'), 'ঘণ্টা আইকন নেই')
  assert.ok(comp.includes('bg-pi-gold'), 'সোনালি ব্যাজ নেই')
  assert.ok(comp.includes('requests.length'), 'ব্যাজে অনুরোধের সংখ্যা নেই')
  assert.ok(comp.includes("navigate('/friends')"), 'ঘণ্টা Friends-এ যায় না')
})
check('TopBar: dark toggle is Moon/Sun icons, Messenger is chat icon, install is download icon', () => {
  assert.ok(comp.includes('IconSun') && comp.includes('IconMoon'), 'Moon/Sun আইকন নেই')
  assert.ok(comp.includes('<IconChat'), 'চ্যাট আইকন নেই')
  assert.ok(comp.includes('<IconDownload'), 'ডাউনলোড আইকন নেই')
  assert.ok(!comp.includes('☀️') && !comp.includes('🌙'), 'পুরোনো emoji টগল এখনো আছে')
  assert.ok(!comp.includes('💬') && !comp.includes('📲') && !comp.includes('👤'), 'TopBar-এ পুরোনো emoji এখনো আছে')
})
check('Mobile search is an always-visible full-width row under the header', () => {
  assert.ok(comp.includes('md:hidden px-3 pb-2'), 'মোবাইল সার্চ সারি নেই')
  assert.ok(!comp.includes('mobileSearchOpen'), 'সার্চ টগল এখনো আছে — সবসময় খোলা থাকার কথা')
})
check('BottomNav exists (mobile only, 5 destinations, gradient active pill) and Layout mounts it', () => {
  assert.ok(comp.includes('export function BottomNav'), 'BottomNav নেই')
  assert.ok(comp.includes('fixed bottom-0'), 'BottomNav নিচে fixed নয়')
  assert.ok(comp.includes('md:hidden fixed bottom-0'), 'BottomNav মোবাইল-only নয়')
  assert.ok(comp.includes('<BottomNav />'), 'Layout-এ BottomNav নেই')
  assert.ok(comp.includes('pb-20 md:pb-8'), 'নিচের প্যাডিং pb-20 নয়')
})
check('Sidebar labels are icon + text (no emoji labels)', () => {
  const side = comp.slice(comp.indexOf('export function Sidebar()'), comp.indexOf('export function SponsoredCard'))
  assert.ok(side.includes('IconHome') && side.includes('IconFriends') && side.includes('IconWallet'), 'সাইডবার আইকন নেই')
  for (const e of ['📰', '👥', '❤️', '📺', '💰', '🏠', '🎬', '📢', '📞', '⚙️', '🛡️']) {
    assert.ok(!side.includes(e), `সাইডবারে ${e} এখনো আছে`)
  }
})
check('Btn primary is violet→gold gradient', () => {
  assert.ok(comp.includes("'pb-gradient text-white shadow-sm'"), 'primary Btn gradient নয়')
})

// ---------- No emoji in chrome ----------
check('Chrome-এ emoji নেই (CENTER_NAV / TopBar / HeaderSearch)', () => {
  const nav = comp.slice(comp.indexOf('const CENTER_NAV'), comp.indexOf('export function TopBar()'))
  for (const e of ['🏠', '👥', '▶️', '❤️', '📺']) assert.ok(!nav.includes(e), `CENTER_NAV-এ ${e} এখনো আছে`)
  const top = comp.slice(comp.indexOf('export function TopBar()'), comp.indexOf('export function BottomNav'))
  for (const e of ['🔍', '☀️', '🌙', '💬', '📲', '👤']) assert.ok(!top.includes(e), `TopBar-এ ${e} এখনো আছে`)
  for (const e of ['🔍', '👥', '📝']) assert.ok(!searchUI.includes(e), `searchUI-তে ${e} এখনো আছে`)
  assert.ok(searchUI.includes('<IconSearch'), 'HeaderSearch-এ IconSearch নেই')
})

// ---------- Feed ----------
check('Feed install banner uses pb-gradient class (no inline pink gradient)', () => {
  assert.ok(pages.includes('rounded-xl p-4 text-white shadow-sm pb-gradient'), 'ইন্সটল ব্যানারে pb-gradient নেই')
  assert.ok(!pages.includes("linear-gradient(135deg, #7C3AED, #EC4899)"), 'ইনলাইন গোলাপি গ্রেডিয়েন্ট এখনো আছে')
})
check('Feed: gradient-ring stories (no old w-28 h-44 cards)', () => {
  assert.ok(pages.includes('story-ring'), 'স্টোরিতে story-ring নেই')
  assert.ok(pages.includes('w-[68px] h-[68px] rounded-full'), 'স্টোরি অ্যাভাটার বৃত্তাকার নয়')
  assert.ok(!pages.includes('w-28 h-44'), 'পুরোনো স্টোরি কার্ড এখনো আছে')
  assert.ok(pages.includes('<IconPlus'), 'Your Story-তে Plus আইকন নেই')
})
check('Feed composer: Title + Add location + Share to Public + Boost Post + photo/video icons', () => {
  assert.ok(pages.includes('placeholder="Title (optional)"'), 'Title ফিল্ড নেই')
  assert.ok(pages.includes('placeholder="Add location (optional)"'), 'Add location ফিল্ড নেই')
  assert.ok(pages.includes('🌐 Public'), 'Share to Public টগল নেই')
  assert.ok(pages.includes('👥 Friends'), 'Share to Friends টগল নেই')
  assert.ok(pages.includes('🚀 Boost Post (0.1 π)'), 'Boost Post বোতাম নেই')
  assert.ok(pages.includes('Post Boost'), 'Boost চার্জের লেজার এন্ট্রি নেই')
  assert.ok(pages.includes('<IconPhoto'), 'কম্পোজারে Photo আইকন নেই')
  assert.ok(pages.includes('<IconVideo'), 'কম্পোজারে Video আইকন নেই')
  assert.ok(pages.includes('<IconImage'), 'কম্পোজারে Image আইকন নেই')
})
check('Feed: filter chips All / Liked / Mine filter visiblePosts', () => {
  assert.ok(pages.includes("setFeedFilter"), 'feedFilter নেই')
  assert.ok(pages.includes("'All'"), 'All চিপ নেই')
  assert.ok(pages.includes("'Liked'"), 'Liked চিপ নেই')
  assert.ok(pages.includes("'Mine'"), 'Mine চিপ নেই')
  assert.ok(pages.includes('visiblePosts.map('), 'visiblePosts রেন্ডার নেই')
})
check('Post type carries title / location / audience / boosted', () => {
  assert.ok(data.includes('title?: string'), 'Post.title নেই')
  assert.ok(data.includes('location?: string'), 'Post.location নেই')
  assert.ok(data.includes("audience?: 'Public' | 'Friends'"), 'Post.audience নেই')
  assert.ok(data.includes('boosted?: boolean'), 'Post.boosted নেই')
  assert.ok(pages.includes('🚀 Boosted'), 'Boosted ব্যাজ নেই')
})
check('Feed: New Members heading has sparkle icon; search headings use icons', () => {
  assert.ok(pages.includes('<IconSparkle'), 'New Members-এ sparkle আইকন নেই')
  assert.ok(pages.includes('New Members</h2>'), 'New Members শিরোনাম নেই')
  assert.ok(pages.includes('<IconFriends'), 'খোঁজার Friends শিরোনামে আইকন নেই')
  assert.ok(pages.includes('<IconSearch'), 'Find Friends-এ সার্চ আইকন নেই')
})
check('Post actions: Comments + Share use icons (reactions/location/audience untouched)', () => {
  assert.ok(pages.includes('Comments ('), 'Comments বোতাম নেই')
  assert.ok(pages.includes('Share ('), 'Share বোতাম নেই')
  assert.ok(pages.includes('<IconChat'), 'Comments-এ চ্যাট আইকন নেই')
  assert.ok(pages.includes('<IconShare'), 'Share-এ শেয়ার আইকন নেই')
  assert.ok(pages.includes('📍'), 'পোস্টের 📍 location মুছে গেছে')
  assert.ok(pages.includes('🌐 Public'), 'Public লেবেল মুছে গেছে')
  assert.ok(pages.includes('🚀 Boosted'), 'Boosted ব্যাজ মুছে গেছে')
})

// ---------- Wallet / Friends / Chat / Live TV ----------
check('Wallet: balance is gradient text, Pi Wallet + Top Up use icons, Pi Wallet first', () => {
  assert.ok(pages.includes('pb-gradient-text'), 'ব্যালেন্সে gradient text নেই')
  assert.ok(pages.includes('<IconWallet'), 'Pi Wallet-এ wallet আইকন নেই')
  assert.ok(pages.includes('Pi Wallet</h2>'), 'Pi Wallet শিরোনাম নেই')
  assert.ok(pages.includes('<IconPlus'), 'Top Up-এ plus আইকন নেই')
  assert.ok(pages.includes('Top Up</h2>'), 'Top Up শিরোনাম নেই')
  assert.ok(pages.indexOf('Pi Wallet</h2>') < pages.indexOf('Top Up</h2>'), 'Pi Wallet উপরে নেই')
})
check('Friends headings use Friends/Search icons; Call History uses call icon', () => {
  assert.ok(pages.includes('Friends</h1>'), 'Friends শিরোনাম নেই')
  assert.ok(pages.includes('Find Friends</h2>'), 'Find Friends শিরোনাম নেই')
  assert.ok(pages.includes('<IconCall'), 'Call History-তে call আইকন নেই')
  assert.ok(pages.includes('Call History</h1>'), 'Call History শিরোনাম নেই')
})
check('Chat heading uses chat icon; sound toggle has no emoji (text kept)', () => {
  assert.ok(pages.includes('Chat — completely free</h2>'), 'Chat শিরোনাম নেই')
  assert.ok(pages.includes('Sound on — tap to turn off'), 'সাউন্ড টগল লেখা নেই')
  assert.ok(!pages.includes('🔔 Sound on'), 'সাউন্ড টগলে 🔔 এখনো আছে')
  assert.ok(!pages.includes('🔕 Sound off'), 'সাউন্ড টগলে 🔕 এখনো আছে')
})
check('Live TV: no "Free with Ads" label; heading + fallback + Full Screen + Share use icons', () => {
  assert.ok(!pages.includes('Free with Ads'), 'Free with Ads লেবেল এখনো আছে')
  assert.ok(!pages.includes('free with ads'), 'free with ads লেখা এখনো আছে')
  assert.ok(pages.includes('Live TV</h1>'), 'Live TV শিরোনাম নেই')
  assert.ok(pages.includes('<IconLiveTV'), 'Live TV-তে TV আইকন নেই')
  assert.ok(pages.includes('<IconExpand'), 'Full Screen-এ expand আইকন নেই')
  assert.ok(pages.includes('Full Screen'), 'Full Screen লেখা নেই')
  assert.ok(pages.includes('Share TV'), 'Share TV লেখা নেই')
})
check('Reels headings/cards use Reels icon, Share uses share icon', () => {
  assert.ok(pages.includes('<IconReels'), 'Reels-এ reels আইকন নেই')
  assert.ok(pages.includes('Reels & Monetization</h1>'), 'Reels শিরোনাম নেই')
  assert.ok(pages.includes('Share</span>'), 'Reels Share বোতাম নেই')
})
check('Dating KYC heading uses shield icon; Menu Profile Settings uses settings icon', () => {
  assert.ok(pages.includes('<IconShield'), 'KYC-তে shield আইকন নেই')
  assert.ok(pages.includes('Dating KYC — Do It Once Only</h1>'), 'KYC শিরোনাম নেই')
  assert.ok(pages.includes('<IconSettings'), 'Profile Settings-এ settings আইকন নেই')
  assert.ok(pages.includes('Profile Settings</h2>'), 'Profile Settings শিরোনাম নেই')
})
check('No "Pi Testnet" UI label anywhere (data field piTestnetAddress stays, asserted elsewhere)', () => {
  assert.ok(!pages.includes('Pi Testnet'), 'Pi Testnet লেবেল এখনো আছে')
  assert.ok(!comp.includes('Pi Testnet'), 'components-এ Pi Testnet আছে')
})

// ---------- Dating ----------
check('Dating: dark full-bleed cards with Same-district badge + X pass', () => {
  assert.ok(data.includes('compat?: number'), 'DatingProfile.compat নেই')
  assert.ok(pages.includes('Same district'), 'Same district ব্যাজ নেই')
  assert.ok(pages.includes('bg-gradient-to-t from-black/80'), 'dark full-bleed overlay নেই')
  assert.ok(pages.includes('aria-label="Pass"'), 'X pass বোতাম নেই')
  assert.ok(pages.includes('setDismissed'), 'dismissed state নেই')
})
check("Match panel: pink→red gradient + 'Say something nice' + reaction pills + Send", () => {
  assert.ok(pages.includes('!pb-match'), 'match panel pb-match নয়')
  assert.ok(pages.includes("It's a Match!"), "It's a Match! নেই")
  assert.ok(pages.includes('placeholder="Say something nice"'), 'Say something nice বক্স নেই')
  for (const r of ['👋', '😊', '❤️']) assert.ok(pages.includes(`'${r}'`), `reaction pill ${r} নেই`)
  assert.ok(pages.includes('💬 Send message'), 'Send message বোতাম নেই')
  assert.ok(pages.includes("navigate('/chat', { state: { with: matched, draft: matchMsg } })"), 'match draft চ্যাটে যায় না')
})
check('ChatPage pre-fills the match message draft', () => {
  assert.ok(pages.includes("if (st?.draft) setDraft(st.draft)"), 'draft pre-fill নেই')
})

// ---------- Live / video glass ----------
check('Call + Live: floating glass controls and panels', () => {
  assert.ok(pages.includes('text-xs glass px-2 py-1 rounded-full'), 'টাইমার চিপ glass নয়')
  assert.ok(pages.includes('glass rounded-xl p-2 mb-3'), 'চ্যাট/গিফট প্যানেল glass নয়')
  assert.ok(pages.includes("glass hover:bg-white/25 rounded-lg"), 'গিফট বোতাম glass নয়')
  assert.ok(pages.includes("className=\"w-14 h-14 rounded-full glass text-2xl\""), 'কল বোতাম glass নয়')
  assert.ok(pages.includes("'pb-gradient' : 'glass'"), 'শেয়ার বোতাম active gradient নয়')
})

// ---------- Profile card ----------
check('MenuPage profile card: Profile Settings + stats + Activity feed', () => {
  assert.ok(pages.includes('Profile Settings'), 'Profile Settings বোতাম নেই')
  assert.ok(pages.includes('ProfileSettingsForm'), 'ProfileSettingsForm নেই')
  assert.ok(pages.includes('Save Profile'), 'Save Profile বোতাম নেই')
  assert.ok(pages.includes('>Friends</p>'), 'Friends stat নেই')
  assert.ok(pages.includes('>Posts</p>'), 'Posts stat নেই')
  assert.ok(pages.includes('>Pi balance</p>'), 'Pi balance stat নেই')
  assert.ok(pages.includes('<h2 className="font-bold">Activity</h2>'), 'Activity feed নেই')
  assert.ok(pages.includes('No activity yet'), 'Activity empty state নেই')
})

// ---------- No Facebook-blue left in UI chrome ----------
check('UI chrome-এ #1877F2 নেই (persona/avatar রঙ data ফাইলে থাকতে পারে)', () => {
  for (const f of ['src/pages.tsx', 'src/components.tsx', 'src/index.css', 'tailwind.config.js']) {
    assert.ok(!read(f).includes('#1877F2'), `${f}-এ #1877F2 এখনো আছে`)
  }
  assert.ok(!pages.includes('bg-blue-100'), 'bg-blue-100 এখনো আছে')
  assert.ok(!pages.includes('bg-blue-50'), 'bg-blue-50 এখনো আছে')
})

console.log(`\nstyle6: ${n} checks, ${process.exitCode ? 'FAILED' : 'all passed'}`)
