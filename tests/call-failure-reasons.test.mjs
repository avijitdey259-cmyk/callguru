// কল-ব্যর্থতার কারণ — কল না গেলে কলকারী ঠিক কেন দেখবেন, জেনেরিক ভুল নয়।
// চালানো: রিপো রুট থেকে `node tests/call-failure-reasons.test.mjs`
// ভাগ ১: src/callFailure.ts-এর বিশুদ্ধ ম্যাপিং (কারণ → বার্তা, গেট/ইনভাইট
//        স্ট্যাটাস → কারণ) + Firestore ইনভাইট স্ট্যাটাস ম্যাপিং।
// ভাগ ২: সার্ভার + ক্লায়েন্ট ওয়্যারিং (স্ট্যাটিক যাচাই — কারণ Firestore
//        ইনভাইট ডকের স্ট্যাটাসে আসে, ব্যস্ত/অফলাইন সার্ভারেই ধরা পড়ে,
//        CallPage কারণ দেখায়)।
// ভাগ ৩: আসল সার্ভার চালিয়ে (টেস্ট পোর্টে, স্টাব করা টোকেন-যাচাই দিয়ে)
//        WebSocket ইন্টিগ্রেশন — সার্ভারের পুরোনো WS ইনভাইট পথ
//        (ক্লায়েন্ট আর ব্যবহার করে না, সার্ভারে আছে) + সার্ভিস-ওয়ার্কার
//        Decline রিলে।
import { build } from 'esbuild'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import WebSocket from 'ws'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-cfr-test-'))

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

const CF = await loadModule('callFailure.ts')
const CI = await loadModule('callInvites.ts')
const IC = await loadModule('incomingCall.ts')

let n = 0
function check(name, fn) {
  n += 1
  fn()
  console.log(`ok ${n} - ${name}`)
}
async function checkAsync(name, fn) {
  n += 1
  await fn()
  console.log(`ok ${n} - ${name}`)
}

const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const serverSrc = readFileSync(join(root, 'server/index.js'), 'utf8')
const overlaySrc = readFileSync(join(root, 'src/IncomingCallOverlay.tsx'), 'utf8')

// ---------- ভাগ ১ক: কারণ → বার্তা ----------
check('busy — নামসহ "is busy on another call"', () => {
  assert.equal(CF.callFailureMessage('busy', 'রিমা'), 'রিমা is busy on another call')
})
check('offline — নামসহ "is offline"; নাম না থাকলে "User is offline"', () => {
  assert.equal(CF.callFailureMessage('offline', 'রিমা'), 'রিমা is offline')
  assert.equal(CF.callFailureMessage('offline', ''), 'User is offline')
  assert.equal(CF.callFailureMessage('offline', '   '), 'User is offline')
})
check('no-credit — "Insufficient Pi balance"', () => {
  assert.equal(CF.callFailureMessage('no-credit', 'রিমা'), 'Insufficient Pi balance — buy Pi first to call')
})
check('not-friend — "Not friends yet — send a friend request first"', () => {
  assert.equal(CF.callFailureMessage('not-friend', 'রিমা'), 'Not friends yet — send a friend request first')
})
check('not-accepting — "is not accepting calls right now"', () => {
  assert.equal(CF.callFailureMessage('not-accepting', 'রিমা'), 'রিমা is not accepting calls right now')
})
check('declined — নামসহ "declined the call"', () => {
  assert.equal(CF.callFailureMessage('declined', 'রিমা'), 'রিমা declined the call')
})
check('no-answer — "No answer — didn\'t pick up"', () => {
  assert.equal(CF.callFailureMessage('no-answer', 'রিমা'), "No answer — রিমা didn't pick up")
})
check('server / call-not-found / room-full — আগের বার্তাগুলোই থাকে', () => {
  assert.equal(CF.callFailureMessage('server', 'রিমা'), 'Could not connect to the server — please try again.')
  assert.equal(CF.callFailureMessage('call-not-found', 'রিমা'), 'The call was not found or has ended.')
  assert.equal(CF.callFailureMessage('room-full', 'রিমা'), 'There are already 2 people on this call.')
})
check('parseFailureReason — জানা কারণ মেলে, অজানা/ভুল মান null', () => {
  assert.equal(CF.parseFailureReason('busy'), 'busy')
  assert.equal(CF.parseFailureReason('not-friend'), 'not-friend')
  assert.equal(CF.parseFailureReason('bogus'), null)
  assert.equal(CF.parseFailureReason(''), null)
  assert.equal(CF.parseFailureReason(null), null)
  assert.equal(CF.parseFailureReason(42), null)
  assert.equal(CF.isCallFailureReason('offline'), true)
  assert.equal(CF.isCallFailureReason('nope'), false)
})
check('NO_ANSWER_TIMEOUT_MS — ৬০ সেকেন্ড TTL + ৫ সেকেন্ড গ্রেস = ৬৫০০০', () => {
  assert.equal(CF.NO_ANSWER_TIMEOUT_MS, 65000)
  assert.ok(CF.NO_ANSWER_TIMEOUT_MS > IC.INVITE_TTL_MS)
})

