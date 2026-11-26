// দুই দিকের রিং — কলকারী রিংব্যাক শুনবেন, গ্রহণকারী রিংটোন (আগের মতোই)।
// চালানো: রিপো রুট থেকে `node tests/ringback.test.mjs`
// (src/sounds.ts pure লজিক esbuild দিয়ে বান্ডল করে চালায় — fake
//  AudioContext + fake টাইমার; ওভারলে/কল-পেজের গঠন সোর্স পড়ে যাচাই করে।)
// যাচাই করে:
//   ১) কলকারী অপেক্ষায় রিংব্যাক বাজে (৪৪০ Hz, ১ সেকেন্ড বার্স্ট, ৪ সেকেন্ড চক্র)
//   ২) সংযোগ/কাটা/টাইমআউট/বাতিলে রিংব্যাক থামে (আর কল শেষে বাজে না)
//   ৩) গ্রহণকারীর রিংটোন ইনভাইট-পথে বাজে (ওভারলে)
//   ৪) দুটোই সাউন্ড-সেটিংস মানে (বন্ধ/ভলিউম ০/চলমান কলে বাজে না)
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = mkdtempSync(join(tmpdir(), 'picall-ringback-test-'))
const outFile = join(outDir, 'sounds.mjs')
await build({
  entryPoints: [join(root, 'src/sounds.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: outFile,
  logLevel: 'silent',
})
const M = await import(outFile)

const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const overlaySrc = readFileSync(join(root, 'src/IncomingCallOverlay.tsx'), 'utf8')
const soundsSrc = readFileSync(join(root, 'src/sounds.ts'), 'utf8')

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`ok ${passed} - ${name}`)
}

const ON = { chatSound: true, ringtone: true, ringtoneVolume: 0.8 }
const OFF = { chatSound: true, ringtone: false, ringtoneVolume: 0.8 }
const VOL0 = { chatSound: true, ringtone: true, ringtoneVolume: 0 }

function fakeCtx(state = 'running') {
  const oscs = []
  const ctx = {
    currentTime: 0,
    state,
    resumed: 0,
    destination: {},
    resume() { this.resumed++; this.state = 'running' },
    createOscillator() {
      const o = { type: '', frequency: { value: 0 }, started: 0, stopped: 0, connect() {}, start() { this.started++ }, stop() { this.stopped++ } }
      oscs.push(o)
      return o
    },
    createGain() {
      return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }
    },
  }
  return { ctx, oscs }
}

function fakeTimers() {
  const intervals = []
  const timeouts = []
  return {
    intervals,
    timeouts,
    setIntervalFn(fn, ms) { const id = intervals.length; intervals.push({ fn, ms, cleared: false }); return id },
    clearIntervalFn(id) { if (intervals[id]) intervals[id].cleared = true },
    setTimeoutFn(fn, ms) { const id = timeouts.length; timeouts.push({ fn, ms, cleared: false }); return id },
    clearTimeoutFn(id) { if (timeouts[id]) timeouts[id].cleared = true },
  }
}

console.log('— রিংব্যাকের প্যাটার্ন —')
check('রিংব্যাক: একক ৪৪০ Hz টোন, ১ সেকেন্ড বার্স্ট, ৪ সেকেন্ড চক্র, ৬৫ সেকেন্ড সর্বোচ্চ', () => {
  assert.deepEqual(M.RINGBACK_FREQS, [440])
  assert.deepEqual(M.RINGBACK_BURSTS, [{ at: 0, dur: 1 }])
  assert.equal(M.RINGBACK_CYCLE_MS, 4000)
  assert.equal(M.RINGBACK_MAX_MS, 65000)
})
check('রিংব্যাক রিংটোনের মতোই সেটিংস মানে (বন্ধ/ভলিউম ০/চলমান কলে নয়)', () => {
  assert.equal(M.shouldPlayRingback(ON, false), true)
  assert.equal(M.shouldPlayRingback(OFF, false), false)
  assert.equal(M.shouldPlayRingback(VOL0, false), false)
  assert.equal(M.shouldPlayRingback(ON, true), false)
})

