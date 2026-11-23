// সাউন্ড টেস্ট — চ্যাট সাউন্ড + ইনকামিং কল রিংটোন; মোবাইল/কম্পিউটার একই আচরণ।
// চালানো: রিপো রুট থেকে `node tests/sounds.test.mjs`
// (src/sounds.ts-এর pure logic esbuild দিয়ে বান্ডল করে চালায়; store/pages-এর
//  গঠন সোর্স পড়ে যাচাই করে — Firebase/React লাগে না।)
import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const storeSrc = readFileSync(join(root, 'src/store.tsx'), 'utf8')
const pagesSrc = readFileSync(join(root, 'src/pages.tsx'), 'utf8')
const appSrc = readFileSync(join(root, 'src/App.tsx'), 'utf8')
const soundsSrc = readFileSync(join(root, 'src/sounds.ts'), 'utf8')

const outDir = mkdtempSync(join(tmpdir(), 'picall-sounds-test-'))
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

let passed = 0
function check(name, fn) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log('— defaults + settings merge —')
check('ডিফল্ট: চ্যাট সাউন্ড চালু, রিংটোন চালু, ভলিউম ০.৮', () => {
  assert.deepEqual(M.DEFAULT_SOUND_SETTINGS, { chatSound: true, ringtone: true, ringtoneVolume: 0.8 })
})
check('খালি/অসম্পূর্ণ সংরক্ষণ ডিফল্টে মেশে', () => {
  assert.deepEqual(M.loadSoundSettings(null), M.DEFAULT_SOUND_SETTINGS)
  assert.deepEqual(M.loadSoundSettings({}), M.DEFAULT_SOUND_SETTINGS)
  assert.deepEqual(M.loadSoundSettings({ chatSound: false }), { chatSound: false, ringtone: true, ringtoneVolume: 0.8 })
})
check('ভলিউম ০–১-এ আটকায়, NaN হলে ডিফল্ট', () => {
  assert.equal(M.loadSoundSettings({ ringtoneVolume: 2 }).ringtoneVolume, 1)
  assert.equal(M.loadSoundSettings({ ringtoneVolume: -1 }).ringtoneVolume, 0)
  assert.equal(M.loadSoundSettings({ ringtoneVolume: NaN }).ringtoneVolume, 0.8)
  assert.equal(M.loadSoundSettings({ ringtoneVolume: 'loud' }).ringtoneVolume, 0.8)
})

console.log('— শর্ত (predicates) —')
check('চ্যাট সাউন্ড বন্ধ থাকলে বাজবে না', () => {
  assert.equal(M.shouldPlayChatSound({ chatSound: true, ringtone: true, ringtoneVolume: 0.8 }), true)
  assert.equal(M.shouldPlayChatSound({ chatSound: false, ringtone: true, ringtoneVolume: 0.8 }), false)
})
check('রিংটোন: বন্ধ / ভলিউম ০ / চলমান কল — কোনোটাতেই বাজবে না', () => {
  const on = { chatSound: true, ringtone: true, ringtoneVolume: 0.8 }
  assert.equal(M.shouldPlayRingtone(on, false), true)
  assert.equal(M.shouldPlayRingtone({ ...on, ringtone: false }, false), false)
  assert.equal(M.shouldPlayRingtone({ ...on, ringtoneVolume: 0 }, false), false)
  assert.equal(M.shouldPlayRingtone(on, true), false)
})

console.log('— টোনের তথ্য —')
check('চ্যাট "পপ": ২ নোট, মোট ০.৫ সেকেন্ডের কম', () => {
  assert.equal(M.CHAT_NOTES.length, 2)
  for (const n of M.CHAT_NOTES) assert.ok(n.freq > 0 && n.dur > 0 && n.dur < 0.5)
  const total = Math.max(...M.CHAT_NOTES.map(n => n.at + n.dur))
  assert.ok(total < 0.5, `total ${total}`)
})
check('রিংটোন চক্র: ২ বার্স্ট, ৩ সেকেন্ড চক্র, ৬০ সেকেন্ড সর্বোচ্চ', () => {
  assert.equal(M.RING_BURSTS.length, 2)
  assert.equal(M.RING_CYCLE_MS, 3000)
  assert.equal(M.RINGTONE_MAX_MS, 60000)
  assert.ok(M.RING_FREQS.length >= 2)
  const end = Math.max(...M.RING_BURSTS.map(b => b.at + b.dur))
  assert.ok(end < M.RING_CYCLE_MS / 1000, 'বার্স্ট চক্রের ভেতরে')
})

console.log('— fake AudioContext দিয়ে আসল বাজানো —')
function fakeCtx(state = 'running') {
  const oscs = []
  const gains = []
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
      const g = { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }
      gains.push(g)
      return g
    },
  }
  return { ctx, oscs, gains }
}