// ---------- ভাগ ১খ: গেট → কারণ ----------
check('gateReasonToFailureReason — in-call→busy, friends→not-friend, nobody/blocked→not-accepting, expired→no-answer', () => {
  assert.equal(CF.gateReasonToFailureReason('in-call'), 'busy')
  assert.equal(CF.gateReasonToFailureReason('privacy-friends'), 'not-friend')
  assert.equal(CF.gateReasonToFailureReason('privacy-nobody'), 'not-accepting')
  assert.equal(CF.gateReasonToFailureReason('blocked'), 'not-accepting')
  assert.equal(CF.gateReasonToFailureReason('expired'), 'no-answer')
  assert.equal(CF.gateReasonToFailureReason('ok'), null)
  assert.equal(CF.gateReasonToFailureReason('self'), null)
  assert.equal(CF.gateReasonToFailureReason('whatever'), null)
})
check('গেটের কারণ আর ম্যাপিং মিলে — friends-গেটে আটকালে কলার "not-friend" পায় (মালিকের নিজের ব্যর্থ কলের মূল কারণ)', () => {
  const gate = IC.shouldShowInvite(
    { code: 'abc123', fromId: 'uid-1', fromName: 'Avijit', kind: 'friend', at: Date.now() },
    { privacy: 'friends', isFriend: false, inCall: false, selfId: 'uid-me', now: Date.now() },
  )
  assert.equal(gate.show, false)
  assert.equal(gate.reason, 'privacy-friends')
  assert.equal(CF.gateReasonToFailureReason(gate.reason), 'not-friend')
  assert.equal(CF.callFailureMessage(CF.gateReasonToFailureReason(gate.reason), 'Susmita'), 'Not friends yet — send a friend request first')
})

// ---------- ভাগ ১গ: ইনভাইট স্ট্যাটাস → কারণ (Firestore) ----------
check('callInviteStatusToFailureReason — কাটলে declined, ব্যস্ত busy, বন্ধু নয় not-friend; ধরলে/বাজতে থাকলে null', () => {
  assert.equal(CI.callInviteStatusToFailureReason('declined'), 'declined')
  assert.equal(CI.callInviteStatusToFailureReason('busy'), 'busy')
  assert.equal(CI.callInviteStatusToFailureReason('not-friend'), 'not-friend')
  assert.equal(CI.callInviteStatusToFailureReason('not-accepting'), 'not-accepting')
  assert.equal(CI.callInviteStatusToFailureReason('accepted'), null)
  assert.equal(CI.callInviteStatusToFailureReason('ringing'), null)
  assert.equal(CI.callInviteStatusToFailureReason('cancelled'), null)
  assert.equal(CF.callFailureMessage(CI.callInviteStatusToFailureReason('declined'), 'রিমা'), 'রিমা declined the call')
})
check('callErrorToFailureReason — call-not-found / room-full ঠিক থাকে, unauthorized আলাদা কারণ (জেনেরিক server নয়), বাকি সব server', () => {
  assert.equal(CF.callErrorToFailureReason('call-not-found'), 'call-not-found')
  assert.equal(CF.callErrorToFailureReason('room-full'), 'room-full')
  assert.equal(CF.callErrorToFailureReason('unauthorized'), 'unauthorized')
  assert.equal(CF.callFailureMessage('unauthorized', 'রিমা'), 'Sign-in check failed — please sign out and sign in again.')
  assert.notEqual(CF.callFailureMessage('unauthorized', 'রিমা'), CF.callFailureMessage('server', 'রিমা'))
  assert.equal(CF.parseFailureReason('unauthorized'), 'unauthorized')
  assert.equal(CF.callErrorToFailureReason(''), 'server')
})
check('closeWhileWaitingToFailureReason — উত্তর অপেক্ষায় সকেট মরলে no-answer, আগে মরলে server', () => {
  assert.equal(CF.closeWhileWaitingToFailureReason(true), 'no-answer')
  assert.equal(CF.closeWhileWaitingToFailureReason(false), 'server')
  assert.equal(CF.callFailureMessage(CF.closeWhileWaitingToFailureReason(true), 'রিমা'), "No answer — রিমা didn't pick up")
  assert.equal(CF.callFailureMessage(CF.closeWhileWaitingToFailureReason(false), 'রিমা'), 'Could not connect to the server — please try again.')
})

