// PiCall সাউন্ড — চ্যাট মেসেজের সাউন্ড + ইনকামিং কলের রিংটোন।
// একটাই WebAudio ইঞ্জিন, মোবাইল আর কম্পিউটারে একইভাবে চলে — ডেস্কটপ-অনলি
// বা মোবাইল-অনলি কোনো পথ নেই; সেটিংসও এক জায়গায় (মেনু + চ্যাট পেজের টগল)।
// বাইরের কোনো ফাইল ডাউনলোড হয় না — টোন WebAudio-তেই বানানো হয়।
// মোবাইল ব্রাউজার (Chrome/Safari) প্রথম ট্যাপের আগে AudioContext suspended
// রাখে — তাই unlockAudio()/installAudioUnlock() প্রথম pointer/touch-এ
// কনটেক্সট চালু করে; রিংটোন তখনো না বাজলে প্রথম ট্যাপেই শুরু হয়।

export type SoundSettings = {
  /** নতুন চ্যাট মেসেজ এলে সাউন্ড (ডিফল্ট চালু) */
  chatSound: boolean
  /** ইনকামিং কলে রিংটোন (ডিফল্ট চালু) */
  ringtone: boolean
  /** রিংটোনের ভলিউম ০–১ (ডিফল্ট ০.৮) */
  ringtoneVolume: number
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = { chatSound: true, ringtone: true, ringtoneVolume: 0.8 }

/** সংরক্ষিত সেটিংস ডিফল্টের সাথে মিলিয়ে নেওয়া — পুরোনো/অসম্পূর্ণ ডেটাতেও নিরাপদ। */
export function loadSoundSettings(raw: unknown): SoundSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<SoundSettings>
  const v = typeof r.ringtoneVolume === 'number' && Number.isFinite(r.ringtoneVolume)
    ? Math.min(1, Math.max(0, r.ringtoneVolume)) : DEFAULT_SOUND_SETTINGS.ringtoneVolume
  return {
    chatSound: typeof r.chatSound === 'boolean' ? r.chatSound : DEFAULT_SOUND_SETTINGS.chatSound,
    ringtone: typeof r.ringtone === 'boolean' ? r.ringtone : DEFAULT_SOUND_SETTINGS.ringtone,
    ringtoneVolume: v,
  }
}

// ---------- টোনের তথ্য (pure data — টেস্টে যাচাই করা যায়) ----------

/** চ্যাট "পপ" — দুটি ছোট নোট, মোট ০.২ সেকেন্ডেরও কম। */
export const CHAT_NOTES: { freq: number; at: number; dur: number; gain: number }[] = [
  { freq: 880, at: 0, dur: 0.07, gain: 0.18 },
  { freq: 1318.5, at: 0.08, dur: 0.1, gain: 0.18 },
]

/** রিংটোন — ক্লাসিক ডুয়াল-টোন (৪৪০ + ৪৮০ Hz): ০.৪ সেকেন্ড বাজে, ০.২ বিরতি,
 *  আবার ০.৪ সেকেন্ড বাজে, তারপর ২ সেকেন্ড চুপ — এক চক্র ৩ সেকেন্ড। */
export const RING_FREQS = [440, 480]
export const RING_BURSTS: { at: number; dur: number }[] = [
  { at: 0, dur: 0.4 },
  { at: 0.6, dur: 0.4 },
]
export const RING_CYCLE_MS = 3000
/** রিংটোন নিজে থেকে থামে — উত্তর/কাটা না হলে সর্বোচ্চ ৬০ সেকেন্ড বাজে। */
export const RINGTONE_MAX_MS = 60000

// ---------- শর্ত (pure predicates) ----------

export function shouldPlayChatSound(s: SoundSettings): boolean {
  return s.chatSound === true
}

export function shouldPlayRingtone(s: SoundSettings, inCall: boolean): boolean {
  if (inCall) return false
  if (s.ringtone !== true) return false
  if (!(s.ringtoneVolume > 0)) return false
  return true
}

// ---------- কল-চলা অবস্থা (রিংটোন যেন চলমান কলে না বাজে) ----------

