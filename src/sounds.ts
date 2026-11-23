// PiCall — সাউন্ড সেটিংস + ইনকামিং-কল রিংটোন।
// মেরামত: remote head e085798e-এর store.tsx এই ফাইল থেকে ইমপোর্ট করে
// (DEFAULT_SOUND_SETTINGS, loadSoundSettings, SoundSettings), আর
// IncomingCallOverlay shouldPlayRingtone/startRingtone ব্যবহার করে —
// কিন্তু ফাইলটা রিপোতে ছিল না, তাই typecheck/build ভাঙা ছিল। এই ফাইল
// শুধু কোডে ব্যবহৃত API-টুকুই দেয়; কোনো অডিও ফাইল লাগে না (WebAudio)।
export type SoundSettings = {
  // ইনকামিং কলে রিংটোন বাজবে কি না
  ringtoneEnabled: boolean
  // রিংটোনের জোর (০..১)
  volume: number
}

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  ringtoneEnabled: true,
  volume: 0.8,
}

// পুরোনো সংরক্ষণ (আংশিক/ভুল মান) → সবসময় বৈধ সেটিংস; কিছু না থাকলে ডিফল্ট।
export function loadSoundSettings(raw: unknown): SoundSettings {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Partial<SoundSettings>
  return {
    ringtoneEnabled: typeof v.ringtoneEnabled === 'boolean' ? v.ringtoneEnabled : DEFAULT_SOUND_SETTINGS.ringtoneEnabled,
    volume: typeof v.volume === 'number' && v.volume >= 0 && v.volume <= 1 ? v.volume : DEFAULT_SOUND_SETTINGS.volume,
  }
}

// রিংটোন বাজবে কি না — বন্ধ থাকলে বা ইতিমধ্যে কলে থাকলে নয়।
export function shouldPlayRingtone(s: SoundSettings, isInCall: boolean): boolean {
  return s.ringtoneEnabled && !isInCall
}

// রিংটোন চালু করে; ফেরত ফাংশন ডাকলে থামে। WebAudio-তে বীপ বাজে (১ সেকেন্ড
// পরপর) — কোনো অডিও ফাইল লাগে না। চালু না হলে null ফেরে (ক্র্যাশ করে না)।
export function startRingtone(s: SoundSettings): (() => void) | null {
  try {
    const Ctx = window.AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    const ctx = new Ctx()
    const gain = ctx.createGain()
    gain.gain.value = s.volume
    gain.connect(ctx.destination)
    let stopped = false
    const beep = () => {
      if (stopped) return
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 880
      osc.connect(gain)
      osc.start()
      osc.stop(ctx.currentTime + 0.4)
    }
    beep()
    const timer = setInterval(beep, 1000)
    return () => {
      stopped = true
      clearInterval(timer)
      try { void ctx.close() } catch { /* ignore */ }
    }
  } catch {
    return null
  }
}