// ---------- ভাগ ২: ওয়্যারিং (স্ট্যাটিক) ----------
check('server: call-invite-এ ব্যস্ত চেক — inCallByUser থাকলে reason busy (সার্ভারের পুরোনো WS পথ, ক্লায়েন্ট আর ব্যবহার করে না)', () => {
  assert.ok(serverSrc.includes('inCallByUser.has(to)'))
  assert.ok(serverSrc.includes("reason: 'busy'"))
  assert.ok(serverSrc.includes("reason: 'offline'"))
})
check('server: call-invite-response-এ কারণ রিলে হয় (allowlist যাচাইসহ)', () => {
  assert.ok(serverSrc.includes("VALID_DECLINE_REASONS"))
  assert.ok(serverSrc.includes("'declined', 'busy', 'not-friend', 'not-accepting'"))
  assert.ok(serverSrc.includes('reason: r') || serverSrc.includes('{ reason }'))
})
check('server: সার্ভিস-ওয়ার্কার Decline-এ call-declined-এ reason declined', () => {
  assert.ok(serverSrc.includes("type: 'call-declined', roomId: `call-${code}`, reason: 'declined'"))
})
check('server: health version 6.4.0 (Railway আপডেট যাচাইয়ের চিহ্ন)', () => {
  assert.ok(serverSrc.includes("version: '6.4.0'"))
})
check('overlay: গেটে আটকালে কারণসহ স্ট্যাটাস লেখে; Decline-এ declined', () => {
  assert.ok(overlaySrc.includes('gateReasonToInviteStatus(gate.reason)'))
  assert.ok(overlaySrc.includes("updateCallInviteStatus(docId, 'declined')"))
})
check('CallPage: কারণ দেখানো হয় (showCallFailure), Firestore ইনভাইট লেখা + ডক শোনা হয়, no-answer টাইমার আছে', () => {
  assert.ok(pagesSrc.includes('showCallFailure'))
  assert.ok(pagesSrc.includes('createCallInvite(payload)'))
  assert.ok(pagesSrc.includes('subscribeCallInviteDoc(inviteId'))
  assert.ok(pagesSrc.includes('callInviteStatusToFailureReason(doc.status)'))
  assert.ok(pagesSrc.includes('armNoAnswerTimer()'))
  assert.ok(pagesSrc.includes('NO_ANSWER_TIMEOUT_MS'))
  assert.ok(!pagesSrc.includes("from './presence'"), 'CallPage এখনো presence ইমপোর্ট করে')
})
check('CallPage: onClose — উত্তর অপেক্ষায় সকেট মরলে no-answer, আগে মরলে server', () => {
  assert.ok(pagesSrc.includes('closeWhileWaitingToFailureReason(noAnswerTimerRef.current !== null)'), 'onClose টাইমারের অবস্থা দেখে কারণ বেছে নেয় না')
  assert.ok(!pagesSrc.includes("onClose: () => { showCallFailure('server') }"), 'onClose এখনো সব বন্ধেই server দেখায়')
  assert.ok(pagesSrc.includes('noAnswerTimerRef.current !== null'), 'টাইমার চলছে কি না দেখা হয় না')
})
check('CallPage: কল শুরুর আগের পর্দায় ক্রেডিট না থাকলে বার্তা আছে (no-credit)', () => {
  assert.ok(pagesSrc.includes('You cannot call without a Pi balance'))
})