console.log('— fake AudioContext দিয়ে আসল বাজানো —')
check('কলকারী অপেক্ষায় রিংব্যাক বাজে — ১টি অসিলেটর, ৪৪০ Hz', () => {
  const f = fakeCtx()
  const t = fakeTimers()
  const stop = M.startRingback(ON, { getCtx: () => f.ctx, ...t })
  assert.equal(M.isRingbackPlaying(), true)
  assert.equal(f.oscs.length, 1)
  assert.equal(f.oscs[0].frequency.value, 440)
  assert.equal(f.oscs[0].started, 1)
  stop()
  assert.equal(M.isRingbackPlaying(), false)
})
check('রিংব্যাক চক্র ধরে বাজে — interval ফায়ার করলে আবার বাজে', () => {
  const f = fakeCtx()
  const t = fakeTimers()
  const stop = M.startRingback(ON, { getCtx: () => f.ctx, ...t })
  assert.equal(t.intervals.length, 1)
  assert.equal(t.intervals[0].ms, 4000)
  t.intervals[0].fn()
  assert.equal(f.oscs.length, 2)
  stop()
})
check('রিংব্যাক থামালে interval + timeout দুটোই পরিষ্কার হয়, অসিলেটর থামে', () => {
  const f = fakeCtx()
  const t = fakeTimers()
  const stop = M.startRingback(ON, { getCtx: () => f.ctx, ...t })
  stop()
  assert.equal(t.intervals[0].cleared, true)
  assert.equal(t.timeouts[0].cleared, true)
  // scheduleTone নিজেই stop() ডাকে (শেষের সময় বসিয়ে) — থামালে আবার ডাকা হয়
  assert.ok(f.oscs.every(o => o.stopped >= 1))
})
check('সর্বোচ্চ সময় (৬৫ সেকেন্ড) পূর্ণ হলে রিংব্যাক নিজে থামে', () => {
  const f = fakeCtx()
  const t = fakeTimers()
  M.startRingback(ON, { getCtx: () => f.ctx, ...t })
  assert.equal(t.timeouts.length, 1)
  assert.equal(t.timeouts[0].ms, 65000)
  t.timeouts[0].fn()
  assert.equal(M.isRingbackPlaying(), false)
})
check('সাউন্ড বন্ধ থাকলে রিংব্যাক শুরুই হয় না', () => {
  const f = fakeCtx()
  const t = fakeTimers()
  const stop = M.startRingback(OFF, { getCtx: () => f.ctx, ...t })
  assert.equal(M.isRingbackPlaying(), false)
  assert.equal(f.oscs.length, 0)
  assert.equal(typeof stop, 'function')
  stop()
})
check('রিংব্যাক আর রিংটোন একসাথে চলতে পারে — আলাদা স্লট', () => {
  const f = fakeCtx()
  const t = fakeTimers()
  const stopRb = M.startRingback(ON, { getCtx: () => f.ctx, ...t })
  const stopRt = M.startRingtone(ON, { getCtx: () => f.ctx, ...t })
  assert.equal(M.isRingbackPlaying(), true)
  assert.equal(M.isRingtonePlaying(), true)
  stopRb()
  assert.equal(M.isRingbackPlaying(), false)
  assert.equal(M.isRingtonePlaying(), true)
  stopRt()
  assert.equal(M.isRingtonePlaying(), false)
})
check('রিংটোনের পুরোনো আচরণ একই আছে (ডুয়াল-টোন, ৩ সেকেন্ড চক্র, ৬০ সেকেন্ড)', () => {
  assert.deepEqual(M.RING_FREQS, [440, 480])
  assert.equal(M.RING_CYCLE_MS, 3000)
  assert.equal(M.RINGTONE_MAX_MS, 60000)
})

console.log('— ওয়্যারিং (সোর্স-গঠন) —')
check('কলকারী: কল শুরুতে (লিংক-কল ছাড়া) রিংব্যাক শুরু হয়', () => {
  assert.ok(pagesSrc.includes('startRingback(soundSettings)'))
  assert.ok(pagesSrc.includes('if (!isLinkCall) {'))
})
check('রিংব্যাক থামে: সংযোগে, ব্যর্থতায়, কল শেষে, পেজ ছাড়লে', () => {
  assert.ok(pagesSrc.includes('if (connected) { stopRingback(); setRingingCall(null) }'))
  assert.ok(soundsSrc.includes('export function stopRingback'))
  // showCallFailure + endCallLocal + unmount — তিন জায়গাতেই stopRingback
  const hits = (pagesSrc.match(/stopRingback\(\)/g) || []).length
  assert.ok(hits >= 4, `stopRingback() ${hits} বার`)
})
check('গ্রহণকারী: ইনভাইট এলেই রিংটোন বাজে (Firestore-ইনভাইট পথ)', () => {
  assert.ok(overlaySrc.includes('if (shouldPlayRingtone(ss, false))'))
  assert.ok(overlaySrc.includes('ringStopRef.current = startRingtone(ss)'))
})
check('গ্রহণকারীর রিংটোন থামে: ধরলে/কাটলে/মেয়াদ শেষে (clearOverlay)', () => {
  assert.ok(overlaySrc.includes('const clearOverlay = () =>'))
  assert.ok(overlaySrc.includes('stopRingtone()'))
})
check('কল শেষে কোনো টোন বাজে না — endCallLocal-এ রিংব্যাক থামে', () => {
  assert.ok(pagesSrc.includes('stopRingback()'))
})

console.log(`\n${passed} passed`)