let inCallActive = false
export function setInCallActive(v: boolean): void { inCallActive = v }
export function isInCallActive(): boolean { return inCallActive }

// ---------- WebAudio — মোবাইল/ডেস্কটপ একই পথ ----------

/** টেস্টে fake context দেওয়া যায় — আসল AudioContext এই আকৃতি মেনে চলে। */
export type ToneOscillator = {
  type: string
  frequency: { value: number }
  connect: (dest: unknown) => void
  start: (when?: number) => void
  stop: (when?: number) => void
}
export type ToneGain = {
  gain: {
    value: number
    setValueAtTime: (v: number, t: number) => void
    linearRampToValueAtTime: (v: number, t: number) => void
    exponentialRampToValueAtTime: (v: number, t: number) => void
  }
  connect: (dest: unknown) => void
}
export interface ToneAudioContext {
  currentTime: number
  state?: string
  resume?: () => void | Promise<void>
  createOscillator: () => ToneOscillator
  createGain: () => ToneGain
  destination: unknown
}

let sharedCtx: ToneAudioContext | null = null
let unlockInstalled = false

function createSharedCtx(): ToneAudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = (window as unknown as { AudioContext?: new () => ToneAudioContext; webkitAudioContext?: new () => ToneAudioContext }).AudioContext
    ?? (window as unknown as { webkitAudioContext?: new () => ToneAudioContext }).webkitAudioContext
  if (!AC) return null
  try { return new AC() } catch { return null }
}

/** শেয়ার্ড AudioContext — মোবাইল/ডেস্কটপ একই। */
export function getSharedAudioContext(): ToneAudioContext | null {
  if (!sharedCtx) sharedCtx = createSharedCtx()
  return sharedCtx
}

/** সাসপেন্ডেড কনটেক্সট চালু করার চেষ্টা (মোবাইলে প্রথম ট্যাপের আগে লাগে)। */
export function unlockAudio(ctx?: ToneAudioContext | null): boolean {
  const c = ctx ?? getSharedAudioContext()
  if (!c) return false
  // resume() ডাকার পর state বদলাতে পারে — তাই আগের মান আলাদা ভ্যারিয়েবলে রেখে
  // (সরাসরি if-এ লিখলে TS state-কে 'suspended'-এ আটকে দেয়)
  const wasSuspended = c.state === 'suspended'
  if (wasSuspended) {
    try { const r = c.resume?.(); if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => { /* ignore */ }) } catch { /* ignore */ }
  }
  return c.state === 'running' || c.state === undefined
}

/**
 * প্রথম pointer/touch-এ অডিও আনলক — মোবাইল আর কম্পিউটার দুটোতেই চলে
 * (pointerdown ডেস্কটপ মাউসেও ফায়ার করে, touchstart পুরোনো মোবাইল ব্রাউজারে)।
 * একবারই বসে; onUnlocked থাকলে আনলকের পর ডাকা হয় (যেমন রিংটোন আবার চেষ্টা)।
 */
export function installAudioUnlock(onUnlocked?: () => void): () => void {
  if (typeof window === 'undefined' || unlockInstalled) return () => {}
  unlockInstalled = true
  const handler = () => {
    unlockAudio()
    onUnlocked?.()
  }
  window.addEventListener('pointerdown', handler, { once: true })
  window.addEventListener('touchstart', handler, { once: true })
  return () => {
    window.removeEventListener('pointerdown', handler)
    window.removeEventListener('touchstart', handler)
    unlockInstalled = false
  }
}

function scheduleTone(ctx: ToneAudioContext, freq: number, at: number, dur: number, peak: number): ToneOscillator | null {
  try {
    const t0 = ctx.currentTime + at
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, t0)
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
    return osc
  } catch { return null }
}

export type SoundDeps = {
  getCtx?: () => ToneAudioContext | null
}

/** চ্যাট মেসেজের "পপ" সাউন্ড — সেটিং বন্ধ থাকলে বা অডিও না থাকলে কিছুই বাজে না। */
export function playChatSound(settings: SoundSettings, deps: SoundDeps = {}): boolean {
  if (!shouldPlayChatSound(settings)) return false
  const ctx = (deps.getCtx ?? getSharedAudioContext)()
  if (!ctx) return false
  unlockAudio(ctx)
  let played = false
  for (const n of CHAT_NOTES) {
    if (scheduleTone(ctx, n.freq, n.at, n.dur, n.gain)) played = true
  }
  return played
}