// ---------- ভাগ ৩: লাইভ সার্ভার ইন্টিগ্রেশন ----------
const TEST_PORT = 4179
const BASE = `http://127.0.0.1:${TEST_PORT}`
const WS_BASE = `ws://127.0.0.1:${TEST_PORT}`
const wrapper = join(outDir, 'server-wrapper.mjs')
writeFileSync(wrapper, `
import { __setTokenVerifier } from '${join(root, 'server', 'auth.js')}'
__setTokenVerifier(async (t) => {
  if (t === 'tok-alice') return { uid: 'alice-uid', email: 'alice@example.com', name: 'Alice' }
  if (t === 'tok-bob') return { uid: 'bob-uid', email: 'bob@example.com', name: 'Bob' }
  return null
})
await import('${join(root, 'server', 'index.js')}')
`)
const child = spawn('node', [wrapper], {
  cwd: root,
  env: { ...process.env, PORT: String(TEST_PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverErr = ''
child.stderr.on('data', (d) => { serverErr += String(d) })

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${BASE}/api/health`)
      if (r.ok) return true
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}

/** WS ক্লায়েন্ট — শর্ত মেলা মেসেজের অপেক্ষা (টাইমআউটে ভুল)। */
function wsClient() {
  const ws = new WebSocket(WS_BASE)
  const seen = []
  const waiters = []
  ws.on('message', (raw) => {
    let m
    try { m = JSON.parse(String(raw)) } catch { return }
    seen.push(m)
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (waiters[i].pred(m)) { waiters[i].resolve(m); waiters.splice(i, 1) }
    }
  })
  return {
    ws,
    seen,
    send: (o) => ws.send(JSON.stringify(o)),
    waitFor: (pred, timeoutMs = 10000) => new Promise((resolve, reject) => {
      const found = seen.find(pred)
      if (found) return resolve(found)
      const timer = setTimeout(() => reject(new Error(`মেসেজ আসেনি (টাইমআউট ${timeoutMs}ms): ${JSON.stringify(seen.slice(-3))}`)), timeoutMs)
      waiters.push({ pred, resolve: (m) => { clearTimeout(timer); resolve(m) } })
    }),
    waitOpen: () => new Promise((resolve, reject) => {
      if (ws.readyState === 1) return resolve()
      ws.on('open', resolve)
      ws.on('error', reject)
      setTimeout(() => reject(new Error('WS খুলল না')), 10000)
    }),
    close: () => { try { ws.close() } catch { /* ignore */ } },
  }
}

async function registerPresence(client, token) {
  await client.waitOpen()
  client.send({ type: 'presence-register', idToken: token })
  const m = await client.waitFor((x) => x.type === 'presence-registered')
  return m
}

try {
  const up = await waitForHealth()
  assert.ok(up, `টেস্ট সার্ভার চালু হয়নি: ${serverErr.slice(0, 500)}`)

  await checkAsync('live: GET /api/health — version 6.4.0', async () => {
    const r = await fetch(`${BASE}/api/health`)
    assert.equal(r.status, 200)
    const body = await r.json()
    assert.equal(body.version, '6.4.0')
  })

  const alice = wsClient()
  const bob = wsClient()
  await registerPresence(alice, 'tok-alice')
  await registerPresence(bob, 'tok-bob')

  await checkAsync('live: ইনভাইট পৌঁছালে কলার delivered:true পায়, গ্রহণকারী ইনভাইট পায়', async () => {
    alice.send({ type: 'call-invite', to: 'bob-uid', code: 'abc123' })
    const got = await bob.waitFor((x) => x.type === 'call-invite' && x.code === 'abc123')
    assert.equal(got.fromId, 'alice-uid')
    assert.equal(got.fromName, 'Alice')
    const ack = await alice.waitFor((x) => x.type === 'call-invite-sent' && x.to === 'bob-uid')
    assert.equal(ack.delivered, true)
    assert.equal(ack.reason, undefined)
  })

  await checkAsync('live: গ্রহণকারী not-friend কারণে কাটলে কলার সেই কারণই পায়', async () => {
    bob.send({ type: 'call-invite-response', to: 'alice-uid', code: 'abc123', accepted: false, reason: 'not-friend' })
    const res = await alice.waitFor((x) => x.type === 'call-invite-response' && x.code === 'abc123' && x.accepted === false)
    assert.equal(res.reason, 'not-friend')
  })

  await checkAsync('live: গ্রহণকারী ভুল কারণ পাঠালে সার্ভার তা বাদ দেয় (কারণ ছাড়াই পৌঁছায়)', async () => {
    alice.send({ type: 'call-invite', to: 'bob-uid', code: 'abc124' })
    await bob.waitFor((x) => x.type === 'call-invite' && x.code === 'abc124')
    bob.send({ type: 'call-invite-response', to: 'alice-uid', code: 'abc124', accepted: false, reason: 'bogus-evil' })
    const res = await alice.waitFor((x) => x.type === 'call-invite-response' && x.code === 'abc124')
    assert.equal(res.reason, undefined)
  })

  // ব্যস্ত: bob একটা কল রুমে ঢোকেন (callee, টোকেনসহ) — তারপর ইনভাইটে busy
  const roomMaker = wsClient()
  await roomMaker.waitOpen()
  roomMaker.send({ type: 'call-join', roomId: 'call-xyz789', role: 'caller', name: 'Guest' })
  await roomMaker.waitFor((x) => x.type === 'call-joined')
  const bobCall = wsClient()
  await bobCall.waitOpen()
  bobCall.send({ type: 'call-join', roomId: 'call-xyz789', role: 'callee', name: 'Bob', idToken: 'tok-bob' })
  await bobCall.waitFor((x) => x.type === 'call-joined')

  await checkAsync('live: গ্রহণকারী অন্য কলে ব্যস্ত থাকলে ইনভাইট রিং বাজে না, কলার busy পায়', async () => {
    const before = bob.seen.filter((x) => x.type === 'call-invite').length
    alice.send({ type: 'call-invite', to: 'bob-uid', code: 'abc125' })
    const ack = await alice.waitFor((x) => x.type === 'call-invite-sent' && x.to === 'bob-uid' && x.reason === 'busy')
    assert.equal(ack.delivered, false)
    assert.equal(ack.pushed, false)
    await new Promise((r) => setTimeout(r, 500))
    assert.equal(bob.seen.filter((x) => x.type === 'call-invite').length, before, 'ব্যস্ত থাকলে ইনভাইট পৌঁছানো উচিত নয়')
  })

  await checkAsync('live: ব্যস্ত কল শেষ হলে আবার ইনভাইট পৌঁছায়', async () => {
    bobCall.send({ type: 'call-end', roomId: 'call-xyz789' })
    await new Promise((r) => setTimeout(r, 300))
    alice.send({ type: 'call-invite', to: 'bob-uid', code: 'abc126' })
    const got = await bob.waitFor((x) => x.type === 'call-invite' && x.code === 'abc126')
    assert.equal(got.fromId, 'alice-uid')
    const ack = await alice.waitFor((x) => x.type === 'call-invite-sent' && x.to === 'bob-uid' && x.delivered === true)
    assert.equal(ack.delivered, true)
  })

  await checkAsync('live: গ্রহণকারী অফলাইন হলে কলার delivered:false + reason offline পায়', async () => {
    alice.send({ type: 'call-invite', to: 'carol-uid', code: 'abc127' })
    const ack = await alice.waitFor((x) => x.type === 'call-invite-sent' && x.to === 'carol-uid')
    assert.equal(ack.delivered, false)
    assert.equal(ack.pushed, false)
    assert.equal(ack.reason, 'offline')
  })

  await checkAsync('live: সার্ভিস-ওয়ার্কার Decline (POST /api/call-invite/decline) — কলার call-declined + reason declined পায়', async () => {
    const caller = wsClient()
    await caller.waitOpen()
    caller.send({ type: 'call-join', roomId: 'call-def456', role: 'caller', name: 'Guest' })
    await caller.waitFor((x) => x.type === 'call-joined')
    const r = await fetch(`${BASE}/api/call-invite/decline`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'def456' }),
    })
    assert.equal(r.status, 200)
    const m = await caller.waitFor((x) => x.type === 'call-declined')
    assert.equal(m.reason, 'declined')
    caller.close()
  })

  alice.close()
  bob.close()
  roomMaker.close()
  bobCall.close()
} finally {
  child.kill('SIGTERM')
}

console.log(`\n${n}/${n} call-failure-reasons tests passed`)
