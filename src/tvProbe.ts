// Live TV channel probe — "working" means the channel actually PLAYS when tapped.
// যাচাইটা URL পিং নয়: HLS স্ট্রিমের প্লেলিস্ট আসলেই লোড হয় কি না (hls.js
// MANIFEST_PARSED), আর সরাসরি ভিডিও হলে loadedmetadata/canplay পর্যন্ত যাওয়া
// হয়। প্লেলিস্ট না এলে / ভিডিও না খুললে / সময় শেষ হলে চ্যানেলটা "চলে না"।
// অ্যাপে ঢুকলে (App মাউন্টে, লগইন থাকলে) একবার যাচাই হয়, আর Live TV
// খুললে আবার নতুন করে যাচাই হয় (সেশন-ক্যাশ মুছে) — চলা চ্যানেল
// উপরে, না-চলা নিচে; যাচাই চলাকালীন তালিকা আগের ক্রমেই থাকে, ফল এলে
// ধাপে ধাপে সাজে। ফল এই পেজ-সেশনের ক্যাশে থাকে (রিলোড = নতুন যাচাই)।
import Hls from 'hls.js'

export type ProbeStatus = boolean | undefined // true = plays, false = does not play, undefined = not checked yet

/** এই পেজ-সেশনের যাচাই-ফল — রিলোড হলে মুছে যায়, অ্যাপে আবার ঢুকলে আবার যাচাই হয়। */
const sessionResults = new Map<string, boolean>()

export function getCachedProbe(url: string): ProbeStatus {
  return sessionResults.get(url)
}

export function setCachedProbe(url: string, plays: boolean): void {
  sessionResults.set(url, plays)
}

export function clearProbeCache(): void {
  sessionResults.clear()
}

/** HLS প্লেলিস্ট (.m3u8) না সরাসরি ভিডিও — প্রোবের পথ এখানেই ঠিক হয়। */
export function isHlsUrl(url: string): boolean {
  return /\.m3u8(\?|$)/i.test(url)
}

export type ProbeLoader = (url: string, timeoutMs: number) => Promise<boolean>

/**
 * আসল প্রোব — ভিডিও এলিমেন্টে স্ট্রিমটা লোড করে দেখা হয়।
 * HLS হলে hls.js-এ MANIFEST_PARSED (প্লেলিস্ট এলো + পার্স হলো = চালানো যাবে);
 * নেটিভ HLS/সরাসরি ভিডিও হলে loadedmetadata/canplay। ERROR/timeout = চলে না।
 */
export function realProbeLoader(url: string, timeoutMs: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      resolve(ok)
    }
    const timer = window.setTimeout(() => finish(false), timeoutMs)
    try {
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.preload = 'auto'
      const cleanup = () => {
        try { video.removeAttribute('src'); video.load() } catch { /* ignore */ }
      }
      if (isHlsUrl(url) && Hls.isSupported()) {
        const hls = new Hls({ maxBufferLength: 2 })
        hls.on(Hls.Events.MANIFEST_PARSED, () => { hls.destroy(); cleanup(); finish(true) })
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) { hls.destroy(); cleanup(); finish(false) }
        })
        hls.loadSource(url)
        hls.attachMedia(video)
        // ভিডিও চালানো হয় না — প্লেলিস্ট পার্স হলেই যথেষ্ট (চালানো যাবে)।
        return
      }
      video.addEventListener('loadedmetadata', () => { cleanup(); finish(true) })
      video.addEventListener('canplay', () => { cleanup(); finish(true) })
      video.addEventListener('error', () => { cleanup(); finish(false) })
      video.src = url
      // কিছু ব্রাউজারে load() না ডাকলে লোড শুরু হয় না
      try { video.load() } catch { /* ignore */ }
    } catch {
      finish(false)
    }
  })
}

/**
 * চ্যানেল সাজানো — চলে এমন আগে (আগের ক্রমেই), যাচাই হয়নি এমন মাঝে,
 * চলে না এমন শেষে। স্থিতিশীল সাজানো: সমান অবস্থার ক্রম বদলায় না।
 */
export function sortChannelsByPlayability<T extends { id: string; streamUrl?: string }>(
  channels: T[],
  status: Record<string, ProbeStatus>,
): T[] {
  const rank = (c: T): number => {
    const s = c.streamUrl ? status[c.streamUrl] : false
    return s === true ? 0 : s === undefined ? 1 : 2
  }
  return [...channels]
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i)
    .map(({ c }) => c)
}

export type ProbeProgress = (url: string, plays: boolean) => void

/**
 * একগুচ্ছ চ্যানেল যাচাই — একসাথে সীমিত সংখ্যক (concurrency), ফল এলে
 * onProgress-এ জানানো হয় (তালিকা ধাপে ধাপে সাজে)। ক্যাশে থাকা ফল আবার
 * যাচাই করা হয় না — সেগুলো onProgress-এ সঙ্গে সঙ্গে জানানো হয়।
 */
export async function probeChannels(
  urls: string[],
  opts: { concurrency?: number; timeoutMs?: number; loader?: ProbeLoader; onProgress?: ProbeProgress } = {},
): Promise<Record<string, boolean>> {
  const concurrency = Math.max(1, opts.concurrency ?? 6)
  const timeoutMs = opts.timeoutMs ?? 5000
  const loader = opts.loader ?? realProbeLoader
  const results: Record<string, boolean> = {}
  const queue = [...new Set(urls.filter(Boolean))]
  // ক্যাশে থাকা ফল — নেটওয়ার্ক ছোঁয়া হয় না
  const pending: string[] = []
  for (const url of queue) {
    const cached = getCachedProbe(url)
    if (cached !== undefined) {
      results[url] = cached
      opts.onProgress?.(url, cached)
    } else {
      pending.push(url)
    }
  }
  let next = 0
  const workers = Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
    while (next < pending.length) {
      const url = pending[next++]
      let plays = false
      try {
        // লোডারের নিজের timeout-ই আসল সীমা; তবু গার্ড থাকে — ভাঙা
        // লোডার আটকে থাকলেও প্রোব শেষ হয় (false ধরা হয়)।
        const guard = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs + 1000))
        plays = await Promise.race([loader(url, timeoutMs), guard])
      } catch {
        plays = false
      }
      setCachedProbe(url, plays)
      results[url] = plays
      opts.onProgress?.(url, plays)
    }
  })
  await Promise.all(workers)
  return results
}