check('চ্যাট সাউন্ড চালু থাকলে ২টি অসিলেটর বাজে', () => {
  const f = fakeCtx()
  const ok = M.playChatSound(M.DEFAULT_SOUND_SETTINGS, { getCtx: () => f.ctx })
  assert.equal(ok, true)
  assert.equal(f.oscs.length, 2)
  assert.ok(f.oscs.every(o => o.started === 1))
})
check('চ্যাট সাউন্ড বন্ধ থাকলে কিছুই বাজে না', () => {
  const f = fakeCtx()
  const ok = M.playChatSound({ ...M.DEFAULT_SOUND_SETTINGS, chatSound: false }, { getCtx: () => f.ctx })
  assert.equal(ok, false)
  assert.equal(f.oscs.length, 0)
})
check('অডিও না থাকলে (ctx null) ক্র্যাশ নয়, false', () => {
  assert.equal(M.playChatSound(M.DEFAULT_SOUND_SETTINGS, { getCtx: () => null }), false)
  assert.equal(M.playRingtoneOnce(M.DEFAULT_SOUND_SETTINGS, { getCtx: () => null }), false)
})
check('সাসপেন্ডেড কনটেক্সট আনলক হয় (মোবাইলে প্রথম ট্যাপের আগে লাগে)', () => {
  const f = fakeCtx('suspended')
  assert.equal(M.unlockAudio(f.ctx), true)
  assert.equal(f.ctx.resumed, 1)
  assert.equal(f.ctx.state, 'running')
})
check('installAudioUnlock Node-এ ক্র্যাশ করে না (window নেই)', () => {
  assert.equal(typeof M.installAudioUnlock(), 'function')
})

// রিংটোন — fake টাইমার দিয়ে চক্র/থামা/অটো-স্টপ যাচাই
function fakeTimers() {
  const intervals = new Map()
  const timeouts = new Map()
  let next = 1
  return {
    intervals, timeouts,
    setIntervalFn(fn, ms) { const id = next++; intervals.set(id, { fn, ms }); return id },
    clearIntervalFn(id) { intervals.delete(id) },
    setTimeoutFn(fn, ms) { const id = next++; timeouts.set(id, { fn, ms }); return id },
    clearTimeoutFn(id) { timeouts.delete(id) },
  }
}

check('রিংটোন শুরু → চক্র বাজে; stop() ডাকলে অসিলেটর থামে + টাইমার মোছে', () => {
  const f = fakeCtx()
  const t = fakeTimers()
  const stop = M.startRingtone(M.DEFAULT_SOUND_SETTINGS, { getCtx: () => f.ctx, ...t })
  assert.equal(M.isRingtonePlaying(), true)
  assert.ok(f.oscs.length > 0, 'প্রথম চক্র বেজেছে')
  assert.equal(t.intervals.size, 1)
  const before = f.oscs.length
  t.intervals.forEach(({ fn }) => fn())
  assert.ok(f.oscs.length > before, 'পরের চক্রেও বাজে')
  stop()
  assert.equal(M.isRingtonePlaying(), false)
  assert.equal(t.intervals.size, 0)
  assert.equal(t.timeouts.size, 0)
  assert.ok(f.oscs.every(o => o.stopped >= 1), 'সব অসিলেটর থেমেছে')
})
check('দুবার startRingtone ডাকলে দ্বিতীয়বার নতুন রিং শুরু হয় না', () => {
  const f = fakeCtx()
  const t = fakeTimers()
  const s1 = M.startRingtone(M.DEFAULT_SOUND_SETTINGS, { getCtx: () => f.ctx, ...t })
  const count = f.oscs.length
  const s2 = M.startRingtone(M.DEFAULT_SOUND_SETTINGS, { getCtx: () => f.ctx, ...t })
  assert.equal(s2, s1)
  assert.equal(f.oscs.length, count)
  s1()
})
check('৬০ সেকেন্ড পূর্ণ হলে রিংটোন নিজে থেকেই থামে', () => {
  const f = fakeCtx()
  const t = fakeTimers()
  M.startRingtone(M.DEFAULT_SOUND_SETTINGS, { getCtx: () => f.ctx, ...t })
  assert.equal(t.timeouts.size, 1)
  const to = [...t.timeouts.values()][0]
  assert.equal(to.ms, 60000)
  to.fn()
  assert.equal(M.isRingtonePlaying(), false)
  assert.equal(t.intervals.size, 0)
  assert.ok(f.oscs.every(o => o.stopped >= 1))
})
check('চলমান কলে রিংটোন বাজে না; কল শেষে আবার বাজে', () => {
  const f = fakeCtx()
  const t = fakeTimers()
  M.setInCallActive(true)
  const stop = M.startRingtone(M.DEFAULT_SOUND_SETTINGS, { getCtx: () => f.ctx, ...t })
  assert.equal(M.isRingtonePlaying(), false)
  assert.equal(f.oscs.length, 0)
  stop()
  M.setInCallActive(false)
  const stop2 = M.startRingtone(M.DEFAULT_SOUND_SETTINGS, { getCtx: () => f.ctx, ...t })
  assert.equal(M.isRingtonePlaying(), true)
  assert.ok(f.oscs.length > 0)
  stop2()
  assert.equal(M.isRingtonePlaying(), false)
})
check('রিংটোন বন্ধ থাকলে / ভলিউম ০ হলে playRingtoneOnce বাজে না', () => {
  const f = fakeCtx()
  assert.equal(M.playRingtoneOnce({ ...M.DEFAULT_SOUND_SETTINGS, ringtone: false }, { getCtx: () => f.ctx }), false)
  assert.equal(M.playRingtoneOnce({ ...M.DEFAULT_SOUND_SETTINGS, ringtoneVolume: 0 }, { getCtx: () => f.ctx }), false)
  assert.equal(f.oscs.length, 0)
})

