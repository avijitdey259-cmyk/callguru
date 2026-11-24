// হোমপেজ UI রিফ্রেশ (2026-11-24 অনুমোদিত ডিজাইন) — Item 2 রিগ্রেশন টেস্ট।
// চালানো: রিপো রুট থেকে `node tests/home-refresh.test.mjs`
// (সোর্স পড়ে যাচাই — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) ফিডের ক্রম: ব্যানার → স্টোরি ("Add your story") → কম্পোজার → ফল → নতুন সদস্য → পোস্ট
//   ২) ফিডে Live TV কার্ড নেই, রিলস স্ট্রিপ নেই ("No reels yet." নেই), ডেইলি বোনাস /
//      রেফারেল InviteCard / লিডারবোর্ড নেই — সেগুলো Wallet / Dating Live-এ থাকে
//   ৩) স্টোরিতে ভুয়া ক্যাপশন নেই (আগাম লেখা ডেমো লাইন সরানো)
//   ৪) স্টোরি রিং Pi purple → gold (Instagram গ্রেডিয়েন্ট নয়); theme-color Pi purple
//   ৫) New Members খালি অবস্থায় রেফারেল লিংক নেই; শুধু আসল ব্যবহারকারী
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (f) => readFileSync(join(root, f), 'utf8')
const pages = read('src/pages.tsx')
const css = read('src/index.css')
const html = read('index.html')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

function feedSpan() {
  const a = pages.indexOf('export function Feed()')
  const b = pages.indexOf('// ---------- Marketplace', a)
  assert.ok(a !== -1 && b !== -1, 'Feed ফাংশন পাওয়া যায়নি')
  return pages.slice(a, b)
}

check('ফিডের ক্রম: ব্যানার → Add your story → কম্পোজার → ফল → নতুন সদস্য → পোস্ট', () => {
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
  assert.ok(!f.includes('Your Story'), 'পুরোনো "Your Story" লেবেল এখনো আছে')
})

check('ফিডে Live TV প্রোমো কার্ড নেই', () => {
  const f = feedSpan()
  assert.ok(!f.includes('Live TV — Free!'), 'ফিডে Live TV কার্ড এখনো আছে')
  assert.ok(!f.includes('Watch Now'), 'ফিডে Watch Now বোতাম এখনো আছে')
  assert.ok(!f.includes('linear-gradient(135deg, #0F2027'), 'ফিডে অফ-প্যালেট টিল গ্রেডিয়েন্ট এখনো আছে')
  // Live TV পেজ নিজে অটুট — শুধু ফিড থেকে সরেছে
  assert.ok(pages.includes('export function LiveTV()'), 'LiveTV পেজ নেই')
})

check('ফিডে রিলস স্ট্রিপ নেই (খালি "No reels yet." নয়)', () => {
  const f = feedSpan()
  assert.ok(!f.includes('No reels yet.'), 'ফিডে "No reels yet." এখনো আছে')
  assert.ok(!f.includes('{REELS.length'), 'ফিডে রিলস স্ট্রিপ এখনো আছে')
  // Reels পেজ নিজে অটুট
  assert.ok(pages.includes('export function ReelsPage()'), 'ReelsPage নেই')
})

check('ফিডে Daily Bonus / InviteCard / Leaderboard নেই — Wallet / Dating Live-এ থাকে', () => {
  const f = feedSpan()
  for (const bad of ['<DailyBonusCard />', '<InviteCard />', '<LeaderboardCard />']) {
    assert.ok(!f.includes(bad), `ফিডে ${bad} এখনো আছে`)
  }
  const wallet = pages.slice(pages.indexOf('export function WalletPage()'), pages.indexOf('// ---------- Friends'))
  assert.ok(wallet.includes('<DailyBonusCard />'), 'DailyBonusCard Wallet-এ নেই')
  assert.ok(wallet.includes('<InviteCard />'), 'InviteCard Wallet-এ নেই')
  const dating = pages.slice(pages.indexOf('export function DatingPage()'), pages.indexOf('export function DatingLivePage()'))
  assert.ok(dating.includes('<LeaderboardCard />'), 'LeaderboardCard Dating-এ নেই')
})

check('স্টোরিতে ভুয়া ক্যাপশন নেই', () => {
  assert.ok(!pages.includes('STORY_CAPTIONS'), 'STORY_CAPTIONS এখনো আছে')
  assert.ok(!pages.includes('STORY_CAPTION_FALLBACK'), 'STORY_CAPTION_FALLBACK এখনো আছে')
  for (const bad of ['Something fun is going to happen', 'Take care, everyone', 'Learned something new today', "Heard today's song", 'A dreamy day today', 'Have a beautiful day today']) {
    assert.ok(!pages.includes(bad), `ভুয়া স্টোরি ক্যাপশন এখনো আছে: ${bad}`)
  }
})

check('স্টোরি রিং Pi purple → gold; theme-color Pi purple', () => {
  assert.ok(css.includes('.story-ring'), '.story-ring নেই')
  assert.ok(css.includes('conic-gradient(from 210deg, #7C3AED, #F59E0B, #7C3AED)'), 'স্টোরি রিং purple→gold নয়')
  for (const bad of ['#FEDA75', '#FA7E1E', '#D62976', '#962FBF', '#4F5BD5']) {
    assert.ok(!css.includes(bad), `Instagram রিং রং এখনো আছে: ${bad}`)
  }
  assert.ok(html.includes('<meta name="theme-color" content="#7C3AED" />'), 'theme-color Pi purple নয়')
  assert.ok(!html.includes('#1877F2'), 'index.html-এ Facebook নীল এখনো আছে')
})

check('New Members খালি অবস্থায় রেফারেল লিংক নেই; শুধু আসল ব্যবহারকারী', () => {
  const start = pages.indexOf('function NewMembersSection()')
  const end = pages.indexOf('// ---------- Feed ----------', start)
  const body = pages.slice(start, end)
  assert.ok(body.includes('fetchNewMembers(10)'), 'NewMembersSection fetch করে না')
  assert.ok(body.includes('Nobody new has joined yet — invite your friend!'), 'খালি অবস্থার লাইন নেই')
  assert.ok(!body.includes('Your link:'), 'New Members-এ রেফারেল লিংক এখনো আছে')
  assert.ok(!body.includes('?ref='), 'New Members-এ ref লিংক এখনো আছে')
  assert.ok(!body.includes('copyLink'), 'New Members-এ কপি লিংক এখনো আছে')
  for (const bad of ['BUDDIES', 'STORY_CAPTIONS']) {
    assert.ok(!body.includes(bad), `সেকশনে ${bad} আছে`)
  }
})

console.log(`\n${passed}/7 passed`)
