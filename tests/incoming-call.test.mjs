// ইনকামিং-কল ওভারলে টেস্ট — হোম পেজে কল এলে ধরো/কাটো কার্ড, গেটিং, presence + পুশ।
// চালানো: রিপো রুট থেকে `node tests/incoming-call.test.mjs`
// (esbuild দিয়ে src/*.ts বান্ডল করে Node-এ চালায় — Firebase/React লাগে না।)
// যাচাই করে:
//   ১) কে কল দিতে পারবে — everyone/friends/nobody + বন্ধু/অচেনা + নিজে + চলমান কল + মেয়াদ
//   ২) ইনভাইট মেসেজ বানানো/পড়া — ভুল আকৃতি বাতিল
//   ৩) ওভারলে অবস্থা — নতুন ইনভাইট আগেরটা সরায়; ধরলে/কাটলে/মুছলে idle
//   ৪) presence মেসেজ চেনা — invite / invite-response / registered / invite-sent
//   ৫) পুশ পেলোড — কলকারীর নাম, ধরো/কাটো অ্যাকশন, /call/<code> লিংক
//   ৬) নোটিফিকেশন ট্যাপ — answer → কলে ঢোকা, decline → শুধু বন্ধ
import { build } from 'esbuild'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-ic-test-'))

async function loadModule(entry) {
  const outFile = join(outDir, entry.replace(/[^a-z]/gi, '') + '.mjs')
  await build({
    entryPoints: [join(root, 'src', entry)],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: outFile,
    logLevel: 'silent',
    // Node-এ import.meta.env নেই — api.ts-এর VITE_API_URL খালি ধরা হয়
    // (খালি হলে Railway ডিফল্ট URL বসে; টেস্টে নেটওয়ার্ক ডাকা হয় না)
    define: { 'import.meta.env.VITE_API_URL': '""' },
  })
  return import(outFile)
}

const IC = await loadModule('incomingCall.ts')
const PR = await loadModule('presence.ts')
const PN = await loadModule('pushNotify.ts')

let n = 0
function check(name, fn) {
  n += 1
  fn()
  console.log(`ok ${n} - ${name}`)
}

const NOW = Date.now()
const INVITE = { code: 'abc123', fromId: 'uid-1', fromName: 'রিমা', kind: 'friend', at: NOW }
const SELF = 'uid-me'

// ---------- ১) গেটিং ----------
check('everyone হলে বন্ধু/অচেনা দুজনেই ওভারলে পায়', () => {
  assert.equal(IC.shouldShowInvite(INVITE, { privacy: 'everyone', isFriend: true, inCall: false, selfId: SELF, now: NOW }).show, true)
  assert.equal(IC.shouldShowInvite(INVITE, { privacy: 'everyone', isFriend: false, inCall: false, selfId: SELF, now: NOW }).show, true)
})
check('friends হলে শুধু বন্ধু পায়, অচেনা পায় না', () => {
  assert.equal(IC.shouldShowInvite(INVITE, { privacy: 'friends', isFriend: true, inCall: false, selfId: SELF, now: NOW }).show, true)
  const g = IC.shouldShowInvite(INVITE, { privacy: 'friends', isFriend: false, inCall: false, selfId: SELF, now: NOW })
  assert.equal(g.show, false)
  assert.equal(g.reason, 'privacy-friends')
})
check('nobody হলে কেউ পায় না', () => {
  const g = IC.shouldShowInvite(INVITE, { privacy: 'nobody', isFriend: true, inCall: false, selfId: SELF, now: NOW })
  assert.equal(g.show, false)
  assert.equal(g.reason, 'privacy-nobody')
})
check('নিজের নিজেকে কল নয়', () => {
  const g = IC.shouldShowInvite(INVITE, { privacy: 'everyone', isFriend: false, inCall: false, selfId: 'uid-1', now: NOW })
  assert.equal(g.show, false)
  assert.equal(g.reason, 'self')
})
check('চলমান কলে থাকলে ওভারলে নয়', () => {
  const g = IC.shouldShowInvite(INVITE, { privacy: 'everyone', isFriend: true, inCall: true, selfId: SELF, now: NOW })
  assert.equal(g.show, false)
  assert.equal(g.reason, 'in-call')
})
check('৬০ সেকেন্ডের বেশি পুরোনো ইনভাইট মেয়াদোত্তীর্ণ', () => {
  const old = { ...INVITE, at: NOW - 61000 }
  const g = IC.shouldShowInvite(old, { privacy: 'everyone', isFriend: true, inCall: false, selfId: SELF, now: NOW })
  assert.equal(g.show, false)
  assert.equal(g.reason, 'expired')
  assert.equal(IC.isInviteExpired(old, NOW), true)
  assert.equal(IC.isInviteExpired(INVITE, NOW), false)
})
check('callPrivacy লোড — ভুল মান হলে ডিফল্ট friends', () => {
  assert.equal(IC.loadCallPrivacy('everyone'), 'everyone')
  assert.equal(IC.loadCallPrivacy('nobody'), 'nobody')
  assert.equal(IC.loadCallPrivacy('bogus'), 'friends')
  assert.equal(IC.loadCallPrivacy(null), 'friends')
  assert.equal(IC.DEFAULT_CALL_PRIVACY, 'friends')
})

