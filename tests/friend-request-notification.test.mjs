// বন্ধু রিকোয়েস্টের নোটিফিকেশন — প্রাপক যেন রিকোয়েস্ট দেখতে পায় (Facebook-এর মতো)।
// চালানো: রিপো রুট থেকে `node tests/friend-request-notification.test.mjs`
// (src/friendRequestNotify.ts + src/friendRequests.ts pure লজিক esbuild দিয়ে
//  বান্ডল করে চালায়; পেজ/স্টোর/সার্ভার/SW-এর গঠন সোর্স পড়ে যাচাই করে —
//  Firebase/React লাগে না।) যাচাই করে:
//   ১) ব্যাজের সংখ্যা — শুধু pending, শুধু আমার কাছে আসা, ব্লক করা প্রেরক বাদ
//   ২) পুশ পেলোড — প্রেরকের নাম, /friends লিংক, View/Later অ্যাকশন, kind
//   ৩) ডিডুপ — একই রিকোয়েস্টে একই tag (ব্রাউজার বদলে দেয়), নতুন রিকোয়েস্টে নতুন tag
//   ৪) নোটিফিকেশন ট্যাপ — view/ট্যাপ → /friends খোলে, dismiss → শুধু বন্ধ
//   ৫) না-জানানোর নিয়ম — পারসোনা/লোকাল id-তে রিকোয়েস্টই যায় না, ব্লক করাকে
//      পাঠানো যায় না, OTP (uid নেই) পথে ডক লেখা হয় না — তাই পুশও যায় না
//   ৬) ওয়্যারিং — ব্যাজ তিন নেভে, Friend Requests কার্ড সবসময় দেখায়,
//      পুশ ট্রিগার শুধু createFriendRequest সফল হলেই, সার্ভার এন্ডপয়েন্ট +
//      সার্ভিস ওয়ার্কার /friends রাউট করে
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-frnotif-test-'))

