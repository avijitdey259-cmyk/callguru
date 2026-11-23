// Style 6 · Pinterest Blend — visual style checks (no feature logic changed)
// Run: node tests/style6.test.mjs
import { readFileSync, readdirSync } from 'node:fs'
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

let n = 0
function check(name, fn) {
  n++
  try { fn(); console.log(`ok ${n} - ${name}`) }
  catch (e) { console.error(`not ok ${n} - ${name}\n  ${e.message}`); process.exitCode = 1 }
}

// ---------- Design tokens ----------
check('tailwind: primary is violet #7C3AED, page bg is white #FFFFFF', () => {
  assert.ok(tailwind.includes("blue: '#7C3AED'"), 'fb.blue violet নয়')
  assert.ok(tailwind.includes("bg: '#FFFFFF'"), 'fb.bg সাদা নয়')
  assert.ok(tailwind.includes('pb:'), 'pb প্যালেট নেই')
})
check('index.css: story-ring conic gradient + pb-gradient + pb-match + glass', () => {
  assert.ok(css.includes('.story-ring'), '.story-ring নেই')
  assert.ok(css.includes('conic-gradient'), 'conic-gradient নেই')
  assert.ok(css.includes('.pb-gradient'), '.pb-gradient নেই')
  assert.ok(css.includes('linear-gradient(135deg, #7C3AED, #EC4899)'), 'violet→pink gradient নেই')
  assert.ok(css.includes('.pb-match'), '.pb-match নেই')
  assert.ok(css.includes('linear-gradient(135deg, #EC4899, #EF4444)'), 'pink→red match gradient নেই')
  assert.ok(css.includes('.glass'), '.glass নেই')
  assert.ok(css.includes('backdrop-filter: blur'), 'glass blur নেই')
})

// ---------- Header / nav ----------
check('TopBar: gradient logo + gradient-pill active nav (no blue underline)', () => {
  assert.ok(comp.includes('pb-gradient-text'), 'লোগোতে gradient text নেই')
  assert.ok(comp.includes("pb-gradient text-white shadow-sm"), 'active nav gradient pill নয়')
  assert.ok(!comp.includes('border-b-2 border-fb-blue'), 'পুরোনো নীল underline এখনো আছে')
})
check('Btn primary is violet→pink gradient', () => {
  assert.ok(comp.includes("'pb-gradient text-white shadow-sm'"), 'primary Btn gradient নয়')
})

// ---------- Feed ----------
check('Feed: gradient-ring stories (no old w-28 h-44 cards)', () => {
  assert.ok(pages.includes('story-ring'), 'স্টোরিতে story-ring নেই')
  assert.ok(pages.includes('w-[68px] h-[68px] rounded-full'), 'স্টোরি অ্যাভাটার বৃত্তাকার নয়')
  assert.ok(!pages.includes('w-28 h-44'), 'পুরোনো স্টোরি কার্ড এখনো আছে')
})
check('Feed composer: Title + Add location + Share to Public + Boost Post', () => {
  assert.ok(pages.includes('placeholder="Title (optional)"'), 'Title ফিল্ড নেই')
  assert.ok(pages.includes('placeholder="Add location (optional)"'), 'Add location ফিল্ড নেই')
  assert.ok(pages.includes('🌐 Public'), 'Share to Public টগল নেই')
  assert.ok(pages.includes('👥 Friends'), 'Share to Friends টগল নেই')
  assert.ok(pages.includes('🚀 Boost Post (0.1 π)'), 'Boost Post বোতাম নেই')
  assert.ok(pages.includes('Post Boost'), 'Boost চার্জের লেজার এন্ট্রি নেই')
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
  assert.ok(pages.includes('⚙️ Profile Settings'), 'Profile Settings বোতাম নেই')
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