export type RingtoneDeps = SoundDeps & {
  setIntervalFn?: (fn: () => void, ms: number) => unknown
  clearIntervalFn?: (id: unknown) => void
  setTimeoutFn?: (fn: () => void, ms: number) => unknown
  clearTimeoutFn?: (id: unknown) => void
}

let ringingStop: (() => void) | null = null
export function isRingtonePlaying(): boolean { return ringingStop !== null }

function playRingCycle(ctx: ToneAudioContext, volume: number): ToneOscillator[] {
  const oscs: ToneOscillator[] = []
  for (const b of RING_BURSTS) {
    for (const f of RING_FREQS) {
      const o = scheduleTone(ctx, f, b.at, b.dur, volume * 0.22)
      if (o) oscs.push(o)
    }
  }
  return oscs
}

/**
 * ইনকামিং কলের রিংটোন — চক্র ধরে বাজতে থাকে, যতক্ষণ না stop() ডাকা হয়
 * (ধরা/কাটা/আনমাউন্ট) বা ৬০ সেকেন্ড পূর্ণ হয়। চলমান কলে, সেটিং বন্ধ থাকলে
 * বা ভলিউম ০ হলে বাজে না। মোবাইলে কনটেক্সট সাসপেন্ডেড থাকলে প্রথম ট্যাপে
 * আনলক হয়ে নিজে থেকেই শুরু হয় — stop ফাংশন তখনো বৈধ থাকে।
 */
export function startRingtone(settings: SoundSettings, deps: RingtoneDeps = {}): () => void {
  if (ringingStop) return ringingStop
  if (!shouldPlayRingtone(settings, isInCallActive())) return () => {}
  const getCtx = deps.getCtx ?? getSharedAudioContext
  const setI = deps.setIntervalFn ?? ((fn: () => void, ms: number) => setInterval(fn, ms))
  const clearI = deps.clearIntervalFn ?? ((id: unknown) => clearInterval(id as number))
  const setT = deps.setTimeoutFn ?? ((fn: () => void, ms: number) => setTimeout(fn, ms))
  const clearT = deps.clearTimeoutFn ?? ((id: unknown) => clearTimeout(id as number))
  const ctx = getCtx()
  if (!ctx) return () => {}
  const volume = settings.ringtoneVolume
  let oscs: ToneOscillator[] = []
  let stopped = false
  let intervalId: unknown = null
  let timeoutId: unknown = null
  const ringOnce = () => { if (!stopped) oscs = [...oscs, ...playRingCycle(ctx, volume)] }
  const stop = () => {
    if (stopped) return
    stopped = true
    if (intervalId !== null) clearI(intervalId)
    if (timeoutId !== null) clearT(timeoutId)
    for (const o of oscs) { try { o.stop() } catch { /* ignore */ } }
    oscs = []
    if (ringingStop === stop) ringingStop = null
  }
  ringingStop = stop
  // মোবাইলে সাসপেন্ডেড থাকলে প্রথম ট্যাপেই আনলক + রিং শুরু (একই সেটিংসে)
  if (ctx.state === 'suspended') {
    unlockAudio(ctx)
    installAudioUnlock(() => { if (!stopped && ringingStop === stop) ringOnce() })
  }
  ringOnce()
  intervalId = setI(() => ringOnce(), RING_CYCLE_MS)
  timeoutId = setT(() => stop(), RINGTONE_MAX_MS)
  return stop
}

/** রিংটোনের এক চক্র — সেটিংস পেজের "শুনুন" বোতামের জন্য। */
export function playRingtoneOnce(settings: SoundSettings, deps: SoundDeps = {}): boolean {
  if (!shouldPlayRingtone(settings, isInCallActive())) return false
  const ctx = (deps.getCtx ?? getSharedAudioContext)()
  if (!ctx) return false
  unlockAudio(ctx)
  return playRingCycle(ctx, settings.ringtoneVolume).length > 0
}