async function loadModule(entry) {
  const outFile = join(outDir, entry.replace(/[^a-z]/gi, '') + '.mjs')
  await build({
    entryPoints: [join(root, 'src', entry)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: outFile,
    logLevel: 'silent',
    define: { 'import.meta.env.VITE_API_URL': '""' },
  })
  return import(outFile)
}

const N = await loadModule('friendRequestNotify.ts')
const FR = await loadModule('friendRequests.ts')

const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const componentsSrc = readFileSync(join(root, 'src/components.tsx'), 'utf8')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
const serverSrc = readFileSync(join(root, 'server/index.js'), 'utf8')
const swSrc = readFileSync(join(root, 'public/sw.js'), 'utf8')

let n = 0
function check(name, fn) {
  n += 1
  fn()
  console.log(`ok ${n} - ${name}`)
}

const ME = 'LxnGL8xA6VW8Gp7hvCaoakOha822'
const SENDER = 'GGCZ2Ta9TlheIBtdvQSCceC6Yfv2'
const OTHER = 'ZSv0IAhwjBabu09KeZGVFV2N2iF3'
const BLOCKED = 'pFo4lpJKI1dpUZUKlRkaoD0vFgI2'

function doc(over = {}) {
  return {
    id: 'req-1', fromUid: SENDER, toUid: ME, fromName: 'Proma', fromColour: '#1877F2',
    toName: 'Susmita', toColour: '#27AE60', status: 'pending', createdAtMs: Date.now(),
    ...over,
  }
}

// ---------- ১) ব্যাজের সংখ্যা ----------
check('pending আসা রিকোয়েস্ট একটাই গোনা হয়', () => {
  assert.equal(N.pendingFriendRequestCount([doc()], ME, []), 1)
})

check('accepted/declined/cancelled ডক ব্যাজে ওঠে না', () => {
  for (const status of ['accepted', 'declined', 'cancelled']) {
    assert.equal(N.pendingFriendRequestCount([doc({ status })], ME, []), 0)
  }
})

check('আমার পাঠানো (toUid != আমি) রিকোয়েস্ট আমার ব্যাজে ওঠে না', () => {
  assert.equal(N.pendingFriendRequestCount([doc({ fromUid: ME, toUid: OTHER })], ME, []), 0)
})

check('ব্লক করা প্রেরকের রিকোয়েস্ট ব্যাজে ওঠে না', () => {
  assert.equal(N.pendingFriendRequestCount([doc({ fromUid: BLOCKED })], ME, [BLOCKED]), 0)
  assert.equal(N.pendingFriendRequestCount([doc(), doc({ id: 'req-2', fromUid: BLOCKED })], ME, [BLOCKED]), 1)
})

check('দুটো pending রিকোয়েস্টে ব্যাজ ২', () => {
  assert.equal(N.pendingFriendRequestCount([doc(), doc({ id: 'req-2', fromUid: OTHER, fromName: 'Avijit' })], ME, []), 2)
})

// ---------- ২) পুশ পেলোড ----------
check('পুশে প্রেরকের নাম, /friends লিংক, View/Later অ্যাকশন', () => {
  const p = N.buildFriendRequestPush({ requestId: 'req-1', fromId: SENDER, fromName: 'Proma' })
  assert.ok(p)
  assert.equal(p.title, '👥 Proma sent you a friend request')
  assert.equal(p.data.url, '/friends')
  assert.equal(p.data.kind, 'friend-request')
  assert.equal(p.data.requestId, 'req-1')
  assert.equal(p.data.fromId, SENDER)
  assert.equal(p.data.fromName, 'Proma')
  assert.deepEqual(p.actions, [
    { action: 'view', title: '👀 View' },
    { action: 'dismiss', title: 'Later' },
  ])
})

check('খারাপ ইনপুটে পেলোড null — খালি নাম/id, ৬০ অক্ষরের বেশি নাম', () => {
  assert.equal(N.buildFriendRequestPush({ requestId: '', fromId: SENDER, fromName: 'Proma' }), null)
  assert.equal(N.buildFriendRequestPush({ requestId: 'req-1', fromId: '', fromName: 'Proma' }), null)
  assert.equal(N.buildFriendRequestPush({ requestId: 'req-1', fromId: SENDER, fromName: '   ' }), null)
  assert.equal(N.buildFriendRequestPush({ requestId: 'req-1', fromId: SENDER, fromName: 'x'.repeat(61) }), null)
})

// ---------- ৩) ডিডুপ ----------
check('একই রিকোয়েস্টে একই tag — ব্রাউজার বদলে দেয়, ডুপ্লিকেট জমে না', () => {
  const a = N.buildFriendRequestPush({ requestId: 'req-1', fromId: SENDER, fromName: 'Proma' })
  const b = N.buildFriendRequestPush({ requestId: 'req-1', fromId: SENDER, fromName: 'Proma' })
  assert.equal(a.tag, b.tag)
  assert.equal(a.tag, 'picall-friend-request-req-1')
})

check('নতুন রিকোয়েস্টে নতুন tag — নতুন নোটিফিকেশন আসে', () => {
  const a = N.buildFriendRequestPush({ requestId: 'req-1', fromId: SENDER, fromName: 'Proma' })
  const b = N.buildFriendRequestPush({ requestId: 'req-2', fromId: SENDER, fromName: 'Proma' })
  assert.notEqual(a.tag, b.tag)
})

// ---------- ৪) নোটিফিকেশন ট্যাপ ----------
check('ট্যাপ বা View → /friends খোলে', () => {
  assert.deepEqual(N.friendRequestNotificationClickTarget(undefined, { url: '/friends' }), { kind: 'open', url: '/friends' })
  assert.deepEqual(N.friendRequestNotificationClickTarget('view', { url: '/friends' }), { kind: 'open', url: '/friends' })
})

check('dismiss → শুধু বন্ধ, কোথাও যায় না', () => {
  assert.deepEqual(N.friendRequestNotificationClickTarget('dismiss', { url: '/friends' }), { kind: 'close' })
})

check('অচেনা url এলেও /friends-এই যায় — বাইরের লিংক নয়', () => {
  assert.deepEqual(N.friendRequestNotificationClickTarget(undefined, { url: 'https://example.com/x' }), { kind: 'open', url: '/friends' })
  assert.deepEqual(N.friendRequestNotificationClickTarget(undefined, null), { kind: 'open', url: '/friends' })
})

// ---------- ৫) না-জানানোর নিয়ম ----------
check('পারসোনা/লোকাল id-তে রিকোয়েস্ট ডকই বানানো যায় না — পুশের প্রশ্নই ওঠে না', () => {
  assert.equal(FR.buildFriendRequestData(
    { uid: ME, name: 'Susmita', colour: '#27AE60' },
    { uid: 'bd-rima', name: 'Rima', colour: '#e11d48' },
  ), null)
  assert.equal(FR.buildFriendRequestData(
    { uid: ME, name: 'Susmita', colour: '#27AE60' },
    { uid: 'fr-1', name: 'Seed', colour: '#888888' },
  ), null)
})

check('ব্লক করা কাউকে রিকোয়েস্ট পাঠানো যায় না — তাই নোটিফিকেশনও যায় না', () => {
  assert.equal(FR.canSendFriendRequest(BLOCKED, { uid: ME, friendIds: [], sentToUids: [], blockedUids: [BLOCKED] }), 'blocked')
})

check('নিজেকে রিকোয়েস্ট পাঠানো যায় না', () => {
  assert.equal(FR.canSendFriendRequest(ME, { uid: ME, friendIds: [], sentToUids: [], blockedUids: [] }), 'self')
})

// ---------- ৬) ওয়্যারিং ----------
check('ব্যাজ তিন নেভেই — মোবাইল BottomNav, ডেস্কটপ সেন্টার নেভ, সাইডবার', () => {
  assert.ok(componentsSrc.includes('BottomNav'), 'BottomNav missing')
  // BottomNav-এ Friends আইকনে ব্যাজ
  const bottomNav = componentsSrc.slice(componentsSrc.indexOf('export function BottomNav()'), componentsSrc.indexOf('export function Sidebar()'))
  assert.ok(bottomNav.includes('pendingCount'), 'BottomNav has no pendingCount badge')
  assert.ok(bottomNav.includes("n.to === '/friends'"), 'BottomNav badge is not on Friends')
  // ডেস্কটপ সেন্টার নেভে Friends ব্যাজ
  assert.ok(componentsSrc.includes("n.to === '/friends' && pendingCount > 0"), 'desktop nav has no Friends badge')
  // সাইডবারে Friends ব্যাজ
  const sidebar = componentsSrc.slice(componentsSrc.indexOf('export function Sidebar()'), componentsSrc.indexOf('export function SponsoredCard()'))
  assert.ok(sidebar.includes("l.to === '/friends' && pendingCount > 0"), 'sidebar has no Friends badge')
})

check('Friend Requests কার্ড খোঁজা চললেও দেখায় — সার্চ-টার্নারির বাইরে', () => {
  const friendsPage = pagesSrc.slice(pagesSrc.indexOf('export function FriendsPage()'), pagesSrc.indexOf('// ---------- সার্চের ফলের পেজ'))
  const cardAt = friendsPage.indexOf('Friend Requests ({requests.length})')
  const searchingAt = friendsPage.indexOf('{searching ? (')
  assert.ok(cardAt !== -1 && searchingAt !== -1, 'requests card or search ternary missing')
  assert.ok(cardAt < searchingAt, 'requests card is still inside/below the search ternary — hidden while searching')
  assert.ok(friendsPage.includes("border-[#7C3AED]"), 'requests card has no prominent highlight when pending')
})

check('পুশ ট্রিগার শুধু createFriendRequest সফল হলেই — sendFriendRequest-এ', () => {
  const sendFn = storeSrc.slice(storeSrc.indexOf('sendFriendRequest: async'), storeSrc.indexOf('cancelFriendRequest: async'))
  assert.ok(sendFn.includes('createFriendRequest(payload)'), 'send does not create the request doc')
  assert.ok(sendFn.includes('triggerFriendRequestPush({ toUid: f.id, requestId,'), 'push trigger not called after doc write')
  assert.ok(sendFn.indexOf('triggerFriendRequestPush') > sendFn.indexOf('if (!requestId) return false'), 'push trigger must run only after a requestId exists')
  assert.ok(storeSrc.includes("import { triggerFriendRequestPush } from './friendRequestNotify'"), 'trigger import missing')
})

check('সার্ভার এন্ডপয়েন্ট POST /api/friend-request/push + ভার্সন 6.4.0', () => {
  assert.ok(serverSrc.includes("app.post('/api/friend-request/push'"), 'server endpoint missing')
  assert.ok(serverSrc.includes('sendFriendRequestPush'), 'server send helper missing')
  assert.ok(serverSrc.includes('picall-friend-request-${'), 'server tag does not carry the requestId')
  assert.ok(serverSrc.includes("version: '6.4.0'"), 'server version not bumped to 6.4.0')
  assert.ok(serverSrc.includes("url: '/friends'"), 'server payload does not point at /friends')
})

check('সার্ভিস ওয়ার্কার /friends রাউট করে, dismiss শুধু বন্ধ করে', () => {
  assert.ok(swSrc.includes("event.action === 'dismiss'"), 'SW does not handle dismiss')
  assert.ok(swSrc.includes("data.url.startsWith('/')"), 'SW still routes only /call/ URLs')
  assert.ok(swSrc.includes("kind === 'friend-request'"), 'SW is not friend-request aware')
})

console.log(`\n${n} checks passed`)