console.log('— সোর্স গঠন (store/pages/App) —')
check('store-এ soundSettings + setter + localStorage সংরক্ষণ', () => {
  assert.ok(storeSrc.includes('soundSettings: SoundSettings'), 'Store type-এ soundSettings নেই')
  assert.ok(storeSrc.includes('setSoundSettings'), 'setSoundSettings নেই')
  assert.ok(storeSrc.includes("save('soundSettings'"), 'soundSettings সংরক্ষণ নেই')
  assert.ok(storeSrc.includes('loadSoundSettings'), 'loadSoundSettings ব্যবহার নেই')
})
check('ChatPage: বন্ধুর উত্তরে চ্যাট সাউন্ড + টগল বোতাম', () => {
  assert.ok(pagesSrc.includes('playChatSound(soundSettings)'), 'playChatSound কল নেই')
  assert.ok(pagesSrc.includes('Sound on — tap to turn off'), 'চ্যাট টগল নেই')
})
check('CallPage: ইন-কল চ্যাটে সাউন্ড + ইনকামিং পর্দায় রিংটোন + চলমান-কল ফ্ল্যাগ', () => {
  assert.ok(pagesSrc.includes('startRingtone(soundSettings)'), 'startRingtone কল নেই')
  assert.ok(pagesSrc.includes("linkState !== 'ready'"), 'রিংটোন শুধু ধরার আগের পর্দায় — শর্ত নেই')
  assert.ok(pagesSrc.includes('setInCallActive(connected)'), 'ইন-কল ফ্ল্যাগ নেই')
})
check('লাইভ চ্যাটেও (দর্শক + হোস্ট) সাউন্ড', () => {
  assert.ok(pagesSrc.includes('setChat(c => [...c, { from, text }]); playChatSound(soundSettings)'), 'দর্শক লাইভ চ্যাটে সাউন্ড নেই')
  assert.ok(pagesSrc.includes('setHostChat(c => [...c.slice(-19), { from, text }]); playChatSound(soundSettings)'), 'হোস্ট লাইভ চ্যাটে সাউন্ড নেই')
})
check('MenuPage: একটাই সাউন্ড সেটিংস কার্ড — টগল + ভলিউম + শোনার বোতাম', () => {
  assert.ok(pagesSrc.includes('🔔 Sound Settings'), 'মেনু সাউন্ড কার্ড নেই')
  assert.ok(pagesSrc.includes('Ringtone volume'), 'ভলিউম স্লাইডার নেই')
  assert.ok(pagesSrc.includes('playRingtoneOnce(soundSettings)'), 'রিংটোন শোনার বোতাম নেই')
  assert.ok(pagesSrc.includes('Hear chat sound'), 'চ্যাট সাউন্ড শোনার বোতাম নেই')
})
check('App: অডিও আনলক একবার বসে (মোবাইল/ডেস্কটপ একই)', () => {
  assert.ok(appSrc.includes('installAudioUnlock()'), 'App-এ installAudioUnlock নেই')
})
check('ইনকামিং-কল ওভারলে যে সাউন্ড ফাংশন চায়, সেগুলো sounds.ts-এ আছে', () => {
  // ওভারলেটি আরেকটি এজেন্টের কাজ — তার import-এর সাথে এই ইঞ্জিনের API মিলতেই হবে
  let overlaySrc = ''
  try { overlaySrc = readFileSync(join(root, 'src/IncomingCallOverlay.tsx'), 'utf8') } catch { /* ওভারলে না থাকলে এই চেক প্রযোজ্য নয় */ }
  if (!overlaySrc) return
  const m = overlaySrc.match(/from '\.\/sounds'/)
  assert.ok(m, 'ওভারলে sounds.ts থেকে import করে না')
  for (const fn of ['shouldPlayRingtone', 'startRingtone']) {
    assert.ok(overlaySrc.includes(fn), `ওভারলে ${fn} চায়`)
    assert.ok(new RegExp(`export function ${fn}\\b`).test(soundsSrc), `sounds.ts-এ ${fn} export নেই`)
  }
})
check('মোবাইল-অনলি / ডেস্কটপ-অনলি কোনো পথ নেই — isMobile/userAgent গেট নেই', () => {
  for (const [name, src] of [['sounds.ts', soundsSrc], ['pages.tsx', pagesSrc], ['store.tsx', storeSrc]]) {
    assert.ok(!src.includes('isMobile'), `${name}-এ isMobile গেট আছে`)
    assert.ok(!src.includes('userAgent'), `${name}-এ userAgent গেট আছে`)
  }
})

console.log(`\nসাউন্ড টেস্ট: ${passed} পাস`)