// ---------- ২) ইনভাইট মেসেজ ----------
check('buildInviteMessage — আকৃতি ঠিক, নাম ৬০ অক্ষরে কাটা', () => {
  const msg = IC.buildInviteMessage({ to: 'uid-2', code: 'abc123', fromId: 'uid-1', fromName: 'র'.repeat(80), kind: 'friend' })
  assert.equal(msg.type, 'call-invite')
  assert.equal(msg.to, 'uid-2')
  assert.equal(msg.code, 'abc123')
  assert.equal(msg.fromName.length, 60)
})
check('parseInviteMessage — ঠিক মেসেজ মেলে, ভুল আকৃতি বাতিল', () => {
  const ok = IC.parseInviteMessage({ type: 'call-invite', code: 'abc123', fromId: 'uid-1', fromName: 'রিমা', kind: 'friend', at: NOW })
  assert.equal(ok?.code, 'abc123')
  assert.equal(ok?.fromName, 'রিমা')
  assert.equal(IC.parseInviteMessage({ type: 'call-invite', code: 'bad!', fromId: 'uid-1', fromName: 'রিমা' }), null)
  assert.equal(IC.parseInviteMessage({ type: 'call-invite', code: 'abc123', fromId: '', fromName: 'রিমা' }), null)
  assert.equal(IC.parseInviteMessage({ type: 'other', code: 'abc123' }), null)
  assert.equal(IC.parseInviteMessage(null), null)
})

// ---------- ৩) ওভারলে অবস্থা ----------
check('নতুন ইনভাইট আগেরটাকে সরিয়ে বাজে; ধরলে/কাটলে/মুছলে idle', () => {
  let s = IC.idleOverlayState()
  assert.equal(s.status, 'idle')
  s = IC.reduceInviteArrived(s, INVITE)
  assert.equal(s.status, 'ringing')
  const second = { ...INVITE, code: 'xyz789', fromName: 'শাকিল' }
  s = IC.reduceInviteArrived(s, second)
  assert.equal(s.status, 'ringing')
  assert.equal(s.invite.code, 'xyz789')
  s = IC.reduceInviteAnswered(s)
  assert.equal(s.status, 'accepted')
  s = IC.reduceInviteCleared(s)
  assert.equal(s.status, 'idle')
  s = IC.reduceInviteArrived(s, INVITE)
  s = IC.reduceInviteDeclined(s)
  assert.equal(s.status, 'declined')
  // idle অবস্থায় ধরলে/কাটলে কিছু বদলায় না
  assert.equal(IC.reduceInviteAnswered(IC.idleOverlayState()).status, 'idle')
})

// ---------- ৪) presence মেসেজ ----------
check('buildPresenceRegister — userId + নাম', () => {
  const m = PR.buildPresenceRegister('uid-1', 'আভিজিৎ')
  assert.equal(m.type, 'presence-register')
  assert.equal(m.userId, 'uid-1')
  assert.equal(m.name, 'আভিজিৎ')
})
check('parsePresenceMessage — invite / response / registered / sent চেনে', () => {
  const inv = PR.parsePresenceMessage({ type: 'call-invite', code: 'abc123', fromId: 'uid-1', fromName: 'রিমা', kind: 'friend', at: NOW })
  assert.equal(inv.kind, 'invite')
  assert.equal(inv.invite.fromName, 'রিমা')
  const res = PR.parsePresenceMessage({ type: 'call-invite-response', code: 'abc123', accepted: false, fromId: 'uid-1' })
  assert.equal(res.kind, 'invite-response')
  assert.equal(res.accepted, false)
  assert.equal(PR.parsePresenceMessage({ type: 'presence-registered' }).kind, 'registered')
  const sent = PR.parsePresenceMessage({ type: 'call-invite-sent', to: 'uid-2', delivered: false, pushed: true })
  assert.equal(sent.kind, 'invite-sent')
  assert.equal(sent.pushed, true)
  assert.equal(PR.parsePresenceMessage({ type: 'nonsense' }).kind, 'unknown')
  assert.equal(PR.parsePresenceMessage({ type: 'call-invite', code: 'bad', fromId: 'x', fromName: 'y' }).kind, 'unknown')
})

// ---------- ৫) পুশ পেলোড ----------
check('buildIncomingCallPush — name, Answer/Decline, /call/<code>', () => {
  const p = PN.buildIncomingCallPush(INVITE)
  assert.ok(p.title.includes('রিমা'))
  assert.equal(p.tag, 'picall-call-abc123')
  assert.equal(p.data.url, '/call/abc123')
  assert.equal(p.data.code, 'abc123')
  assert.deepEqual(p.actions.map((a) => a.action), ['answer', 'decline'])
  assert.ok(p.actions[0].title.includes('Answer'))
  assert.ok(p.actions[1].title.includes('Decline'))
})

// ---------- ৬) নোটিফিকেশন ট্যাপ ----------
check('notificationClickTarget — answer/ট্যাপ → কলে ঢোকা, decline → শুধু বন্ধ', () => {
  assert.deepEqual(PN.notificationClickTarget('answer', { url: '/call/abc123' }), { kind: 'open', url: '/call/abc123' })
  assert.deepEqual(PN.notificationClickTarget(undefined, { url: '/call/abc123' }), { kind: 'open', url: '/call/abc123' })
  assert.deepEqual(PN.notificationClickTarget('decline', { url: '/call/abc123' }), { kind: 'close' })
  assert.deepEqual(PN.notificationClickTarget('answer', { url: '/evil' }), { kind: 'open', url: '/feed' })
  assert.deepEqual(PN.notificationClickTarget('answer', null), { kind: 'open', url: '/feed' })
})

console.log(`\n${n}/${n} incoming-call tests passed`)
